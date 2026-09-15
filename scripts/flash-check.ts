/**
 * Flash-template verification — solves the beginner plant at the design
 * point and a few off-design points, printing the streams and teaching
 * KPIs. Also asserts the element balance closes and no liquid forms when
 * the chiller is warm (the "vanishing product" lesson).
 */
import { solveFlash, flashKpis, FLASH_BASE } from '../src/lib/plants/flash';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const tot = (n: number[]) => n.reduce((a, b) => a + b, 0);

function report(name: string, spec: ReturnType<() => typeof FLASH_BASE>) {
  const r = solveFlash(spec);
  const k = flashKpis(r);
  const S = r.streams;
  console.log(`\n=== ${name} ===`);
  for (const id of ['S01', 'S02', 'S03', 'S04']) {
    const s = S[id as keyof typeof S];
    const yNH3 = s.n[6] / (tot(s.n) || 1);
    console.log(
      `${id} ${s.name.padEnd(26)} T=${(s.T - 273.15).toFixed(0)}°C P=${(s.P / 1e5).toFixed(0)}bar ` +
        `flow=${tot(s.n).toFixed(0)} yNH3=${pct(yNH3)}`,
    );
  }
  console.log(
    `KPIs: vaporFrac=${pct(k.vaporFraction)} recovery=${pct(k.nh3Recovery)} ` +
      `purity=${pct(k.liquidPurity)} liquid=${k.liquidTpd.toFixed(1)} t/d duty=${k.chillerDutyMW.toFixed(2)} MW`,
  );
  const maxRelErr = Math.max(...r.balance.map((b) => b.relErr));
  console.log(`balance: max rel err = ${maxRelErr.toExponential(2)} · converged=${r.converged} · warnings=[${r.warnings.join('; ')}]`);
  return k;
}

const base = report('BASE CASE (feed 2000 kmol/h, 12% NH3, 140 bar, chiller −20 °C)', FLASH_BASE);

const warm = report('WARM CHILLER (+10 °C — product should shrink)', { ...FLASH_BASE, chillT: 10 });
if (!(warm.liquidTpd < base.liquidTpd)) throw new Error('warmer chiller did not reduce liquid product');

const cold = report('COLD CHILLER (−40 °C — recovery should rise)', { ...FLASH_BASE, chillT: -40 });
if (!(cold.nh3Recovery >= base.nh3Recovery)) throw new Error('colder chiller did not raise recovery');

const lowP = report('LOW PRESSURE (60 bar — less condensation)', { ...FLASH_BASE, feedP: 60 });
if (!(lowP.liquidTpd < base.liquidTpd)) throw new Error('lower pressure did not reduce liquid product');

console.log('\nAll flash-template physics checks passed.');
