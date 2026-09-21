/**
 * POST /api/agent/build — START a build job, return its id immediately.
 *
 * The preview proxy in front of the app will not hold one long HTTP
 * response open (~30 s), and a full agent build legitimately runs for
 * minutes — streaming the build over this POST meant every silent LLM
 * stretch (critic, docent, 429 backoff) got the connection cut and the
 * client showed a bare "network error".
 *
 * So this route only STARTS the work:
 *   1. createJob(brief) in the shared job store
 *   2. run the orchestrator detached, emitting every BuildEvent into the
 *      job (buffered + broadcast)
 *   3. respond { jobId } right away
 *
 * The browser then consumes the run from GET /api/agent/build/events?id=… —
 * a resumable SSE stream with 10 s heartbeats: a proxy cut costs one
 * automatic 2 s reconnect (Last-Event-ID), never the build. All LLM calls
 * still happen here, server-side; the browser never touches the SDK.
 */

import { NextRequest } from 'next/server';
import { runAgentBuild } from '@/lib/agent/orchestrator';
import { CachedLlm, TokenMeter, ZaiLlm } from '@/lib/agent/llm';
import { createJob, MAX_RUNNING_JOBS, runningJobCount } from '@/lib/agent/jobStore';

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
  if (runningJobCount() >= MAX_RUNNING_JOBS) {
    return Response.json(
      { error: 'too many builds are running right now — try again in a minute' },
      { status: 429 },
    );
  }

  const job = createJob(brief.trim());

  // the run is detached from this request: it keeps going no matter what
  // happens to any single connection, and every event is buffered in the
  // job for whoever is (re)attaching via /events
  void (async () => {
    // one meter + one cached LLM per run: every call's usage is recorded,
    // and identical calls (same brief re-run, replayed turn) are served
    // from the disk cache for zero tokens
    const meter = new TokenMeter();
    const llm = new CachedLlm(new ZaiLlm(meter), meter);
    try {
      await runAgentBuild(brief.trim(), {
        llm,
        emit: (e) => job.emit(e),
        meter,
        shouldStop: () => job.aborted,
      });
    } catch {
      // runAgentBuild never throws (its own top-level catch emits done) —
      // this is belt-and-braces so a job can never hang without a `done`
      job.emit({ type: 'error', message: 'the build crashed unexpectedly' });
      job.emit({ type: 'done', success: false, graph: null, unitCount: 0, streamCount: 0 });
    }
  })();

  return Response.json({ jobId: job.id });
}
