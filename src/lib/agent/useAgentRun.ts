'use client';

/**
 * useAgentRun — one hook, every agent run surface.
 *
 * Owns the whole life of a build/remix run: the quick job POST (which
 * returns a jobId and detaches the run onto the server), the resumable
 * SSE consumption (heartbeats + Last-Event-ID reconnect — the anti-proxy
 * design), the paced one-by-one event stream, and the honest stop
 * (server-side cancel + client stream close).
 *
 * Two surfaces share it, so the experience is ONE experience:
 *   · the builder page — fresh builds and reference remixes
 *   · the project page's EDIT mode — editing a saved plant in place
 *
 * The hook is deliberately page-level: mounting/unmounting a panel never
 * kills a live run, and every mode's canvas can watch the same assembly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowGraph } from '@/lib/engine/graph';
import type {
  BuildEvent,
  BuildPhase,
  CriticVerdict,
  LogEntry,
  RunUsage,
  SolveSummary,
} from '@/lib/agent/protocol';
import type { Tour } from '@/lib/content/units';

// THE ONE CONVERSATION LAW: the transcript is shared vocabulary (record
// persistence, the session panel) — one type, defined in the protocol
export type { LogEntry };

export type RunStatus = 'idle' | 'running' | 'finished';

export interface UseAgentRun {
  status: RunStatus;
  running: boolean;
  phase: BuildPhase | null;
  /** the LIVE graph — the remix source until events arrive, then the assembly */
  graph: FlowGraph | null;
  entries: LogEntry[];
  solve: SolveSummary | null;
  verdict: CriticVerdict | null;
  tour: Tour | null;
  family: { id: string; label: string } | null;
  doneOk: boolean | null;
  /** start a run; for remixes pass the graph being edited */
  start: (brief: string, sourceGraph?: FlowGraph | null) => Promise<void>;
  /** honest stop — server-side cancel + close the stream */
  stop: () => void;
  /** back to idle (a remix keeps its source graph on the canvas) */
  reset: (sourceGraph?: FlowGraph | null) => void;
  /** restore a finished run from a saved record (?load=) without a server call */
  restore: (src: {
    brief: string;
    graph: FlowGraph;
    verdict?: CriticVerdict | null;
    kpis?: SolveSummary['kpis'] | null;
    name?: string;
    tour?: Tour | null;
  }) => void;
  /** append a page-level note (guidance, errors, state changes) */
  note: (text: string) => void;
  /** wipe the transcript (page state transitions) */
  clearEntries: () => void;
  /** preload entries (page composes the greeting) */
  seedEntries: (list: Omit<LogEntry, 'key'>[]) => void;
}

export function useAgentRun(opts?: {
  /** called once when the run finishes (page-level side effects: save, fit) */
  onDone?: (ev: Extract<BuildEvent, { type: 'done' }>, finalGraph: FlowGraph | null) => void;
}): UseAgentRun {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [phase, setPhase] = useState<BuildPhase | null>(null);
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [solve, setSolve] = useState<SolveSummary | null>(null);
  const [verdict, setVerdict] = useState<CriticVerdict | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [family, setFamily] = useState<{ id: string; label: string } | null>(null);
  const [doneOk, setDoneOk] = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const keyRef = useRef(0);
  const onDoneRef = useRef(opts?.onDone);
  onDoneRef.current = opts?.onDone;

  const addEntry = useCallback((e: Omit<LogEntry, 'key'>) => {
    setEntries((prev) => {
      const next = [...prev, { ...e, key: ++keyRef.current }];
      return next.length > 400 ? next.slice(-360) : next;
    });
  }, []);

  const note = useCallback((text: string) => addEntry({ kind: 'note', text }), [addEntry]);
  const clearEntries = useCallback(() => setEntries([]), []);
  const seedEntries = useCallback((list: Omit<LogEntry, 'key'>[]) => {
    setEntries(list.map((e) => ({ ...e, key: ++keyRef.current })));
  }, []);

  const handleEvent = useCallback(
    (ev: BuildEvent) => {
      switch (ev.type) {
        case 'phase':
          setPhase(ev.phase);
          addEntry({ kind: 'phase', phase: ev.phase, label: ev.label });
          break;
        case 'message':
          addEntry({ kind: 'message', role: ev.role, text: ev.text });
          break;
        case 'tool': {
          const a = (ev.args ?? {}) as Record<string, unknown>;
          const target =
            typeof a.id === 'string'
              ? a.id
              : typeof a.unit === 'string'
                ? a.unit
                : typeof a.stream === 'string'
                  ? a.stream
                  : '';
          const utype = typeof a.type === 'string' ? a.type : '';
          addEntry({ kind: 'tool', tool: ev.name, ok: ev.ok, seq: ev.seq, text: ev.summary, target, utype });
          break;
        }
        case 'graph':
          setGraph(ev.graph);
          break;
        case 'solve':
          setSolve(ev.solve);
          addEntry({ kind: 'solve', solve: ev.solve });
          break;
        case 'verdict':
          setVerdict(ev.verdict);
          addEntry({ kind: 'verdict', verdict: ev.verdict });
          break;
        case 'family':
          // QUIET CHAT: the router's family pick is state, not a message —
          // it reaches the UI through chips/labels, never a chat bubble
          setFamily({ id: ev.family, label: ev.label });
          break;
        case 'tour':
          setTour(ev.tour);
          break;
        case 'usage':
          addEntry({ kind: 'usage', usage: ev.usage });
          break;
        case 'error':
          addEntry({ kind: 'error', text: ev.message });
          break;
        case 'done': {
          // QUIET CHAT: no "run finished" bubble — the ANSWER card and the
          // panel sub-header carry the result
          setDoneOk(ev.success);
          setStatus('finished');
          onDoneRef.current?.(ev, graphRef.current);
          break;
        }
      }
    },
    [addEntry],
  );

  // the live graph for onDone (a ref so handleEvent stays stable)
  const graphRef = useRef<FlowGraph | null>(null);
  graphRef.current = graph;

  const start = useCallback(
    async (brief: string, sourceGraph?: FlowGraph | null) => {
      if (!brief.trim() || status === 'running') return;
      const isRemix = !!sourceGraph;
      setStatus('running');
      setPhase(null);
      setGraph(sourceGraph ?? null);
      // THE ONE CONVERSATION LAW: a new run APPENDS to the transcript —
      // build → tour → edit is one chat; only reset() starts a fresh one
      setEntries((prev) => [...prev, { key: ++keyRef.current, kind: 'user', text: brief.trim() }]);
      setSolve(null);
      setVerdict(null);
      setDoneOk(null);
      setTour(null);
      if (!isRemix) setFamily(null);
      const ac = new AbortController();
      abortRef.current = ac;
      jobIdRef.current = null;
      try {
        // 1 — START the job: a quick POST that returns { jobId }; the run
        //     lives on the server, decoupled from any single connection
        const res = await fetch(isRemix ? '/api/agent/remix' : '/api/agent/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isRemix ? { graph: sourceGraph, instruction: brief } : { brief }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? `server responded ${res.status}`);
        }
        const started = (await res.json()) as { jobId?: string };
        if (!started.jobId) throw new Error('the server did not accept the build');
        jobIdRef.current = started.jobId;

        // 2 — CONSUME the run over resumable SSE: heartbeats keep the proxy
        //     warm, and a dropped stream reconnects itself with Last-Event-ID
        await new Promise<void>((resolve) => {
          const es = new EventSource(`/api/agent/build/events?id=${encodeURIComponent(started.jobId!)}`);
          esRef.current = es;
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            es.close();
            esRef.current = null;
            finishRef.current = null;
            resolve();
          };
          finishRef.current = finish;
          es.onmessage = (m) => {
            let ev: BuildEvent;
            try {
              ev = JSON.parse(m.data) as BuildEvent;
            } catch {
              return; // skip malformed frame
            }
            if (ev.type === 'done') {
              handleEvent(ev);
              finish(); // the stream is over — close before EventSource reconnects
            } else {
              handleEvent(ev);
            }
          };
          es.addEventListener('gone', () => {
            addEntry({
              kind: 'error',
              text: 'This build session is no longer live on the server — start it again.',
            });
            setStatus('finished');
            setDoneOk((ok) => ok ?? false);
            finish();
          });
          es.onerror = () => {
            // EventSource retries automatically (same URL, Last-Event-ID
            // header) — nothing to do here; 'gone' ends it if the job is gone
          };
        });
      } catch (e) {
        const err = e as Error;
        if (err.name === 'AbortError') {
          addEntry({ kind: 'note', text: 'Build stopped.' });
        } else {
          addEntry({ kind: 'error', text: err.message || 'connection lost' });
        }
        setStatus('finished');
        setDoneOk((ok) => ok ?? false);
      }
    },
    [status, handleEvent, addEntry],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    const id = jobIdRef.current;
    esRef.current?.close();
    esRef.current = null;
    jobIdRef.current = null;
    finishRef.current?.();
    addEntry({ kind: 'note', text: 'Build stopped.' });
    setStatus('finished');
    setDoneOk((ok) => ok ?? false);
    if (id) {
      void fetch('/api/agent/build/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      }).catch(() => {
        /* the sweeper catches an orphaned job anyway */
      });
    }
  }, [addEntry]);

  // leaving the page closes the stream (the server-side run finishes into
  // the job buffer on its own — nothing dangles client-side)
  useEffect(
    () => () => {
      esRef.current?.close();
      esRef.current = null;
    },
    [],
  );

  const reset = useCallback((sourceGraph?: FlowGraph | null) => {
    setStatus('idle');
    setPhase(null);
    setGraph(sourceGraph ?? null);
    setEntries([]);
    setSolve(null);
    setVerdict(null);
    setDoneOk(null);
    setTour(null);
    if (!sourceGraph) setFamily(null);
  }, []);

  const restore = useCallback(
    (src: {
      brief: string;
      graph: FlowGraph;
      verdict?: CriticVerdict | null;
      kpis?: SolveSummary['kpis'] | null;
      name?: string;
      tour?: Tour | null;
    }) => {
      setEntries([]);
      keyRef.current = 0;
      setGraph(src.graph);
      setVerdict(src.verdict ?? null);
      setTour(src.tour ?? null);
      // QUIET CHAT seed order: the brief leads, the answer follows — the
      // same YOU → ANSWER shape a live run leaves behind
      if (src.brief) addEntry({ kind: 'user', text: src.brief });
      if (src.kpis) {
        const s: SolveSummary = {
          kpis: src.kpis,
          converged: true,
          iterations: 0,
          solveMs: 0,
          balanceWorstRelErr: 0,
          warnings: [],
        };
        setSolve(s);
        addEntry({ kind: 'solve', solve: s });
      }
      if (src.verdict) addEntry({ kind: 'verdict', verdict: src.verdict });
      addEntry({
        kind: 'note',
        text: `Loaded “${src.name ?? 'plant'}” — inspect it below or start a new session.`,
      });
      setStatus('finished');
      setDoneOk(src.verdict?.verdict !== 'fail');
    },
    [addEntry],
  );

  return {
    status,
    running: status === 'running',
    phase,
    graph,
    entries,
    solve,
    verdict,
    tour,
    family,
    doneOk,
    start,
    stop,
    reset,
    restore,
    note,
    clearEntries,
    seedEntries,
  };
}

