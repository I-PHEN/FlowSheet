// E2E test: inject a ROUTER STRESS TEST plant into IndexedDB.
// Exercises: adjacent forward, skip-forward (over a column), multi-row
// columns, band wrap (depth 8 → band 1), two recycles (one cross-band,
// one in-band), and sinks from both the last and a middle column.
(() => {
  const now = new Date().toISOString();
  const rec = {
    id: 'ptest-router-stress',
    name: 'Router Stress Test',
    brief: 'A synthetic plant built to stress the collision-free stream router: branches, skips, a band wrap, two recycle loops and mid-sheet product takeoffs.',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ownerId: 'test-owner',
    source: 'user',
    productionTpd: 512,
    kpis: {
      productionTpd: 512,
      productPurityMol: 0.993,
      productPurityWt: 0.995,
      perPassConv: 0.14,
      overallConv: 0.92,
      loopInerts: 0.06,
      h2n2Ratio: 2.05,
      makeupFlow: 12400,
      recycleMultiple: 4.8,
      purgeFrac: 0.04,
      reformerDutyMW: 68.4,
      refrigerationDutyMW: 12.2,
      syngasComprPowerMW: 9.6,
      circulatorPowerKW: 420,
      specificEnergyGJt: 29.8,
      airFlow: 0,
      secondaryExitC: 0,
      coSlipLTS: 0.002,
    },
    verdict: {
      verdict: 'pass',
      score: 92,
      summary: 'Synthetic stress graph for the routing layer — every connection type at once.',
      strengths: ['clean recycle', 'realistic duties'],
      issues: [],
      suggestions: [],
    },
    graph: {
      units: [
        { id: 'A', type: 'ng-source', specs: {} },
        { id: 'B', type: 'feed-preheater', specs: {} },
        { id: 'C', type: 'primary-reformer', specs: {} },
        { id: 'D1', type: 'wgs-hts', specs: {} },
        { id: 'D2', type: 'intercooler', specs: {} },
        { id: 'E', type: 'whb-cooler', specs: {} },
        { id: 'F', type: 'syngas-compressor', specs: {} },
        { id: 'G', type: 'loop-mixer', specs: {} },
        { id: 'H', type: 'flash-drum', specs: {} },
        { id: 'I', type: 'purge-split', specs: {} },
      ],
      streams: [
        { id: 'S1', name: 'natural gas', cls: 'feed', from: { unit: 'A', port: 'out' }, to: { unit: 'B', port: 'in' } },
        { id: 'S2', name: 'hot feed', cls: 'feed', from: { unit: 'B', port: 'out' }, to: { unit: 'C', port: 'in' } },
        { id: 'S3', name: 'reformate', cls: 'syngas', from: { unit: 'C', port: 'out' }, to: { unit: 'D1', port: 'in' } },
        { id: 'S4', name: 'reformate split', cls: 'syngas', from: { unit: 'C', port: 'out' }, to: { unit: 'D2', port: 'in' } },
        // skip-forward: D1 (depth 3) → E (depth 4) is adjacent; C → E skips D
        { id: 'S5', name: 'hot bypass', cls: 'syngas', from: { unit: 'C', port: 'out' }, to: { unit: 'E', port: 'in' } },
        { id: 'S6', name: 'shifted gas', cls: 'syngas', from: { unit: 'D1', port: 'out' }, to: { unit: 'E', port: 'in' } },
        // skip-forward: D2 (depth 3) → F (depth 5)
        { id: 'S7', name: 'cooled branch', cls: 'syngas', from: { unit: 'D2', port: 'out' }, to: { unit: 'F', port: 'in' } },
        { id: 'S8', name: 'cooled syngas', cls: 'syngas', from: { unit: 'E', port: 'out' }, to: { unit: 'F', port: 'in' } },
        { id: 'S9', name: 'make-up', cls: 'syngas', from: { unit: 'F', port: 'out' }, to: { unit: 'G', port: 'in' } },
        { id: 'S10', name: 'to separator', cls: 'syngas', from: { unit: 'G', port: 'out' }, to: { unit: 'H', port: 'in' } },
        // band wrap: H (depth 7) → I (depth 8, band 1 col 0)
        { id: 'S11', name: 'to purge split', cls: 'syngas', from: { unit: 'H', port: 'vap' }, to: { unit: 'I', port: 'in' } },
        // sink from the LAST column
        { id: 'S12', name: 'crude methanol', cls: 'product', from: { unit: 'H', port: 'liq' }, to: null },
        // sink from a MIDDLE column (lane run to the margin)
        { id: 'S13', name: 'drain', cls: 'water', from: { unit: 'D2', port: 'out' }, to: null },
        // recycle in-band: I (depth 8) → G (depth 6) — also cross-band
        { id: 'S14', name: 'loop gas', cls: 'loopgas', from: { unit: 'I', port: 'out' }, to: { unit: 'G', port: 'loopin' } },
        // recycle in-band shallow: G (depth 6) → C (depth 2)
        { id: 'S15', name: 'reformer recycle', cls: 'loopgas', from: { unit: 'G', port: 'out' }, to: { unit: 'C', port: 'loopin' } },
      ],
      controllers: [],
    },
  };
  return new Promise((resolve, reject) => {
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
      t.oncomplete = () => { db.close(); resolve('injected ' + rec.id); };
      t.onerror = () => reject(req.error);
    };
    req.onerror = () => reject(req.error);
  });
})()
