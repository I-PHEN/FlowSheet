'use client';

/**
 * Plant workspace — top bar (back · title · mode switch · tutor toggle),
 * full-bleed flowsheet canvas, right-side panel that swaps between the
 * tutor home, a running tour, and the selected unit/stream detail.
 */

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { C } from '@/lib/design/tokens';
import { baseCase, run } from '@/lib/engine';
import { STREAM_MAP, UNIT_MAP } from '@/lib/flowsheet/layout';
import { bboxOf } from '@/lib/flowsheet/geom';
import type { Tour } from '@/lib/content/units';
import { FlowsheetCanvas, type CanvasHandle } from '@/components/flowsheet/Canvas';
import type { Focus } from '@/components/flowsheet/Diagram';
import { DetailPanel } from './DetailPanel';
import { ColorAnswer, TourRunner, TutorHome } from './TutorPanel';

type TourState = { tour: Tour; idx: number } | null;

function refBox(ref: Focus) {
  if (ref.type === 'unit') {
    const u = UNIT_MAP[ref.id];
    return u ? { x: u.x, y: u.y, w: u.w, h: u.h } : null;
  }
  const s = STREAM_MAP[ref.id];
  return s ? bboxOf(s.pts) : null;
}

export function Workspace() {
  // one deterministic solve of the base case — real numbers everywhere
  const result = useMemo(() => run(baseCase()), []);
  const canvasRef = useRef<CanvasHandle>(null);
  const [selected, setSelected] = useState<Focus | null>(null);
  const [tour, setTour] = useState<TourState>(null);
  const [colors, setColors] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const spotlight = tour ? tour.tour.steps[tour.idx].ref : null;

  const startTour = (t: Tour) => {
    setColors(false);
    setSelected(null);
    setTour({ tour: t, idx: 0 });
    setPanelOpen(true);
    const b = refBox(t.steps[0].ref);
    if (b) canvasRef.current?.panTo(b);
  };

  const stepTo = (i: number) => {
    if (!tour) return;
    const idx = Math.max(0, Math.min(tour.tour.steps.length - 1, i));
    setTour({ ...tour, idx });
    const b = refBox(tour.tour.steps[idx].ref);
    if (b) canvasRef.current?.panTo(b);
  };

  const select = (f: Focus | null) => {
    if (f) {
      // manual selection interrupts a running tour
      setTour(null);
      setColors(false);
      setPanelOpen(true);
    }
    setSelected(f);
  };

  const exitTour = () => {
    setTour(null);
    canvasRef.current?.fit();
  };

  const panelBody = selected ? (
    <DetailPanel result={result} selected={selected} onSelect={select} onClose={() => setSelected(null)} />
  ) : tour ? (
    <TourRunner tour={tour.tour} idx={tour.idx} onStep={stepTo} onExit={exitTour} />
  ) : colors ? (
    <ColorAnswer onBack={() => setColors(false)} />
  ) : (
    <TutorHome onTour={startTour} onColors={() => setColors(true)} />
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
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold transition-colors hover:bg-[#E9E7E1]"
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
              aria-selected="true"
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={{ background: C.ink, color: C.paper }}
            >
              Explore
            </button>
            <button
              role="tab"
              aria-selected="false"
              disabled
              title="Live operating controls arrive in the next phase — the legacy console is at /legacy"
              className="cursor-not-allowed rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={{ color: C.inkFaint }}
            >
              Operate
            </button>
          </div>

          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-[#E9E7E1]"
            style={{
              borderColor: C.bandLine,
              color: C.ink,
              background: panelOpen ? C.band : C.paper,
            }}
          >
            Learn
          </button>

          <a
            href="/legacy"
            className="hidden rounded-full px-2 py-1 text-[11px] font-semibold underline-offset-2 hover:underline md:block"
            style={{ color: C.inkFaint }}
          >
            Console
          </a>
        </div>
      </header>

      {/* main */}
      <main className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <FlowsheetCanvas
            ref={canvasRef}
            result={result}
            selected={selected}
            spotlight={spotlight}
            onSelect={select}
          />
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
            className="fixed inset-x-0 bottom-0 z-30 max-h-[62dvh] overflow-y-auto rounded-t-2xl border-t p-5 pb-8 shadow-2xl lg:hidden"
            style={{ background: C.paper, borderColor: C.bandLine }}
          >
            {panelBody}
            <button
              onClick={() => setPanelOpen(false)}
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
