/**
 * Generate a browser-inject that seeds a REAL v2 PlantRecord for parity
 * verification: the true reference graph, kpis from an actual engine solve
 * (not hand-written), a passing verdict, and a docent-style tour written in
 * Orion's voice (so the CinemaBar's ORION chip + narration path get
 * exercised on a plant that genuinely solves and operates).
 *
 * Run: bun scripts/make-parity-plant.ts   → writes scripts/seed-parity-plant.js
 */
import { writeFileSync } from 'fs';
import { referenceGraph, executeGraph } from '../src/lib/engine';
import type { PlantRecord } from '../src/lib/projects/record';

const g = referenceGraph();
const r = executeGraph(g);
if (!r.ok || !r.converged) throw new Error('reference graph did not solve — aborting');

const now = new Date().toISOString();
const rec: PlantRecord = {
  id: 'ptest-parity-01',
  name: 'Reference Ammonia Plant (parity check)',
  brief: 'Build the standard ammonia plant at the reference operating point.',
  createdAt: now,
  updatedAt: now,
  schemaVersion: 2,
  ownerId: 'test-owner',
  source: 'user',
  family: 'ammonia',
  graph: g,
  kpis: r.kpis,
  verdict: {
    verdict: 'pass',
    score: 100,
    summary: 'Converged, balanced, on the canonical route at the reference conditions.',
    strengths: [],
    issues: [],
    suggestions: [],
  } as PlantRecord['verdict'],
  productionTpd: r.kpis.productionTpd,
  tour: {
    id: 'orion-parity',
    chip: 'Walk the plant with Orion',
    title: 'The reference ammonia plant',
    steps: [
      {
        ref: { type: 'unit', id: 'SRC_NG' },
        title: 'Where it all starts',
        text: 'Orion here — I have run this plant for thirty years, and it always starts right here. Natural gas at battery limit: one thousand kilomoles an hour of methane. Everything downstream is this feed, transformed.',
      },
      {
        ref: { type: 'unit', id: 'R1' },
        title: 'The hot heart',
        text: 'The primary reformer runs at eight hundred degrees over nickel catalyst. Steam and methane split into hydrogen and carbon monoxide. You can hear the burners breathe when the firebox is happy.',
      },
      {
        ref: { type: 'unit', id: 'R6' },
        title: 'The loop that makes ammonia',
        text: 'Three beds of iron catalyst, two hundred bar, and patience. Nitrogen and hydrogen combine here on each pass — about fourteen percent per pass — then we chill, separate, and send the rest around again.',
      },
      {
        ref: { type: 'unit', id: 'V3' },
        title: 'The product',
        text: 'Liquid ammonia leaves the separator at over a thousand tonnes a day, ninety-nine point nine five percent pure. That is the plant answering. Switch to Operate and move a lever — it answers live.',
      },
    ],
  } as PlantRecord['tour'],
};

const js = `(() => {
  const rec = ${JSON.stringify(rec)};
  const req = indexedDB.open('flowsheet', 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('plants')) {
      const store = db.createObjectStore('plants', { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
    }
  };
  req.onsuccess = () => {
    const db = req.result;
    const t = db.transaction('plants', 'readwrite');
    t.objectStore('plants').put(rec);
    t.oncomplete = () => { db.close(); window.__seeded = true; };
  };
  return 'seeding ${rec.id} with productionTpd ' + rec.kpis.productionTpd.toFixed(1);
})()`;

writeFileSync('/home/z/my-project/scripts/seed-parity-plant.js', js);
console.log(`wrote seed-parity-plant.js — plant solves: ${r.ok}, production ${r.kpis.productionTpd.toFixed(1)} t/d, tour stops: ${rec.tour?.steps.length}`);
