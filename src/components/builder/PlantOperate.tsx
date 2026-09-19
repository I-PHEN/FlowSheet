'use client';

/**
 * PlantOperate — the control room for ANY saved plant.
 *
 * Parity with the prebuilt workspaces: the plant's answer pinned at the top
 * (sticky — the levers scroll under it), live deltas against the saved
 * design point, and a reset. The levers themselves are DERIVED from the
 * graph + registry (see lib/projects/operate.ts) — no plant-specific code
 * lives here, so every plant the agent builds gets the same control room
 * the reference plant has. Each lever change re-solves the whole flowsheet
 * live; the stream dots speed up and slow down with the flows.
 */

import { useMemo } from 'react';
import { C } from '@/lib/design/tokens';
import type { PlantResult } from '@/lib/engine/types';
import type { FlowGraph } from '@/lib/engine/graph';
import { AnswerStrip } from '@/components/workspace/AnswerStrip';
import { answerCells, deriveLevers, type OperateLever } from '@/lib/projects/operate';

function LeverControl({
  lever,
  onChange,
}: {
  lever: OperateLever;
  onChange: (unitId: string, specKey: string, value: number) => void;
}) {
  const pct = ((lever.value - lever.min) / (lever.max - lever.min)) * 100;
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
          {lever.value.toLocaleString('en-US')}
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
        value={lever.value}
        aria-label={`${lever.label} (${lever.ref}) in ${lever.unit}`}
        onChange={(e) => onChange(lever.unitId, lever.specKey, Number(e.target.value))}
        style={
          {
            '--op-fill': `linear-gradient(to right, var(--fs-ink) 0%, var(--fs-ink) ${pct}%, var(--fs-band-line) ${pct}%, var(--fs-band-line) 100%)`,
          } as React.CSSProperties
        }
      />

      <div className="flex justify-between font-mono text-[10.5px]" style={{ color: C.inkFaint }}>
        <span>
          {lever.min.toLocaleString('en-US')} {lever.unit}
        </span>
        <span>
          {lever.max.toLocaleString('en-US')} {lever.unit}
        </span>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
        {lever.hint}
      </p>
    </section>
  );
}

export function PlantOperate({
  graph,
  result,
  baseResult,
  designKpis,
  dirty,
  onChange,
  onReset,
}: {
  /** the LIVE graph (design point when nothing has moved) */
  graph: FlowGraph;
  /** live solve of `graph` — null when this combination doesn't solve */
  result: PlantResult | null;
  /** solve of the saved design point — the delta baseline */
  baseResult: PlantResult | null;
  /** the record's saved kpis — fallback baseline if the design re-solve failed */
  designKpis: PlantResult['kpis'] | null;
  /** any lever off the saved design point? (drives the reset affordance) */
  dirty: boolean;
  onChange: (unitId: string, specKey: string, value: number) => void;
  onReset: () => void;
}) {
  const levers = useMemo(() => deriveLevers(graph), [graph]);
  const baseKpis = baseResult?.kpis ?? designKpis ?? undefined;

  // the honest pre-state: the saved flowsheet itself doesn't solve
  if (!baseResult && !designKpis) {
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
        <p className="mt-3 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed" style={{ borderColor: C.warn, color: C.inkSoft }}>
          This plant&apos;s flowsheet doesn&apos;t solve in the live engine, so there is nothing
          honest to operate — no invented numbers. Open it in the AI builder and remix it back
          to a solvable design.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* the answer pinned above the levers — it stays visible while the
          levers scroll under it (the whole point of this panel) */}
      <AnswerStrip
        dirty={dirty}
        onReset={onReset}
        cells={answerCells(result?.kpis ?? baseResult?.kpis ?? designKpis, baseKpis)}
      />

      <header>
        <div className="font-mono text-[11px] font-bold tracking-widest" style={{ color: C.inkSoft }}>
          OPERATE · LIVE
        </div>
        <h3 className="mt-0.5 text-[17px] font-semibold leading-tight" style={{ color: C.ink }}>
          Plant controls
        </h3>
      </header>

      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: C.ink }}>
        The flowsheet is live. Each lever re-solves every unit in this plant, and the dots on
        the streams speed up and slow down with the real flows. Start from the saved design
        point, move one thing at a time, and watch the plant answer — it stays pinned at the
        top while you scroll.
      </p>

      {levers.length === 0 ? (
        <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
          This plant has no operable fields the engine exposes — its units set their own
          conditions. The numbers above are the saved design point.
        </p>
      ) : (
        levers.map((l) => <LeverControl key={l.key} lever={l} onChange={onChange} />)
      )}

      {result && (
        <p className="mt-4 font-mono text-[10.5px]" style={{ color: C.inkFaint }}>
          {result.converged
            ? `Converged · ${result.iterations} loop iterations`
            : 'Loop did not converge — values are last iterate'}
        </p>
      )}

      {!result && baseResult && (
        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: C.warn }}>
          ⚠ This combination doesn&apos;t solve — the numbers above are the saved design point.
          Ease the lever back toward it.
        </p>
      )}

      {result && result.warnings.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {result.warnings.map((w) => (
            <p key={w} className="text-[12px] leading-relaxed" style={{ color: C.warn }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
