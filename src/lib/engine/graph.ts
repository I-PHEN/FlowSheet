/**
 * FlowGraph — a plant flowsheet as pure data.
 *
 * This is the object the AI builder agent will compose and edit in Phase D2:
 * units (typed blocks with specs), streams (edges between unit ports, or to/
 * from the environment), and controllers (design-time feedback loops).
 *
 * The graph contains NO solve logic. The executor walks it; the registry
 * defines what each unit type means; the validator checks structural
 * legality. All physics stays in units.ts (untouched).
 */

import type { StreamClass } from './types';

/** physical phase of a port — used by the validator to catch wiring mistakes */
export type PortKind = 'gas' | 'liquid' | 'any';

export interface PortDef {
  key: string;
  kind: PortKind;
  /** short human description for agent-facing catalogs */
  doc?: string;
}

/** specification field declared by a unit type (the agent-editable knobs) */
export interface SpecField {
  key: string;
  /** 'number' | 'boolean' | 'number[]' */
  kind: 'number' | 'boolean' | 'number[]';
  /** physical minimum (clamped) — numbers only */
  min?: number;
  max?: number;
  /** per-element bounds for number[] */
  elemMin?: number;
  elemMax?: number;
  default: number | boolean | number[];
  unit?: string;
  doc?: string;
}

/** state of a stream during execution (SI: K, Pa, kmol/h per species) */
export interface StreamState {
  /** K */
  T: number;
  /** Pa */
  P: number;
  /** kmol/h per species */
  n: number[];
}

/**
 * A stream edge. `from: null` would be an environment source (unused —
 * feeds are explicit source units); `to: null` is an environment sink
 * (product / waste / purge leaving the plant).
 */
export interface StreamEdge {
  id: string;
  name: string;
  cls: StreamClass;
  from: { unit: string; port: string };
  to: { unit: string; port: string } | null;
  /**
   * Implicit edges carry material that is bookkeeping inside a unit pair
   * (e.g. letdown flash vapor merging into the purge) and are NOT recorded
   * in PlantResult.streams.
   */
  implicit?: boolean;
}

export interface GraphUnit {
  id: string;
  /** registry type key, e.g. 'primary-reformer' */
  type: string;
  /** specs resolved onto this unit (missing fields fall back to defaults) */
  specs: Record<string, number | boolean | number[]>;
}

/**
 * Design controller — a feedback loop at design time. The ammonia plant
 * has one: process-air flow is manipulated so make-up H2/N2 hits target.
 */
export interface GraphController {
  id: string;
  /** source unit whose `flow` spec is manipulated */
  manipulate: string;
  /** stream where the controlled ratio is measured */
  measure: string;
  /** species indexes for ratio = n[num] / n[den] */
  num: number;
  den: number;
  /** target ratio */
  set: number;
  auto: boolean;
}

export interface FlowGraph {
  units: GraphUnit[];
  streams: StreamEdge[];
  controllers: GraphController[];
  /** plant family this graph belongs to ('ammonia' | 'methanol' | 'hydrogen').
   *  Drives the family KPI hook + tear initializer in the executor; defaults
   *  to 'ammonia' when absent (legacy graphs are ammonia graphs). */
  family?: string;
}

/** a validation finding — the strings the agent reads to self-correct */
export interface GraphIssue {
  code: string;
  message: string;
  unitId?: string;
  streamId?: string;
}
