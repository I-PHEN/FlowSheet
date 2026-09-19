(() => {
  const now = new Date().toISOString();
  const rec = {
    id: 'ptest-learn-01',
    name: 'Hydrogen Train',
    brief: 'A small hydrogen plant for Learn-merge verification.',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 2,
    ownerId: 'test-owner',
    source: 'user',
    family: 'general',
    productionTpd: 12,
    kpis: {
      productionTpd: 12.4,
      productPurityMol: 0.999,
      productPurityWt: 0.999,
      perPassConv: 0,
      overallConv: 0,
      productSpecies: 'H2',
      familyKpis: [
        { label: 'Production', value: '12 t/d' },
        { label: 'Purity', value: '99.9 mol%' },
      ],
    },
    verdict: {
      verdict: 'pass',
      score: 94,
      summary: 'Coherent train that honours the brief.',
      strengths: [],
      issues: [],
      suggestions: [],
    },
    tour: {
      id: 'docent-test',
      chip: 'Walk my plant',
      title: 'A guided walk',
      steps: [
        {
          ref: { type: 'unit', id: 'U3' },
          title: 'The reformer',
          text: 'Where the chemistry starts. The primary reformer cracks the feed into hydrogen over nickel catalyst at high temperature, absorbing heat from the furnace around the tubes.',
        },
        {
          ref: { type: 'unit', id: 'U5' },
          title: 'Scrub the carbon',
          text: 'The CO2 removal unit scrubs carbon dioxide out of the gas with a circulating solvent, leaving nearly pure hydrogen behind for the PSA to polish.',
        },
        {
          ref: { type: 'unit', id: 'U7' },
          title: 'Polish to purity',
          text: 'The pressure-swing adsorption bed captures the last impurities at high pressure and releases them at low pressure. The hydrogen leaving here is product grade.',
        },
      ],
    },
    graph: {
      units: [
        { id: 'U1', type: 'ng-source', specs: {} },
        { id: 'U2', type: 'feed-mixer', specs: {} },
        { id: 'U3', type: 'primary-reformer', specs: {} },
        { id: 'U4', type: 'wgs-hts', specs: {} },
        { id: 'U5', type: 'co2-removal', specs: {} },
        { id: 'U6', type: 'syngas-compressor', specs: {} },
        { id: 'U7', type: 'psa', specs: {} },
      ],
      streams: [
        { id: 'S1', name: 'natural gas', cls: 'feed', from: { unit: 'U1', port: 'out' }, to: { unit: 'U2', port: 'ng' } },
        { id: 'S2', name: 'mixed feed', cls: 'feed', from: { unit: 'U2', port: 'out' }, to: { unit: 'U3', port: 'in' } },
        { id: 'S3', name: 'reformate', cls: 'syngas', from: { unit: 'U3', port: 'out' }, to: { unit: 'U4', port: 'in' } },
        { id: 'S4', name: 'shifted gas', cls: 'syngas', from: { unit: 'U4', port: 'out' }, to: { unit: 'U5', port: 'in' } },
        { id: 'S5', name: 'scrubbed gas', cls: 'syngas', from: { unit: 'U5', port: 'out' }, to: { unit: 'U6', port: 'in' } },
        { id: 'S6', name: 'high-pressure gas', cls: 'syngas', from: { unit: 'U6', port: 'out' }, to: { unit: 'U7', port: 'in' } },
        { id: 'S7', name: 'product hydrogen', cls: 'product', from: { unit: 'U7', port: 'out' }, to: null },
      ],
      controllers: [],
    },
  };
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
    t.oncomplete = () => {
      db.close();
      window.__seeded = true;
    };
  };
  return 'seeding ptest-learn-01';
})()
