/**
 * POST /api/agent/remix — edit an existing plant with the agent team,
 * streaming BuildEvents over Server-Sent Events.
 *
 * One request = one remix session (engineer edit loop → solver → critic →
 * docent). The browser sends the plant's FlowGraph (it lives in IndexedDB,
 * client-side) plus the student's instruction; the workspace is SEEDED with
 * that graph, so the engineer starts from a working plant and makes the
 * smallest edit that honors the request. Same event protocol as /build —
 * the builder page consumes both identically.
 */

import { NextRequest } from 'next/server';
import { runAgentRemix } from '@/lib/agent/orchestrator';
import { CachedLlm, TokenMeter, ZaiLlm } from '@/lib/agent/llm';
import type { BuildEvent } from '@/lib/agent/protocol';
import type { FlowGraph } from '@/lib/engine/graph';

export const runtime = 'nodejs';
export const maxDuration = 600;

/** minimal structural sanity — the workspace is the real cage */
function isGraphLike(v: unknown): v is FlowGraph {
  if (v === null || typeof v !== 'object') return false;
  const g = v as Record<string, unknown>;
  return Array.isArray(g.units) && Array.isArray(g.streams) && g.units.length > 0;
}

export async function POST(req: NextRequest) {
  let graph: unknown;
  let instruction: unknown;
  try {
    const body = (await req.json()) as { graph?: unknown; instruction?: unknown } | null;
    graph = body?.graph;
    instruction = body?.instruction;
  } catch {
    graph = null;
  }
  if (!isGraphLike(graph)) {
    return Response.json({ error: 'a "graph" with at least one unit is required' }, { status: 400 });
  }
  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    return Response.json({ error: 'a non-empty "instruction" string is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: BuildEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true; // client disconnected
        }
      };
      try {
        // same economy as /build: metered calls + the zero-token reply cache
        const meter = new TokenMeter();
        const llm = new CachedLlm(new ZaiLlm(meter), meter);
        await runAgentRemix(graph, instruction, { llm, emit: send, meter });
      } catch (e) {
        send({ type: 'error', message: (e as Error).message || 'agent failure' });
        send({ type: 'done', success: false, graph: null, unitCount: 0, streamCount: 0 });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
