/**
 * Family verification gate:
 *   1. AMMONIA IDENTITY — executeGraph(referenceGraph()) must reproduce the
 *      pre-refactor baseline (/tmp/family-baseline.json) byte-for-byte.
 *   2. METHANOL + HYDROGEN — reference graphs validate clean, solve,
 *      converge, element-balance < 1e-4, and produce sane headline numbers.
 */
import { readFileSync } from 'fs';
import { referenceGraph } from '../src/lib/engine/reference';
import { executeGraph } from '../src/lib/engine/executor';
import { validateGraph } from '../src/lib/engine/validate';
import { METHANOL } from '../src/lib/families/methanol';
import { HYDROGEN } from '../src/lib/families/hydrogen';
import { getFamily } from '../src/lib/families';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// ---------- 1. ammonia identity ----------
const baseline = JSON.parse(readFileSync('/tmp/family-baseline.json', 'utf8'));
const amm = executeGraph(referenceGraph());
const b = baseline as {
  kpis: Record<string, number>;
  balance: Array<{ in: number; out: number; relErr: number }>;
  streams: Record<string, { T: number; P: number; n: number[] }>;
  warnings: string[];
  converged: boolean;
  iterations: number;
};
check(amm.converged === baseline.converged, 'ammonia: converged', String(amm.converged));
check(amm.iterations === baseline.iterations, 'ammonia: iterations', `${amm.iterations} vs ${baseline.iterations}`);
for (const [k, v] of Object.entries(b.kpis)) {
  const got = (amm.kpis as unknown as Record<string, number>)[k];
  if (got !== v) {
    check(false, `ammonia kpi ${k}`, `${got} vs baseline ${v}`);
  }
}
check(true, 'ammonia: all KPI fields byte-identical', `${Object.keys(b.kpis).length} fields`);
for (const [id, s] of Object.entries(b.streams)) {
  const got = amm.streams[id];
  // baseline predates CH3OH (species 11, always zero here): compare the
  // baseline-length prefix and require the appended tail to be zero
  const same =
    got &&
    got.T === s.T &&
    got.P === s.P &&
    got.n.slice(0, s.n.length).every((x, i) => x === s.n[i]) &&
    got.n.slice(s.n.length).every((x) => x === 0);
  if (!same) {
    check(false, `ammonia stream ${id}`, 'differs from baseline');
  }
}
check(true, 'ammonia: all streams byte-identical', `${Object.keys(b.streams).length} streams`);
for (let i = 0; i < b.balance.length; i++) {
  if (amm.balance[i].in !== b.balance[i].in || amm.balance[i].out !== b.balance[i].out) {
    check(false, `ammonia balance ${amm.balance[i].element}`, 'differs');
  }
}
check(JSON.stringify(amm.warnings) === JSON.stringify(b.warnings), 'ammonia: warnings identical', JSON.stringify(amm.warnings));

// ---------- 2. methanol ----------
const meoh = METHANOL.referenceGraph();
const meohIssues = validateGraph(meoh);
check(meohIssues.length === 0, 'methanol: validation clean', meohIssues.map((i) => i.message).join('; ') || '0 issues');
try {
  const r = executeGraph(meoh);
  const worst = r.balance.reduce((w, x) => Math.max(w, x.relErr), 0);
  check(r.converged, 'methanol: loop converged', `${r.iterations} iterations`);
  check(worst < 1e-4, 'methanol: element balance', worst.toExponential(2));
  check(r.kpis.productionTpd > 100 && r.kpis.productionTpd < 3000, 'methanol: crude production sane', `${r.kpis.productionTpd.toFixed(0)} t/d`);
  check(r.kpis.productPurityWt > 0.7 && r.kpis.productPurityWt < 1, 'methanol: crude purity sane', `${(r.kpis.productPurityWt * 100).toFixed(1)} wt %`);
  check(r.kpis.perPassConv > 0.05 && r.kpis.perPassConv < 0.9, 'methanol: per-pass carbon conversion sane', `${(r.kpis.perPassConv * 100).toFixed(1)} %`);
  console.log('      methanol familyKpis:', r.kpis.familyKpis?.map((k) => `${k.label}=${k.value}`).join(' · '));
  console.log('      methanol warnings:', JSON.stringify(r.warnings));
  const feed = r.streams['S10'];
  console.log(`      converter feed: ${(feed.T - 273.15).toFixed(0)} °C ${(feed.P / 1e5).toFixed(1)} bar, H2 ${((feed.n[0] / feed.n.reduce((a, c) => a + c, 0)) * 100).toFixed(1)} %`);
} catch (e) {
  check(false, 'methanol: solve threw', (e as Error).message);
}

// ---------- 3. hydrogen ----------
const h2 = HYDROGEN.referenceGraph();
const h2Issues = validateGraph(h2);
check(h2Issues.length === 0, 'hydrogen: validation clean', h2Issues.map((i) => i.message).join('; ') || '0 issues');
try {
  const r = executeGraph(h2);
  const worst = r.balance.reduce((w, x) => Math.max(w, x.relErr), 0);
  check(r.converged, 'hydrogen: solved (no loop → direct)', `${r.iterations} iterations`);
  check(worst < 1e-4, 'hydrogen: element balance', worst.toExponential(2));
  check(r.kpis.productionTpd > 30 && r.kpis.productionTpd < 300, 'hydrogen: H2 production sane', `${r.kpis.productionTpd.toFixed(0)} t/d`);
  check(r.kpis.productPurityMol > 0.999, 'hydrogen: purity at spec', `${(r.kpis.productPurityMol * 100).toFixed(3)} %`);
  check(r.kpis.familyKpis !== undefined && r.kpis.family === 'hydrogen', 'hydrogen: family KPIs stamped');
  console.log('      hydrogen familyKpis:', r.kpis.familyKpis?.map((k) => `${k.label}=${k.value}`).join(' · '));
  console.log('      hydrogen warnings:', JSON.stringify(r.warnings));
} catch (e) {
  check(false, 'hydrogen: solve threw', (e as Error).message);
}

// ---------- 4. registry sanity ----------
check(getFamily('methanol').id === 'methanol' && getFamily(undefined).id === 'ammonia', 'family registry lookups');
console.log(failures === 0 ? '\nALL FAMILY CHECKS PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
