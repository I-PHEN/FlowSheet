/**
 * PHASE 1 GATE — engine validation suite.
 *
 * Run: bun scripts/engine-tests.ts
 *
 * Sections:
 *   A. Correlation anchors (numerically verified during research)
 *   B. PR-EOS / flash sanity
 *   C. Base case: convergence, element balance, KPI envelopes vs EFMA/literature
 *   D. Physical monotonicity probes
 *   E. Determinism
 *   F. Robustness fuzz (random specs within physical ranges)
 */

import {
  baseCase,
  run,
  eqNH3Fraction,
  kSR1,
  kWGS,
  flashPT,
  total,
  massFlow,
  prFugacity,
} from '../src/lib/engine';

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
console.log('\nA. CORRELATION ANCHORS (research-verified values)');
// ---------------------------------------------------------------------------

// Gillespie–Beattie equilibrium NH3 % for stoichiometric feed
const gbAnchors: Array<[number, number, number]> = [
  // T(°C), P(atm), expected NH3 % — Larson-Dodge/Vancini classic tables
  [350, 100, 37.3],
  [350, 200, 50.9],
  [400, 100, 25.2],
  [400, 150, 32.4],
  [400, 200, 38.2],
  [450, 100, 16.3],
  [450, 150, 22.3],
  [450, 200, 27.4],
  [500, 150, 15.0],
  [500, 300, 26.4],
];
for (const [tC, pAtm, expected] of gbAnchors) {
  const got = eqNH3Fraction(tC + 273.15, pAtm) * 100;
  check(
    `G-B eq NH3 @ ${tC}°C/${pAtm}atm → ${expected}%`,
    near(got, expected, 0.6),
    `(got ${got.toFixed(2)})`,
  );
}

// K_WGS anchors
check(
  'K_WGS @ 400°C = 12.2',
  near(kWGS(673.15), 12.2, 0.4),
  `(got ${kWGS(673.15).toFixed(2)})`,
);
check(
  'K_WGS @ 220°C = 133',
  near(kWGS(493.15), 133, 6),
  `(got ${kWGS(493.15).toFixed(1)})`,
);

// K_SR1 sanity: at 1000 K O(10), at 1273 K O(10^3) (consistent with ΔG via Cp-corrected thermo)
check(
  'K_SR1 @ 1000K in [8, 60]',
  kSR1(1000) > 8 && kSR1(1000) < 60,
  `(got ${kSR1(1000).toFixed(2)})`,
);
check(
  'K_SR1 @ 1273K in [2e3, 2e4]',
  kSR1(1273) > 2e3 && kSR1(1273) < 2e4,
  `(got ${kSR1(1273).toFixed(0)})`,
);

// ---------------------------------------------------------------------------
console.log('\nB. PR-EOS / FLASH SANITY');
// ---------------------------------------------------------------------------

// Pure NH3 saturation pressure at −20 °C ≈ 1.9 bar (literature).
// Pure-species saturation: bisect P where lnφ_liq = lnφ_vap (both PR roots).
{
  const T = 253.15;
  const y = new Array(9).fill(0);
  y[6] = 1;
  const dln = (P: number) => {
    const fv = prFugacity(y, T, P, 'vapor');
    const fl = prFugacity(y, T, P, 'liquid');
    return fl.lnPhi[6] - fv.lnPhi[6]; // <0 → liquid favored → P above Psat
  };
  let lo = 0.2e5; // dln > 0 (vapor favored, below Psat)
  let hi = 10e5; // dln < 0 (liquid favored, above Psat)
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (dln(mid) > 0) lo = mid;
    else hi = mid;
  }
  const psat = 0.5 * (lo + hi) / 1e5;
  check(
    'PR NH3 Psat(−20°C) ≈ 1.9 bar [1.2, 2.8]',
    psat > 1.2 && psat < 2.8,
    `(got ${psat.toFixed(2)})`,
  );
}

// Loop-gas flash at −20°C/145 bar: liquid mostly NH3, gas keeps NH3 single-digit %
{
  const n = [2610, 870, 0, 0, 522, 174, 696, 0, 0]; // H2 N2 . . CH4 AR NH3 . .
  const fl = flashPT(n, 253.15, 145e5);
  const liqTot = total(fl.liquid);
  const liqNH3 = fl.liquid[6] / Math.max(liqTot, 1e-9);
  const gasNH3 = fl.yv[6];
  check('loop flash: two-phase', fl.twoPhase);
  check(
    'loop flash: liquid > 96 mol% NH3',
    liqNH3 > 0.96,
    `(got ${(liqNH3 * 100).toFixed(2)}%)`,
  );
  check(
    'loop flash: gas NH3 in [1%, 10%]',
    gasNH3 > 0.01 && gasNH3 < 0.10,
    `(got ${(gasNH3 * 100).toFixed(2)}%)`,
  );
  // mass conservation
  const inTot = total(n);
  const outTot = total(fl.vapor) + total(fl.liquid);
  check('loop flash: mass conservation', Math.abs(inTot - outTot) / inTot < 1e-9);
}

// Knockout flash at 40°C/26 bar with 40% steam: water mostly condenses
{
  const n = [2800, 900, 260, 340, 40, 18, 0, 3600, 0];
  const fl = flashPT(n, 313.15, 26e5);
  check(
    'KO flash: > 85% of water condenses',
    fl.liquid[7] / 3600 > 0.85,
    `(got ${(fl.liquid[7] / 3600 * 100).toFixed(1)}%)`,
  );
}

// ---------------------------------------------------------------------------
console.log('\nC. BASE CASE — convergence, balance, KPI envelopes');
// ---------------------------------------------------------------------------

const base = run(baseCase());
console.log(
  `  [solve] converged=${base.converged} iters=${base.iterations} ${base.solveMs.toFixed(1)}ms  ` +
    `NH3=${base.kpis.productionTpd.toFixed(0)} t/d  H2/N2=${base.kpis.h2n2Ratio.toFixed(3)}  ` +
    `perPass=${(base.kpis.perPassConv * 100).toFixed(1)}%  inerts=${(base.kpis.loopInerts * 100).toFixed(1)}%  ` +
    `purity=${(base.kpis.productPurityWt * 100).toFixed(2)}wt%  ` +
    `R1duty=${base.kpis.reformerDutyMW.toFixed(0)}MW  refrig=${base.kpis.refrigerationDutyMW.toFixed(1)}MW  ` +
    `specEnergy=${base.kpis.specificEnergyGJt.toFixed(1)} GJ/t  air=${base.kpis.airFlow.toFixed(0)} kmol/h`,
);

check('base: converged', base.converged);
check("base: < 35 loop iterations", base.iterations < 35, `(${base.iterations})`);
check("base: solve < 250 ms", base.solveMs < 250, `(${base.solveMs.toFixed(0)}ms)`);

// element balance
for (const b of base.balance) {
  check(
    `base: ${b.element} balance closes < 1e-6`,
    b.relErr < 1e-6,
    `(in ${b.in.toFixed(1)} out ${b.out.toFixed(1)} relErr ${b.relErr.toExponential(2)})`,
  );
}

// KPI envelopes (EFMA / Flórez-Orrego / Rice — research Q6)
const k = base.kpis;
check('KPI: production 700–1500 t/d', k.productionTpd > 700 && k.productionTpd < 1500, `(${k.productionTpd.toFixed(0)})`);
check('KPI: product purity > 98.5 wt%', k.productPurityWt > 0.985, `(${(k.productPurityWt * 100).toFixed(2)})`);
check('KPI: per-pass conversion 14–32%', k.perPassConv > 0.14 && k.perPassConv < 0.32, `(${(k.perPassConv * 100).toFixed(1)})`);
check('KPI: overall N2 conversion > 88%', k.overallConv > 0.88, `(${(k.overallConv * 100).toFixed(1)})`);
check('KPI: loop inerts 5–16%', k.loopInerts > 0.05 && k.loopInerts < 0.16, `(${(k.loopInerts * 100).toFixed(1)})`);
check('KPI: H2/N2 at converter 2.6–3.1', k.h2n2Ratio > 2.6 && k.h2n2Ratio < 3.1, `(${k.h2n2Ratio.toFixed(2)})`);
check('KPI: makeup H2/N2 controller |err| < 0.01', Math.abs(base.h2n2Err ?? 0) < 0.01, `(${(base.h2n2Err ?? 0).toFixed(4)})`);
check('KPI: recycle multiple 1.8–6.5', k.recycleMultiple > 1.8 && k.recycleMultiple < 6.5, `(${k.recycleMultiple.toFixed(2)})`);
check('KPI: secondary exit 900–1050°C', k.secondaryExitC > 900 && k.secondaryExitC < 1050, `(${k.secondaryExitC.toFixed(0)})`);
check('KPI: LTS CO slip 0.1–0.6% dry', k.coSlipLTS > 0.001 && k.coSlipLTS < 0.006, `(${(k.coSlipLTS * 100).toFixed(2)})`);
check('KPI: oxides after methanator < 10 ppm', k.oxidesAfterMeth < 10, `(${k.oxidesAfterMeth.toFixed(1)})`);
check('KPI: syngas compression 5–12 MW', k.syngasComprPowerMW > 5 && k.syngasComprPowerMW < 12, `(${k.syngasComprPowerMW.toFixed(1)})`);
check('KPI: specific energy 24–36 GJ/t', k.specificEnergyGJt > 24 && k.specificEnergyGJt < 36, `(${k.specificEnergyGJt.toFixed(1)})`);
check('KPI: converter NH3 out 12–20%', (() => {
  const s21 = base.streams.S21;
  return s21.n[6] / total(s21.n) > 0.12 && s21.n[6] / total(s21.n) < 0.20;
})(), `(${((base.streams.S21.n[6] / total(base.streams.S21.n)) * 100).toFixed(1)})`);
check('KPI: converter inlet NH3 1–4%', (() => {
  const s20 = base.streams.S20;
  return s20.n[6] / total(s20.n) > 0.01 && s20.n[6] / total(s20.n) < 0.04;
})(), `(${((base.streams.S20.n[6] / total(base.streams.S20.n)) * 100).toFixed(1)})`);

// Front-end spot checks vs literature ranges
const s04 = base.streams.S04; // primary effluent
{
  const dry = total(s04.n) - s04.n[7];
  const ch4 = s04.n[4] / dry;
  check('R1: CH4 slip 4–12% dry', ch4 > 0.04 && ch4 < 0.12, `(${(ch4 * 100).toFixed(2)})`);
}
const s06 = base.streams.S06; // secondary effluent
{
  const dry = total(s06.n) - s06.n[7];
  const ch4 = s06.n[4] / dry;
  const co = s06.n[2] / dry;
  check('R2: CH4 slip 0.1–1% dry', ch4 > 0.001 && ch4 < 0.01, `(${(ch4 * 100).toFixed(2)})`);
  check('R2: CO 10–15% dry', co > 0.10 && co < 0.15, `(${(co * 100).toFixed(1)})`);
}
const s08 = base.streams.S08; // HTS out
{
  const dry = total(s08.n) - s08.n[7];
  check('HTS: CO 2–4.5% dry', s08.n[2] / dry > 0.02 && s08.n[2] / dry < 0.045, `(${((s08.n[2] / dry) * 100).toFixed(2)})`);
}
const s13 = base.streams.S13; // CO2-lean gas
{
  const dry = total(s13.n) - s13.n[7];
  check('A1: residual CO2 100–600 ppmvd', s13.n[3] / dry > 100e-6 && s13.n[3] / dry < 600e-6, `(${((s13.n[3] / dry) * 1e6).toFixed(0)})`);
}

// Print the stream table for eyeball verification
console.log('\n  STREAM TABLE (base case) — kmol/h');
const spOrder = ['H2', 'N2', 'CO', 'CO2', 'CH4', 'AR', 'NH3', 'H2O', 'O2'] as const;
const header = 'stream    '.padEnd(10) + 'T°C  '.padStart(6) + 'Pbar '.padStart(6) + spOrder.map((s) => s.padStart(7)).join('');
console.log('  ' + header);
for (const sid of Object.keys(base.streams)) {
  const s = base.streams[sid];
  const row =
    sid.padEnd(10) +
    (s.T - 273.15).toFixed(0).padStart(6) +
    (s.P / 1e5).toFixed(1).padStart(6) +
    spOrder.map((_, i) => (s.n[i] > 0.05 ? s.n[i].toFixed(1).padStart(7) : '.'.padStart(7))).join('');
  console.log('  ' + row);
}

// ---------------------------------------------------------------------------
console.log('\nD. PHYSICAL MONOTONICITY PROBES');
// ---------------------------------------------------------------------------

// higher loop pressure → higher per-pass conversion (Le Chatelier)
{
  const a = run({ ...baseCase(), loopP: 100 });
  const b = run({ ...baseCase(), loopP: 200 });
  check('P↑ → per-pass conversion ↑', b.kpis.perPassConv > a.kpis.perPassConv, `(${(a.kpis.perPassConv * 100).toFixed(1)} → ${(b.kpis.perPassConv * 100).toFixed(1)})`);
}
// higher bed-1 inlet T (equilibrium-limited region) → LOWER outlet NH3 per pass
{
  const a = run({ ...baseCase(), bed1T: 380 });
  const b = run({ ...baseCase(), bed1T: 470 });
  const nh3Out = (r: typeof base) => r.streams.S21.n[6] / total(r.streams.S21.n);
  check('bed T↑ → converter outlet NH3 ↓ (exothermic)', nh3Out(b) < nh3Out(a), `(${(nh3Out(a) * 100).toFixed(1)} → ${(nh3Out(b) * 100).toFixed(1)})`);
}
// lower bed approach → lower outlet NH3
{
  const a = run({ ...baseCase(), bedApproach: [0.9, 0.9, 0.9] });
  const b = run({ ...baseCase(), bedApproach: [0.6, 0.6, 0.6] });
  const nh3Out = (r: typeof base) => r.streams.S21.n[6] / total(r.streams.S21.n);
  check('approach↓ → outlet NH3 ↓', nh3Out(b) < nh3Out(a), `(${(nh3Out(b) * 100).toFixed(1)} < ${(nh3Out(a) * 100).toFixed(1)})`);
}
// colder chiller → higher NH3 recovery, higher purity path
{
  const a = run({ ...baseCase(), chillT: -5 });
  const b = run({ ...baseCase(), chillT: -33 });
  check('chiller T↓ → production ↑', b.kpis.productionTpd > a.kpis.productionTpd, `(${a.kpis.productionTpd.toFixed(0)} → ${b.kpis.productionTpd.toFixed(0)})`);
}
// higher purge → lower inerts, lower production (more H2 lost)
{
  const a = run({ ...baseCase(), purgeFrac: 0.03 });
  const b = run({ ...baseCase(), purgeFrac: 0.15 });
  check('purge↑ → loop inerts ↓', b.kpis.loopInerts < a.kpis.loopInerts, `(${(a.kpis.loopInerts * 100).toFixed(1)} → ${(b.kpis.loopInerts * 100).toFixed(1)})`);
  check('purge↑ → production ↓', b.kpis.productionTpd < a.kpis.productionTpd, `(${a.kpis.productionTpd.toFixed(0)} → ${b.kpis.productionTpd.toFixed(0)})`);
}
// higher S/C → lower primary CH4 slip
{
  const a = run({ ...baseCase(), steamCarbon: 2.2 });
  const b = run({ ...baseCase(), steamCarbon: 4.2 });
  const slip = (r: typeof base) => r.streams.S04.n[4] / (total(r.streams.S04.n) - r.streams.S04.n[7]);
  check('S/C↑ → primary CH4 slip ↓', slip(b) < slip(a), `(${(slip(a) * 100).toFixed(1)} → ${(slip(b) * 100).toFixed(1)})`);
}
// more air (manual) → lower make-up H2/N2
{
  const a = run({ ...baseCase(), airAuto: false, airFlow: 1300 });
  const b = run({ ...baseCase(), airAuto: false, airFlow: 1800 });
  const r = (x: typeof base) => x.streams.S16.n[0] / x.streams.S16.n[1];
  check('air↑ → make-up H2/N2 ↓', r(b) < r(a), `(${r(a).toFixed(3)} → ${r(b).toFixed(3)})`);
}

// ---------------------------------------------------------------------------
console.log('\nE. DETERMINISM');
// ---------------------------------------------------------------------------

{
  const a = run(baseCase());
  const b = run(baseCase());
  let same = true;
  for (const sid of Object.keys(a.streams)) {
    for (let i = 0; i < 9; i++) {
      if (a.streams[sid].n[i] !== b.streams[sid].n[i]) same = false;
    }
  }
  check('two runs bitwise identical', same);
}

// ---------------------------------------------------------------------------
console.log('\nF. ROBUSTNESS FUZZ — 60 random specs within physical ranges');
// ---------------------------------------------------------------------------

{
  let solved = 0;
  let convergedCount = 0;
  let balanceOk = 0;
  let nanFound = false;
  let threw = 0;
  let rngState = 20260830;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) % 4294967296;
    return rngState / 4294967296;
  };
  const U = (lo: number, hi: number) => lo + rng() * (hi - lo);
  for (let trial = 0; trial < 60; trial++) {
    const spec = {
      ngFeed: U(200, 2500),
      steamCarbon: U(2.2, 4.5),
      frontEndP: U(22, 40),
      primaryT: U(740, 870),
      primaryATE: U(0, 30),
      airAuto: rng() > 0.3,
      airFlow: U(300, 5000),
      h2n2Set: U(2.6, 3.3),
      secondaryATE: U(5, 60),
      htsInletT: U(310, 390),
      htsATE: U(5, 45),
      ltsInletT: U(190, 235),
      ltsATE: U(5, 55),
      co2Residual: U(50, 1500),
      co2h2Slip: U(0, 0.008),
      methInletT: U(260, 350),
      loopP: U(90, 230),
      bed1T: U(360, 445),
      bed2T: U(390, 465),
      bed3T: U(385, 455),
      bedApproach: [U(0.55, 0.98), U(0.55, 0.98), U(0.55, 0.98)] as [number, number, number],
      chillT: U(-38, 25),
      purgeFrac: U(0.015, 0.22),
      comprStages: 3,
      etaP: U(0.65, 0.82),
      dpConverter: U(1, 6),
      dpCondenser: U(1, 5),
    };
    try {
      const r = run(spec);
      solved++;
      if (r.converged) convergedCount++;
      const balOk = r.balance.every((b) => b.relErr < 1e-6);
      if (balOk) balanceOk++;
      for (const sid of Object.keys(r.streams)) {
        for (let i = 0; i < 9; i++) {
          if (!Number.isFinite(r.streams[sid].n[i])) nanFound = true;
        }
      }
      for (const key of Object.keys(r.kpis) as Array<keyof typeof r.kpis>) {
        if (!Number.isFinite(r.kpis[key])) nanFound = true;
      }
    } catch (e) {
      threw++;
      console.log(`    throw @ trial ${trial}: ${(e as Error).message}`);
    }
  }
  console.log(`    solved ${solved}/60, converged ${convergedCount}, balance ok ${balanceOk}`);
  check('fuzz: no exceptions', threw === 0, `(${threw} threw)`);
  check('fuzz: no NaN/Infinity anywhere', !nanFound);
  check('fuzz: every converged run closes element balance', balanceOk === convergedCount, `(${balanceOk}/${convergedCount})`);
  check('fuzz: ≥ 90% converge', convergedCount >= 0.9 * solved, `(${convergedCount}/${solved})`);
}

// ---------------------------------------------------------------------------
console.log(`\n════════════════════════════════════════`);
console.log(`PHASE 1 GATE: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
} else {
  console.log('ALL GREEN — engine core is sound.');
}
