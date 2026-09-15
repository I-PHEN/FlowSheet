// set up legacy localStorage library + clear migration flag
(() => {
  const legacy = [{
    slug: 'plegacy-ammonia-77',
    name: 'Legacy Ammonia Build',
    brief: 'Build a modest ammonia plant with a small synthesis loop.',
    savedAt: '2026-09-10T14:30:00.000Z',
    graph: {
      units: [
        { id: 'A', type: 'ng-source', specs: {} },
        { id: 'B', type: 'primary-reformer', specs: {} },
        { id: 'C', type: 'syngas-compressor', specs: {} },
        { id: 'D', type: 'flash-drum', specs: {} },
      ],
      streams: [
        { id: 'T1', name: 'feed gas', cls: 'feed', from: { unit: 'A', port: 'out' }, to: { unit: 'B', port: 'in' } },
        { id: 'T2', name: 'syngas', cls: 'syngas', from: { unit: 'B', port: 'out' }, to: { unit: 'C', port: 'in' } },
        { id: 'T3', name: 'product', cls: 'product', from: { unit: 'C', port: 'out' }, to: { unit: 'D', port: 'in' } },
      ],
      controllers: [],
    },
    kpis: null,
    verdict: null,
    productionTpd: null,
  }];
  localStorage.setItem('psp.library.v1', JSON.stringify(legacy));
  localStorage.removeItem('fs.legacy.migrated');
  return 'legacy set, migration flag cleared';
})()
