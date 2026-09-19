/**
 * The Teaching Blueprint — the canonical educational flowsheet as DATA.
 *
 * This is the agent-architecture rewrite (v2). The lesson of v1: when the
 * canonical SMR + Haber-Bosch route was only PROSE in the prompts, the LLM
 * invented its own topology (HX7, S99, "SMR_102"…) and produced an
 * ambiguous 16-box flowchart that broke every plant convention. v2 locks
 * the structure: the Engineer may only place BLUEPRINT slots and wire
 * BLUEPRINT edges (the workspace enforces it with plain-English
 * corrections), so the LLM's real job becomes what an engineer actually
 * does on a teaching rig — interpret the brief, set the knobs, assemble,
 * verify. Structure is deterministic; intelligence goes into
 * parameterization and verification.
 *
 * Topology (ids, types, ports, stream names/classes, implicit flags, the
 * controller) is DERIVED from engine/reference.ts at runtime — the single
 * source of truth — so blueprint and engine can never drift. Only the
 * PRESENTATION layer (equipment tags, display labels, stages, teaching
 * roles) is authored here, mirroring the reference PFD layout.
 */

import { referenceGraph } from '../engine/reference';
import type { FlowGraph, StreamEdge } from '../engine/graph';

// ---------------------------------------------------------------------------
// presentation layer (the only hand-authored part)
// ---------------------------------------------------------------------------

export interface StageDef {
  n: 1 | 2 | 3;
  label: string;
  /** short teaching phrase for prompts */
  blurb: string;
}

export const STAGES: StageDef[] = [
  { n: 1, label: 'FEED & REFORMING', blurb: 'make the hydrogen: natural gas + steam reform over Ni, process air adds nitrogen' },
  { n: 2, label: 'SHIFT & PURIFICATION', blurb: 'clean it up: water-gas shift, knock out condensate, scrub CO2, methanate the traces' },
  { n: 3, label: 'SYNTHESIS LOOP & COMPRESSION', blurb: 'make ammonia: compress, convert N2 + H2 over Fe, chill, separate liquid NH3, purge inerts, recirculate' },
];

interface Presentation {
  tag: string;
  label: string;
  stage: 1 | 2 | 3;
  role: string;
}

/** equipment tags follow the reference PFD (M-101, R-102, …) */
const PRESENTATION: Record<string, Presentation> = {
  SRC_NG: { tag: 'FQ-101', label: 'NATURAL GAS', stage: 1, role: 'natural-gas feed at battery limit' },
  SRC_ST: { tag: 'FQ-102', label: 'PROCESS STEAM', stage: 1, role: 'HP steam feed at battery limit' },
  SRC_AIR: { tag: 'FQ-103', label: 'PROCESS AIR', stage: 1, role: 'compressed air (N2 source, controller-trimmed)' },
  M1: { tag: 'M-101', label: 'FEED MIX', stage: 1, role: 'joins natural gas with steam' },
  R1: { tag: 'R-102', label: 'PRIMARY REFORMER', stage: 1, role: 'fired furnace — SMR + WGS equilibrium at ~805 °C' },
  R2: { tag: 'R-103', label: 'SECONDARY REFORMER', stage: 1, role: 'burns part of the H2 with air — adds N2, finishes reforming' },
  E1: { tag: 'E-101', label: 'WASTE HEAT BOILER', stage: 1, role: 'cools to shift inlet' },
  R3: { tag: 'R-104', label: 'HIGH-TEMP SHIFT', stage: 2, role: 'Fe-Cr shift: CO + H2O → CO2 + H2' },
  E4: { tag: 'E-102', label: 'INTERCOOLER', stage: 2, role: 'cools between shift beds' },
  R4: { tag: 'R-105', label: 'LOW-TEMP SHIFT', stage: 2, role: 'Cu-Zn shift drives CO down' },
  V1: { tag: 'V-101', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains shift condensate' },
  A1: { tag: 'C-101', label: 'CO2 REMOVAL', stage: 2, role: 'aMDEA scrub — CO2 offgas out' },
  R5: { tag: 'R-106', label: 'METHANATOR', stage: 2, role: 'traces carbon oxides to ppm' },
  V2: { tag: 'V-102', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains methanation water' },
  C1: { tag: 'K-101', label: 'SYNGAS COMPRESSOR', stage: 3, role: 'make-up gas to ~150 bar' },
  M2: { tag: 'M-102', label: 'LOOP MIXER', stage: 3, role: 'joins make-up with recycle' },
  E3: { tag: 'E-103', label: 'FEED PREHEATER', stage: 3, role: 'sets converter inlet (loop tear point)' },
  R6: { tag: 'R-107', label: 'SYNTHESIS CONVERTER', stage: 3, role: '3-bed Fe converter makes NH3' },
  E2: { tag: 'E-104', label: 'CONDENSATION TRAIN', stage: 3, role: 'chills effluent to about −20 °C' },
  V3: { tag: 'V-103', label: 'NH3 SEPARATOR', stage: 3, role: 'splits liquid product from loop gas' },
  SP1: { tag: 'SP-101', label: 'PURGE SPLIT', stage: 3, role: 'small purge so inerts do not accumulate' },
  C2: { tag: 'K-102', label: 'CIRCULATOR', stage: 3, role: 'boosts recycle back to the mixer' },
};

// ---------------------------------------------------------------------------
// blueprint objects (derived)
// ---------------------------------------------------------------------------

export interface BlueprintSlot {
  id: string;
  type: string;
  tag: string;
  label: string;
  stage: 1 | 2 | 3;
  role: string;
}

export interface BlueprintEdge {
  id: string;
  name: string;
  cls: StreamEdge['cls'];
  from: { unit: string; port: string };
  to: { unit: string; port: string } | null;
  implicit: boolean;
}

export interface Blueprint {
  slots: BlueprintSlot[];
  edges: BlueprintEdge[];
  controller: { id: string; manipulate: string; measure: string; num: number; den: number; set: number; auto: boolean } | null;
  slotById: Map<string, BlueprintSlot>;
  edgeById: Map<string, BlueprintEdge>;
}

export function teachingBlueprint(): Blueprint {
  const ref = referenceGraph();
  const slots: BlueprintSlot[] = ref.units.map((u) => {
    const p = PRESENTATION[u.id];
    if (!p) throw new Error(`blueprint: no presentation for reference unit "${u.id}" — add it to PRESENTATION`);
    return { id: u.id, type: u.type, tag: p.tag, label: p.label, stage: p.stage, role: p.role };
  });
  const edges: BlueprintEdge[] = ref.streams.map((s) => ({
    id: s.id,
    name: s.name,
    cls: s.cls,
    from: s.from,
    to: s.to,
    implicit: s.implicit === true,
  }));
  const c = ref.controllers[0] ?? null;
  return {
    slots,
    edges,
    controller: c ? { ...c } : null,
    slotById: new Map(slots.map((s) => [s.id, s])),
    edgeById: new Map(edges.map((e) => [e.id, e])),
  };
}

// ---------------------------------------------------------------------------
// prompt digests (compact text the LLMs see — generated, never hand-copied)
// ---------------------------------------------------------------------------

/** one-line stage→slots digest for the Architect */
export function blueprintDigest(bp: Blueprint): string {
  const lines = STAGES.map((st) => {
    const slots = bp.slots
      .filter((s) => s.stage === st.n)
      .map((s) => `${s.id}=${s.tag} ${s.label.toLowerCase()}`)
      .join(', ');
    return `STAGE ${st.n} — ${st.label} · ${st.blurb}\n  units: ${slots}`;
  });
  return `THE TEACHING FLOWSHEET (fixed structure — ${bp.slots.length} units, ${bp.edges.length} streams, one H2/N2 controller):\n${lines.join('\n')}`;
}

/** the full stream table for the Engineer (exact wiring to reproduce) */
export function streamTableDigest(bp: Blueprint): string {
  const ep = (e: { unit: string; port: string }) => `${e.unit}.${e.port}`;
  return bp.edges
    .map((e) => `- ${e.id} "${e.name}" [${e.cls}] ${ep(e.from)} → ${e.to ? ep(e.to) : 'environment (leaves plant)'}${e.implicit ? ' (implicit)' : ''}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// deterministic conformance (a Critic fact — measured, not claimed)
// ---------------------------------------------------------------------------

export interface Conformance {
  /** every slot placed and every edge wired, nothing extra */
  complete: boolean;
  placedUnits: number;
  totalUnits: number;
  wiredStreams: number;
  totalStreams: number;
  missingUnits: string[];
  missingStreams: string[];
  extras: string[];
}

export function blueprintConformance(graph: FlowGraph, bp: Blueprint): Conformance {
  const unitIds = new Set(graph.units.map((u) => u.id));
  const streamIds = new Set(graph.streams.map((s) => s.id));
  const missingUnits = bp.slots.filter((s) => !unitIds.has(s.id)).map((s) => s.id);
  const missingStreams = bp.edges.filter((e) => !streamIds.has(e.id)).map((e) => e.id);
  const extras = [...unitIds].filter((id) => !bp.slotById.has(id));
  const extraStreams = [...streamIds].filter((id) => !bp.edgeById.has(id));
  return {
    complete: missingUnits.length === 0 && missingStreams.length === 0 && extras.length === 0 && extraStreams.length === 0,
    placedUnits: bp.slots.length - missingUnits.length,
    totalUnits: bp.slots.length,
    wiredStreams: bp.edges.length - missingStreams.length,
    totalStreams: bp.edges.length,
    missingUnits,
    missingStreams,
    extras: [...extras, ...extraStreams],
  };
}

/** one-line digest for the critic facts */
export function conformanceLine(c: Conformance): string {
  if (c.complete) return `blueprint conformance: complete (${c.placedUnits}/${c.totalUnits} units, ${c.wiredStreams}/${c.totalStreams} streams, no extras)`;
  const bits: string[] = [];
  if (c.missingUnits.length > 0) bits.push(`missing units: ${c.missingUnits.join(', ')}`);
  if (c.missingStreams.length > 0) bits.push(`missing streams: ${c.missingStreams.join(', ')}`);
  if (c.extras.length > 0) bits.push(`non-blueprint items: ${c.extras.join(', ')}`);
  return `blueprint conformance: INCOMPLETE (${c.placedUnits}/${c.totalUnits} units, ${c.wiredStreams}/${c.totalStreams} streams) — ${bits.join('; ')}`;
}
