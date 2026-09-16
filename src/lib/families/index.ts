/**
 * Family registry — the plant families the builder can build.
 *
 * Order matters for the router prompt (family #1 is the default when a brief
 * is ambiguous). Adding a family = one module + one entry here; the router,
 * prompts, docent, canvas and viewers all pick it up generically.
 */

import type { FlowGraph } from '@/lib/engine/graph';
import { AMMONIA } from './ammonia';
import { METHANOL } from './methanol';
import { HYDROGEN } from './hydrogen';
import type { PlantFamily } from './types';

export type { PlantFamily, FamilyStage, FamilyPresentation, FamilyPreset, KpiCtx, FamilyKpis } from './types';

export const FAMILIES: PlantFamily[] = [AMMONIA, METHANOL, HYDROGEN];

const BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

export function getFamily(id: string | undefined): PlantFamily {
  return BY_ID.get(id ?? 'ammonia') ?? AMMONIA;
}

export function isFamilyId(id: string): boolean {
  return BY_ID.has(id);
}

/** stamp a graph with its family (executor + records read it back) */
export function withFamily(graph: FlowGraph, familyId: string): FlowGraph {
  return { ...graph, family: familyId };
}
