/**
 * POST /api/agent/remix — START a remix job, return its id immediately.
 *
 * Same job architecture as POST /api/agent/build (see that route for the
 * why: the preview proxy cuts long responses; the build must survive any
 * single connection). The browser sends the plant's FlowGraph (it lives in
 * IndexedDB, client-side) plus the student's instruction; the workspace is
 * SEEDED with that graph, so the engineer starts from a working plant and
 * makes the smallest edit that honors the request. Events stream from GET
 * /api/agent/build/events?id=… — same protocol, same resumability.
 */

import { NextRequest } from 'next/server';
import { runAgentRemix } from '@/lib/agent/orchestrator';
import { CachedLlm, TokenMeter, ZaiLlm } from '@/lib/agent/llm';
import { createJob, MAX_RUNNING_JOBS, runningJobCount } from '@/lib/agent/jobStore';
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
  if (runningJobCount() >= MAX_RUNNING_JOBS) {
    return Response.json(
      { error: 'too many builds are running right now — try again in a minute' },
      { status: 429 },
    );
  }

  const trimmed = instruction.trim();
  const job = createJob(trimmed); // the store keys jobs by id; the brief is descriptive

  // detached run — buffered + broadcast into the job, connection-independent
  void (async () => {
    // same economy as /build: metered calls + the zero-token reply cache
    const meter = new TokenMeter();
    const llm = new CachedLlm(new ZaiLlm(meter), meter);
    try {
      await runAgentRemix(graph, trimmed, {
        llm,
        emit: (e) => job.emit(e),
        meter,
        shouldStop: () => job.aborted,
      });
    } catch {
      // runAgentRemix never throws (its own top-level catch emits done)
      job.emit({ type: 'error', message: 'the remix crashed unexpectedly' });
      job.emit({ type: 'done', success: false, graph: null, unitCount: 0, streamCount: 0 });
    }
  })();

  return Response.json({ jobId: job.id });
}
