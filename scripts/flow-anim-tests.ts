/**
 * FLOW ANIMATION GATE — pure laws of lib/flowsheet/flowAnim.ts.
 *
 * Run: bun scripts/flow-anim-tests.ts
 *
 * The particle layer animates the SOLVED state; these tests pin the
 * mapping from solver facts to motion so no future refactor silently
 * changes what the dots teach:
 *
 *   A. speed law — log-normalized, monotonic, liquid damping, bounds
 *   B. density law — coverage, cap, sparse near-dead streams, zero-flow silence
 *   C. global budget — 100-stream plants stay under the cap
 *   D. radius law — monotonic, bounded
 *   E. product tint — composition-driven, family-agnostic
 *   F. LUT sampling — endpoints, midpoints, clamping
 *   G. dot visibility — endpoint fades, pill masking
 *   H. phase stability — a re-render never reshuffles the dots
 */

import {
  FLOW_R,
  FLOW_SPEED,
  applyBudget,
  dotCount,
  dotOpacity,
  phaseFor,
  radiusFor,
  sampleLUT,
  speedFor,
  tintFor,
  totalFlow,
  type PathLUT,
} from '../src/lib/flowsheet/flowAnim';
import { C, STREAM_STYLE } from '../src/lib/design/tokens';
import { I } from '../src/lib/engine/species';

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

function near(actual: number, target: number, tol: number): boolean {
  return Math.abs(actual - target) <= tol;
}

// ---------------------------------------------------------------------------
console.log('\nA. SPEED LAW (log-normalized molar flow)');
// ---------------------------------------------------------------------------
{
  const max = 25000; // big loop gas, kmol/h
  check('zero flow → minimum speed', speedFor(0, max) === FLOW_SPEED.min);
  check('max flow → maximum speed', near(speedFor(max, max), FLOW_SPEED.max, 1e-9));
  check('monotonic in flow', speedFor(300, max) < speedFor(3000, max) && speedFor(3000, max) < speedFor(25000, max));
  check('bounded', speedFor(1e9, max) <= FLOW_SPEED.max + 1e-9 && speedFor(0, max) >= FLOW_SPEED.min - 1e-9);
  // decades apart, perceptually closer than linear
  const lo = speedFor(300, max);
  const lin = FLOW_SPEED.min + (300 / max) * (FLOW_SPEED.max - FLOW_SPEED.min);
  check('log scale lifts small flows above linear', lo > lin, `lo=${lo.toFixed(1)} lin=${lin.toFixed(1)}`);
  check('liquid moves at half speed', near(speedFor(5000, max, true), speedFor(5000, max) * 0.5, 1e-9));
  check('degenerate max=0 → minimum, no NaN', speedFor(100, 0) === FLOW_SPEED.min);
}

// ---------------------------------------------------------------------------
console.log('\nB. DENSITY LAW (coverage + importance)');
// ---------------------------------------------------------------------------
{
  const max = 25000;
  check('zero flow → silent', dotCount(400, 0, max) === 0);
  check('negative flow → silent', dotCount(400, -5, max) === 0);
  check('tiny path → silent', dotCount(10, 1000, max) === 0);
  check('short line → 1-2 dots', dotCount(80, 1000, max) >= 1 && dotCount(80, 1000, max) <= 2);
  check('medium line → ≤ 5', dotCount(600, 1000, max) <= 5 && dotCount(600, 1000, max) >= 3);
  check('very long line → capped at 5', dotCount(5000, 20000, max) === 5);
  check('near-dead stream (<2% of max) runs sparse', dotCount(600, 300, max) < dotCount(600, 20000, max), `sparse=${dotCount(600, 300, max)} full=${dotCount(600, 20000, max)}`);
  check('healthy stream full coverage', dotCount(600, 20000, max) >= 4, `got ${dotCount(600, 20000, max)}`);
}

// ---------------------------------------------------------------------------
console.log('\nC. GLOBAL BUDGET (100-stream plant)');
// ---------------------------------------------------------------------------
{
  const counts = Array.from({ length: 100 }, () => 5);
  const out = applyBudget(counts);
  const total = out.reduce((a, b) => a + b, 0);
  check('over-budget scales down', total <= 260, `total=${total}`);
  check('every stream keeps ≥ 1 dot', out.every((n) => n >= 1));
  check('under-budget untouched', applyBudget([2, 3]).join() === '2,3');
  check('empty input safe', applyBudget([]).length === 0);
}

// ---------------------------------------------------------------------------
console.log('\nD. RADIUS LAW');
// ---------------------------------------------------------------------------
{
  const max = 25000;
  check('zero flow → min radius', radiusFor(0, max) === FLOW_R.min);
  check('max flow → max radius', near(radiusFor(max, max), FLOW_R.max, 1e-9));
  check('monotonic', radiusFor(1000, max) < radiusFor(10000, max));
  check('sqrt growth: 1% of max ≈ 10% of the radius span', near(radiusFor(250, max), FLOW_R.min + 0.1 * (FLOW_R.max - FLOW_R.min), 0.05));
  check('degenerate max=0 → min, no NaN', radiusFor(100, 0) === FLOW_R.min);
}

// ---------------------------------------------------------------------------
console.log('\nE. PRODUCT TINT (composition-driven, family-agnostic)');
// ---------------------------------------------------------------------------
{
  // ammonia loop: effluent ~13 mol% NH3 → tinted; lean recycle gas → not
  const n = new Array(15).fill(0);
  n[I.H2] = 4000; n[I.N2] = 1300; n[I.NH3] = 800; // 800/6100 ≈ 13.1%
  check('NH3-rich stream takes the product hue', tintFor(n, 'NH3') === C.nh3);
  n[I.NH3] = 300; // 300/5600 ≈ 5.4% — below threshold
  check('lean stream keeps its class color', tintFor(n, 'NH3') === null);
  // Claus: sulphur-bearing gas goes gold
  const s = new Array(15).fill(0);
  s[I.H2S] = 600; s[I.SO2] = 300; s[I.S2] = 150; // 150/1050 ≈ 14.3%
  check('sulphur-bearing gas goes gold', tintFor(s, 'S2') === C.sulfur);
  s[I.S2] = 40; // 40/940 ≈ 4.3%
  check('lean Claus gas stays steel', tintFor(s, 'S2') === null);
  // guard rails
  check('no declared product → never tints', tintFor(n, undefined) === null);
  check('unknown product species → never tints', tintFor(n, 'Au') === null);
  check('empty stream → never tints', tintFor(new Array(15).fill(0), 'NH3') === null);
  check('undefined composition → never tints', tintFor(undefined, 'NH3') === null);
  // dotColor = tint ?? class color
  const rich = new Array(15).fill(0);
  rich[I.NH3] = 1000; // 100%
  check('dotColor prefers the product tint', dotColorForTest(rich, 'syngas', 'NH3') === C.nh3);
  check('dotColor falls back to the class color', dotColorForTest(new Array(15).fill(0), 'co2') === STREAM_STYLE.co2.color);
  // totalFlow helper
  check('totalFlow sums species', totalFlow([1, 2, 3]) === 6 && totalFlow(undefined) === 0);
}

function dotColorForTest(n: number[] | undefined, cls: string, productSpecies?: string) {
  return tintFor(n, productSpecies) ?? (STREAM_STYLE[cls] ?? STREAM_STYLE.syngas).color;
}

// ---------------------------------------------------------------------------
console.log('\nF. LUT SAMPLING (arc-length tables)');
// ---------------------------------------------------------------------------
{
  const lut: PathLUT = {
    xs: Float64Array.from([0, 50, 100]),
    ys: Float64Array.from([0, 0, 0]),
    n: 3,
    len: 100,
  };
  const a = sampleLUT(lut, 0);
  const b = sampleLUT(lut, 1);
  const mid = sampleLUT(lut, 0.5);
  check('endpoints exact', a.x === 0 && b.x === 100 && a.y === 0 && b.y === 0);
  check('midpoint interpolated', near(mid.x, 50, 1e-9), `x=${mid.x}`);
  check('t clamped below', sampleLUT(lut, -0.5).x === 0);
  check('t clamped above', sampleLUT(lut, 1.7).x === 100);
  check('quarter point', near(sampleLUT(lut, 0.25).x, 25, 1e-9));
}

// ---------------------------------------------------------------------------
console.log('\nG. DOT VISIBILITY (fades + pill masking)');
// ---------------------------------------------------------------------------
{
  check('born invisible at t=0', dotOpacity(0, 500) === 0);
  check('gone at t=1', dotOpacity(1, 500) === 0);
  check('fully visible mid-path', dotOpacity(0.5, 500) === 1);
  check('fade window is 6% of the run', dotOpacity(0.06, 500) === 1 && dotOpacity(0.05, 500) < 1);
  // pill at 0.5 on a 1000-unit line: ±20 units = ±0.02
  check('masked under the pill', dotOpacity(0.5, 1000, 0.5) === 0);
  check('ramps back outside the window', dotOpacity(0.56, 1000, 0.5) === 1);
  check('half-masked at the window edge', dotOpacity(0.51, 1000, 0.5) > 0 && dotOpacity(0.51, 1000, 0.5) < 1);
  check('no pillAt → no mask', dotOpacity(0.5, 1000) === 1);
  check('degenerate len=0 safe', dotOpacity(0.5, 0, 0.5) === 1);
}

// ---------------------------------------------------------------------------
console.log('\nH. PHASE STABILITY (deterministic offsets)');
// ---------------------------------------------------------------------------
{
  const a = phaseFor('S23', 0, 3);
  const b = phaseFor('S23', 0, 3);
  check('same id → same phase', a === b);
  const all = [0, 1, 2].map((i) => phaseFor('S23', i, 3));
  const distinct = new Set(all);
  check('dots on one stream spread out', distinct.size === 3, `phases=${all.map((v) => v.toFixed(2)).join(',')}`);
  check('phases stay in [0,1)', all.every((v) => v >= 0 && v < 1));
  const other = phaseFor('S24', 0, 3);
  check('different streams decorrelated', new Set([...all, other]).size === 4);
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
