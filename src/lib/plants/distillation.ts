/**
 * Distillation plant — rung 2 of the curriculum ladder.
 *
 * Benzene–toluene, the textbook binary: a feed source, a preheater that sets
 * the feed's thermal condition, and ONE compound column unit whose internals
 * are the classic McCabe–Thiele stage solve (see engine/units.ts). The
 * condenser, reflux drum, and reboiler are drawn on the sheet and reported
 * honestly — their duties and flows are real numbers from the column solve —
 * but they are not separate graph units, because reflux-as-a-recycle-loop
 * would obscure the lesson this rung teaches (R is a lever, not an emergent
 * property of a converged loop).
 *
 * solveDistillation() therefore enriches the executor result with the column's
 * internal streams (overhead vapor, reflux, boilup) and its three auxiliaries
 * as virtual units — same records the panels already render, zero executor
 * changes, plant-agnostic plumbing.
 */

import { executeGraph } from '@/lib/engine/executor';
import { distillationColumn, type DistillColumnResult } from '@/lib/engine/units';
import { I, SPECIES, SP } from '@/lib/engine/species';
import type { FlowGraph, StreamEdge } from '@/lib/engine/graph';
import type { PlantResult, Stream, UnitResult } from '@/lib/engine/types';

export interface DistillSpec {
  /** total binary feed, kmol/h */
  feedFlow: number;
  /** benzene (light key) mole fraction in the feed */
  zBenzene: number;
  /** feed temperature at the battery limit, °C */
  feedT: number;
  /** feed pressure, bar */
  feedP: number;
  /** preheater outlet temperature — sets the feed thermal condition q */
  heaterT: number;
  /** distillate purity target (benzene mole fraction) */
  xD: number;
  /** reflux ratio L/D */
  reflux: number;
  /** equilibrium stages including the reboiler */
  stages: number;
  /** feed tray counted from the top (1 = top tray) */
  feedStage: number;
}

export const DISTILL_BASE: DistillSpec = {
  feedFlow: 500,
  zBenzene: 0.45,
  feedT: 25,
  feedP: 1.4,
  heaterT: 103,
  xD: 0.97,
  reflux: 2.5,
  stages: 14,
  feedStage: 8,
};

/** column pressure drop, bar (top → bottom) */
export const COLUMN_DP = 0.15;

const e = (
  id: string,
  name: string,
  cls: StreamEdge['cls'],
  from: { unit: string; port: string },
  to: { unit: string; port: string } | null,
): StreamEdge => ({ id, name, cls, from, to, implicit: false });

export function distillGraph(spec: DistillSpec): FlowGraph {
  return {
    units: [
      {
        id: 'FEED',
        type: 'column-feed',
        specs: {
          flow: spec.feedFlow,
          zLight: spec.zBenzene,
          T: spec.feedT,
          P: spec.feedP,
        },
      },
      { id: 'HEATER', type: 'feed-heater', specs: { outletT: spec.heaterT, dp: 0.1 } },
      {
        id: 'COLUMN',
        type: 'distillation-column',
        specs: {
          xD: spec.xD,
          reflux: spec.reflux,
          stages: spec.stages,
          feedStage: spec.feedStage,
          dp: COLUMN_DP,
        },
      },
    ],
    streams: [
      e('S01', 'Raw feed', 'feed', { unit: 'FEED', port: 'out' }, { unit: 'HEATER', port: 'in' }),
      e('S02', 'Preheated feed', 'syngas', { unit: 'HEATER', port: 'out' }, { unit: 'COLUMN', port: 'feed' }),
      e('S03', 'Benzene product', 'product', { unit: 'COLUMN', port: 'distillate' }, null),
      e('S04', 'Toluene product', 'product', { unit: 'COLUMN', port: 'bottoms' }, null),
    ],
    controllers: [],
  };
}

const binary = (flow: number, zLight: number): number[] => {
  const n = new Array(SPECIES.length).fill(0);
  n[I.C6H6] = flow * zLight;
  n[I.C7H8] = flow * (1 - zLight);
  return n;
};

const mw = (n: number[]) => n.reduce((a, v, i) => a + v * (SP[SPECIES[i]]?.mw ?? 0), 0);

/**
 * Solve the distillation plant and ENRICH the result with the column's
 * internal streams and auxiliaries (drawn on the sheet, values from the
 * same deterministic column solve the unit just ran).
 */
export function solveDistillation(spec: DistillSpec): PlantResult {
  const r = executeGraph(distillGraph(spec));

  // re-run the column internals from the solved feed stream (deterministic —
  // same inputs, same numbers the unit just reported)
  const feed = r.streams.S02;
  const N = Math.round(spec.stages);
  const nf = Math.max(2, Math.min(N - 1, Math.round(spec.feedStage)));
  const Ptop = feed?.P ?? 1.2e5;
  const col = distillationColumn(
    feed?.n ?? binary(spec.feedFlow, spec.zBenzene),
    feed?.T ?? 376,
    Ptop,
    Ptop + COLUMN_DP * 1e5,
    I.C6H6,
    I.C7H8,
    spec.xD,
    spec.reflux,
    N,
    nf,
  );

  // --- internal streams (ids match the drawing) ---
  const st = (id: string, name: string, T: number, P: number, n: number[], cls: Stream['cls']): Stream => ({
    id,
    name,
    T,
    P,
    n,
    cls,
  });
  r.streams.S05 = st('S05', 'Overhead vapor', col.TdewTop, Ptop, binary(col.V, col.xD), 'syngas');
  r.streams.S06 = st('S06', 'Reflux', col.Ttop, Ptop, binary(col.L, col.xD), 'loopgas');
  r.streams.S07 = st('S07', 'Condensate', col.Ttop, Ptop, binary(col.V, col.xD), 'loopgas');
  r.streams.S08 = st('S08', 'Bottoms draw', col.Tbot, Ptop + COLUMN_DP * 1e5, binary(col.Lbar, col.xB), 'syngas');
  r.streams.S09 = st('S09', 'Boilup', col.TdewBot, Ptop + COLUMN_DP * 1e5, binary(col.Vbar, col.yB), 'loopgas');

  // --- auxiliaries as virtual units (same records the panels render) ---
  const MWc = col.QcKJh / 3.6e6;
  const MWr = col.QrKJh / 3.6e6;
  const d1 = (x: number) => x.toFixed(1);
  const d2 = (x: number) => x.toFixed(2);
  const unit = (id: string, name: string, model: string, metrics: UnitResult['metrics']): UnitResult => ({
    id,
    name,
    model,
    metrics,
    warnings: [],
  });
  r.units.COND = unit(
    'COND',
    'Condenser',
    'Total condenser — overhead vapor condensed to saturated liquid',
    [
      { label: 'Duty', value: `${d2(MWc)} MW`, raw: MWc },
      { label: 'Condensed flow', value: `${d1(col.V)} kmol/h` },
      { label: 'Outlet T', value: `${d1(col.Ttop - 273.15)} °C` },
    ],
  );
  r.units.RDRUM = unit(
    'RDRUM',
    'Reflux drum',
    'Collects condensate and splits it: product out, reflux back',
    [
      { label: 'Distillate D', value: `${d1(col.D)} kmol/h` },
      { label: 'Reflux L', value: `${d1(col.L)} kmol/h` },
      { label: 'Reflux ratio R', value: d2(spec.reflux), raw: spec.reflux },
    ],
  );
  r.units.REB = unit(
    'REB',
    'Reboiler',
    'Kettle reboiler — vaporizes boilup that rises back through the trays',
    [
      { label: 'Duty', value: `${d2(MWr)} MW`, raw: MWr },
      { label: 'Boilup', value: `${d1(col.Vbar)} kmol/h` },
      { label: 'Boilup ratio', value: d2(col.boilupRatio) },
    ],
  );

  return r;
}

/** The column internals (Rmin, q, duties) for the operate scorecard. */
export function distillModel(spec: DistillSpec): DistillColumnResult {
  const r = executeGraph(distillGraph(spec));
  const feed = r.streams.S02;
  const N = Math.round(spec.stages);
  const nf = Math.max(2, Math.min(N - 1, Math.round(spec.feedStage)));
  const Ptop = feed?.P ?? 1.2e5;
  return distillationColumn(
    feed?.n ?? binary(spec.feedFlow, spec.zBenzene),
    feed?.T ?? 376,
    Ptop,
    Ptop + COLUMN_DP * 1e5,
    I.C6H6,
    I.C7H8,
    spec.xD,
    spec.reflux,
    N,
    nf,
  );
}

/** Teaching KPIs — the rung-2 scorecard. */
export interface DistillKpis {
  /** benzene mole fraction in the distillate */
  xD: number;
  /** benzene mole fraction in the bottoms */
  xB: number;
  /** fraction of feed benzene recovered in the distillate */
  benzeneRecovery: number;
  /** distillate rate, tonnes/day */
  distillateTpd: number;
  /** bottoms rate, tonnes/day */
  bottomsTpd: number;
  /** minimum reflux ratio at the current feed condition */
  rmin: number;
  /** feed thermal condition */
  q: number;
  /** relative volatility (PR EOS) */
  alpha: number;
  /** condenser / reboiler duties, MW */
  condenserMW: number;
  reboilerMW: number;
  /** column model internals (feed-stage optimum etc.) */
  model: DistillColumnResult;
}

export function distillKpis(r: PlantResult, model: DistillColumnResult): DistillKpis {
  const d = r.streams.S03?.n ?? [];
  const b = r.streams.S04?.n ?? [];
  const dTot = d.reduce((a, v) => a + v, 0) || 1;
  const bTot = b.reduce((a, v) => a + v, 0) || 1;
  const feed = r.streams.S01?.n ?? [];
  const fTot = feed.reduce((a, v) => a + v, 0) || 1;
  return {
    xD: (d[I.C6H6] ?? 0) / dTot,
    xB: (b[I.C6H6] ?? 0) / bTot,
    benzeneRecovery:
      feed[I.C6H6] > 1e-9 ? (d[I.C6H6] ?? 0) / feed[I.C6H6] : 0,
    distillateTpd: (mw(d) * 24) / 1000,
    bottomsTpd: (mw(b) * 24) / 1000,
    rmin: model.Rmin,
    q: model.q,
    alpha: model.alpha,
    condenserMW: model.QcKJh / 3.6e6,
    reboilerMW: model.QrKJh / 3.6e6,
    model,
  };
}
