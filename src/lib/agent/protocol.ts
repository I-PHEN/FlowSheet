/**
 * Agent protocol — the shared language of the plant builder.
 *
 * The orchestrator (server) emits BuildEvents; the builder page consumes
 * them and mirrors the FlowGraph locally, so the canvas assembles live as
 * the engineer agent works. Everything the browser needs to render the
 * build — phases, agent messages, tool calls, graph snapshots, solve
 * results, the critic verdict — travels through this one event union.
 *
 * Pure types, no imports from server-only code: safe on both sides.
 */

import type { FlowGraph } from '../engine/graph';
import type { Kpis } from '../engine/types';

/** the three LLM roles + the deterministic solver phase */
export type BuildPhase = 'architect' | 'engineer' | 'solver' | 'critic' | 'done';

export interface SolveSummary {
  kpis: Kpis;
  converged: boolean;
  iterations: number;
  solveMs: number;
  /** worst element-balance relative error */
  balanceWorstRelErr: number;
  warnings: string[];
}

export interface CriticVerdict {
  verdict: 'pass' | 'revise' | 'fail';
  /** 0–100 — feasibility + brief satisfaction */
  score: number;
  summary: string;
  strengths: string[];
  issues: string[];
  suggestions: string[];
}

/** one LLM-proposed action, executed by the deterministic workspace */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

/** what the workspace reports back (to the agent AND the event log) */
export interface ToolResult {
  ok: boolean;
  /** one-line human summary (log + event feed) */
  summary: string;
  /** structured payload (issues, kpis, stream readings…) — JSON-safe */
  data?: Record<string, unknown>;
}

export type BuildEvent =
  | { type: 'phase'; phase: BuildPhase; label: string }
  | { type: 'message'; role: 'architect' | 'engineer' | 'critic' | 'system'; text: string }
  | { type: 'tool'; seq: number; name: string; args: Record<string, unknown>; ok: boolean; summary: string }
  /** full graph snapshot — emitted after every successful mutation */
  | { type: 'graph'; graph: FlowGraph }
  | { type: 'solve'; seq: number; solve: SolveSummary }
  | { type: 'verdict'; verdict: CriticVerdict }
  | { type: 'done'; success: boolean; graph: FlowGraph | null; unitCount: number; streamCount: number }
  | { type: 'error'; message: string };

/** POST body for /api/agent/build */
export interface BuildRequest {
  brief: string;
}

/** the engineer's per-turn JSON reply */
export interface EngineerStep {
  /** short visible reasoning (streamed as an engineer message) */
  thinking: string;
  actions: ToolCall[];
  done?: boolean;
  doneReason?: string;
}

/** the architect's JSON plan — guidance for the engineer, not executed directly */
export interface ArchitectPlan {
  approach: string;
  units: { id: string; type: string; role: string }[];
  streams: { id: string; name: string; cls: string; from: string; to: string }[];
  specs: { unit: string; key: string; value: number }[];
  controller: { id: string; manipulate: string; measure: string; num: number; den: number; set: number; auto: boolean } | null;
  notes: string[];
}

/** localStorage library record (client) */
export interface SavedPlant {
  slug: string;
  name: string;
  brief: string;
  savedAt: string;
  graph: FlowGraph;
  kpis: Kpis | null;
  verdict: CriticVerdict | null;
  productionTpd: number | null;
}

export const LIBRARY_KEY = 'psp.library.v1';

/** suggested briefs shown on the builder page */
export const PRESET_BRIEFS: { label: string; text: string }[] = [
  {
    label: 'Reference plant',
    text: 'Build the standard SMR ammonia plant: natural gas + steam reforming, secondary reforming with process air, two-stage water-gas shift, CO2 removal, methanation, then a high-pressure synthesis loop with make-up compression, converter, refrigerated condensation, separator, purge and recycle. Target roughly 800 t/day of liquid ammonia at the reference conditions.',
  },
  {
    label: 'Modest plant',
    text: 'Build a compact SMR ammonia plant for a teaching module: full front end (reforming, shift, CO2 removal, methanation) with a small synthesis loop, natural gas feed around 500 kmol/h, moderate loop pressure. Name key streams clearly so students can follow the hydrogen path.',
  },
  {
    label: 'Energy-lean loop',
    text: 'Build the standard SMR ammonia plant, but design the synthesis loop for low energy: deep chilling in the condensation train, a tight purge, and an efficient circulator. Keep the front end at reference conditions; report the specific energy result.',
  },
];
