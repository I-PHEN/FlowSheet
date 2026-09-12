'use client';

/**
 * Operate panel — the minimal live control room.
 *
 * Three real levers, a reset, and the plant's headline numbers. Every
 * change re-solves the full flowsheet (all 19 units + the synthesis
 * loop, ~36 ms); the canvas, hover tooltips, and detail panels all
 * read from that one live solve.
 */

import { C } from '@/lib/design/tokens';
import type { Kpis, PlantResult } from '@/lib/engine/types';
import type { PlantSpec } from '@/lib/engine/plant';

interface Lever {
  key: 'loopP' | 'primaryT' | 'ngFeed';
  label: string;
  ref: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  hint: string;
}

const LEVERS: Lever[] = [
  {
    key: 'loopP',
    label: 'Synthesis loop pressure',
    ref: 'R-107 · K-102',
    unit: 'bar',
    min: 80,
    max: 250,
    step: 5,
    fmt: (v) => v.toFixed(0),
    hint: 'Ammonia synthesis favours high pressure. Raising the loop squeezes more NH3 out of each pass through the converter — at the cost of harder compression work.',
  },
  {
    key: 'primaryT',
    label: 'Reformer outlet temperature',
    ref: 'R-102',
    unit: '°C',
    min: 700,
    max: 900,
    step: 5,
    fmt: (v) => v.toFixed(0),
    hint: 'A hotter firebox drives methane closer to complete conversion, so more hydrogen reaches the loop. Tube metallurgy sets the ceiling near 900 °C.',
  },
  {
    key: 'ngFeed',
    label: 'Natural gas feed',
    ref: 'M-101',
    unit: 'kmol/h',
    min: 100,
    max: 3000,
    step: 25,
    fmt: (v) => v.toLocaleString('en-US'),
    hint: 'The plant\u2019s throttle. Fresh hydrogen — and daily production — scale almost linearly with natural gas feed, until the loop says otherwise.',
  },
];

function LeverControl({
  lever,
  value,
  onChange,
}: {
  lever: Lever;
  value: number;
  onChange: (patch: Partial<PlantSpec>) => void;
}) {
  const pct = ((value - lever.min) / (lever.max - lever.min)) * 100;
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[13.5px] font-semibold" style={{ color: C.ink }}>
          {lever.label}
        </h4>
        <span className="font-mono text-[10.5px] font-bold tracking-widest" style={{ color: C.inkFaint }}>
          {lever.ref}
        </span>
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
        onChange={(e) => onChange({ [lever.key]: Number(e.target.value) } as Partial<PlantSpec>)}
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

function KpiRow({
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
    <div className="flex items-baseline justify-between gap-2 border-b py-1.5" style={{ borderColor: C.bandLine }}>
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

export function OperatePanel({
  spec,
  result,
  baseKpis,
  onChange,
  onReset,
}: {
  spec: PlantSpec;
  result: PlantResult;
  baseKpis: Kpis;
  onChange: (patch: Partial<PlantSpec>) => void;
  onReset: () => void;
}) {
  const k = result.kpis;
  const b = baseKpis;
  const dTpd = k.productionTpd - b.productionTpd;
  const dConv = (k.perPassConv - b.perPassConv) * 100;

  return (
    <div>
      <header>
        <div className="font-mono text-[11px] font-bold tracking-widest" style={{ color: C.inkSoft }}>
          OPERATE · LIVE
        </div>
        <h3 className="mt-0.5 text-[17px] font-semibold leading-tight" style={{ color: C.ink }}>
          Plant controls
        </h3>
      </header>

      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: C.ink }}>
        The flowsheet is live. Each lever below re-solves all 19 units and the synthesis loop, and
        every temperature, pressure, and composition on the canvas updates with it. Start from the
        design point, move one thing at a time, and watch the plant answer.
      </p>

      {LEVERS.map((l) => (
        <LeverControl key={l.key} lever={l} value={spec[l.key]} onChange={onChange} />
      ))}

      <section className="mt-6">
        <h4
          className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
          style={{ color: C.inkSoft }}
        >
          Plant answer
        </h4>
        <KpiRow
          label="NH3 production"
          value={`${k.productionTpd.toLocaleString('en-US', { maximumFractionDigits: 1 })} t/d`}
          delta={dTpd}
          deltaUnit="t/d"
        />
        <KpiRow
          label="Per-pass conversion"
          value={`${(k.perPassConv * 100).toFixed(1)} %`}
          delta={dConv}
          deltaUnit="pt"
        />
        <KpiRow label="Product purity" value={`${(k.productPurityMol * 100).toFixed(2)} % mol`} />
        <KpiRow label="H2/N2 at converter" value={k.h2n2Ratio.toFixed(2)} />
      </section>

      <p className="mt-3 font-mono text-[10.5px]" style={{ color: C.inkFaint }}>
        {result.converged
          ? `Converged \u00b7 ${result.iterations} loop iterations`
          : 'Loop did not converge \u2014 values are last iterate'}
      </p>

      {result.warnings.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {result.warnings.map((w) => (
            <p key={w} className="text-[12px] leading-relaxed" style={{ color: C.warn }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={onReset}
        className="hover-band mt-5 w-full rounded-lg border py-2 text-[12.5px] font-bold"
        style={{ borderColor: C.bandLine, color: C.ink }}
      >
        Reset to design conditions
      </button>
    </div>
  );
}
