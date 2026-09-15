'use client';

/**
 * Flash-separation workspace — the beginner plant. Same studio paradigm as
 * the ammonia workspace (top bar · one-sheet canvas · learn panel), minus
 * everything a first flowsheet does not need: no zones, no recycle, no
 * KPI wall. Explore = the book; Operate = four levers that re-solve the
 * flash live, so the student FEELS temperature and pressure move the
 * vapor-liquid split.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '@/lib/design/tokens';
import { FLASH_LAYOUT, FLASH_STREAM_MAP, FLASH_UNIT_MAP } from '@/lib/flowsheet/flashLayout';
import { bboxOf } from '@/lib/flowsheet/geom';
import {
  FLASH_BASE,
  flashKpis,
  solveFlash,
  type FlashKpis,
  type FlashSpec,
} from '@/lib/plants/flash';
import { FLASH_TOURS, FLASH_UNIT_CONTENT } from '@/lib/content/flash';
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

const FLASH_PLANT_CONTENT: PlantContent = {
  plantId: 'flash',
  unitMap: FLASH_UNIT_MAP,
  unitStreams: {
    FEED: { in: [], out: ['S01'] },
    CHILL: { in: ['S01'], out: ['S02'] },
    DRUM: { in: ['S02'], out: ['S03', 'S04'] },
  },
  unitContent: FLASH_UNIT_CONTENT,
};

function refBox(ref: Focus) {
  if (ref.type === 'unit') {
    const u = FLASH_UNIT_MAP[ref.id];
    return u ? { x: u.x, y: u.y, w: u.w, h: u.h } : null;
  }
  const s = FLASH_STREAM_MAP[ref.id];
  return s ? bboxOf(s.pts) : null;
}

// ---------------------------------------------------------------------------
// tutor home (flash edition)
// ---------------------------------------------------------------------------

function FlashTutorHome({
  onTour,
  onColors,
}: {
  onTour: (t: Tour) => void;
  onColors: () => void;
}) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
        Your first flowsheet
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
        One guided walkthrough — about three minutes. It moves the diagram for you and ends
        with a challenge in Operate mode.
      </p>
      <div className="mt-4 space-y-2">
        {FLASH_TOURS.map((t) => (
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
// operate panel (flash edition — four levers, six live numbers)
// ---------------------------------------------------------------------------

interface Lever {
  key: keyof FlashSpec;
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
    key: 'chillT',
    label: 'Chiller temperature',
    unit: '°C',
    min: -40,
    max: 10,
    step: 1,
    fmt: (v) => `${v.toFixed(0)}`,
    hint: 'The master lever. Cold gas holds less vapor — watch the liquid product appear, grow, and vanish again as you sweep it.',
  },
  {
    key: 'feedP',
    label: 'Feed pressure',
    unit: 'bar',
    min: 60,
    max: 220,
    step: 5,
    fmt: (v) => v.toFixed(0),
    hint: 'High pressure squeezes vapor into liquid. Notice how the same temperature recovers more ammonia at 200 bar than at 80 bar.',
  },
  {
    key: 'feedNH3',
    label: 'Ammonia in feed',
    unit: 'mol %',
    min: 0.02,
    max: 0.3,
    step: 0.005,
    fmt: (v) => (v * 100).toFixed(1),
    hint: 'Richer feed, bigger product rate. The vapor fraction falls because there is more condensable material in the gas.',
  },
  {
    key: 'feedFlow',
    label: 'Feed flow',
    unit: 'kmol/h',
    min: 500,
    max: 6000,
    step: 50,
    fmt: (v) => v.toFixed(0),
    hint: 'Scale changes the product rate and the chiller duty — but not the split. Vapor fraction and purity stay put: equilibrium does not care about size.',
  },
];

function FlashLever({
  lever,
  value,
  onChange,
}: {
  lever: Lever;
  value: number;
  onChange: (patch: Partial<FlashSpec>) => void;
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
        onChange={(e) => onChange({ [lever.key]: Number(e.target.value) } as Partial<FlashSpec>) }
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

function FlashKpiRow({
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
            {Math.abs(delta!).toFixed(1)} {deltaUnit}
          </span>
        )}
      </span>
    </div>
  );
}

function FlashOperatePanel({
  spec,
  kpis,
  base,
  warnings,
  onChange,
  onReset,
}: {
  spec: FlashSpec;
  kpis: FlashKpis;
  base: FlashKpis;
  warnings: string[];
  onChange: (patch: Partial<FlashSpec>) => void;
  onReset: () => void;
}) {
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
          The separation levers
        </h3>
      </header>

      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: C.ink }}>
        The flowsheet is live. Each lever re-solves the flash instantly — every temperature,
        composition, and product rate on the canvas follows. Move one thing at a time and
        watch the drum answer.
      </p>

      <div className="mt-5 space-y-5">
        {LEVERS.map((l) => (
          <FlashLever key={l.key} lever={l} value={spec[l.key]} onChange={onChange} />
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
          <FlashKpiRow
            label="Vapor fraction"
            value={`${(kpis.vaporFraction * 100).toFixed(1)} %`}
            delta={(kpis.vaporFraction - base.vaporFraction) * 100}
            deltaUnit="%"
          />
          <FlashKpiRow
            label="NH3 recovery"
            value={`${(kpis.nh3Recovery * 100).toFixed(1)} %`}
            delta={(kpis.nh3Recovery - base.nh3Recovery) * 100}
            deltaUnit="%"
            deltaGood
          />
          <FlashKpiRow
            label="Liquid purity"
            value={`${(kpis.liquidPurity * 100).toFixed(1)} %`}
            delta={(kpis.liquidPurity - base.liquidPurity) * 100}
            deltaUnit="%"
            deltaGood
          />
          <FlashKpiRow
            label="Liquid product"
            value={`${kpis.liquidTpd.toFixed(1)} t/d`}
            delta={kpis.liquidTpd - base.liquidTpd}
            deltaUnit="t/d"
            deltaGood
          />
          <FlashKpiRow label="Gas to recycle" value={`${kpis.vaporFlow.toFixed(0)} kmol/h`} />
          <FlashKpiRow
            label="Chiller duty"
            value={`${kpis.chillerDutyMW.toFixed(2)} MW`}
            delta={-(kpis.chillerDutyMW - base.chillerDutyMW)}
            deltaUnit="MW"
          />
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
        Everything here is the same physics the big plant uses — the ammonia separator in the
        reference plant solves exactly this flash, at 20× the flow.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// workspace shell
// ---------------------------------------------------------------------------

export function FlashWorkspace() {
  const [mode, setMode] = useState<Mode>('explore');
  const [spec, setSpec] = useState<FlashSpec>(() => FLASH_BASE);
  const result = useMemo(() => solveFlash(spec), [spec]);
  const baseKpis = useMemo(() => flashKpis(solveFlash(FLASH_BASE)), []);
  const kpis = useMemo(() => flashKpis(result), [result]);
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
    setSpec(FLASH_BASE);
  };

  const patchSpec = (patch: Partial<FlashSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const resetSpec = () => setSpec(FLASH_BASE);

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
      plant={FLASH_PLANT_CONTENT}
    />
  ) : tour ? (
    <TourRunner tour={tour.tour} idx={tour.idx} onStep={stepTo} onExit={exitTour} />
  ) : colors ? (
    <ColorAnswer onBack={() => setColors(false)} />
  ) : mode === 'operate' ? (
    <FlashOperatePanel
      spec={spec}
      kpis={kpis}
      base={baseKpis}
      warnings={result.warnings}
      onChange={patchSpec}
      onReset={resetSpec}
    />
  ) : (
    <FlashTutorHome onTour={startTour} onColors={() => setColors(true)} />
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
              Flash Separation
            </div>
            <span
              className="hidden rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider sm:inline"
              style={{ borderColor: C.gas, color: C.gas }}
            >
              BEGINNER
            </span>
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            First flowsheet · 3 units · 4 streams · teaches phase separation
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
            layout={FLASH_LAYOUT}
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
