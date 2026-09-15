/**
 * GET /api/agent/build/events?id=<jobId> — the build's event stream.
 *
 * SSE with full resume semantics:
 *   - every event is written with an `id:` (its sequence number)
 *   - on connect, the buffer is replayed after the client's Last-Event-ID
 *     (EventSource sends it automatically when it reconnects)
 *   - `retry: 2000` asks the browser to reconnect fast
 *   - `: ping` comments every 10 s keep idle proxies warm
 *   - after the `done` event is delivered the stream closes
 *
 * So a proxy that kills long responses costs the client one 2-second
 * reconnect, not the build. Unknown/expired jobs get a named `gone` event
 * (not an HTTP error) so EventSource delivers it once instead of
 * retry-looping.
 */

import { NextRequest } from 'next/server';
import { getJob } from '@/lib/agent/jobStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
  Connection: 'keep-alive',
};

const HEARTBEAT_MS = 10_000;

function frame(je: { seq: number; event: unknown }): string {
  return `id: ${je.seq}\ndata: ${JSON.stringify(je.event)}\n\n`;
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const job = id ? getJob(id) : undefined;

  // unknown job → one `gone` event, then close (client stops instead of
  // retrying forever against a 404)
  if (!job) {
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: gone\ndata: {}\n\n'));
          controller.close();
        },
      }),
      { headers: SSE_HEADERS },
    );
  }

  const lastIdRaw = req.headers.get('last-event-id');
  const lastId = Number.parseInt(lastIdRaw ?? '0', 10);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // client is gone
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      send('retry: 2000\n\n');

      // replay + live-subscribe in the same synchronous block — no event
      // can slip between the two (single-threaded event loop)
      for (const je of job.replayAfter(Number.isFinite(lastId) ? lastId : 0)) {
        send(frame(je));
        if (je.event.type === 'done') {
          cleanup();
          return;
        }
      }
      if (job.finished) {
        // done was already delivered to this client (Last-Event-ID >= its
        // seq) — nothing left to say
        cleanup();
        return;
      }

      unsubscribe = job.subscribe((je) => {
        send(frame(je));
        if (je.event.type === 'done') cleanup();
      });
      heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
