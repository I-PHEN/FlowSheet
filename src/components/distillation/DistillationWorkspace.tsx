'use client';

/**
 * Distillation workspace — rung 2 of the ladder. Same studio paradigm as
 * the flash workspace (top bar · one-sheet canvas · learn panel). Explore =
 * the book; Operate = six levers that re-solve the McCabe–Thiele column
 * live, so the student FEELS reflux, stages, feed tray, and feed condition
 * move the split.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '@/lib/design/tokens';
import {
  DISTILL_UNIT_MAP,
  DISTILL_STREAM_MAP,
  DISTILL_UNIT_STREAMS,
  DISTILLATION_LAYOUT,
} from '@/lib/flowsheet/distillationLayout';
import { bboxOf } from '@/lib/flowsheet/geom';
import {
  DISTILL_BASE,
  distillKpis,
  distillModel,
  solveDistillation,
  type DistillKpis,
  type DistillSpec,
} from '@/lib/plants/distillation';
import { DISTILL_TOURS, DISTILL_UNIT_CONTENT } from '@/lib/content/distillation';
import type { Tour } from '@/lib/content/units';
import { FlowsheetCanvas, type CanvasHandle } from '@/components/flowsheet/Canvas';
import type { Focus } from '@/components/flowsheet/Diagram';
import { ThemeToggle } from '@/components/ThemeToggle';
import { unlockAudio } from '@/lib/audio/tourAudio';
import { setTourActive } from '@/lib/ui/tourBus';
import { DetailPanel, type PlantContent } from '@/components/workspace/DetailPanel';
import { ColorAnswer, TourRunner } from '@/components/workspace/TutorPanel';

type TourState = { tour: Tour; idx: number } | null;
type Mode = 'explore' | 'operate';

const DISTILL_PLANT_CONTENT: PlantContent = {
  unitMap: DISTILL_UNIT_MAP,
  unitStreams: DISTILL_UNIT_STREAMS,
  unitContent: DISTILL_UNIT_CONTENT,
};

function refBox(ref: Focus) {
  if (ref.type === 'unit') {
    const u = DISTILL_UNIT_MAP[ref.id];
    return u ? { x: u.x, y: u.y, w: u.w, h: u.h } : null;
  }
  const s = DISTILL_STREAM_MAP[ref.id];
  return s ? bboxOf(s.pts) : null;
}

// ---------------------------------------------------------------------------
// tutor home (distillation edition)
// ---------------------------------------------------------------------------

function DistillTutorHome({
  onTour,
  onColors,
}: {
  onTour: (t: Tour) => void;
  onColors: () => void;
}) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
        The flash drum, stacked
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
        One guided walkthrough — about four minutes. It traces the feed up and over the
        tower, then hands you six levers in Operate mode and a challenge: find the
        pinch.
      </p>
      <div className="mt-4 space-y-2">
        {DISTILL_TOURS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTour(t)}
            className="group flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left hover-band"
            style={{ borderColor: C.bandLine, background: C.paper }}
          >
            <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
              {t.chip}
            </span>
            <span
              className="text-[13px] font-bold transition-transform group-hover:translate-x-0.5"
              style={{ color: C.inkSoft }}
            >
              →
            </span>
          </button>
        ))}
        <button
          onClick={onColors}
          className="group flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left hover-band"
          style={{ borderColor: C.bandLine, background: C.paper }}
        >
          <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
            What do the colors and numbers mean?
          </span>
          <span
            className="text-[13px] font-bold transition-transform group-hover:translate-x-0.5"
            style={{ color: C.inkSoft }}
          >
            →
          </span>
        </button>
      </div>
      <p className="mt-5 text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>
        The tour is narrated over a soft instrumental bed — toggle either off mid-tour if you
        prefer silence. Finished? Switch to Operate and pull the levers yourself.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// operate panel (distillation edition — six levers, live scorecard)
// ---------------------------------------------------------------------------

interface Lever {
  key: keyof DistillSpec;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  hint: string;
}

const LEVERS: Lever[] = [
  {
    key: 'reflux',
    label: 'Reflux ratio R',
    unit: 'L / D',
    min: 0.4,
    max: 6,
    step: 0.05,
    fmt: (v) => v.toFixed(2),
    hint: 'The master lever. More reflux purifies the bottoms — but the condenser and reboiler bills climb with it. Slide it down slowly and watch the column pinch at its minimum.',
  },
  {
    key: 'stages',
    label: 'Number of stages',
    unit: 'trays',
    min: 6,
    max: 26,
    step: 1,
    fmt: (v) => v.toFixed(0),
    hint: 'More trays, better separation — with diminishing returns. Each extra tray buys less benzene removal than the one before it.',
  },
  {
    key: 'feedStage',
    label: 'Feed tray',
    unit: 'from top',
    min: 2,
    max: 22,
    step: 1,
    fmt: (v) => v.toFixed(0),
    hint: 'Where the feed meets the tower. The wrong tray wastes stages: the column warns you and the scorecard shows the cost. Find the optimum the panel reports.',
  },
  {
    key: 'heaterT',
    label: 'Feed temperature',
    unit: '°C',
    min: 25,
    max: 160,
    step: 1,
    fmt: (v) => v.toFixed(0),
    hint: 'The feed mood lever. Cold feed makes the reboiler work harder; hot, flashing feed unburdens it but raises the minimum reflux. Watch q and Qr move against each other.',
  },
  {
    key: 'zBenzene',
    label: 'Benzene in feed',
    unit: 'mol %',
    min: 0.25,
    max: 0.65,
    step: 0.01,
    fmt: (v) => (v * 100).toFixed(0),
    hint: 'Leaner feed, smaller distillate — and a higher minimum reflux. The difficulty of the split moves with the mixture you are handed.',
  },
  {
    key: 'xD',
    label: 'Distillate purity target',
    unit: 'mol %',
    min: 0.9,
    max: 0.995,
    step: 0.005,
    fmt: (v) => (v * 100).toFixed(1),
    hint: 'The spec. Pushing the last percent of purity costs a disproportionate amount of stages and reflux — recovery falls as xB chases the target.',
  },
];

function DistillLever({
  lever,
  value,
  onChange,
}: {
  lever: Lever;
  value: number;
  onChange: (patch: Partial<DistillSpec>) => void;
}) {
  const pct = ((value - lever.min) / (lever.max - lever.min)) * 100;
  return (
    <section>
      <div className="text-[12.5px] font-bold" style={{ color: C.ink }}>
        {lever.label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[20px] font-bold leading-none" style={{ color: C.ink }}>
          {lever.fmt(value)}
        </span>
        <span className="text-[12px]" style={{ color: C.inkSoft }}>
          {lever.unit}
        </span>
      </div>
      <input
        type="range"
        className="op-slider"
        min={lever.min}
        max={lever.max}
        step={lever.step}
        value={value}
        aria-label={`${lever.label} in ${lever.unit}`}
        onChange={(e) => onChange({ [lever.key]: Number(e.target.value) } as Partial<DistillSpec>)}
        style={
          {
            '--op-fill': `linear-gradient(to right, var(--fs-ink) 0%, var(--fs-ink) ${pct}%, var(--fs-band-line) ${pct}%, var(--fs-band-line) 100%)`,
          } as React.CSSProperties
        }
      />
      <div className="flex justify-between font-mono text-[10.5px]" style={{ color: C.inkFaint }}>
        <span>
          {lever.fmt(lever.min)} {lever.unit}
        </span>
        <span>
          {lever.fmt(lever.max)} {lever.unit}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
        {lever.hint}
      </p>
    </section>
  );
}

function DistillKpiRow({
  label,
  value,
  delta,
  deltaUnit,
  deltaGood,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaUnit?: string;
  deltaGood?: boolean;
}) {
  const showDelta = delta !== undefined && Math.abs(delta) > 0.05;
  const deltaColor = !showDelta ? C.inkFaint : delta! > 0 === deltaGood ? C.nh3 : C.warn;
  return (
    <div
      className="flex items-baseline justify-between gap-2 border-b py-1.5"
      style={{ borderColor: C.bandLine }}
    >
      <span className="text-[11.5px]" style={{ color: C.inkSoft }}>
        {label}
      </span>
      <span className="font-mono text-[13px] font-semibold" style={{ color: C.ink }}>
        {value}
        {showDelta && (
          <span className="ml-2 text-[11px] font-bold" style={{ color: deltaColor }}>
            {delta! > 0 ? '+' : '\u2212'}
            {Math.abs(delta!).toFixed(deltaUnit === '%' ? 1 : 2)} {deltaUnit}
          </span>
        )}
      </span>
    </div>
  );
}

function DistillOperatePanel({
  spec,
  kpis,
  base,
  warnings,
  onChange,
  onReset,
}: {
  spec: DistillSpec;
  kpis: DistillKpis;
  base: DistillKpis;
  warnings: string[];
  onChange: (patch: Partial<DistillSpec>) => void;
  onReset: () => void;
}) {
  const m = kpis.model;
  return (
    <div>
      <header>
        <div
          className="font-mono text-[11px] font-bold tracking-widest"
          style={{ color: C.inkSoft }}
        >
          OPERATE · LIVE
        </div>
        <h3 className="mt-0.5 text-[17px] font-semibold leading-tight" style={{ color: C.ink }}>
          The column levers
        </h3>
      </header>

      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: C.ink }}>
        The flowsheet is live. Each lever re-solves the 14-stage column instantly — every
        composition, duty, and internal flow follows. Move one thing at a time and watch
        the tower answer.
      </p>

      <div className="mt-5 space-y-5">
        {LEVERS.map((l) => (
          <DistillLever key={l.key} lever={l} value={spec[l.key]} onChange={onChange} />
        ))}
      </div>

      <section className="mt-6">
        <div
          className="font-mono text-[11px] font-bold tracking-widest"
          style={{ color: C.inkSoft }}
        >
          THE SCORECARD
        </div>
        <div className="mt-2">
          <DistillKpiRow
            label="Bottoms benzene xB"
            value={`${(kpis.xB * 100).toFixed(2)} %`}
            delta={-(kpis.xB - base.xB) * 100}
            deltaUnit="%"
            deltaGood
          />
          <DistillKpiRow
            label="Benzene recovery"
            value={`${(kpis.benzeneRecovery * 100).toFixed(1)} %`}
            delta={(kpis.benzeneRecovery - base.benzeneRecovery) * 100}
            deltaUnit="%"
            deltaGood
          />
          <DistillKpiRow
            label="Distillate product"
            value={`${kpis.distillateTpd.toFixed(1)} t/d`}
            delta={kpis.distillateTpd - base.distillateTpd}
            deltaUnit="t/d"
            deltaGood
          />
          <DistillKpiRow label="Minimum reflux Rmin" value={m.Rmin.toFixed(2)} />
          <DistillKpiRow label="Feed condition q" value={m.q.toFixed(2)} />
          <DistillKpiRow label="Reflux R / Rmin" value={m.Rmin > 1e-6 ? (spec.reflux / m.Rmin).toFixed(2) : '—'} />
          <DistillKpiRow
            label="Reboiler duty"
            value={`${kpis.reboilerMW.toFixed(2)} MW`}
            delta={-(kpis.reboilerMW - base.reboilerMW)}
            deltaUnit="MW"
          />
          <DistillKpiRow
            label="Condenser duty"
            value={`${kpis.condenserMW.toFixed(2)} MW`}
            delta={-(kpis.condenserMW - base.condenserMW)}
            deltaUnit="MW"
          />
          <DistillKpiRow label="Volatility α (PR)" value={m.alpha.toFixed(2)} />
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="mt-4">
          {warnings.map((w) => (
            <p key={w} className="text-[12px] leading-relaxed" style={{ color: C.warn }}>
              ⚠ {w}
            </p>
          ))}
        </section>
      )}

      <button
        onClick={onReset}
        className="hover-band mt-5 w-full rounded-lg border py-2 text-[12.5px] font-bold"
        style={{ borderColor: C.bandLine, color: C.ink }}
      >
        Reset to design point
      </button>

      <p className="mt-4 text-[11.5px] leading-relaxed" style={{ color: C.inkFaint }}>
        Same physics, different lesson: the volatility comes from the same Peng-Robinson
        EOS the flash drum used — the tower just repeats that flash fourteen times and
        lets reflux pay for the difference.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// workspace shell
// ---------------------------------------------------------------------------

export function DistillationWorkspace() {
  const [mode, setMode] = useState<Mode>('explore');
  const [spec, setSpec] = useState<DistillSpec>(() => DISTILL_BASE);
  const result = useMemo(() => solveDistillation(spec), [spec]);
  const model = useMemo(() => distillModel(spec), [spec]);
  const baseModel = useMemo(() => distillModel(DISTILL_BASE), []);
  const baseResult = useMemo(() => solveDistillation(DISTILL_BASE), []);
  const baseKpis = useMemo(() => distillKpis(baseResult, baseModel), [baseResult, baseModel]);
  const kpis = useMemo(() => distillKpis(result, model), [result, model]);
  const canvasRef = useRef<CanvasHandle>(null);
  const [selected, setSelected] = useState<Focus | null>(null);
  const [tour, setTour] = useState<TourState>(null);

  // publish tour state — the floating Build button ducks while a tour speaks
  useEffect(() => {
    setTourActive(tour !== null);
    return () => setTourActive(false);
  }, [tour]);
  const [colors, setColors] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const enterOperate = () => {
    setMode('operate');
    setTour(null);
    setColors(false);
    setSelected(null);
    setPanelOpen(true);
  };

  const enterExplore = () => {
    setMode('explore');
    setSpec(DISTILL_BASE);
  };

  const patchSpec = (patch: Partial<DistillSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const resetSpec = () => setSpec(DISTILL_BASE);

  const spotlight = tour ? tour.tour.steps[tour.idx].ref : null;

  const startTour = (t: Tour) => {
    unlockAudio(); // audio needs a user gesture — this click is it
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
    <DetailPanel
      result={result}
      selected={selected}
      onSelect={select}
      onClose={() => setSelected(null)}
      condLabel={mode === 'operate' ? 'operating point' : 'base case'}
      plant={DISTILL_PLANT_CONTENT}
    />
  ) : tour ? (
    <TourRunner tour={tour.tour} idx={tour.idx} onStep={stepTo} onExit={exitTour} />
  ) : colors ? (
    <ColorAnswer onBack={() => setColors(false)} />
  ) : mode === 'operate' ? (
    <DistillOperatePanel
      spec={spec}
      kpis={kpis}
      base={baseKpis}
      warnings={result.warnings}
      onChange={patchSpec}
      onReset={resetSpec}
    />
  ) : (
    <DistillTutorHome onTour={startTour} onColors={() => setColors(true)} />
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
          <div className="flex items-baseline gap-2">
            <div className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
              Distillation
            </div>
            <span
              className="hidden rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider sm:inline"
              style={{ borderColor: C.gas, color: C.gas }}
            >
              INTERMEDIATE
            </span>
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            Second flowsheet · 6 units · 9 streams · teaches staged separation
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center rounded-full border p-0.5"
            style={{ borderColor: C.bandLine, background: C.canvas }}
            role="tablist"
            aria-label="Workspace mode"
          >
            <button
              role="tab"
              aria-selected={mode === 'explore'}
              onClick={enterExplore}
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={
                mode === 'explore'
                  ? { background: C.ink, color: C.paper }
                  : { color: C.inkSoft }
              }
            >
              Explore
            </button>
            <button
              role="tab"
              aria-selected={mode === 'operate'}
              onClick={enterOperate}
              className="rounded-full px-3.5 py-1 text-[12px] font-bold"
              style={
                mode === 'operate'
                  ? { background: C.ink, color: C.paper }
                  : { color: C.inkSoft }
              }
            >
              Operate
            </button>
          </div>

          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="hover-band rounded-full border px-3 py-1.5 text-[12px] font-bold"
            style={{
              borderColor: C.bandLine,
              color: C.ink,
              background: panelOpen ? C.band : C.paper,
            }}
          >
            Learn
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* main */}
      <main className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <FlowsheetCanvas
            ref={canvasRef}
            layout={DISTILLATION_LAYOUT}
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
