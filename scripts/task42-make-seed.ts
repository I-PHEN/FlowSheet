/**
 * Task 42 — seed a saved methanol plant into the browser's IndexedDB so the
 * projects grid (miniLayout thumbnails with real symbol kinds) renders for
 * E2E. Writes scripts/seed-meoh.js (eval'd in the page by agent-browser).
 */
import { writeFileSync } from 'fs';
import { METHANOL } from '../src/lib/families/methanol';
import { executeGraph } from '../src/lib/engine/executor';

const graph = METHANOL.referenceGraph();
const r = executeGraph(graph);

const rec = {
  id: 'p3meohdemo',
  name: 'Methanol plant — SMR + Cu/ZnO loop',
  brief: 'Build the standard methanol plant: natural gas + steam reforming, compression, a three-bed converter loop with condensation, purge, and recycle.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schemaVersion: 2,
  ownerId: 'e2e-demo',
  graph,
  kpis: r.kpis,
  verdict: {
    verdict: 'pass',
    score: 87,
    summary: 'Solver-certified demo record for thumbnail E2E.',
    strengths: [],
    issues: [],
    suggestions: [],
  },
  productionTpd: r.kpis.productionTpd,
  source: 'user',
  family: 'methanol',
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
  return 'seeding ' + rec.id;
})()`;

writeFileSync('/home/z/my-project/scripts/seed-meoh.js', js);
console.log('wrote seed-meoh.js — units:', graph.units.length, 'production:', r.kpis.productionTpd.toFixed(0), 't/d');
