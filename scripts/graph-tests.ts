/**
 * ENGINE 2.0 GATE — graph executor identity + structure tests.
 *
 * Run: bun scripts/graph-tests.ts
 *
 * The identity test is the D1 gate: executeGraph(buildGraph(spec)) must
 * reproduce runLegacy(spec) — same streams, same metric strings, same
 * solver trace, same warnings — across the whole spec envelope. Only
 * after this holds does the graph path become the real run().
 */

import {
  baseCase,
  run,
  runLegacy,
  buildGraph,
  referenceGraph,
  executeGraph,
  planTear,
  validateGraph,
  sccList,
} from '../src/lib/engine';
import type { PlantSpec } from '../src/lib/engine/plant';
import type { PlantResult, Stream, UnitResult } from '../src/lib/engine/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name}  ${detail}`);
  }
}

// ---------------------------------------------------------------------------
console.log('\nG1. IDENTITY — run() (graph path) vs runLegacy() across the envelope');
// ---------------------------------------------------------------------------

const specs: Array<{ label: string; spec: PlantSpec }> = [
  { label: 'base case', spec: baseCase() },
  { label: 'loopP 200', spec: { ...baseCase(), loopP: 200 } },
  { label: 'low loop + cool reformer', spec: { ...baseCase(), loopP: 100, primaryT: 760 } },
  { label: 'big plant', spec: { ...baseCase(), ngFeed: 1800, steamCarbon: 3.5 } },
  { label: 'manual air', spec: { ...baseCase(), airAuto: false, airFlow: 1200 } },
  { label: 'purge + warm chill', spec: { ...baseCase(), purgeFrac: 0.15, chillT: 5 } },
  { label: '4-stage compressor', spec: { ...baseCase(), comprStages: 4, etaP: 0.7 } },
  { label: 'H2/N2 target 2.8', spec: { ...baseCase(), h2n2Set: 2.8 } },
  { label: 'dirty CO2 spec', spec: { ...baseCase(), co2Residual: 800, co2h2Slip: 0.008 } },
  { label: 'bed approaches', spec: { ...baseCase(), bedApproach: [0.8, 0.95, 0.85] } },
  { label: 'shift ATEs', spec: { ...baseCase(), htsATE: 35, ltsATE: 30 } },
  { label: 'corner: tiny feed', spec: { ...baseCase(), ngFeed: 100 } },
  { label: 'corner: cold reformer', spec: { ...baseCase(), primaryT: 700 } },
];

// seeded pseudo-random specs within physical ranges (deterministic)
let seed = 42;
const rnd = (lo: number, hi: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return lo + ((seed / 2147483648) * (hi - lo));
};
for (let i = 0; i < 6; i++) {
  const b = baseCase();
  specs.push({
    label: `random #${i + 1}`,
    spec: {
      ...b,
      ngFeed: rnd(300, 2500),
      steamCarbon: rnd(2.2, 4.2),
      frontEndP: rnd(24, 38),
      primaryT: rnd(740, 860),
      primaryATE: rnd(2, 25),
      airAuto: i % 2 === 0,
      airFlow: rnd(800, 2400),
      h2n2Set: rnd(2.7, 3.2),
      secondaryATE: rnd(10, 60),
      htsInletT: rnd(320, 370),
      htsATE: rnd(5, 35),
      ltsInletT: rnd(190, 225),
      ltsATE: rnd(5, 40),
      co2Residual: rnd(100, 1200),
      co2h2Slip: rnd(0.001, 0.007),
      methInletT: rnd(270, 330),
      loopP: rnd(100, 220),
      bed1T: rnd(370, 430),
      bed2T: rnd(390, 460),
      bed3T: rnd(385, 445),
      bedApproach: [rnd(0.7, 0.95), rnd(0.7, 0.95), rnd(0.7, 0.95)],
      chillT: rnd(-35, 15),
      purgeFrac: rnd(0.015, 0.12),
      comprStages: Math.round(rnd(2, 5)),
      etaP: rnd(0.65, 0.82),
      dpConverter: rnd(1.5, 6),
      dpCondenser: rnd(1, 4),
    },
  });
}

const maxDiff = { value: 0, where: '' };
const numDiff = (a: number, b: number, where: string, tol = 1e-9) => {
  const d = Math.abs(a - b);
  if (d > maxDiff.value) maxDiff.value = d;
  if (d > maxDiff.where.length + 0 && d > 0) maxDiff.where = where;
  return d <= tol;
};

function compareResults(label: string, a: PlantResult, b: PlantResult): boolean {
  let ok = true;
  const bad = (msg: string) => {
    ok = false;
    failures.push(`[${label}] ${msg}`);
    console.log(`    ✗ ${label}: ${msg}`);
  };
  if (a.converged !== b.converged) bad(`converged ${a.converged} vs ${b.converged}`);
  if (a.iterations !== b.iterations) bad(`iterations ${a.iterations} vs ${b.iterations}`);
  if (a.h2n2Err !== null || b.h2n2Err !== null) {
    if (a.h2n2Err === null || b.h2n2Err === null) bad('h2n2Err null mismatch');
    else if (!numDiff(a.h2n2Err, b.h2n2Err, 'h2n2Err')) bad(`h2n2Err ${a.h2n2Err} vs ${b.h2n2Err}`);
  }
  // streams
  const keys = new Set([...Object.keys(a.streams), ...Object.keys(b.streams)]);
  if (keys.size !== Object.keys(a.streams).length || keys.size !== Object.keys(b.streams).length) {
    bad(`stream set mismatch: ${Object.keys(a.streams).length} vs ${Object.keys(b.streams).length}`);
  }
  for (const k of keys) {
    const sa = a.streams[k] as Stream | undefined;
    const sb = b.streams[k] as Stream | undefined;
    if (!sa || !sb) continue;
    if (sa.name !== sb.name) bad(`stream ${k} name "${sa.name}" vs "${sb.name}"`);
    if (sa.cls !== sb.cls) bad(`stream ${k} cls ${sa.cls} vs ${sb.cls}`);
    if (!numDiff(sa.T, sb.T, `stream ${k} T`)) bad(`stream ${k} T ${sa.T} vs ${sb.T}`);
    if (!numDiff(sa.P, sb.P, `stream ${k} P`)) bad(`stream ${k} P ${sa.P} vs ${sb.P}`);
    for (let i = 0; i < 9; i++) {
      if (!numDiff(sa.n[i], sb.n[i], `stream ${k} n[${i}]`)) bad(`stream ${k} n[${i}] ${sa.n[i]} vs ${sb.n[i]}`);
    }
  }
  // units — metric strings exact, raws to tolerance
  const uk = new Set([...Object.keys(a.units), ...Object.keys(b.units)]);
  for (const k of uk) {
    const ua = a.units[k] as UnitResult | undefined;
    const ub = b.units[k] as UnitResult | undefined;
    if (!ua || !ub) {
      bad(`unit ${k} missing on one side`);
      continue;
    }
    if (ua.name !== ub.name) bad(`unit ${k} name "${ua.name}" vs "${ub.name}"`);
    if (ua.model !== ub.model) bad(`unit ${k} model "${ua.model}" vs "${ub.model}"`);
    if (ua.metrics.length !== ub.metrics.length) {
      bad(`unit ${k} metric count ${ua.metrics.length} vs ${ub.metrics.length}`);
      continue;
    }
    for (let i = 0; i < ua.metrics.length; i++) {
      if (ua.metrics[i].label !== ub.metrics[i].label) bad(`unit ${k} metric ${i} label`);
      if (ua.metrics[i].value !== ub.metrics[i].value) bad(`unit ${k} metric ${i} value "${ua.metrics[i].value}" vs "${ub.metrics[i].value}"`);
      const ra = ua.metrics[i].raw;
      const rb = ub.metrics[i].raw;
      if (ra !== undefined || rb !== undefined) {
        if (ra === undefined || rb === undefined) bad(`unit ${k} metric ${i} raw presence`);
        else if (!numDiff(ra, rb, `unit ${k} metric ${i} raw`)) bad(`unit ${k} metric ${i} raw ${ra} vs ${rb}`);
      }
    }
    if (JSON.stringify(ua.warnings) !== JSON.stringify(ub.warnings)) bad(`unit ${k} warnings ${JSON.stringify(ua.warnings)} vs ${JSON.stringify(ub.warnings)}`);
  }
  // KPIs
  for (const [k, va] of Object.entries(a.kpis)) {
    const vb = (b.kpis as unknown as Record<string, unknown>)[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      if (!numDiff(va, vb, `kpi ${k}`)) bad(`kpi ${k} ${va} vs ${vb}`);
    }
  }
  // balance
  for (let i = 0; i < a.balance.length; i++) {
    if (!numDiff(a.balance[i].in, b.balance[i].in, `balance ${i} in`)) bad(`balance ${a.balance[i].element} in`);
    if (!numDiff(a.balance[i].out, b.balance[i].out, `balance ${i} out`)) bad(`balance ${a.balance[i].element} out`);
    if (!numDiff(a.balance[i].relErr, b.balance[i].relErr, `balance ${i} relErr`)) bad(`balance ${a.balance[i].element} relErr`);
  }
  // solver trace — exact structure, err to tight tolerance
  if (a.solverTrace.length !== b.solverTrace.length) {
    bad(`trace length ${a.solverTrace.length} vs ${b.solverTrace.length}`);
  } else {
    for (let i = 0; i < a.solverTrace.length; i++) {
      if (a.solverTrace[i].iter !== b.solverTrace[i].iter) bad(`trace ${i} iter`);
      if (a.solverTrace[i].method !== b.solverTrace[i].method) bad(`trace ${i} method ${a.solverTrace[i].method} vs ${b.solverTrace[i].method}`);
      if (!numDiff(a.solverTrace[i].err, b.solverTrace[i].err, `trace ${i} err`, 1e-12)) bad(`trace ${i} err ${a.solverTrace[i].err} vs ${b.solverTrace[i].err}`);
    }
  }
  // warnings — exact ordered array
  if (JSON.stringify(a.warnings) !== JSON.stringify(b.warnings)) {
    bad(`warnings ${JSON.stringify(a.warnings)} vs ${JSON.stringify(b.warnings)}`);
  }
  return ok;
}

for (const { label, spec } of specs) {
  const a = run(spec);
  const b = runLegacy(spec);
  check(`identity: ${label}`, compareResults(label, a, b));
}
console.log(`  (max numeric diff across all specs: ${maxDiff.value.toExponential(2)} at ${maxDiff.where})`);

// determinism of the new path
{
  const a = run(baseCase());
  const b = run(baseCase());
  check('graph path deterministic', JSON.stringify([a.kpis, a.solverTrace, a.warnings]) === JSON.stringify([b.kpis, b.solverTrace, b.warnings]));
}

// ---------------------------------------------------------------------------
console.log('\nG2. GRAPH STRUCTURE — tear detection & validation');
// ---------------------------------------------------------------------------

{
  const g = referenceGraph();
  const issues = validateGraph(g);
  check('reference graph validates clean', issues.length === 0, JSON.stringify(issues.map((i) => i.message)));

  const { scc, cut } = planTear(g);
  const loopUnits = ['M2', 'E3', 'R6', 'E2', 'V3', 'SP1', 'C2'];
  check(
    'SCC = synthesis loop units',
    scc.size === loopUnits.length && loopUnits.every((u) => scc.has(u)),
    `got {${[...scc].join(',')}}`,
  );
  check('tear edge = S20 (converter feed, spec-determined outlet)', cut?.id === 'S20', `got ${cut?.id}`);
}

// validator rejections
{
  const g = buildGraph(baseCase());
  // 1. unfed inlet: disconnect S25 from SP1
  const g1 = JSON.parse(JSON.stringify(g)) as typeof g;
  g1.streams = g1.streams.filter((s) => s.id !== 'S25');
  let issues = validateGraph(g1);
  check('unfed inlet rejected', issues.some((i) => i.code === 'unfed-inlet' && i.unitId === 'SP1'), issues.map((i) => i.code).join(','));

  // 2. spec out of range
  const g2 = JSON.parse(JSON.stringify(g)) as typeof g;
  g2.units.find((u) => u.id === 'R1')!.specs.outletT = 1200;
  issues = validateGraph(g2);
  check('spec out of range rejected', issues.some((i) => i.code === 'spec-out-of-range' && i.unitId === 'R1'));

  // 3. port phase mismatch: wire V1 liquid into R3 gas inlet
  const g3 = JSON.parse(JSON.stringify(g)) as typeof g;
  const s12 = g3.streams.find((s) => s.id === 'S12')!;
  s12.to = { unit: 'R3', port: 'in' };
  issues = validateGraph(g3);
  check('port phase mismatch rejected', issues.some((i) => i.code === 'port-kind-mismatch'));

  // 4. duplicate stream id
  const g4 = JSON.parse(JSON.stringify(g)) as typeof g;
  g4.streams.push({ ...g4.streams[0] });
  issues = validateGraph(g4);
  check('duplicate stream id rejected', issues.some((i) => i.code === 'duplicate-stream-id'));

  // 5. unknown unit type
  const g5 = JSON.parse(JSON.stringify(g)) as typeof g;
  g5.units.find((u) => u.id === 'R5')!.type = 'flux-capacitor';
  issues = validateGraph(g5);
  check('unknown unit type rejected', issues.some((i) => i.code === 'unknown-unit-type'));

  // 6. unreachable unit
  const g6 = JSON.parse(JSON.stringify(g)) as typeof g;
  g6.units.push({ id: 'X1', type: 'wgs-hts', specs: {} });
  g6.streams.push({ id: 'SX1', name: 'orphan out', cls: 'syngas', from: { unit: 'X1', port: 'out' }, to: null });
  g6.streams.push({ id: 'SX2', name: 'orphan loop', cls: 'syngas', from: { unit: 'X1', port: 'out' }, to: { unit: 'X1', port: 'in' } });
  issues = validateGraph(g6);
  check('unreachable unit rejected', issues.some((i) => i.code === 'unreachable-unit' && i.unitId === 'X1'));
  // note: X1.out feeds two streams → also dangling/double-fed; either is fine

  // 7. dangling outlet
  const g7 = JSON.parse(JSON.stringify(g)) as typeof g;
  g7.streams = g7.streams.filter((s) => !(s.id === 'S13'));
  issues = validateGraph(g7);
  check('dangling outlet rejected', issues.some((i) => i.code === 'dangling-outlet' && i.unitId === 'A1'));
}

// ---------------------------------------------------------------------------
console.log('\nG3. MODIFIED GRAPHS — the point of Engine 2.0');
// ---------------------------------------------------------------------------

{
  // bypass the LTS reactor: E4 feeds V1 directly
  const g = buildGraph(baseCase());
  g.units = g.units.filter((u) => u.id !== 'R4');
  g.streams = g.streams.filter((s) => s.id !== 'S09');
  const s10 = g.streams.find((s) => s.id === 'S10')!;
  s10.from = { unit: 'E4', port: 'out' };
  s10.name = 'Shift effluent (no LTS)';
  const issues = validateGraph(g);
  check('LTS-bypass graph validates clean', issues.length === 0, issues.map((i) => i.message).join('; '));
  try {
    const r = executeGraph(g);
    check('LTS-bypass graph solves', r.ok && Number.isFinite(r.kpis.productionTpd), `tpd=${r.kpis.productionTpd}`);
    check(
      'LTS-bypass: no R4 unit result, front end intact',
      r.units.R4 === undefined && r.units.R1 !== undefined && r.units.R6 !== undefined,
    );
    check('LTS-bypass: element balance still closes', r.balance.every((b) => b.relErr < 1e-6), JSON.stringify(r.balance.map((b) => b.relErr)));
    // higher CO slip should cost production vs the reference
    const ref = run(baseCase());
    check('LTS-bypass: production drops (CO poisons loop less H2)', r.kpis.productionTpd < ref.kpis.productionTpd, `${r.kpis.productionTpd} vs ${ref.kpis.productionTpd}`);
  } catch (err) {
    check('LTS-bypass graph solves', false, String(err));
  }
}

// ---------------------------------------------------------------------------
console.log('\n════════════════════════════════════════');
console.log(`ENGINE 2.0 GATE: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log('IDENTITY HOLDS — the graph path is the engine.');
else {
  console.log('FAILURES:');
  for (const f of failures.slice(0, 40)) console.log(`  · ${f}`);
}
console.log('════════════════════════════════════════');
if (failed > 0) process.exit(1);
