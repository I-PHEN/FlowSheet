// E2E test: inject a plant record into IndexedDB, then verify grid/viewer/tour
(() => {
  const now = new Date().toISOString();
  const rec = {
    id: 'ptest-methanol-01',
    name: 'Test Methanol Loop',
    brief: 'Build a 500 t/day methanol plant with steam reforming and a synthesis recycle loop.',
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
      summary: 'Coherent reforming-and-loop route that honours the brief.',
      strengths: ['clean recycle', 'realistic duties'],
      issues: [],
      suggestions: [],
    },
    graph: {
      units: [
        { id: 'U1', type: 'ng-source', specs: {} },
        { id: 'U2', type: 'feed-preheater', specs: {} },
        { id: 'U3', type: 'primary-reformer', specs: {} },
        { id: 'U4', type: 'wgs-hts', specs: {} },
        { id: 'U5', type: 'whb-cooler', specs: {} },
        { id: 'U6', type: 'syngas-compressor', specs: {} },
        { id: 'U7', type: 'loop-mixer', specs: {} },
        { id: 'U8', type: 'flash-drum', specs: {} },
        { id: 'U9', type: 'purge-split', specs: {} },
      ],
      streams: [
        { id: 'S1', name: 'natural gas', cls: 'feed', from: { unit: 'U1', port: 'out' }, to: { unit: 'U2', port: 'in' } },
        { id: 'S2', name: 'hot feed', cls: 'feed', from: { unit: 'U2', port: 'out' }, to: { unit: 'U3', port: 'in' } },
        { id: 'S3', name: 'reformate', cls: 'syngas', from: { unit: 'U3', port: 'out' }, to: { unit: 'U4', port: 'in' } },
        { id: 'S4', name: 'shifted gas', cls: 'syngas', from: { unit: 'U4', port: 'out' }, to: { unit: 'U5', port: 'in' } },
        { id: 'S5', name: 'cooled syngas', cls: 'syngas', from: { unit: 'U5', port: 'out' }, to: { unit: 'U6', port: 'in' } },
        { id: 'S6', name: 'make-up', cls: 'syngas', from: { unit: 'U6', port: 'out' }, to: { unit: 'U7', port: 'in' } },
        { id: 'S7', name: 'loop gas', cls: 'loopgas', from: { unit: 'U9', port: 'out' }, to: { unit: 'U7', port: 'loopin' } },
        { id: 'S8', name: 'reactor feed', cls: 'loopgas', from: { unit: 'U7', port: 'out' }, to: { unit: 'U3', port: 'loopin' } },
        { id: 'S9', name: 'crude methanol', cls: 'product', from: { unit: 'U8', port: 'liq' }, to: null },
        { id: 'S10', name: 'to separator', cls: 'syngas', from: { unit: 'U8', port: 'vap' }, to: { unit: 'U9', port: 'in' } },
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
