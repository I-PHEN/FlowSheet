/**
 * Plant families — one builder, many plants.
 *
 * A family bundles EVERYTHING that distinguishes ammonia from methanol from
 * hydrogen from sulphur from a free-form general build: the canonical
 * teaching topology (the reference graph), the presentation layer (equipment
 * tags, labels, stages, roles), the prompt material (primer + conventions +
 * presets), the tour focus, and the KPI computation. The engine walker, the
 * unit registry, the validator, the workspace and the canvas stay
 * family-agnostic; a family is data + two small functions.
 *
 * The GENERAL family is the exception that proves the architecture: no
 * canonical route at all — its primer teaches the BASICS (species, known
 * chemistry, separation physics) and the agent composes freely from the full
 * catalog, declaring its product so generic KPIs compute.
 *
 * Pure data modules — no React, no SDK: importable from the executor
 * (server), the agent prompts (server) and the UI (client) alike.
 */

import type { FlowGraph, StreamState } from '@/lib/engine/graph';
import type { Kpis, UnitResult } from '@/lib/engine/types';
import type { Moles } from '@/lib/engine/species';

export interface FamilyStage {
  n: 1 | 2 | 3 | 4;
  label: string;
  /** short teaching phrase for prompts / tours */
  blurb: string;
}

export interface FamilyPresentation {
  /** equipment tag following the family PFD (M-101, R-102, …) */
  tag: string;
  /** short uppercase name shown under the tag */
  label: string;
  stage: 1 | 2 | 3 | 4;
  /** one-phrase teaching role */
  role: string;
}

/** everything the family KPI hook needs from the executor */
export interface KpiCtx {
  states: Record<string, StreamState>;
  unitRecs: Record<string, UnitResult>;
  specs: Record<string, Record<string, number | boolean | number[]>>;
  graph: FlowGraph;
  /** controller-found source flow (ammonia air controller) */
  controlledAir?: number;
}

export interface FamilyKpis {
  kpis: Kpis;
  /** family-specific warnings, merged into PlantResult.warnings */
  warnings: string[];
}

export interface FamilyPreset {
  label: string;
  text: string;
}

export interface PlantFamily {
  id: string;
  /** display name, e.g. 'Ammonia' */
  name: string;
  /** the canonical route, e.g. 'SMR + Haber-Bosch loop' */
  route: string;
  /** one-line teaching blurb for pickers and badges */
  blurb: string;
  /** the product this family makes (species name; '*' for general builds) */
  productSpecies: string;
  /** species the prompts should mention (indexes into the engine species table) */
  speciesOfInterest: string[];
  /** does the canonical topology contain a recycle loop? */
  hasLoop: boolean;
  stages: FamilyStage[];
  /** presentation per reference unit id */
  presentation: Record<string, FamilyPresentation>;
  /** the canonical teaching recipe for the Architect/Engineer prompts */
  primer: string;
  /** id/KPI conventions block for the prompts (assembled with live digests) */
  conventions(speciesDigest: string, catalogDigest: string): string;
  presets: FamilyPreset[];
  /** unit ids the docent (tour writer) should spotlight */
  tourFocus: string[];
  /** the canonical teaching topology — the single source of truth */
  referenceGraph(): FlowGraph;
  /** family physics: headline KPIs from the solved state */
  computeKpis(ctx: KpiCtx): FamilyKpis;
  /** loop families: stream ids (fallback chain) that feed the loop, for tear init */
  makeupStreamIds: string[];
  /** loop families: loop-gas guess for the tear initializer */
  tearGuess(makeup: Moles): Moles;
}
