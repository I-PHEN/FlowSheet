/**
 * POST /api/agent/build — run the multi-agent plant builder, streaming
 * BuildEvents over Server-Sent Events.
 *
 * One request = one full build session (brief → architect → engineer →
 * solver → critic → done). The browser consumes the stream and mirrors the
 * FlowGraph from the graph snapshots, so the canvas assembles live.
 *
 * All LLM calls happen here, server-side; the browser never touches the
 * SDK. The stream ends with a `done` event, then closes.
 */

import { NextRequest } from 'next/server';
import { runAgentBuild } from '@/lib/agent/orchestrator';
import { ZaiLlm } from '@/lib/agent/llm';
import type { BuildEvent } from '@/lib/agent/protocol';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  let brief: unknown;
  try {
    const body = (await req.json()) as { brief?: unknown } | null;
    brief = body?.brief;
  } catch {
    brief = null;
  }
  if (typeof brief !== 'string' || brief.trim().length === 0) {
    return Response.json({ error: 'a non-empty "brief" string is required' }, { status: 400 });
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
        const llm = new ZaiLlm();
        await runAgentBuild(brief, { llm, emit: send });
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
