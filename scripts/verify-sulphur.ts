/**
 * Sulphur family verification gate — the Claus chemistry must be honest:
 *   1. reference graph validates clean
 *   2. once-through solve, element balance < 1e-6 (no loop, so no convergence
 *      story — but the S-atom balance is the real gate)
 *   3. thermal stage: ⅓ of the H2S burned, flame 950-1400 °C, 35-65 % of S as S2
 *   4. total recovery 90-98 % (the real-plant window for rich feed)
 *   5. tail-gas H2S slip < 1 mol %, H2S:SO2 ratio in 1.5-2.5 (the heartbeat)
 *   6. stage split: three liquid-sulphur products, thermal > catalytic-1 > catalytic-2
 *   7. Kp sanity: thermal Kp rises with T (endothermic S2), catalytic falls (exothermic S8)
 */
import { executeGraph } from '../src/lib/engine/executor';
import { validateGraph } from '../src/lib/engine/validate';
import { SULPHUR } from '../src/lib/families/sulphur';
import { kpClausThermal, kpClausCat, burnH2S, solveClausEq } from '../src/lib/engine/reactions';
import { total } from '../src/lib/engine/thermo';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// ---------- Kp sanity ----------
check(kpClausThermal(1300) > kpClausThermal(1000), 'Kp thermal rises with T', `Kp(1000)=${kpClausThermal(1000).toFixed(2)}, Kp(1300)=${kpClausThermal(1300).toFixed(2)}`);
check(kpClausCat(500) > kpClausCat(600), 'Kp catalytic falls with T', `Kp(500)=${kpClausCat(500).toExponential(1)}, Kp(600)=${kpClausCat(600).toExponential(1)}`);

// ---------- burner chemistry in isolation ----------
{
  // 1000 kmol/h acid gas at 85 % H2S; air sized for exactly ⅓
  const h2s = 850;
  const o2 = (h2s / 3) * 1.5;
  const n = new Array(15).fill(0);
  n[12] = h2s;
  n[8] = o2;
  const burned = burnH2S(n);
  check(
    Math.abs(burned.h2sBurned - h2s / 3) < 1e-9 && burned.o2Left < 1e-9,
    'burner: O2-limiting burns exactly ⅓',
    `${burned.h2sBurned.toFixed(1)} of ${h2s} burned, O2 left ${burned.o2Left.toFixed(3)}`,
  );
  // equilibrium on the burned gas at 1250 K, 1.3 bar — H2S:SO2 should stay 2:1
  const eq = solveClausEq(burned.n, 1250, 1.3e5, kpClausThermal(1250));
  const h2sAfter = burned.n[12] - 4 * eq.xi;
  const so2After = burned.n[13] - 2 * eq.xi;
  check(eq.frac > 0.3 && eq.frac < 0.9, 'thermal equilibrium converts a plausible fraction', `frac=${(eq.frac * 100).toFixed(1)} %`);
  check(
    Math.abs(h2sAfter - 2 * so2After) / (2 * so2After) < 1e-6,
    'thermal equilibrium preserves the 2:1 H2S:SO2 signature',
    `H2S:SO2 = ${(h2sAfter / so2After).toFixed(3)}`,
  );
}

// ---------- reference graph ----------
const g = SULPHUR.referenceGraph();
const issues = validateGraph(g);
check(issues.length === 0, 'sulphur: validation clean', issues.map((i) => i.message).join('; ') || '0 issues');

const r = executeGraph(g);
const worst = r.balance.reduce((w, x) => Math.max(w, x.relErr), 0);
check(r.converged, 'sulphur: solved (once-through)', `${r.iterations} iterations`);
check(worst < 1e-6, 'sulphur: element balance (incl. S)', worst.toExponential(2));

const k = r.kpis;
console.log('      familyKpis:', k.familyKpis?.map((x) => `${x.label}=${x.value}`).join(' · '));
console.log('      warnings:', JSON.stringify(r.warnings));

check(k.family === 'sulphur', 'sulphur: KPI block ran', k.family);
check(k.productionTpd > 300 && k.productionTpd < 900, 'sulphur: liquid sulphur sane (reference feed ≈ 646 t/d)', `${k.productionTpd.toFixed(0)} t/d`);
check(k.overallConv > 0.9 && k.overallConv < 0.99, 'sulphur: recovery in the real 90-98 % window', `${(k.overallConv * 100).toFixed(1)} %`);

// tail gas
const tail = r.streams['S11'];
const tailTot = total(tail.n);
const h2sSlip = (tail.n[12] / tailTot) * 100;
const so2Slip = (tail.n[13] / tailTot) * 100;
const ratio = tail.n[12] / Math.max(tail.n[13], 1e-9);
check(h2sSlip < 1, 'sulphur: tail-gas H2S slip < 1 mol %', `${h2sSlip.toFixed(2)} %`);
check(ratio > 1.5 && ratio < 2.5, 'sulphur: tail-gas H2S:SO2 near 2:1', `${ratio.toFixed(2)}`);
check(so2Slip < 1.2, 'sulphur: tail-gas SO2 slip sane', `${so2Slip.toFixed(2)} %`);

// stage split — thermal condenser carries the most, third the least
const s1 = r.streams['S06'].n[14];
const s2 = r.streams['S09'].n[14];
const s3 = r.streams['S12'].n[14];
check(s1 > s2 && s2 > s3 && s3 > 0, 'sulphur: stage split thermal > cat1 > cat2', `${s1.toFixed(1)} / ${s2.toFixed(1)} / ${s3.toFixed(1)} kmol/h S2`);

// burner metrics
const burner = r.units['B1'];
check(burner !== undefined, 'sulphur: burner result present');
if (burner) {
  const flameC = burner.metrics[0].raw as number;
  const thermalFrac = burner.metrics[3].raw as number;
  check(flameC > 950 && flameC < 1400, 'sulphur: flame temperature sane', `${flameC.toFixed(0)} °C`);
  check(thermalFrac > 0.35 && thermalFrac < 0.65, 'sulphur: thermal stage share 35-65 %', `${(thermalFrac * 100).toFixed(1)} %`);
}

// warnings — the reference plant should be warning-free
check(r.warnings.length === 0, 'sulphur: reference plant warning-free', JSON.stringify(r.warnings));

console.log(failures === 0 ? '\nALL SULPHUR CHECKS PASS' : `\n${failures} SULPHUR CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
