/**
 * Distillation-template verification — solves rung 2 at the design point
 * and off-design points, asserting the teaching physics:
 *   - base case: spec met, recovery sane, element balance closed
 *   - reflux ↑ → xB ↓ (but duties ↑)
 *   - stages ↑ → xB ↓ with diminishing returns
 *   - R below Rmin → honest pinch (no fake solution)
 *   - wrong feed tray → warning + worse xB
 *   - cold feed → reboiler pays more; hot flashing feed → Rmin rises
 *   - volatility α lands in the textbook window for benzene–toluene
 */
import {
  DISTILL_BASE,
  distillModel,
  distillKpis,
  solveDistillation,
  type DistillSpec,
} from '../src/lib/plants/distillation';

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const tot = (n: number[]) => n.reduce((a, b) => a + b, 0);

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

function full(spec: DistillSpec) {
  const r = solveDistillation(spec);
  const model = distillModel(spec);
  return { r, model, k: distillKpis(r, model) };
}

console.log('\nA. BASE CASE (500 kmol/h, z=0.45, N=14, nf=8, R=2.5, xD=0.97)');
const base = full(DISTILL_BASE);
{
  const { r, model, k } = base;
  for (const id of ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09']) {
    const s = r.streams[id];
    check(`stream ${id} present`, !!s);
  }
  check('virtual units present (COND/RDRUM/REB)', !!(r.units.COND && r.units.RDRUM && r.units.REB));
  check(`distillate hits the 97% spec (${pct(k.xD)})`, Math.abs(k.xD - 0.97) < 1e-6);
  check(`bottoms lean: xB in [1%, 8%] (${pct(k.xB)})`, k.xB > 0.01 && k.xB < 0.08);
  check(`recovery in [90%, 99%] (${pct(k.benzeneRecovery)})`, k.benzeneRecovery > 0.9 && k.benzeneRecovery < 0.99);
  check(`α in textbook window [2.1, 2.6] (${model.alpha.toFixed(2)})`, model.alpha > 2.1 && model.alpha < 2.6);
  check(`Rmin in [1.2, 2.0] (${model.Rmin.toFixed(2)})`, model.Rmin > 1.2 && model.Rmin < 2.0);
  check(`feed tray 8 is optimal at base (got ${model.feedStageOptimal})`, model.feedStageOptimal === 8);
  check(`q near saturated liquid (${model.q.toFixed(2)})`, model.q > 0.8 && model.q <= 1.05);
  check(`top cooler than bottom (${(model.Ttop - 273.15).toFixed(0)} < ${(model.Tbot - 273.15).toFixed(0)} °C)`, model.Ttop < model.Tbot);
  const dTot = tot(r.streams.S03.n);
  const bTot = tot(r.streams.S04.n);
  check(`overall balance D + B = F (${dTot.toFixed(1)} + ${bTot.toFixed(1)})`, Math.abs(dTot + bTot - 500) < 1e-6);
  const maxRelErr = Math.max(...r.balance.map((b) => b.relErr));
  check(`element balance closes (${maxRelErr.toExponential(1)})`, maxRelErr < 1e-9);
  check('no warnings at design point', r.warnings.length === 0, `[${r.warnings.join(' | ')}]`);
  check(`condenser ≈ reboiler duty (${k.condenserMW.toFixed(2)} / ${k.reboilerMW.toFixed(2)} MW)`, Math.abs(k.condenserMW - k.reboilerMW) < 1);
  console.log(
    `  [base] xB=${pct(k.xB)} recovery=${pct(k.benzeneRecovery)} D=${model.D.toFixed(1)} B=${model.B.toFixed(1)} ` +
      `Rmin=${model.Rmin.toFixed(2)} Nmin=${model.Nmin.toFixed(1)} Qc=${k.condenserMW.toFixed(2)} Qr=${k.reboilerMW.toFixed(2)} MW`,
  );
}

console.log('\nB. LEVER PHYSICS');
{
  const hiR = full({ ...DISTILL_BASE, reflux: 4 });
  check(`higher reflux leans xB (${pct(hiR.k.xB)} < ${pct(base.k.xB)})`, hiR.k.xB < base.k.xB);
  check(`higher reflux costs duty (${hiR.k.reboilerMW.toFixed(1)} > ${base.k.reboilerMW.toFixed(1)} MW)`, hiR.k.reboilerMW > base.k.reboilerMW);

  const moreN = full({ ...DISTILL_BASE, stages: 22 });
  check(`more stages lean xB (${pct(moreN.k.xB)})`, moreN.k.xB < base.k.xB);
  const fewerN = full({ ...DISTILL_BASE, stages: 8 });
  check(`fewer stages fatten xB (${pct(fewerN.k.xB)})`, fewerN.k.xB > base.k.xB);

  const pinch = full({ ...DISTILL_BASE, reflux: 1.0 });
  check('R < Rmin flags pinched', pinch.model.pinched);
  check('pinched column refuses to fake a split (xB = zF)', Math.abs(pinch.model.xB - 0.45) < 1e-6);
  check('pinch warning names Rmin', pinch.r.warnings.some((w) => w.includes('pinched') && w.includes('Rmin')));
  check('pinched internal flows stay non-negative', pinch.model.Vbar >= 0 && pinch.model.Lbar >= 0);

  const offTray = full({ ...DISTILL_BASE, feedStage: 13 });
  check('wrong feed tray warns', offTray.r.warnings.some((w) => w.includes('optimal')));
  check(`wrong feed tray degrades xB (${pct(offTray.k.xB)} > ${pct(base.k.xB)})`, offTray.k.xB > base.k.xB);

  const cold = full({ ...DISTILL_BASE, heaterT: 40 });
  check(`cold feed: q > 1 (${cold.model.q.toFixed(2)})`, cold.model.q > 1);
  check(`cold feed: reboiler pays more (${cold.k.reboilerMW.toFixed(1)} > ${base.k.reboilerMW.toFixed(1)} MW)`, cold.k.reboilerMW > base.k.reboilerMW);

  const hot = full({ ...DISTILL_BASE, heaterT: 150, reflux: 4 });
  check(`vapor feed: q < 1 (${hot.model.q.toFixed(2)})`, hot.model.q < 1);
  check(`vapor feed raises Rmin (${hot.model.Rmin.toFixed(2)} > ${base.model.Rmin.toFixed(2)})`, hot.model.Rmin > base.model.Rmin);
  check(`vapor feed unburdens the reboiler (${hot.k.reboilerMW.toFixed(1)} < ${cold.k.reboilerMW.toFixed(1)} MW)`, hot.k.reboilerMW < cold.k.reboilerMW);
  check(`vapor feed with R=4 still separates (xB=${pct(hot.k.xB)})`, hot.k.xB < 0.08);

  const lean = full({ ...DISTILL_BASE, zBenzene: 0.3 });
  check(`leaner feed raises Rmin (${lean.model.Rmin.toFixed(2)} > ${base.model.Rmin.toFixed(2)})`, lean.model.Rmin > base.model.Rmin);

  const pure = full({ ...DISTILL_BASE, xD: 0.995, stages: 26, reflux: 3.5 });
  check(`99.5% spec achievable with stages+reflux (xB=${pct(pure.k.xB)})`, pure.k.xB < 0.06);
  check('99.5% closes the benzene balance (all light overhead)', Math.abs(pure.model.D - (500 * 0.45) / 0.995) < 0.5);

  const tooHigh = full({ ...DISTILL_BASE, feedStage: 3 });
  check('feed tray far too high → starved with the right diagnosis', tooHigh.r.warnings.some((w) => w.includes('too high')));
}

console.log('\nC. STREAM SHEET INTEGRITY');
{
  const { r, model } = base;
  const vap = r.streams.S05;
  const ref = r.streams.S06;
  const boil = r.streams.S09;
  check(`overhead vapor V = (R+1)D (${tot(vap.n).toFixed(1)})`, Math.abs(tot(vap.n) - (DISTILL_BASE.reflux + 1) * model.D) < 0.5);
  check(`reflux L = R·D (${tot(ref.n).toFixed(1)})`, Math.abs(tot(ref.n) - DISTILL_BASE.reflux * model.D) < 0.5);
  check(`boilup in eq with bottoms (yB=${pct(model.yB)})`, Math.abs(boil.n[9] / tot(boil.n) - model.yB) < 1e-9);
  const maxRelErr = Math.max(...r.balance.map((b) => b.relErr));
  check(`element balance still closes with virtual streams (${maxRelErr.toExponential(1)})`, maxRelErr < 1e-9);
}

console.log('\nD. DETERMINISM');
{
  const a = full(DISTILL_BASE);
  const b = full(DISTILL_BASE);
  check('same spec → same xB to 1e-12', Math.abs(a.model.xB - b.model.xB) < 1e-12);
  check('same spec → same duties to 1e-6', Math.abs(a.model.QrKJh - b.model.QrKJh) < 1e-6);
}

console.log('\n══════════════════════════════════════');
console.log(`DISTILLATION GATE: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('ALL GREEN — rung 2 is sound.');
