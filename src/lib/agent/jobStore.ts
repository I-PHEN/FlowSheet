/**
 * Build job store — decouples a running build from any single HTTP
 * connection.
 *
 * Why: the preview proxy in front of the app will not hold one long HTTP
 * response open (~30 s limit) — a full agent build legitimately runs for
 * minutes. So POST /api/agent/build now starts a job and returns a jobId
 * immediately, and GET /api/agent/build/events streams (and replays) the
 * job's events. If the proxy drops the stream, EventSource reconnects with
 * Last-Event-ID and resumes with zero lost events; a page refresh can
 * re-attach the same way.
 *
 * In-memory by design: one dev/demo server, no persistence guarantees.
 * Jobs are swept by age, and there is a small cap on concurrent running
 * builds so runaway clients cannot pile up LLM work.
 */

import { randomUUID } from 'crypto';
import type { BuildEvent } from './protocol';

/** a buffered event + its 1-based, monotonic sequence number */
export interface JobEvent {
  seq: number;
  event: BuildEvent;
}

type Subscriber = (je: JobEvent) => void;

/** max concurrently RUNNING builds (finished ones don't count) */
export const MAX_RUNNING_JOBS = 6;
/** a running job is swept after this long (stuck retries, orphaned tabs…) */
const RUNNING_TTL_MS = 30 * 60_000;
/** finished jobs linger so refreshes can replay the session */
const DONE_TTL_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

export class BuildJob {
  readonly id = randomUUID();
  readonly brief: string;
  readonly createdAt = Date.now();
  aborted = false;

  private events: JobEvent[] = [];
  private subscribers = new Set<Subscriber>();
  private doneAt: number | null = null;
  private seq = 0;

  constructor(brief: string) {
    this.brief = brief;
  }

  get finished(): boolean {
    return this.doneAt !== null;
  }

  /** when the `done` event landed (null while running) — for the sweeper */
  get finishedAt(): number | null {
    return this.doneAt;
  }

  /** append + broadcast; the `done` event terminates the job */
  emit(event: BuildEvent): void {
    if (this.doneAt !== null) return;
    const je: JobEvent = { seq: ++this.seq, event };
    this.events.push(je);
    if (event.type === 'done') this.doneAt = Date.now();
    for (const sub of this.subscribers) {
      try {
        sub(je);
      } catch {
        // a broken subscriber never breaks the build
      }
    }
  }

  /** buffered events strictly after `seq` (0 → everything) */
  replayAfter(seq: number): JobEvent[] {
    if (seq <= 0) return this.events;
    // seq numbers are dense and ordered — binary search the first > seq
    let lo = 0;
    let hi = this.events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.events[mid].seq <= seq) lo = mid + 1;
      else hi = mid;
    }
    return this.events.slice(lo);
  }

  subscribe(sub: Subscriber): () => void {
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  /** user cancel — the orchestrator polls this between phases/turns */
  stop(): void {
    this.aborted = true;
  }
}

// ── module-level registry ────────────────────────────────────────────────────
//
// The registry lives on globalThis: in Next dev (Turbopack) each route gets
// its own instance of this module, so a plain module-scoped Map would give
// the POST route one store and the events route another — jobs would "vanish"
// between requests. One global object, one store, every route instance.

interface JobsGlobal {
  __pspBuildJobs?: Map<string, BuildJob>;
  __pspBuildJobsSweeper?: ReturnType<typeof setInterval> | null;
}

const G = globalThis as typeof globalThis & JobsGlobal;
const jobs = (G.__pspBuildJobs ??= new Map<string, BuildJob>());

function ensureSweeper() {
  if (G.__pspBuildJobsSweeper) return;
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      const ttl = job.finished ? DONE_TTL_MS : RUNNING_TTL_MS;
      const age = job.finished ? now - (job.finishedAt ?? now) : now - job.createdAt;
      if (age > ttl) jobs.delete(id);
    }
  }, SWEEP_INTERVAL_MS);
  // never keep the process alive just for the sweeper
  (sweeper as unknown as { unref?: () => void }).unref?.();
  G.__pspBuildJobsSweeper = sweeper;
}

export function runningJobCount(): number {
  let n = 0;
  for (const job of jobs.values()) if (!job.finished) n++;
  return n;
}

export function createJob(brief: string): BuildJob {
  ensureSweeper();
  const job = new BuildJob(brief);
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): BuildJob | undefined {
  return jobs.get(id);
}
