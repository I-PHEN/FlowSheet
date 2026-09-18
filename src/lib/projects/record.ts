/**
 * PlantRecord — one record type, two sources of truth.
 *
 * A prebuilt template and a user's AI-built plant are the same shape of
 * data: a name, a brief, a graph, and whatever the solver/critic said
 * about it. The prebuilts ship in code; user plants live in the local
 * project store. The viewer never asks which is which.
 *
 * Schema is versioned and owner-stamped from day one, so the day accounts
 * and server storage arrive, existing records claim cleanly: `ownerId` is
 * already the isolation key and `schemaVersion` already gates upgrades.
 */

import type { FlowGraph } from '@/lib/engine/graph';
import type { Kpis } from '@/lib/engine/types';
import type { CriticVerdict, SavedPlant } from '@/lib/agent/protocol';
import type { Tour } from '@/lib/content/units';
import { isFamilyId } from '@/lib/families';
import { safeTour } from './tour';

export const PLANT_SCHEMA_VERSION = 2;

/** anonymous browser owner id (localStorage) — the per-user isolation key */
export const OWNER_KEY = 'fs.owner';

export interface PlantRecord {
  id: string;
  name: string;
  brief: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  ownerId: string;
  graph: FlowGraph;
  kpis: Kpis | null;
  verdict: CriticVerdict | null;
  productionTpd: number | null;
  source: 'user';
  /** which family built it (v2) — the viewer badges + KPI blocks read it */
  family?: string;
  /** the docent's narrated tour (v2) — played by the viewer's tour runner */
  tour?: Tour | null;
}

/** the family a record belongs to, with a v1 fallback to the graph stamp */
export function effectiveFamily(rec: Pick<PlantRecord, 'family' | 'graph'>): string {
  const f = rec.family ?? rec.graph.family;
  return f && isFamilyId(f) ? f : 'ammonia';
}

/** collision-safe-enough local id: time-ordered + random tail */
export function newPlantId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `p${t}${r}`;
}

/** the anonymous owner id of this browser — created on first ask */
export function getOwnerId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = window.localStorage.getItem(OWNER_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `o${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(OWNER_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

/** migrate a legacy localStorage SavedPlant into a first-class record */
export function recordFromSaved(sp: SavedPlant, ownerId: string): PlantRecord {
  const ts = sp.savedAt || new Date().toISOString();
  const kpis = safeKpis(sp.kpis);
  return {
    id: sp.slug || newPlantId(),
    name: sp.name || 'Agent-built plant',
    brief: sp.brief || '',
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: PLANT_SCHEMA_VERSION,
    ownerId,
    graph: sp.graph,
    kpis,
    verdict: sp.verdict ?? null,
    productionTpd: sp.productionTpd ?? null,
    source: 'user',
    family: effectiveFamily({ family: undefined, graph: sp.graph }),
  };
}

/** shape-check an unknown JSON blob (import file / legacy store) */
export function isValidGraph(g: unknown): g is FlowGraph {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  if (!Array.isArray(o.units) || !Array.isArray(o.streams)) return false;
  return o.units.every(
    (u) => !!u && typeof u === 'object' && typeof (u as { id?: unknown }).id === 'string',
  );
}

/**
 * Keep a kpis object only if every field the UI renders is a finite number.
 * Real solver records always qualify; hand-edited imports or older partial
 * records get null instead of a crash deep inside a toFixed() call.
 */
export function safeKpis(k: unknown): Kpis | null {
  if (!k || typeof k !== 'object') return null;
  const o = k as Record<string, unknown>;
  const need = [
    'productionTpd',
    'productPurityMol',
    'productPurityWt',
    'perPassConv',
    'overallConv',
    'loopInerts',
    'h2n2Ratio',
    'specificEnergyGJt',
  ];
  for (const f of need) {
    const v = o[f];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  }
  return k as Kpis;
}

/** parse an exported .flowsheet.json back into a record (new id, this owner) */
export function recordFromImport(json: unknown): PlantRecord | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (!isValidGraph(o.graph)) return null;
  const now = new Date().toISOString();
  const verdict = (o.verdict ?? null) as CriticVerdict | null;
  const kpis = safeKpis(o.kpis);
  return {
    id: newPlantId(),
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 64) : 'Imported plant',
    brief: typeof o.brief === 'string' ? o.brief.slice(0, 2000) : '',
    createdAt: now,
    updatedAt: now,
    schemaVersion: PLANT_SCHEMA_VERSION,
    ownerId: getOwnerId(),
    graph: o.graph,
    kpis,
    verdict,
    productionTpd: typeof o.productionTpd === 'number' ? o.productionTpd : (kpis?.productionTpd ?? null),
    source: 'user',
    family: effectiveFamily({ family: typeof o.family === 'string' ? o.family : undefined, graph: o.graph }),
    tour: safeTour(o.tour),
  };
}
