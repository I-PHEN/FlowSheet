/**
 * POST /api/tts — text-to-speech for tour narration.
 *
 * Body: { text: string }  →  audio/wav (24 kHz mono)
 *
 * - Sanitizes flowsheet prose into spoken form (H2 → "H two", −20 °C →
 *   "minus 20 degrees Celsius", V-103 → "V one oh three") so the voice
 *   sounds like an engineer, not a screen reader.
 * - Enforces the SDK's 1024-character cap (truncates at sentence boundary).
 * - Caches rendered audio by spoken text in memory — revisiting a tour step
 *   is instant and costs no quota.
 * - All SDK access stays server-side; the browser only fetches this route.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { toSpoken } from '@/lib/audio/spoken';

export const runtime = 'nodejs';
export const maxDuration = 120;

const VOICE = 'jam'; // calm British narrator — explainer-video register
const SPEED = 1.15; // measured ~87 wpm at 1.0; 1.15 ≈ a relaxed teaching pace
const MAX_INPUT = 1200; // raw text we accept (spoken is trimmed to 1024)

let zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function client() {
  if (!zai) zai = await ZAI.create();
  return zai;
}

/** rendered-audio cache, keyed by spoken text (bounded, LRU-ish) */
const CACHE_MAX = 64;
const cache = new Map<string, Buffer>();

function cacheGet(key: string): Buffer | null {
  const hit = cache.get(key);
  if (hit) {
    // refresh recency
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit ?? null;
}

function cacheSet(key: string, body: Buffer) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, body);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** keep at most 1024 chars, preferring a sentence boundary */
function clampSpoken(spoken: string): string {
  if (spoken.length <= 1024) return spoken;
  const cut = spoken.slice(0, 1024);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop > 200) return cut.slice(0, stop + 1);
  return cut.slice(0, 1000).trimEnd() + '.';
}

async function render(spoken: string): Promise<Buffer> {
  const c = await client();
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await c.audio.tts.create({
        input: spoken,
        voice: VOICE,
        speed: SPEED,
        response_format: 'wav',
        stream: false,
      });
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(new Uint8Array(arrayBuffer));
      if (buffer.length < 200) throw new Error(`suspiciously small audio (${buffer.length} bytes)`);
      return buffer;
    } catch (e) {
      lastErr = (e as Error).message ?? String(e);
      const rateLimited = /429|too many requests/i.test(lastErr);
      if (attempt === 3) throw new Error(lastErr);
      await new Promise((r) => setTimeout(r, rateLimited ? 4000 * attempt : 600 * attempt));
    }
  }
  throw new Error(lastErr || 'tts failed');
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    const body = (await req.json()) as { text?: unknown } | null;
    raw = body?.text;
  } catch {
    raw = null;
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return Response.json({ error: 'a non-empty "text" string is required' }, { status: 400 });
  }
  const text = raw.length > MAX_INPUT ? raw.slice(0, MAX_INPUT) : raw;

  const spoken = clampSpoken(toSpoken(text));

  const cached = cacheGet(spoken);
  if (cached) {
    return new Response(new Uint8Array(cached), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(cached.length) },
    });
  }

  try {
    const buffer = await render(spoken);
    cacheSet(spoken, buffer);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(buffer.length) },
    });
  } catch (e) {
    console.error('[api/tts] render failed:', (e as Error).message);
    return Response.json({ error: 'voice generation failed' }, { status: 503 });
  }
}
