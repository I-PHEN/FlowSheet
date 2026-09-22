/**
 * Agent protocol — the shared language of the plant builder.
 *
 * The orchestrator (server) emits BuildEvents; the builder page consumes
 * them and mirrors the FlowGraph locally, so the canvas assembles live as
 * the engineer agent works. Everything the browser needs to render the
 * build — phases, agent messages, tool calls, graph snapshots, family
 * routing, solve results, the critic verdict, the docent's tour — travels
 * through this one event union.
 *
 * Pure types, no imports from server-only code: safe on both sides.
 */

import type { FlowGraph } from '../engine/graph';
import type { Kpis } from '../engine/types';
import type { Tour } from '../content/units';

/** the LLM roles + the deterministic solver phase */
export type BuildPhase = 'architect' | 'engineer' | 'solver' | 'critic' | 'docent' | 'done';

/** what one agent run cost — the token ledger (honest economy) */
export interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  /** real LLM calls (cache hits excluded) */
  calls: number;
  cacheHits: number;
  /** ≈ prompt tokens NOT spent thanks to the reply cache */
  cacheSavedTokens: number;
  /** per-role buckets, insertion order */
  byRole: Array<{ role: string; prompt: number; completion: number; calls: number; hits: number }>;
}

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
  | { type: 'message'; role: 'architect' | 'engineer' | 'critic' | 'docent' | 'system'; text: string }
  | { type: 'tool'; seq: number; name: string; args: Record<string, unknown>; ok: boolean; summary: string }
  /** full graph snapshot — emitted after every successful mutation */
  | { type: 'graph'; graph: FlowGraph }
  | { type: 'solve'; seq: number; solve: SolveSummary }
  | { type: 'verdict'; verdict: CriticVerdict }
  /** router decision — which plant family this brief belongs to */
  | { type: 'family'; family: string; label: string; reason?: string }
  /** the docent's narrated tour (validated) for the solved plant */
  | { type: 'tour'; tour: Tour }
  /** the run's token ledger — emitted just before `done` */
  | { type: 'usage'; usage: RunUsage }
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
  /** general builds: the product the plant must deliver */
  product?: { stream: string; species: string } | null;
  notes: string[];
}

/**
 * One line of the session transcript — the client-side mirror of a run's
 * BuildEvents, folded by the session panel into the quiet chat (one work
 * card + one answer card per run). THE ONE CONVERSATION LAW: entries
 * accumulate across runs; only an explicit reset starts a new transcript.
 * Saved into the plant record (`session.entries`) so the conversation
 * travels with the plant between the builder and its project page.
 */
export interface LogEntry {
  key: number;
  kind: 'user' | 'phase' | 'message' | 'tool' | 'solve' | 'verdict' | 'error' | 'note' | 'usage';
  phase?: BuildPhase;
  label?: string;
  role?: 'architect' | 'engineer' | 'critic' | 'docent' | 'system';
  text?: string;
  tool?: string;
  ok?: boolean;
  seq?: number;
  /** the id the action touched (unit / stream / controller) — powers the now-line */
  target?: string;
  /** for add_unit: the unit type ("primary-reformer") — powers the now-line */
  utype?: string;
  solve?: SolveSummary;
  verdict?: CriticVerdict;
  usage?: RunUsage;
}

/** localStorage library record (client, legacy) */
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
