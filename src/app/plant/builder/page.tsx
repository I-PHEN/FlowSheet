'use client';

/**
 * /plant/builder — the AI plant builder studio.
 *
 * Two zones, Flow-inspired but ours: the stage (left) is the live flowsheet —
 * it assembles as the agents work and inspects like the reference plant
 * (pan, zoom, hover streams, click units); the session (right) is the chat —
 * the narrative spine of the build. The session shrinks to a rail so the
 * plant gets the attention, and the whole thing runs on the existing agent
 * stream (Router → Architect → Engineer → Solver → Critic → Docent over
 * SSE, or the remix variant on the same protocol). Engine and agent:
 * untouched.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { FlowGraph } from '@/lib/engine/graph';
import type { BuildEvent, BuildPhase, CriticVerdict, SolveSummary } from '@/lib/agent/protocol';
import type { Tour } from '@/lib/content/units';
import { BuildCanvas, UnitInspector, type BuildCanvasHandle } from '@/components/builder/BuildCanvas';
import { SessionPanel, PHASE_COLOR, PHASE_LABEL, type LogEntry } from '@/components/builder/SessionPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { C } from '@/lib/design/tokens';
import { getFamily, isFamilyId } from '@/lib/families';
import {
  getPlant,
  findLegacyBySlug,
  putPlant,
} from '@/lib/projects/store';
import {
  getOwnerId,
  newPlantId,
  PLANT_SCHEMA_VERSION,
  type PlantRecord,
} from '@/lib/projects/record';

type Status = 'idle' | 'running' | 'finished';

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
  const [savedId, setSavedId] = useState<string | null>(null);
  const [family, setFamily] = useState<{ id: string; label: string } | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  // remix mode (?remix=<plantId|reference>): a working plant is loaded on the
  // canvas and the composer sends CHANGE instructions, not build briefs. The
  // source updates to the latest graph after each run, so changes chain.
  const [remixSource, setRemixSource] = useState<{ name: string; graph: FlowGraph } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const keyRef = useRef(0);
  const canvasRef = useRef<BuildCanvasHandle>(null);

  const addEntry = useCallback((e: Omit<LogEntry, 'key'>) => {
    setEntries((prev) => {
      const next = [...prev, { ...e, key: ++keyRef.current }];
      return next.length > 400 ? next.slice(-360) : next;
    });
  }, []);

  // restore a project (?load=id reads the IndexedDB store, then falls back
  // to the legacy localStorage slug) — client-only
  useEffect(() => {
    const loadId = new URLSearchParams(window.location.search).get('load');
    if (!loadId) return;
    let alive = true;
    const restore = (
      src: Pick<PlantRecord, 'brief' | 'graph' | 'verdict' | 'kpis' | 'name'>,
    ) => {
      setBrief(src.brief);
      setGraph(src.graph);
      setVerdict(src.verdict);
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
      if (src.brief) addEntry({ kind: 'user', text: src.brief });
      addEntry({ kind: 'note', text: `Loaded “${src.name}” — inspect it below or start a new session.` });
      setStatus('finished');
      setDoneOk(src.verdict?.verdict !== 'fail');
      setSaved(true);
      setChatOpen(true);
    };
    void (async () => {
      const rec = await getPlant(loadId);
      if (!alive) return;
      if (rec) {
        restore(rec);
        return;
      }
      // pre-migration links still work
      const legacy = findLegacyBySlug(loadId);
      if (legacy) {
        restore({
          name: legacy.name,
          brief: legacy.brief,
          graph: legacy.graph,
          verdict: legacy.verdict,
          kpis: legacy.kpis,
        });
      }
    })();
    return () => {
      alive = false;
    };
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
        addEntry({ kind: 'solve', solve: ev.solve });
        break;
      case 'verdict':
        setVerdict(ev.verdict);
        addEntry({ kind: 'verdict', verdict: ev.verdict });
        break;
      case 'family':
        setFamily({ id: ev.family, label: ev.label });
        addEntry({ kind: 'note', text: `Router → ${ev.label}${ev.reason ? ` (${ev.reason})` : ''}` });
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
      case 'done':
        setDoneOk(ev.success);
        setStatus('finished');
        // remix chains: the next instruction edits the LATEST graph
        if (remixSource && ev.graph) setRemixSource({ name: remixSource.name, graph: ev.graph });
        addEntry({
          kind: 'note',
          text: `${remixSource ? 'Remix' : 'Build'} finished — ${ev.unitCount} units, ${ev.streamCount} streams${ev.success ? '' : ' (with problems — see the session)'}.`,
        });
        canvasRef.current?.fit();
        break;
    }
  };

  // load a plant for remixing (?remix=reference → the ammonia family's
  // reference graph; ?remix=<id> → a saved project from the library)
  useEffect(() => {
    const remixId = new URLSearchParams(window.location.search).get('remix');
    if (!remixId) return;
    let alive = true;
    void (async () => {
      let src: { name: string; graph: FlowGraph } | null = null;
      if (remixId === 'reference') {
        const fam = getFamily('ammonia');
        src = { name: 'The reference plant', graph: fam.referenceGraph() };
      } else {
        const rec = await getPlant(remixId);
        if (rec) src = { name: rec.name, graph: rec.graph };
      }
      if (!alive || !src) return;
      const fid = src.graph.family && isFamilyId(src.graph.family) ? src.graph.family : 'ammonia';
      const fam = getFamily(fid);
      setRemixSource(src);
      setGraph(src.graph);
      setFamily({ id: fid, label: `${fam.name} — ${fam.route}` });
      // no log entry on purpose: the empty state (with remix examples) is the
      // greeting — adding a note would replace it with a bare transcript
      setChatOpen(true);
    })();
    return () => {
      alive = false;
    };
  }, [addEntry]);

  async function startBuild() {
    if (!brief.trim() || status === 'running') return;
    setStatus('running');
    setPhase(null);
    if (!remixSource) setGraph(null);
    setEntries([{ key: ++keyRef.current, kind: 'user', text: brief.trim() }]);
    setSolve(null);
    setVerdict(null);
    setDoneOk(null);
    setSelected(null);
    setSaved(false);
    setSavedId(null);
    if (!remixSource) setFamily(null);
    setTour(null);
    setChatOpen(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(remixSource ? '/api/agent/remix' : '/api/agent/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remixSource ? { graph: remixSource.graph, instruction: brief } : { brief }),
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
    if (!remixSource) setGraph(null);
    setEntries([]);
    setSolve(null);
    setVerdict(null);
    setDoneOk(null);
    setSelected(null);
    setSaved(false);
    setSavedId(null);
    if (!remixSource) setFamily(null);
    setTour(null);
    setChatOpen(true);
  }

  // save as a first-class project (IndexedDB, this browser) — one click to
  // reopen it any time from the home grid
  async function saveProject(): Promise<PlantRecord | null> {
    if (!graph) return null;
    const now = new Date().toISOString();
    const rec: PlantRecord = {
      id: newPlantId(),
      name: remixSource
        ? `${remixSource.name.slice(0, 40)} — remixed`
        : brief.trim().slice(0, 48) || 'Agent-built plant',
      brief: brief.trim(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: PLANT_SCHEMA_VERSION,
      ownerId: getOwnerId(),
      graph,
      kpis: solve?.kpis ?? null,
      verdict,
      productionTpd: solve?.kpis.productionTpd ?? null,
      source: 'user',
      family: family?.id ?? graph.family,
      tour,
    };
    try {
      await putPlant(rec);
      setSaved(true);
      setSavedId(rec.id);
      toast.success('Project saved', {
        action: {
          label: 'Open',
          onClick: () => {
            window.location.href = `/plant/p/${rec.id}`;
          },
        },
      });
      return rec;
    } catch {
      addEntry({ kind: 'error', text: 'Could not save in this browser (storage unavailable).' });
      return null;
    }
  }

  // save (if needed) and jump to the project page where the tour player
  // lives — voice, music, spotlight, step controls
  async function takeTour() {
    if (!graph) return;
    let id = savedId;
    if (!id) {
      const rec = await saveProject();
      id = rec?.id ?? null;
    }
    if (id) window.location.href = `/plant/p/${id}`;
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
          <div className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
              AI Plant Builder
            </span>
            {remixSource && (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em] sm:inline"
                style={{ borderColor: C.utility, color: C.utility }}
                title={`Remixing ${remixSource.name}`}
              >
                REMIX
              </span>
            )}
            {family && (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em] sm:inline"
                style={{ borderColor: C.nh3, color: C.nh3 }}
                title={family.label}
              >
                {family.id === 'general' ? 'GENERAL BUILD' : `${family.label.split(' — ')[0].toUpperCase()} FAMILY`}
              </span>
            )}
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            {remixSource
              ? `remixing: ${remixSource.name} · ${unitCount} units`
              : unitCount > 0
                ? `${unitCount} units · ${streamCount} streams`
                : 'describe the plant — the agents build it'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status === 'finished' && tour && graph && (
            <button
              onClick={() => void takeTour()}
              className="hidden items-center rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold sm:flex"
              style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
              title="Save the plant and play the docent's guided tour — voice and music"
            >
              ▶ Take the tour
            </button>
          )}
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
          {savedId && (
            <Link
              href={`/plant/p/${savedId}`}
              className="hidden items-center rounded-full border px-3 py-1 text-[11.5px] font-bold sm:flex"
              style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
              title="Open the saved project"
            >
              Open project →
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* the studio: stage + session */}
      <main className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* stage */}
        <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Live flowsheet stage">
          <div className="min-h-0 flex-1">
            <BuildCanvas
              ref={canvasRef}
              graph={graph}
              selected={selected}
              warm={status === 'finished'}
              onUnitClick={(id) => setSelected((cur) => (cur === id ? null : id))}
              onBackgroundClick={() => setSelected(null)}
            />
          </div>
          {unitCount > 0 && (
            <div
              className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.14em]"
              style={{ background: 'var(--fs-paper-a95)', borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
            >
              LIVE FLOWSHEET · {unitCount} UNITS · {streamCount} STREAMS
            </div>
          )}
          {graph && selected && <UnitInspector graph={graph} unitId={selected} onClose={() => setSelected(null)} />}
        </section>

        {/* session — the chat */}
        {chatOpen ? (
          <aside
            className="flex h-[56dvh] w-full shrink-0 flex-col border-t lg:h-auto lg:w-[420px] lg:border-l lg:border-t-0"
            style={{ borderColor: 'var(--fs-band-line)' }}
            aria-label="Build session"
          >
            <SessionPanel
              entries={entries}
              status={status}
              phase={phase}
              brief={brief}
              onBriefChange={setBrief}
              onStart={startBuild}
              onStop={stopBuild}
              onReset={resetToIdle}
              onSave={() => void saveProject()}
              onZoomIn={() => {
                setChatOpen(false);
                canvasRef.current?.fit();
              }}
              onCollapse={() => setChatOpen(false)}
              saved={saved}
              hasGraph={unitCount > 0}
              unitCount={unitCount}
              streamCount={streamCount}
              doneOk={doneOk}
              tourReady={tour !== null && status === 'finished'}
              onTakeTour={() => void takeTour()}
              remixName={remixSource?.name ?? null}
            />
          </aside>
        ) : (
          <>
            {/* desktop rail */}
            <aside
              className="hidden w-[52px] shrink-0 flex-col items-center gap-3 border-l py-3 lg:flex"
              style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}
              aria-label="Session, collapsed"
            >
              <button
                onClick={() => setChatOpen(true)}
                aria-label="Open the session panel"
                title="Open the session panel"
                className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: 'var(--fs-band-line)', color: C.ink }}
              >
                <ChevronRight size={16} />
              </button>
              <div className="flex flex-col items-center gap-2 pt-1">
                {running && (
                  <span
                    className="bd-pulse inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: phase ? PHASE_COLOR[phase] : C.gas }}
                  />
                )}
                <span
                  className="font-mono text-[10px] font-extrabold tracking-[0.22em]"
                  style={{ color: C.inkSoft, writingMode: 'vertical-rl' }}
                >
                  SESSION
                </span>
              </div>
            </aside>
            {/* mobile reopen pill — raised above the canvas legend */}
            <button
              onClick={() => setChatOpen(true)}
              className="hover-band fixed bottom-16 right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-bold shadow-lg lg:hidden"
              style={{ background: C.paper, borderColor: 'var(--fs-band-line)', color: C.ink }}
            >
              {running && (
                <span
                  className="bd-pulse inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: phase ? PHASE_COLOR[phase] : C.gas }}
                />
              )}
              Session
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </main>
    </div>
  );
}
