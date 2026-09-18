/**
 * LLM adapter — role calls over z-ai-web-dev-sdk, made robust.
 *
 * The z-ai SDK gives plain chat completions (no native function calling),
 * so the agent protocol is strict-JSON-in / JSON-out. This module:
 *   - wraps ZAI.create() lazily (server-side only — never import from
 *     client components)
 *   - extracts JSON from replies that may be wrapped in code fences or
 *     prose (balanced-brace scan, string-aware)
 *   - retries once with the parse error fed back when extraction fails
 *
 * TOKEN ECONOMY (both live here, both opt-out-able):
 *   - TokenMeter  — the per-run ledger: every call's prompt/completion
 *     usage (from the API's own usage fields) + cache savings, bucketed
 *     by role. The orchestrator snapshots it into a `usage` event so the
 *     UI can show what a build actually cost.
 *   - CachedLlm   — a disk-backed reply cache keyed by the exact message
 *     array. Identical calls (a re-run of the same brief, a replayed
 *     turn, a retry after a dropped connection) replay for zero tokens.
 *     AGENT_LLM_CACHE=0 disables; AGENT_LLM_CACHE_DIR relocates.
 *
 * The `Llm` interface is intentionally tiny so tests inject scripted
 * models and the orchestrator never touches the SDK directly.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { RunUsage } from './protocol';

export interface LlmMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface Llm {
  /** one completion; `label` is for logs only */
  chat(messages: LlmMessage[], label?: string): Promise<string>;
}

// ── token meter ──────────────────────────────────────────────────────────────

/**
 * The per-run token ledger. The API reports usage on every completion;
 * ZaiLlm records it here (label → role bucket), CachedLlm records the
 * hits. One meter per build/remix run; the orchestrator snapshots it into
 * the `usage` event right before `done`.
 */
export class TokenMeter {
  private roles: Record<string, { prompt: number; completion: number; calls: number; hits: number; saved: number }> = {};

  /** 'engineer:3', 'engineer:final:repair1', 'remix-critic' → role buckets */
  static roleOf(label: string): string {
    return label.split(':')[0] || 'llm';
  }

  record(label: string, promptTokens: number, completionTokens: number): void {
    const r = (this.roles[TokenMeter.roleOf(label)] ??= { prompt: 0, completion: 0, calls: 0, hits: 0, saved: 0 });
    r.prompt += Math.max(0, promptTokens | 0);
    r.completion += Math.max(0, completionTokens | 0);
    r.calls++;
  }

  /** a cache hit: no tokens spent; `estPromptTokens` ≈ what it saved */
  recordCacheHit(label: string, estPromptTokens: number): void {
    const r = (this.roles[TokenMeter.roleOf(label)] ??= { prompt: 0, completion: 0, calls: 0, hits: 0, saved: 0 });
    r.hits++;
    r.saved += Math.max(0, estPromptTokens | 0);
  }

  snapshot(): RunUsage {
    let promptTokens = 0;
    let completionTokens = 0;
    let calls = 0;
    let cacheHits = 0;
    let cacheSavedTokens = 0;
    const byRole: RunUsage['byRole'] = [];
    for (const [role, r] of Object.entries(this.roles)) {
      promptTokens += r.prompt;
      completionTokens += r.completion;
      calls += r.calls;
      cacheHits += r.hits;
      cacheSavedTokens += r.saved;
      byRole.push({ role, prompt: r.prompt, completion: r.completion, calls: r.calls, hits: r.hits });
    }
    return { promptTokens, completionTokens, calls, cacheHits, cacheSavedTokens, byRole };
  }
}

// ── the SDK-backed LLM, metered ───────────────────────────────────────────────

export class ZaiLlm implements Llm {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor(private readonly meter?: TokenMeter) {}

  private async client() {
    if (!this.zai) this.zai = await ZAI.create();
    return this.zai;
  }

  /** the API's own accounting, defensively read (snake/camel tolerated) */
  private recordUsage(label: string, completion: unknown): void {
    if (!this.meter) return;
    const u = (completion as { usage?: Record<string, unknown> } | null)?.usage;
    if (!u || typeof u !== 'object') return;
    const p = Number(u.prompt_tokens ?? u.promptTokens ?? 0) || 0;
    const c = Number(u.completion_tokens ?? u.completionTokens ?? 0) || 0;
    this.meter.record(label, p, c);
  }

  async chat(messages: LlmMessage[], label = 'llm'): Promise<string> {
    const client = await this.client();
    let lastMsg = '';
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          thinking: { type: 'disabled' },
        });
        const content = completion.choices[0]?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) {
          this.recordUsage(label, completion);
          return content;
        }
        throw new Error('empty completion');
      } catch (e) {
        lastMsg = (e as Error).message ?? String(e);
        const rateLimited = /429|too many requests/i.test(lastMsg);
        if (attempt === 5) {
          console.error(`[agent:llm] ${label} failed after ${attempt} attempts: ${lastMsg}`);
          throw new Error(`LLM call "${label}" failed: ${lastMsg}`);
        }
        // rate limits need real cooldown (quota windows can be minutes);
        // other errors recover fast
        await new Promise((r) => setTimeout(r, rateLimited ? 8000 * 2 ** (attempt - 1) : 800 * attempt));
      }
    }
    throw new Error('unreachable');
  }
}

// ── the reply cache — identical calls replay for zero tokens ─────────────────

/** bump when prompts/protocol change so stale replies cannot leak back in */
const CACHE_SALT = 'flowsheet-llm-v1';

function cacheDir(): string {
  return process.env.AGENT_LLM_CACHE_DIR ?? path.join(process.cwd(), '.agent-cache', 'llm');
}

function cacheKey(messages: LlmMessage[]): string {
  return createHash('sha256').update(`${CACHE_SALT}\u0000${JSON.stringify(messages)}`).digest('hex');
}

/** chars→tokens estimate for cache-savings accounting (no API on a hit) */
const estPromptTokens = (messages: LlmMessage[]): number =>
  Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 3.6);

/**
 * Disk-backed reply cache. A build is a deterministic function of
 * (prompts, brief, prior replies, deterministic tool results) — so an
 * identical brief re-runs ENTIRELY from cache: router, architect, every
 * engineer turn, critic, docent. Classroom re-runs, dev loops and retry
 * replays cost zero LLM tokens. Cache failures (read/write) never break
 * a build — a miss just calls through.
 */
export class CachedLlm implements Llm {
  constructor(
    private readonly inner: Llm,
    private readonly meter?: TokenMeter,
  ) {}

  private get enabled(): boolean {
    return process.env.AGENT_LLM_CACHE !== '0';
  }

  async chat(messages: LlmMessage[], label = 'llm'): Promise<string> {
    if (!this.enabled) return this.inner.chat(messages, label);
    const file = path.join(cacheDir(), `${cacheKey(messages)}.txt`);
    try {
      const hit = fs.readFileSync(file, 'utf8');
      if (hit.length > 0) {
        this.meter?.recordCacheHit(label, estPromptTokens(messages));
        return hit;
      }
    } catch {
      // miss — fall through to the real call
    }
    const out = await this.inner.chat(messages, label);
    try {
      fs.mkdirSync(cacheDir(), { recursive: true });
      fs.writeFileSync(file, out, 'utf8');
    } catch {
      // a full disk or a read-only fs must never fail a build
    }
    return out;
  }
}

/**
 * Extract the first balanced JSON object from LLM output. Handles code
 * fences, leading prose, and braces inside strings. If the reply is a
 * TRUNCATED object (max-token cutoff mid-turn — the classic agentic
 * failure), attempts to close the dangling braces/brackets and parse the
 * salvageable prefix: partial action batches are safe (every action is
 * individually validated downstream).
 */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let s = text.trim();
  // strip code fences: ```json ... ``` or ``` ... ```
  const fence = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          return null;
        } catch {
          return null;
        }
      }
    }
  }
  // no balanced object — try repairing a truncated one
  const stack: string[] = [];
  inStr = false;
  esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  if (stack.length === 0) return null;
  const attempts: string[] = [];
  const base = s.slice(start).replace(/[,\s]+$/, '');
  attempts.push(base + (inStr ? '"' : ''));
  attempts.push(base.replace(/,\s*"[^"]*"?\s*:?\s*$/, '') + (inStr ? '"' : ''));
  for (let a of attempts) {
    // rebuild the closer against THIS candidate's actual state
    const st: string[] = [];
    let str = false;
    let e2 = false;
    for (let i = 0; i < a.length; i++) {
      const c = a[i];
      if (str) {
        if (e2) e2 = false;
        else if (c === '\\') e2 = true;
        else if (c === '"') str = false;
        continue;
      }
      if (c === '"') str = true;
      else if (c === '{' || c === '[') st.push(c);
      else if (c === '}' || c === ']') st.pop();
    }
    if (str) a += '"';
    while (st.length > 0) a += st.pop() === '{' ? '}' : ']';
    try {
      const parsed = JSON.parse(a);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // next attempt
    }
  }
  return null;
}

/**
 * One role call with strict JSON reply: chat → extract → parse; on failure,
 * up to two repair turns (raw reply + parse error fed back), then give up
 * by throwing (the orchestrator turns that into a clean degraded event).
 */
export async function chatJson(llm: Llm, messages: LlmMessage[], label = 'role'): Promise<Record<string, unknown>> {
  let raw = await llm.chat(messages, label);
  let parsed = extractJson(raw);
  if (parsed) return parsed;
  for (let repair = 1; repair <= 2; repair++) {
    const repairMsg = await llm.chat(
      [
        ...messages,
        { role: 'assistant', content: raw.slice(0, 4000) },
        {
          role: 'user',
          content:
            repair === 1
              ? 'That reply was not a valid JSON object (truncated or wrapped in prose). Reply again with ONLY the complete JSON object — no fences, no prose. Keep the exact schema requested. Shorten values if needed to finish the object.'
              : 'Still not valid JSON. Reply with a MINIMAL valid JSON object now: {"thinking": "one sentence", "actions": [], "done": false}. You may continue the work in the next turn.',
        },
      ],
      `${label}:repair${repair}`,
    );
    parsed = extractJson(repairMsg);
    if (parsed) return parsed;
    raw = repairMsg;
  }
  throw new Error(`role "${label}" did not produce JSON after repair`);
}
