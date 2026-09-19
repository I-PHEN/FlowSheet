'use client';

/**
 * Plant workspace — top bar (back · title · mode switch · panel toggle),
 * full-bleed flowsheet stage, and a right-side panel.
 *
 * Learn (one mode, two paces): the guided tour is CINEMA — the director
 * flies the camera stop-to-stop, captions stream in the CinemaBar at the
 * bottom of the stage, and the narrator is owned by the page, so panels
 * may open and close freely. Clicking anything on the sheet mid-tour
 * drops into free roam (camera flies there, caption card appears);
 * RESUME returns to the thread. Operate stays the control room.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { baseCase, run } from '@/lib/engine';
import type { PlantSpec } from '@/lib/engine/plant';
import { REFERENCE_LAYOUT, STREAM_MAP, UNIT_MAP } from '@/lib/flowsheet/layout';
import { bboxOf } from '@/lib/flowsheet/geom';
import { UNIT_CONTENT, type Tour } from '@/lib/content/units';
import { FlowsheetCanvas, type CanvasHandle } from '@/components/flowsheet/Canvas';
import type { Focus } from '@/components/flowsheet/Diagram';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTourDirector } from '@/lib/ui/tourDirector';
import { useCinemaPanel } from '@/lib/ui/useCinemaPanel';
import { CinemaBar } from '@/components/learn/CinemaBar';
import { TourIndex } from '@/components/learn/TourIndex';
import { DetailPanel } from './DetailPanel';
import { OperatePanel } from './OperatePanel';
import { ColorAnswer, TutorHome } from './TutorPanel';

type Mode = 'learn' | 'operate';

function refBox(ref: Focus) {
  if (ref.type === 'unit') {
    const u = UNIT_MAP[ref.id];
    return u ? { x: u.x, y: u.y, w: u.w, h: u.h } : null;
  }
  const s = STREAM_MAP[ref.id];
  return s ? bboxOf(s.pts) : null;
}

export function Workspace() {
  // ONE mode axis: learn = the book (tours + unit stories at the design
  // case), operate = the control room (levers, live deltas)
  const [mode, setMode] = useState<Mode>('learn');
  // the live plant specification — base case until a lever moves
  const [spec, setSpec] = useState<PlantSpec>(() => baseCase());
  // the whole canvas + every panel + every tooltip reads from this one solve
  const result = useMemo(() => run(spec), [spec]);
  const baseKpis = useMemo(() => run(baseCase()).kpis, []);
  const canvasRef = useRef<CanvasHandle>(null);
  const [selected, setSelected] = useState<Focus | null>(null);
  const [colors, setColors] = useState(false);

  // the tour brain — page level, panel-independent (that's the point)
  const synthesize = useCallback(
    (ref: Focus): { title: string; text: string } | null => {
      if (ref.type !== 'unit') return null;
      const story = UNIT_CONTENT[ref.id];
      if (!story) return null;
      return { title: result.units[ref.id]?.name ?? ref.id, text: story.plain };
    },
    [result],
  );
  const director = useTourDirector(synthesize);
  // tours collapse the panel for a full-screen view; the user's toggle still
  // works mid-tour and an untouched panel returns when the tour ends
  const { showPanel: panelOpen, togglePanel, openPanel } = useCinemaPanel(director.tour !== null);

  // camera choreography: the director emits intents (data), this canvas
  // executes them — a new intent object fires this effect exactly once
  useEffect(() => {
    const cam = director.cam;
    if (!cam) return;
    if (cam.kind === 'fit') canvasRef.current?.fit();
    else {
      const b = refBox(cam.ref);
      if (b) canvasRef.current?.panTo(b);
    }
  }, [director.cam]);

  const enterOperate = () => {
    director.end();
    setMode('operate');
    setColors(false);
    setSelected(null);
    openPanel(true);
  };

  const enterLearn = () => {
    // the book mode always shows design conditions — leave the lab, reset
    director.end();
    setMode('learn');
    setSpec(baseCase());
  };

  const patchSpec = (patch: Partial<PlantSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const resetSpec = () => setSpec(baseCase());

  const startTour = (t: Tour) => {
    // unlockAudio() fires inside director.start() — this click is the gesture.
    // The cinema owns the panel now: it collapses for the tour (useCinemaPanel)
    setColors(false);
    setSelected(null);
    director.start(t);
  };

  const select = (f: Focus | null) => {
    if (f && director.tour) {
      // a click during a tour = free roam: fly there, caption card, pause
      director.roamTo(f);
    }
    setSelected(f);
  };

  const panelBody = director.tour ? (
    <TourIndex director={director} />
  ) : selected ? (
    <DetailPanel
      result={result}
      selected={selected}
      onSelect={select}
      onClose={() => setSelected(null)}
      condLabel={mode === 'operate' ? 'operating point' : 'base case'}
    />
  ) : colors ? (
    <ColorAnswer onBack={() => setColors(false)} />
  ) : mode === 'operate' ? (
    <OperatePanel
      spec={spec}
      result={result}
      baseKpis={baseKpis}
      onChange={patchSpec}
      onReset={resetSpec}
    />
  ) : (
    <TutorHome onTour={startTour} onColors={() => setColors(true)} remixHref="/plant/builder?remix=reference" />
  );

  return (
    <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
      {/* top bar */}
      <header
        className="flex h-[54px] shrink-0 items-center gap-3 border-b px-3 sm:px-4"
        style={{ background: C.paper, borderColor: C.bandLine }}
      >
        <Link
          href="/"
          aria-label="Back to library"
          className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold"
          style={{ borderColor: C.bandLine, color: C.ink }}
        >
          ←
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
            Steam-Methane Reforming Plant
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            Reference plant · 1,000 t/d design · 19 units · 27 streams
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* mode switch */}
          <div
            className="flex items-center rounded-full border p-0.5"
            style={{ borderColor: C.bandLine, background: C.canvas }}
            role="tablist"
            aria-label="Workspace mode"
          >
            <button
              role="tab"
              aria-selected={mode === 'learn'}
              onClick={enterLearn}
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={mode === 'learn' ? { background: C.ink, color: C.paper } : { color: C.inkSoft }}
            >
              Learn
            </button>
            <button
              role="tab"
              aria-selected={mode === 'operate'}
              onClick={enterOperate}
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={mode === 'operate' ? { background: C.ink, color: C.paper } : { color: C.inkSoft }}
            >
              Operate
            </button>
          </div>

          <button
            onClick={togglePanel}
            aria-label={panelOpen ? 'Hide the side panel' : 'Show the side panel'}
            title={panelOpen ? 'Hide the side panel' : 'Show the side panel'}
            className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{
              borderColor: C.bandLine,
              color: panelOpen ? C.ink : C.inkSoft,
              background: panelOpen ? C.band : C.paper,
            }}
          >
            <PanelRight size={15} />
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* main */}
      <main className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <FlowsheetCanvas
            ref={canvasRef}
            layout={REFERENCE_LAYOUT}
            result={result}
            selected={selected}
            spotlight={director.stop?.ref ?? null}
            onSelect={select}
          />
          {/* the tour lives on the stage — captions at the bottom, narration
              owned by the page: closing the panel no longer silences it */}
          <CinemaBar director={director} />
        </div>

        {/* desktop panel */}
        {panelOpen && (
          <aside
            className="hidden w-[380px] shrink-0 overflow-y-auto border-l p-5 lg:block"
            style={{ background: C.paper, borderColor: C.bandLine }}
          >
            {panelBody}
          </aside>
        )}

        {/* mobile sheet */}
        {panelOpen && (
          <aside
            className="fixed inset-x-0 bottom-0 z-40 max-h-[62dvh] overflow-y-auto rounded-t-2xl border-t p-5 pb-8 shadow-2xl lg:hidden"
            style={{ background: C.paper, borderColor: C.bandLine }}
          >
            {panelBody}
            <button
              onClick={() => openPanel(false)}
              className="absolute right-4 top-4 rounded-md border px-2 py-0.5 text-[12px] font-bold"
              style={{ borderColor: C.bandLine, color: C.inkSoft }}
            >
              ✕
            </button>
          </aside>
        )}
      </main>
    </div>
  );
}
