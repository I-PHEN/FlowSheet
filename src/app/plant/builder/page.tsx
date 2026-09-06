'use client';

/**
 * /plant/builder — the AI plant builder interface.
 *
 * Type a design brief → the multi-agent runtime (Architect → Engineer →
 * Solver → Critic) builds a flowsheet through the engine's tool surface,
 * streaming events over SSE. This page mirrors the FlowGraph from the
 * graph snapshots so the canvas assembles live, shows the transcript of
 * every agent decision and tool result, the plant KPIs after each solve,
 * the critic's verdict, and saves finished plants to the local library.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FlowGraph } from '@/lib/engine/graph';
import type { BuildEvent, BuildPhase, CriticVerdict, SavedPlant, SolveSummary } from '@/lib/agent/protocol';
import { LIBRARY_KEY, PRESET_BRIEFS } from '@/lib/agent/protocol';
import { BuildCanvas, UnitInspector } from '@/components/builder/BuildCanvas';
import { BuildLog, KpiPanel, VerdictCard, type LogEntry } from '@/components/builder/BuildPanels';
import { ThemeToggle } from '@/components/ThemeToggle';
import { C } from '@/lib/design/tokens';

type Status = 'idle' | 'running' | 'finished';

const PHASE_LABEL: Record<BuildPhase, string> = {
  architect: 'Architect planning',
  engineer: 'Engineer building',
  solver: 'Solver verifying',
  critic: 'Critic reviewing',
  done: 'Done',
};

const PHASE_COLOR: Record<BuildPhase, string> = {
  architect: C.feed,
  engineer: C.gas,
  solver: C.inkSoft,
  critic: C.nh3,
  done: C.nh3,
};

export default function BuilderPage() {
  const [brief, setBrief] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState<BuildPhase | null>(null);
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [solve, setSolve] = useState<SolveSummary | null>(null);
  const [verdict, setVerdict] = useState<CriticVerdict | null>(null);
  const [doneOk, setDoneOk] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [restored, setRestored] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const keyRef = useRef(0);

  const addEntry = useCallback((e: Omit<LogEntry, 'key'>) => {
    setEntries((prev) => {
      const next = [...prev, { ...e, key: ++keyRef.current }];
      return next.length > 400 ? next.slice(-360) : next;
    });
  }, []);

  // restore from library (?load=slug) — client-only read
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('load');
    if (!slug) return;
    try {
      const list = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as SavedPlant[];
      const rec = list.find((r) => r.slug === slug);
      if (!rec) return;
      setBrief(rec.brief);
      setGraph(rec.graph);
      setVerdict(rec.verdict);
      if (rec.kpis) {
        setSolve({ kpis: rec.kpis, converged: true, iterations: 0, solveMs: 0, balanceWorstRelErr: 0, warnings: [] });
      }
      setStatus('finished');
      setDoneOk(rec.verdict?.verdict !== 'fail');
      setRestored(true);
      addEntry({ kind: 'note', text: `Loaded “${rec.name}” from the library — ask for a new build to rebuild or modify.` });
    } catch {
      // ignore corrupt library
    }
  }, [addEntry]);

  const handleEvent = (ev: BuildEvent) => {
    switch (ev.type) {
      case 'phase':
        setPhase(ev.phase);
        addEntry({ kind: 'phase', phase: ev.phase, label: ev.label });
        break;
      case 'message':
        addEntry({ kind: 'message', role: ev.role, text: ev.text });
        break;
      case 'tool':
        addEntry({ kind: 'tool', tool: ev.name, ok: ev.ok, seq: ev.seq, text: ev.summary });
        break;
      case 'graph':
        setGraph(ev.graph);
        break;
      case 'solve':
        setSolve(ev.solve);
        addEntry({
          kind: 'solve',
          text: `${ev.solve.kpis.productionTpd.toFixed(1)} t/d · purity ${(ev.solve.kpis.productPurityWt * 100).toFixed(1)} wt % · per-pass ${(ev.solve.kpis.perPassConv * 100).toFixed(1)} % · ${ev.solve.converged ? `converged (${ev.solve.iterations} it)` : 'NOT converged'}`,
        });
        break;
      case 'verdict':
        setVerdict(ev.verdict);
        addEntry({ kind: 'message', role: 'critic', text: `${ev.verdict.verdict.toUpperCase()} · ${ev.verdict.score}/100 — ${ev.verdict.summary}` });
        break;
      case 'error':
        addEntry({ kind: 'error', text: ev.message });
        break;
      case 'done':
        setDoneOk(ev.success);
        setStatus('finished');
        addEntry({ kind: 'note', text: `Build finished — ${ev.unitCount} units, ${ev.streamCount} streams${ev.success ? '' : ' (with problems — see the log)'}.` });
        break;
    }
  };

  async function startBuild() {
    if (!brief.trim() || status === 'running') return;
    setStatus('running');
    setPhase(null);
    setGraph(null);
    setEntries([]);
    setSolve(null);
    setVerdict(null);
    setDoneOk(null);
    setSelected(null);
    setSaved(false);
    setRestored(false);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch('/api/agent/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `server responded ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!frame.startsWith('data: ')) continue;
          try {
            handleEvent(JSON.parse(frame.slice(6)) as BuildEvent);
          } catch {
            // skip malformed frame
          }
        }
      }
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
  }

  function stopBuild() {
    abortRef.current?.abort();
  }

  function resetToIdle() {
    setStatus('idle');
    setPhase(null);
    setGraph(null);
    setEntries([]);
    setSolve(null);
    setVerdict(null);
    setDoneOk(null);
    setSelected(null);
    setSaved(false);
    setRestored(false);
  }

  function saveToLibrary() {
    if (!graph) return;
    const rec: SavedPlant = {
      slug: `p${Date.now().toString(36)}`,
      name: brief.trim().slice(0, 48) || 'Agent-built plant',
      brief: brief.trim(),
      savedAt: new Date().toISOString(),
      graph,
      kpis: solve?.kpis ?? null,
      verdict,
      productionTpd: solve?.kpis.productionTpd ?? null,
    };
    try {
      const list = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as SavedPlant[];
      localStorage.setItem(LIBRARY_KEY, JSON.stringify([rec, ...list].slice(0, 12)));
      setSaved(true);
    } catch {
      addEntry({ kind: 'error', text: 'Could not save in this browser (storage unavailable).' });
    }
  }

  const running = status === 'running';
  const unitCount = graph?.units.length ?? 0;
  const streamCount = graph?.streams.length ?? 0;

  return (
    <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
      {/* header */}
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b px-3 sm:px-4" style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}>
        <Link href="/" className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold" style={{ color: C.ink }} title="Back to library">
          ←
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
            AI Plant Builder
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            {unitCount > 0 ? `${unitCount} units · ${streamCount} streams` : 'describe the plant — the agents build it'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {phase && status !== 'idle' && (
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold"
              style={{ color: PHASE_COLOR[phase], borderColor: 'var(--fs-band-line)', background: C.paper }}
            >
              {running && <span className="bd-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: PHASE_COLOR[phase] }} />}
              {PHASE_LABEL[phase]}
            </span>
          )}
          {status === 'finished' && doneOk !== null && (
            <span
              className="rounded-full border px-3 py-1 font-mono text-[11px] font-bold"
              style={{ color: doneOk ? C.nh3 : C.warn, borderColor: doneOk ? C.nh3 : C.warn }}
            >
              {doneOk ? 'BUILD OK' : 'BUILD ISSUES'}
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* brief composer */}
      <div className="shrink-0 border-b px-3 py-2.5 sm:px-4" style={{ background: C.paper, borderColor: 'var(--fs-band-line)' }}>
        {status === 'idle' ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe the plant to build — e.g. “Build the standard SMR ammonia plant for ~800 t/day…”"
              rows={2}
              className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] leading-relaxed outline-none focus:ring-2"
              style={{ color: C.ink, background: C.canvas, borderColor: 'var(--fs-band-line)' }}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_BRIEFS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setBrief(p.text)}
                  className="hover-band rounded-full border px-3 py-1 text-[11.5px] font-bold"
                  style={{ color: C.inkSoft, borderColor: 'var(--fs-band-line)' }}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={startBuild}
                disabled={!brief.trim()}
                className="ml-auto rounded-full border px-5 py-1.5 text-[12.5px] font-extrabold disabled:opacity-40"
                style={{ color: C.paper, background: C.ink, borderColor: C.ink }}
              >
                Build it →
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: C.inkSoft }} title={brief}>
              “{brief.trim() || 'restored plant'}”
            </p>
            {running ? (
              <button onClick={stopBuild} className="hover-band rounded-full border px-4 py-1.5 text-[12px] font-bold" style={{ color: C.warn, borderColor: C.warn }}>
                Stop
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {graph && unitCount > 0 && (
                  <button
                    onClick={saveToLibrary}
                    disabled={saved}
                    className="hover-band rounded-full border px-4 py-1.5 text-[12px] font-bold disabled:opacity-50"
                    style={{ color: saved ? C.nh3 : C.ink, borderColor: saved ? C.nh3 : 'var(--fs-band-line)' }}
                  >
                    {saved ? 'Saved ✓' : 'Save to library'}
                  </button>
                )}
                <button onClick={resetToIdle} className="hover-band rounded-full border px-4 py-1.5 text-[12px] font-bold" style={{ color: C.ink, borderColor: 'var(--fs-band-line)' }}>
                  New build
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* main split */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* canvas column */}
        <div className="flex min-h-[46dvh] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex items-center gap-3 border-b px-4 py-1.5" style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}>
            <span className="font-mono text-[10px] font-extrabold tracking-[0.16em]" style={{ color: C.inkSoft }}>
              LIVE FLOWSHEET
            </span>
            {unitCount > 0 && (
              <span className="font-mono text-[10px]" style={{ color: C.inkFaint }}>
                {unitCount} units · {streamCount} streams
              </span>
            )}
            {selected && (
              <button onClick={() => setSelected(null)} className="ml-auto font-mono text-[10px] font-bold" style={{ color: C.inkFaint }}>
                deselect
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <BuildCanvas graph={graph} selected={selected} onUnitClick={(id) => setSelected((cur) => (cur === id ? null : id))} />
          </div>
          {graph && selected && (
            <UnitInspector graph={graph} unitId={selected} onClose={() => setSelected(null)} />
          )}
        </div>

        {/* log column */}
        <aside className="flex min-h-0 w-full flex-col border-t lg:w-[400px] lg:border-l lg:border-t-0" style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}>
          <div className="flex items-center gap-2 border-b px-4 py-1.5" style={{ borderColor: 'var(--fs-band-line)' }}>
            <span className="font-mono text-[10px] font-extrabold tracking-[0.16em]" style={{ color: C.inkSoft }}>
              BUILD LOG
            </span>
            <span className="font-mono text-[10px]" style={{ color: C.inkFaint }}>
              {entries.length} events
            </span>
          </div>
          {entries.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <p className="text-[12.5px] leading-relaxed" style={{ color: C.inkFaint }}>
                Every agent decision, tool call, validator finding, solve result, and the critic&apos;s verdict will appear here while the plant is being built.
              </p>
            </div>
          ) : (
            <BuildLog entries={entries} running={running} />
          )}
          {solve && <KpiPanel solve={solve} />}
          {verdict && <VerdictCard verdict={verdict} />}
        </aside>
      </div>
    </div>
  );
}
