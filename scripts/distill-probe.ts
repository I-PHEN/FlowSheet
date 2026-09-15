/**
 * Distillation-template physics probe — base case + lever sweeps, printed
 * for inspection. Full assertions live in distill-check.ts once numbers are
 * confirmed sane.
 */
import {
  DISTILL_BASE,
  distillGraph,
  distillModel,
  solveDistillation,
  distillKpis,
} from '../src/lib/plants/distillation';

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const tot = (n: number[]) => n.reduce((a, b) => a + b, 0);

function probe(name: string, spec: typeof DISTILL_BASE) {
  const r = solveDistillation(spec);
  const model = distillModel(spec);
  const k = distillKpis(r, model);
  const S = r.streams;
  console.log(`\n=== ${name} ===`);
  for (const id of ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S09']) {
    const s = S[id];
    if (!s) continue;
    const zB = (s.n[9] ?? 0) / (tot(s.n) || 1);
    console.log(
      `${id} ${s.name.padEnd(20)} T=${(s.T - 273.15).toFixed(1)}°C P=${(s.P / 1e5).toFixed(2)}bar flow=${tot(s.n).toFixed(1)} zBz=${pct(zB)}`,
    );
  }
  console.log(
    `col : xD=${pct(model.xD)} xB=${pct(model.xB)} D=${model.D.toFixed(1)} B=${model.B.toFixed(1)} ` +
      `q=${model.q.toFixed(3)} alpha=${model.alpha.toFixed(2)} Rmin=${model.Rmin.toFixed(3)} Nmin=${model.Nmin.toFixed(1)} ` +
      `boilup=${model.Vbar.toFixed(1)} feedOpt=${model.feedStageOptimal} pinched=${model.pinched} starved=${model.starved}`,
  );
  console.log(
    `duty: Qc=${(model.QcKJh / 3.6e6).toFixed(2)} MW  Qr=${(model.QrKJh / 3.6e6).toFixed(2)} MW  ` +
      `recovery=${pct(k.benzeneRecovery)} dist=${k.distillateTpd.toFixed(1)} t/d`,
  );
  const maxRelErr = Math.max(...r.balance.map((b) => b.relErr));
  console.log(`balance: max rel err = ${maxRelErr.toExponential(2)} · warnings=[${r.warnings.join(' | ')}]`);
  return { r, model, k };
}

const base = probe('BASE (500 kmol/h, z=0.45, N=14, nf=8, R=2.5, xD=0.97)', DISTILL_BASE);

probe('HIGH REFLUX (R=4)', { ...DISTILL_BASE, reflux: 4 });
probe('LOW REFLUX (R=1.5 — near Rmin)', { ...DISTILL_BASE, reflux: 1.5 });
probe('PINCHED (R=1.0)', { ...DISTILL_BASE, reflux: 1.0 });
probe('MORE STAGES (N=22)', { ...DISTILL_BASE, stages: 22 });
probe('FEWER STAGES (N=8)', { ...DISTILL_BASE, stages: 8 });
probe('COLD FEED (heater 40 °C — subcooled)', { ...DISTILL_BASE, heaterT: 40 });
probe('VAPOR FEED (heater 150 °C)', { ...DISTILL_BASE, heaterT: 150 });
probe('FEED TRAY HIGH (nf=3)', { ...DISTILL_BASE, feedStage: 3 });
probe('FEED TRAY LOW (nf=13)', { ...DISTILL_BASE, feedStage: 13 });
probe('LEANER FEED (z=0.3)', { ...DISTILL_BASE, zBenzene: 0.3 });
probe('HIGHER PURITY (xD=0.995)', { ...DISTILL_BASE, xD: 0.995 });
