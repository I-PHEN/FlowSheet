/**
 * OPERATE PARITY GATE — the laws behind every plant's control room.
 *
 * Run: bun scripts/operate-parity-tests.ts
 *
 * The user's law: whatever the app does for the prebuilt plants, the
 * agent-built plants get identically — DERIVED from data, never wired per
 * plant. These tests pin the pieces that make that true:
 *
 *   A. lever law     — levers derive from graph + registry metadata:
 *                      feed throttles (controller-owned flows skipped),
 *                      one operating lever per process unit in teaching
 *                      priority (outletT → dischargeP/outletP → °C → bar)
 *   B. patch purity  — the design-point graph is never mutated; levers
 *                      compose through immutable patches
 *   C. answer cells  — the pinned bar's numbers derive from the family
 *                      KPIs (or the generic triple), with honest deltas
 *   D. live loop     — a patched graph re-solves and the plant ANSWERS
 *   E. anti-drift    — Orion's voice spec, the ORION chip, the saved
 *                      plant's Learn|Operate axis, the pinned answer bar
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { referenceGraph, executeGraph } from '../src/lib/engine';
import type { FlowGraph } from '../src/lib/engine/graph';
import type { Kpis } from '../src/lib/engine/types';
import { deriveLevers, patchSpec, answerCells, LEVER_CAP } from '../src/lib/projects/operate';

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
console.log('\nA. LEVER LAW (derived from the graph + registry, never per plant)');
// ---------------------------------------------------------------------------
{
  const g = referenceGraph();
  const levers = deriveLevers(g);

  check('reference plant has levers', levers.length > 0, `got ${levers.length}`);
  check(`lever count respects the cap (${LEVER_CAP})`, levers.length <= LEVER_CAP, `got ${levers.length}`);

  // feed throttles first, biggest feed first
  const flowLevers = levers.filter((l) => l.specKey === 'flow');
  check('feed throttles present', flowLevers.length >= 2, `got ${flowLevers.length}`);
  check(
    'throttles lead the list (steam 3000 before ng 1000 — biggest feed first)',
    levers[0].unitId === 'SRC_ST' && levers[1].unitId === 'SRC_NG',
    `got ${levers[0].unitId}, ${levers[1].unitId}`,
  );

  // the controller owns the air flow — the lever list must not fight it
  check(
    'controller-owned flow (SRC_AIR) is skipped honestly',
    !levers.some((l) => l.unitId === 'SRC_AIR'),
  );

  // the reformer's operating lever is its outlet temperature, bounds from the registry
  const r1 = levers.find((l) => l.unitId === 'R1');
  check('primary reformer contributes a lever', !!r1);
  check('reformer lever is outletT (the hot section)', r1?.specKey === 'outletT');
  check('reformer lever bounds come from the registry', r1?.min === 700 && r1?.max === 900);
  check('reformer lever value is the resolved spec (805)', r1?.value === 805);

  // well-formedness for every lever
  check(
    'every lever: min < value <= max, step > 0, unit present',
    levers.every((l) => l.min < l.max && l.value >= l.min && l.value <= l.max && l.step > 0 && l.unit.length > 0),
  );
  check(
    'every lever has a label, ref and hint',
    levers.every((l) => l.label.length > 0 && l.ref.length > 0 && l.hint.length > 0),
  );
  check(
    'no unit contributes two levers',
    new Set(levers.map((l) => l.unitId)).size === levers.length,
  );

  // teaching priority: a lone compressor contributes its DISCHARGE PRESSURE
  // (the classic loop-pressure lever), not its intercool temperature
  const compressorOnly: FlowGraph = {
    units: [{ id: 'C1', type: 'syngas-compressor', specs: {} }],
    streams: [],
    controllers: [],
  };
  const cLev = deriveLevers(compressorOnly);
  check('lone compressor contributes one lever', cLev.length === 1, `got ${cLev.length}`);
  check('compressor lever is dischargeP (pressure beats postT)', cLev[0]?.specKey === 'dischargeP');
  check('compressor bounds from the registry', cLev[0]?.min === 40 && cLev[0]?.max === 250);

  // unknown unit types never crash and never contribute
  const withGhost: FlowGraph = {
    units: [
      { id: 'C1', type: 'syngas-compressor', specs: {} },
      { id: 'GHOST', type: 'not-a-real-type', specs: {} },
    ],
    streams: [],
    controllers: [],
  };
  check('unknown unit types are skipped without crashing', deriveLevers(withGhost).length === 1);

  // a source WITHOUT a controller is operable; WITH one it is not
  const airFree: FlowGraph = {
    units: [{ id: 'AIR', type: 'air-source', specs: {} }],
    streams: [],
    controllers: [],
  };
  const airAuto: FlowGraph = {
    units: [{ id: 'AIR', type: 'air-source', specs: {} }],
    streams: [],
    controllers: [{ id: 'CTRL', manipulate: 'AIR', measure: 'S1', num: 0, den: 1, set: 3, auto: true }],
  };
  check('uncontrolled air source is a throttle', deriveLevers(airFree).length === 1);
  check('auto-controlled air source is left to the controller', deriveLevers(airAuto).length === 0);

  // throttle cap: many feeds still read clearly
  const manyFeeds: FlowGraph = {
    units: [1, 2, 3, 4, 5].map((i) => ({ id: `NG${i}`, type: 'ng-source', specs: {} })),
    streams: [],
    controllers: [],
  };
  const manyLevers = deriveLevers(manyFeeds);
  check(
    'five feeds cap at three throttles',
    manyLevers.length === 3 && manyLevers.every((l) => l.specKey === 'flow'),
    `got ${manyLevers.length}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\nB. PATCH PURITY (the design point stays pristine — reset is real)');
// ---------------------------------------------------------------------------
{
  const g = referenceGraph();
  const snapshot = JSON.stringify(g);

  const p = patchSpec(g, 'SRC_NG', 'flow', 1400);
  check('patch returns a NEW graph (fresh identity for caches)', p !== g);
  check('the original graph is unmutated', JSON.stringify(g) === snapshot);

  const ng = p.units.find((u) => u.id === 'SRC_NG');
  check('the patched spec is set', ng?.specs.flow === 1400);
  check('sibling units are untouched', p.units.find((u) => u.id === 'R1') === g.units.find((u) => u.id === 'R1'));

  // levers compose: patch the patch
  const p2 = patchSpec(p, 'R1', 'outletT', 850);
  check('patches compose', p2.units.find((u) => u.id === 'SRC_NG')?.specs.flow === 1400 && p2.units.find((u) => u.id === 'R1')?.specs.outletT === 850);
  check('the intermediate patch is unmutated too', p.units.find((u) => u.id === 'R1')?.specs.outletT === undefined);
}

// ---------------------------------------------------------------------------
console.log('\nC. ANSWER CELLS (family headlines when present, generic otherwise)');
// ---------------------------------------------------------------------------
{
  const kpis = (over: Partial<Kpis>): Kpis => ({
    productionTpd: 1020,
    productPurityMol: 0.995,
    productPurityWt: 0.997,
    perPassConv: 0.14,
    overallConv: 0.6,
    loopInerts: 0.04,
    h2n2Ratio: 2.98,
    makeupFlow: 4000,
    recycleMultiple: 4.9,
    purgeFrac: 0.02,
    reformerDutyMW: 90,
    refrigerationDutyMW: 30,
    syngasComprPowerMW: 20,
    circulatorPowerKW: 500,
    specificEnergyGJt: 28,
    airFlow: 1560,
    secondaryExitC: 980,
    coSlipLTS: 0.002,
    oxidesAfterMeth: 5,
    ...over,
  });

  // no familyKpis → the generic triple with deltas
  const base = kpis({});
  const live = kpis({ productionTpd: 1120, productPurityMol: 0.996 });
  const cells = answerCells(live, base);
  check('generic path yields the triple', cells.length === 3);
  check('production delta is live − base', cells[0].delta === 100);
  check('purity delta is in points', Math.abs((cells[1].delta ?? 0) - 0.1) < 1e-9);
  check('null kpis → no cells (no fake numbers)', answerCells(null, base).length === 0);

  // familyKpis → the family's own headlines, raw rows only
  const fam = kpis({
    familyKpis: [
      { label: 'Declared product', value: 'S2 via S-40' },
      { label: 'Production', value: '646.2 t/d of S2', raw: 646.2 },
      { label: 'Purity', value: '99.10 mol %', raw: 0.991 },
      { label: 'S-atom recovery', value: '98.8 %', raw: 0.988 },
      { label: 'Plant size', value: '14 units · 22 streams' },
    ],
  });
  const famBase = kpis({
    familyKpis: [
      { label: 'Production', value: '600.0 t/d of S2', raw: 600.0 },
      { label: 'Purity', value: '99.00 mol %', raw: 0.99 },
      { label: 'S-atom recovery', value: '98.0 %', raw: 0.98 },
    ],
  });
  const fcells = answerCells(fam, famBase);
  check('family path uses the raw rows only', fcells.length === 3, `got ${fcells.length}`);
  check('family cells carry the family labels', fcells[0].label === 'Production');
  check('family delta matches the baseline raw', Math.abs((fcells[0].delta ?? 0) - 46.2) < 1e-9);
  check('cells are capped at four', answerCells(kpis({ familyKpis: [1, 2, 3, 4, 5, 6].map((i) => ({ label: `L${i}`, value: `v${i}`, raw: i })) }), null).length === 4);
}

// ---------------------------------------------------------------------------
console.log('\nD. LIVE LOOP (a moved lever re-solves — the plant answers)');
// ---------------------------------------------------------------------------
{
  const g = referenceGraph();
  const base = executeGraph(g);
  check('design point solves', base.ok && base.converged);

  const hotter = executeGraph(patchSpec(g, 'SRC_NG', 'flow', 1400));
  check('patched graph re-solves', hotter.ok);
  check(
    'more natural gas → more ammonia (the loop is honest)',
    hotter.kpis.productionTpd > base.kpis.productionTpd + 50,
    `${base.kpis.productionTpd.toFixed(1)} → ${hotter.kpis.productionTpd.toFixed(1)}`,
  );

  const reformer = executeGraph(patchSpec(g, 'R1', 'outletT', 880));
  check('hotter reformer re-solves', reformer.ok);
  check(
    'the reformer lever moves a real number',
    Math.abs(reformer.kpis.productionTpd - base.kpis.productionTpd) > 1 ||
      Math.abs(reformer.kpis.perPassConv - base.kpis.perPassConv) > 1e-4,
  );

  // every derived lever is inside registry bounds → every lever move solves
  const levers = deriveLevers(g);
  const allMoves = levers.map((l) => executeGraph(patchSpec(g, l.unitId, l.specKey, l.max)));
  check(
    'lever at max stays inside the engine (solves or degrades honestly)',
    allMoves.every((r) => r.ok),
  );
}

// ---------------------------------------------------------------------------
console.log('\nE. ANTI-DRIFT (Orion + parity wiring, pinned in source)');
// ---------------------------------------------------------------------------
{
  const src = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8');
  const prompts = src('lib', 'agent', 'prompts.ts');
  const cinema = src('components', 'learn', 'CinemaBar.tsx');
  const page = src('app', 'plant', 'p', '[id]', 'page.tsx');
  const refPanel = src('components', 'workspace', 'OperatePanel.tsx');
  const answer = src('components', 'workspace', 'AnswerStrip.tsx');

  // Orion — one guide, one voice spec, embedded in the docent prompt
  check('Orion voice spec is an exported block (agent-replicable)', /export const ORION_VOICE/.test(prompts));
  check('Orion is the shift supervisor', /Orion/.test(prompts) && /shift supervisor/.test(prompts));
  check('docentSystem embeds ORION_VOICE', /\$\{ORION_VOICE\}/.test(prompts));
  check('Orion never invents numbers', /never invent numbers/.test(prompts));
  check('Orion introduces himself once, in the first stop', /Introduce yourself by name once/.test(prompts));
  check('the caption bar carries the ORION nameplate (plate + Belt mark)', /<OrionPlate guide=\{firstStop\} \/>/.test(cinema));

  // parity — the saved plant has the same mode axis as the prebuilts
  check('saved plant page mounts PlantOperate', /<PlantOperate/.test(page));
  check('saved plant page has the Learn|Operate axis', /'learn' \| 'operate'/.test(page) && /aria-label="Project mode"/.test(page));
  check('saved plant page solves live (executeGraph wired)', /executeGraph/.test(page));
  check('saved plant page patches levers immutably', /patchSpec/.test(page));
  check('the canvas and inspector read the LIVE graph', /graph=\{opGraph \?\? rec\.graph\}/.test(page));

  // the reference plant keeps its pinned answer bar
  check('reference Operate panel still mounts the AnswerStrip', /<AnswerStrip/.test(refPanel));
  check('the answer strip is sticky (content scrolls under it)', /sticky top-0/.test(answer));
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
