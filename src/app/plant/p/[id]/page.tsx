'use client';

/**
 * /plant/p/[id] — a saved plant as a first-class citizen.
 *
 * Same stage as the prebuilts: the live BuildCanvas renderer (pan, zoom,
 * hover streams, click units), an inspector, and — the point of the page —
 * a narrated guided tour generated from the build itself. The tour runs as
 * CINEMA: the director flies the camera stop-to-stop, captions stream in
 * the CinemaBar at the bottom of the stage, and clicking any unit mid-tour
 * drops into free roam (camera flies there, a caption card appears).
 *
 * Full parity with the prebuilt workspaces means OPERATE too: Learn | Operate
 * in the header, and a control room whose levers are derived from the graph
 * + registry (never per-plant code) — every lever re-solves the whole
 * flowsheet live, the answer stays pinned while the levers scroll, and the
 * stream dots ride the new flows. The record in the local project store is
 * the only input; nothing here knows or cares that the plant was drawn by
 * AI agents rather than shipped in code.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Download, PanelRight, Wand2 } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { executeGraph } from '@/lib/engine';
import type { FlowGraph } from '@/lib/engine/graph';
import type { PlantResult } from '@/lib/engine/types';
import { BuildCanvas, UnitInspector, type BuildCanvasHandle } from '@/components/builder/BuildCanvas';
import { PlantOperate } from '@/components/builder/PlantOperate';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CinemaBar } from '@/components/learn/CinemaBar';
import { TourIndex } from '@/components/learn/TourIndex';
import { useTourDirector } from '@/lib/ui/tourDirector';
import { useCinemaPanel } from '@/lib/ui/useCinemaPanel';
import { getPlant, ensureMigrated, exportRecord } from '@/lib/projects/store';
import { effectiveFamily, type PlantRecord } from '@/lib/projects/record';
import { patchSpec } from '@/lib/projects/operate';
import { getFamily } from '@/lib/families';
import { generateTour, roamStep } from '@/lib/projects/tour';

type Mode = 'learn' | 'operate';

/** solve, or null when this combination doesn't — honesty over fake numbers */
function trySolve(g: FlowGraph): PlantResult | null {
  try {
    const r = executeGraph(g);
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [rec, setRec] = useState<PlantRecord | null | 'missing'>(null);
  const [userSelected, setUserSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('learn');
  // null = the saved design point; a patched graph once a lever has moved
  const [liveGraph, setLiveGraph] = useState<FlowGraph | null>(null);
  const canvasRef = useRef<BuildCanvasHandle>(null);

  useEffect(() => {
    let alive = true;
    void ensureMigrated().then(async () => {
      const r = await getPlant(id);
      if (alive) setRec(r ?? 'missing');
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // the docent's authored tour (saved with the record) beats the auto-tour
  const tour = useMemo(
    () => (rec && rec !== 'missing' ? (rec.tour ?? generateTour(rec)) : null),
    [rec],
  );
  const fam = useMemo(
    () => (rec && rec !== 'missing' ? getFamily(effectiveFamily(rec)) : null),
    [rec],
  );

  // the tour brain — page level, panel-independent. Free-roam captions for
  // units without an authored stop are synthesized from registry facts.
  const graph = rec && rec !== 'missing' ? rec.graph : null;
  const synthesize = useCallback(
    (ref: { type: 'unit' | 'stream'; id: string }): { title: string; text: string } | null => {
      if (!graph || ref.type !== 'unit') return null;
      return roamStep(graph, ref.id);
    },
    [graph],
  );
  const director = useTourDirector(synthesize);

  // camera choreography: the director emits intents, this canvas executes
  useEffect(() => {
    const cam = director.cam;
    if (!cam) return;
    if (cam.kind === 'fit') canvasRef.current?.fit();
    else canvasRef.current?.flyToRef(cam.ref);
  }, [director.cam]);

  // the tour owns the spotlight while it runs; the user owns it otherwise
  const spotlightUnit =
    director.tour && director.stop && director.stop.ref.type === 'unit'
      ? director.stop.ref.id
      : userSelected;
  const touring = director.tour !== null;
  // tours collapse the panel for a full-screen view; the user's toggle still
  // works mid-tour and an untouched panel returns when the tour ends
  const { showPanel, togglePanel } = useCinemaPanel(touring);

  const startTour = useCallback(() => {
    if (!tour) return;
    // unlockAudio() fires inside director.start() — this click is the gesture
    setUserSelected(null);
    director.start(tour);
  }, [tour, director]);

  // --- operate: the live control room over the saved graph -----------------
  // (`graph` is the record's design-point graph, declared above for the
  // tour's roam synthesis — the same object feeds the solve baseline)
  // the design-point solve: the delta baseline (fallback: the saved kpis)
  const baseResult = useMemo(() => (graph ? trySolve(graph) : null), [graph]);
  // the live graph: the record's own object until a lever moves (so the
  // canvas and its solve cache keep their identity), then immutable patches
  const opGraph = liveGraph ?? graph;
  const liveResult = useMemo(() => (opGraph ? trySolve(opGraph) : null), [opGraph]);

  const enterOperate = useCallback(() => {
    director.end();
    setUserSelected(null);
    setMode('operate');
  }, [director]);
  const enterLearn = useCallback(() => {
    director.end();
    setMode('learn');
    setLiveGraph(null); // the book mode always shows the saved design point
  }, [director]);
  const onLever = useCallback(
    (unitId: string, specKey: string, value: number) => {
      setLiveGraph((cur) => {
        const base = cur ?? (rec && rec !== 'missing' ? rec.graph : null);
        return base ? patchSpec(base, unitId, specKey, value) : cur;
      });
    },
    [rec],
  );
  const resetLever = useCallback(() => setLiveGraph(null), []);

  if (rec === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: C.canvas }}>
        <span className="bd-pulse font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: C.inkSoft }}>
          LOADING PROJECT…
        </span>
      </div>
    );
  }

  if (rec === 'missing') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: C.canvas }}>
        <div className="text-[20px] font-extrabold" style={{ color: C.ink }}>Project not found</div>
        <p className="max-w-[380px] text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
          It may have been deleted in this browser, or the link belongs to another browser&apos;s
          library. Exported plants travel as files — import one from the home page.
        </p>
        <Link href="/" className="mt-1 rounded-full border px-5 py-2.5 text-[13px] font-bold" style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}>
          Back to Flowsheet
        </Link>
      </div>
    );
  }

  const unitCount = rec.graph.units.length;
  const streamCount = rec.graph.streams.filter((s) => !s.implicit).length;
  const k = rec.kpis;

  return (
    <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
      {/* header */}
      <header
        className="flex h-[54px] shrink-0 items-center gap-3 border-b px-3 sm:px-4"
        style={{ borderColor: C.bandLine, background: C.paper }}
      >
        <Link
          href="/"
          className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold"
          style={{ borderColor: C.bandLine, color: C.ink }}
          title="Back to Flowsheet"
          aria-label="Back to Flowsheet"
        >
          ←
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
              {rec.name}
            </span>
            {fam && (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em] sm:inline"
                style={{ borderColor: C.nh3, color: C.nh3 }}
                title={fam.route}
              >
                {fam.name.toUpperCase()} · {fam.id === 'general' ? (rec.graph.product?.species ?? 'CUSTOM') : fam.productSpecies}
              </span>
            )}
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            {unitCount} units · {streamCount} streams · saved{' '}
            {new Date(rec.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* mode switch — the same Learn | Operate axis as the prebuilts */}
          <div
            className="flex items-center rounded-full border p-0.5"
            style={{ borderColor: C.bandLine, background: C.canvas }}
            role="tablist"
            aria-label="Project mode"
          >
            <button
              role="tab"
              aria-selected={mode === 'learn'}
              onClick={enterLearn}
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={mode === 'learn' ? { background: C.accent, color: C.onAccent, borderColor: C.accentLine } : { color: C.inkSoft }}
            >
              Learn
            </button>
            <button
              role="tab"
              aria-selected={mode === 'operate'}
              onClick={enterOperate}
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={mode === 'operate' ? { background: C.accent, color: C.onAccent, borderColor: C.accentLine } : { color: C.inkSoft }}
            >
              Operate
            </button>
          </div>
          <button
            onClick={togglePanel}
            aria-label={showPanel ? 'Hide the side panel' : 'Show the side panel'}
            title={showPanel ? 'Hide the side panel' : 'Show the side panel'}
            className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{
              borderColor: C.bandLine,
              color: showPanel ? C.ink : C.inkSoft,
              background: showPanel ? C.band : C.paper,
            }}
          >
            <PanelRight size={15} />
          </button>
          <button
            type="button"
            onClick={() => exportRecord(rec)}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold"
            style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
            title="Export as .flowsheet.json"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <Link
            href={`/plant/builder?remix=${rec.id}`}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold"
            style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
            title="Open this plant in the AI builder — describe changes and the agents will remix, re-solve and re-judge it"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Remix with AI</span>
            <span className="sm:hidden">Remix</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* the studio: stage + project panel */}
      <main className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* stage */}
        <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Project flowsheet">
          <div className="relative min-h-0 flex-1">
            <BuildCanvas
              ref={canvasRef}
              graph={opGraph ?? rec.graph}
              selected={spotlightUnit}
              warm
              onUnitClick={(uid) => {
                if (touring) {
                  // a click during a tour = free roam: fly there, caption, pause
                  director.roamTo({ type: 'unit', id: uid });
                  return;
                }
                setUserSelected((cur) => (cur === uid ? null : uid));
              }}
              onBackgroundClick={() => setUserSelected(null)}
            />
            {/* the tour lives on the stage — captions at the bottom, narration
                owned by the page: it survives everything */}
            <CinemaBar director={director} />
          </div>
          <div
            className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.14em]"
            style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
          >
            YOUR PLANT · {unitCount} UNITS · {streamCount} STREAMS
          </div>
          {rec.graph && userSelected && !touring && (
            <UnitInspector graph={opGraph ?? rec.graph} unitId={userSelected} onClose={() => setUserSelected(null)} />
          )}
        </section>

        {/* project panel — the mode axis owns it: the book in Learn, the
            control room in Operate (the answer pinned, levers scroll under).
            During a tour the cinema takes the width (useCinemaPanel); the
            header toggle brings it back anytime. */}
        {showPanel && (
        <aside
          className="flex h-[52dvh] w-full shrink-0 flex-col overflow-y-auto border-t lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0"
          style={{ borderColor: C.bandLine, background: C.paper }}
          aria-label="Project details"
        >
          {mode === 'operate' ? (
            <div className="p-5">
              <PlantOperate
                graph={opGraph ?? rec.graph}
                result={liveResult}
                baseResult={baseResult}
                designKpis={rec.kpis}
                dirty={liveGraph !== null}
                onChange={onLever}
                onReset={resetLever}
              />
            </div>
          ) : (
            <>
          {/* brief */}
          <div className="border-b p-4" style={{ borderColor: C.bandLine }}>
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
              THE BRIEF
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: C.ink }}>
              {rec.brief || 'No brief was recorded for this plant.'}
            </p>
          </div>

          {/* the numbers */}
          <div className="border-b p-4" style={{ borderColor: C.bandLine }}>
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
              THE NUMBERS
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(k?.familyKpis && k.familyKpis.length > 0
                ? k.familyKpis.map((f) => ({
                    label: f.label.toUpperCase(),
                    value: f.value,
                  }))
                : [
                    { label: 'PRODUCTION', value: k ? `${Math.round(k.productionTpd).toLocaleString()} t/d` : '—' },
                    { label: 'PRODUCT PURITY', value: k ? `${(k.productPurityWt * 100).toFixed(1)} wt%` : '—' },
                    { label: 'PER-PASS CONVERSION', value: k ? `${(k.perPassConv * 100).toFixed(1)}%` : '—' },
                  ]
              ).map((f) => (
                <Stat key={f.label} label={f.label} value={f.value} />
              ))}
              <Stat label="UNITS · STREAMS" value={`${unitCount} · ${streamCount}`} />
            </div>
            {k && (
              <div
                className="mt-2.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider"
                style={{ borderColor: C.nh3, color: C.nh3 }}
              >
                MASS + ENERGY BALANCE CONVERGED
              </div>
            )}
          </div>

          {/* the critic */}
          {rec.verdict && (
            <div className="border-b p-4" style={{ borderColor: C.bandLine }}>
              <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
                THE CRITIC
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider"
                  style={{
                    borderColor: rec.verdict.verdict === 'pass' ? C.nh3 : C.warn,
                    color: rec.verdict.verdict === 'pass' ? C.nh3 : C.warn,
                  }}
                >
                  {rec.verdict.verdict.toUpperCase()} · {rec.verdict.score}/100
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
                {rec.verdict.summary}
              </p>
              {rec.verdict.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {rec.verdict.issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed" style={{ color: C.inkSoft }}>
                      <span style={{ color: C.warn }}>·</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* the tour */}
          <div className="p-4">
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
              {'GUIDED TOUR · ' + (rec.tour ? 'WRITTEN BY THE DOCENT FOR THIS PLANT' : 'GENERATED FROM YOUR BUILD')}
            </div>

            {!touring ? (
              <>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
                  A narrated walk down the process path — Orion flies the camera unit to unit,
                  captions arrive as he speaks them at the bottom of the sheet, and you can pause
                  anytime to explore on your own. Voice and a soft instrumental bed, just like the
                  prebuilt plants.
                </p>
                <button
                  type="button"
                  onClick={startTour}
                  disabled={!tour}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border text-[13px] font-bold disabled:opacity-40"
                  style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
                >
                  <span aria-hidden="true">▶</span>
                  {tour ? tour.chip : 'No tour available'}
                </button>
              </>
            ) : (
              <div className="mt-2">
                <TourIndex director={director} />
              </div>
            )}
          </div>
            </>
          )}
        </aside>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: C.bandLine, background: C.canvas }}>
      <div className="font-mono text-[8.5px] font-bold tracking-[0.14em]" style={{ color: C.inkFaint }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-bold" style={{ color: C.ink }}>
        {value}
      </div>
    </div>
  );
}
