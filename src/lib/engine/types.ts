import type { Moles } from './species';

/** A material stream. Flows are the single source of truth (kmol/h per species). */
export interface Stream {
  id: string;
  name: string;
  /** K */
  T: number;
  /** Pa */
  P: number;
  /** kmol/h per species, length 9 */
  n: Moles;
  /** stream class for PFD color coding */
  cls: StreamClass;
}

export type StreamClass =
  | 'feed' // natural gas / air / steam
  | 'syngas' // front-end process gas
  | 'loopgas' // synthesis loop gas
  | 'product' // liquid ammonia
  | 'water' // condensed water
  | 'co2' // CO2 offgas
  | 'purge'; // loop purge

export interface UnitResult {
  id: string;
  name: string;
  /** one-line model description shown in inspector */
  model: string;
  /** key numeric outputs for inspector / PFD labels */
  metrics: Metric[];
  /** warnings (non-fatal) */
  warnings: string[];
}

export interface Metric {
  label: string;
  value: string;
  /** optional raw value for tests */
  raw?: number;
}

export interface SolverTraceRow {
  iter: number;
  /** max relative tear-stream change */
  err: number;
  method: 'damped-DS' | 'wegstein' | 'broyden';
  qMin?: number;
  qMax?: number;
}

export interface ElementBalance {
  element: string;
  in: number;
  out: number;
  relErr: number;
}

export interface Kpis {
  /** t/d */
  productionTpd: number;
  /** mol fraction NH3 in liquid product */
  productPurityMol: number;
  /** wt fraction */
  productPurityWt: number;
  /** per-pass N2 conversion, fraction */
  perPassConv: number;
  /** overall N2 conversion of makeup, fraction */
  overallConv: number;
  /** CH4+Ar at converter inlet, mol frac */
  loopInerts: number;
  /** H2/N2 at converter inlet */
  h2n2Ratio: number;
  /** kmol/h */
  makeupFlow: number;
  /** recycle / makeup */
  recycleMultiple: number;
  /** fraction of separator gas purged */
  purgeFrac: number;
  /** MW */
  reformerDutyMW: number;
  /** MW absorbed in condenser train */
  refrigerationDutyMW: number;
  /** MW shaft */
  syngasComprPowerMW: number;
  circulatorPowerKW: number;
  /** GJ per t NH3: feed LHV + furnace fuel + electric power (partial scope, documented) */
  specificEnergyGJt: number;
  /** kmol/h */
  airFlow: number;
  /** secondary reformer catalytic-zone exit, °C */
  secondaryExitC: number;
  /** CO dry at LTS exit, fraction */
  coSlipLTS: number;
  /** total carbon oxides after methanator, ppmv */
  oxidesAfterMeth: number;
}

export interface PlantResult {
  ok: boolean;
  converged: boolean;
  iterations: number;
  solveMs: number;
  streams: Record<string, Stream>;
  units: Record<string, UnitResult>;
  kpis: Kpis;
  solverTrace: SolverTraceRow[];
  balance: ElementBalance[];
  warnings: string[];
  /** H2/N2 controller residual (target - actual) */
  h2n2Err: number | null;
}
