/**
 * POST /api/agent/build/stop — cancel a running build job.
 *
 * Marks the job aborted; the orchestrator polls the flag at its phase/turn
 * boundaries and ends the session honestly (system message + done event
 * with the partial graph). Idempotent: stopping a finished or unknown job
 * is a no-op so racing clients can't trip over each other.
 */

import { NextRequest } from 'next/server';
import { getJob } from '@/lib/agent/jobStore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let jobId: unknown;
  try {
    const body = (await req.json()) as { jobId?: unknown } | null;
    jobId = body?.jobId;
  } catch {
    jobId = null;
  }
  if (typeof jobId !== 'string' || jobId.length === 0) {
    return Response.json({ error: 'a "jobId" string is required' }, { status: 400 });
  }
  const job = getJob(jobId);
  if (job && !job.finished) job.stop();
  return Response.json({ ok: true });
}
