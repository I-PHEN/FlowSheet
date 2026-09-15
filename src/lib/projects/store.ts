/**
 * Local project store — IndexedDB, per-user, no accounts.
 *
 * localStorage capped us at ~5 MB and stringifies the whole library on
 * every save; IndexedDB gives structured records, key-pathed access and
 * room to grow. Every call is SSR-safe (returns empty/idle off-browser).
 *
 * The legacy `psp.library.v1` strip from the old builder is folded in
 * automatically, once, on first touch — the original key is left intact
 * so nothing is ever destroyed by a migration.
 */

import type { FlowGraph } from '@/lib/engine/graph';
import type { SavedPlant } from '@/lib/agent/protocol';
import { LIBRARY_KEY } from '@/lib/agent/protocol';
import {
  getOwnerId,
  recordFromSaved,
  recordFromImport,
  safeKpis,
  type PlantRecord,
} from './record';

const DB_NAME = 'flowsheet';
const STORE = 'plants';
const DB_VERSION = 1;
const MIGRATED_KEY = 'fs.legacy.migrated';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
    t.oncomplete = () => db.close();
  });
}

/** one-shot: fold the legacy localStorage library into the store */
export async function ensureMigrated(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    if (window.localStorage.getItem(MIGRATED_KEY)) return;
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const legacy = JSON.parse(raw) as SavedPlant[];
      if (Array.isArray(legacy) && legacy.length > 0) {
        const ownerId = getOwnerId();
        for (const sp of legacy) {
          try {
            await putPlant(recordFromSaved(sp, ownerId));
          } catch {
            /* a bad legacy record never blocks the rest */
          }
        }
      }
    }
    window.localStorage.setItem(MIGRATED_KEY, '1');
  } catch {
    /* storage unavailable — migration retried on next visit */
  }
}

export async function listPlants(): Promise<PlantRecord[]> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return [];
  await ensureMigrated();
  try {
    const all = await tx<PlantRecord[]>('readonly', (s) => s.getAll() as IDBRequest<PlantRecord[]>);
    return (Array.isArray(all) ? all : [])
      .filter((r) => r && Array.isArray(r.graph?.units))
      .map((r) => ({ ...r, kpis: safeKpis(r.kpis) }))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  } catch {
    return [];
  }
}

export async function getPlant(id: string): Promise<PlantRecord | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  try {
    const rec = await tx<PlantRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<PlantRecord | undefined>);
    if (!rec) return null;
    // records written by other paths (or older schema moments) get the same
    // mercy as imports: partial numbers are dropped, not crashed on
    return { ...rec, kpis: safeKpis(rec.kpis) };
  } catch {
    return null;
  }
}

export async function putPlant(rec: PlantRecord): Promise<void> {
  await tx('readwrite', (s) => s.put(rec) as IDBRequest<IDBValidKey>);
}

export async function deletePlant(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

/** find a legacy record by its old slug (pre-migration `?load=slug` links) */
export function findLegacyBySlug(slug: string): SavedPlant | null {
  if (typeof window === 'undefined') return null;
  try {
    const list = JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? '[]') as SavedPlant[];
    return list.find((r) => r.slug === slug) ?? null;
  } catch {
    return null;
  }
}

/** download a record as a portable .flowsheet.json */
export function exportRecord(rec: PlantRecord): void {
  const payload = {
    app: 'Flowsheet',
    kind: 'plant',
    exportedAt: new Date().toISOString(),
    name: rec.name,
    brief: rec.brief,
    graph: rec.graph,
    kpis: rec.kpis,
    verdict: rec.verdict,
    productionTpd: rec.productionTpd,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = rec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plant';
  a.href = url;
  a.download = `${safe}.flowsheet.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** read a picked file back into a fresh record owned by this browser */
export async function importRecord(file: File): Promise<PlantRecord | null> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  return recordFromImport(json);
}

/** a graph's fingerprint, for thumbnails that change when the plant does */
export function graphStamp(graph: FlowGraph): string {
  return `${graph.units.length}u${graph.streams.length}s${graph.units.map((u) => u.id).join('.')}`;
}
