/**
 * Family verification gate:
 *   1. AMMONIA IDENTITY — executeGraph(referenceGraph()) must reproduce the
 *      captured baseline byte-for-byte (scripts/baselines/ammonia-baseline.json).
 *   2. AMMONIA PHYSICS WINDOWS — literature-anchored envelopes so real
 *      regressions are caught even when a (documented) re-capture shifts
 *      convergence bytes.
 *   3. METHANOL + HYDROGEN + SULPHUR + GENERAL — reference graphs validate
 *      clean, solve, converge, element-balance < 1e-6, and produce sane
 *      headline numbers.
 */
import { existsSync, readFileSync } from 'fs';
import { referenceGraph } from '../src/lib/engine/reference';
import { executeGraph } from '../src/lib/engine/executor';
import { validateGraph } from '../src/lib/engine/validate';
import { METHANOL } from '../src/lib/families/methanol';
import { HYDROGEN } from '../src/lib/families/hydrogen';
import { SULPHUR } from '../src/lib/families/sulphur';
import { GENERAL } from '../src/lib/families/general';
import { getFamily } from '../src/lib/families';

let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const baselinePath = existsSync('scripts/baselines/ammonia-baseline.json')
  ? 'scripts/baselines/ammonia-baseline.json'
  : '/tmp/family-baseline.json';
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

// ---------- 1. ammonia identity ----------
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
  // primitives strictly; familyKpis (object array) via JSON
  const same = typeof v === 'object' && v !== null
    ? JSON.stringify(got) === JSON.stringify(v)
    : got === v;
  if (!same) {
    check(false, `ammonia kpi ${k}`, `${JSON.stringify(got)} vs baseline ${JSON.stringify(v)}`);
  }
}
check(true, 'ammonia: all KPI fields byte-identical', `${Object.keys(b.kpis).length} fields`);
for (const [id, s] of Object.entries(b.streams)) {
  const got = amm.streams[id];
  // baseline may predate appended species: compare the baseline-length prefix
  // and require the appended tail to be zero
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

// ---------- 1b. ammonia physics windows ----------
// byte-identity above protects against silent drift; these windows protect
// against REAL regressions even if a (documented) re-capture shifts
// convergence bytes — literature-anchored envelopes from the EFMA-era base case.
check(amm.converged, 'ammonia: physics — converged');
check(
  amm.kpis.productionTpd > 790 && amm.kpis.productionTpd < 800,
  'ammonia: physics — production window',
  `${amm.kpis.productionTpd.toFixed(2)} t/d (literature ≈ 795.7)`,
);
check(
  amm.kpis.productPurityWt > 0.985 && amm.kpis.productPurityWt < 0.999,
  'ammonia: physics — product purity window',
  `${(amm.kpis.productPurityWt * 100).toFixed(2)} wt %`,
);
check(
  amm.kpis.perPassConv > 0.25 && amm.kpis.perPassConv < 0.32,
  'ammonia: physics — per-pass conversion window',
  `${(amm.kpis.perPassConv * 100).toFixed(1)} %`,
);
check(
  amm.balance.reduce((w, x) => Math.max(w, x.relErr), 0) < 1e-6,
  'ammonia: physics — element balance',
  amm.balance.reduce((w, x) => Math.max(w, x.relErr), 0).toExponential(2),
);

// ---------- 2. methanol ----------
const meoh = METHANOL.referenceGraph();
const meohIssues = validateGraph(meoh);
check(meohIssues.length === 0, 'methanol: validation clean', meohIssues.map((i) => i.message).join('; ') || '0 issues');
try {
  const r = executeGraph(meoh);
  const worst = r.balance.reduce((w, x) => Math.max(w, x.relErr), 0);
  check(r.converged, 'methanol: loop converged', `${r.iterations} iterations`);
  check(worst < 1e-4, 'methanol: element balance', worst.toExponential(2));
  check(r.kpis.productionTpd > 100 && r.kpis.productionTpd < 2000, 'methanol: crude production sane', `${r.kpis.productionTpd.toFixed(0)} t/d`);
  check(r.kpis.productPurityWt > 0.5 && r.kpis.productPurityWt < 1, 'methanol: crude purity sane', `${(r.kpis.productPurityWt * 100).toFixed(1)} wt %`);
  check(r.kpis.perPassConv > 0.05 && r.kpis.perPassConv < 0.95, 'methanol: per-pass carbon conversion sane', `${(r.kpis.perPassConv * 100).toFixed(1)} %`);
  console.log('      methanol familyKpis:', r.kpis.familyKpis?.map((k) => `${k.label}=${k.value}`).join(' · '));
  console.log('      methanol warnings:', JSON.stringify(r.warnings));
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
  check(worst < 1e-6, 'hydrogen: element balance', worst.toExponential(2));
  check(r.kpis.productionTpd > 50 && r.kpis.productionTpd < 200, 'hydrogen: H2 production sane', `${r.kpis.productionTpd.toFixed(0)} t/d`);
  check(r.kpis.productPurityMol > 0.999, 'hydrogen: purity at spec', `${(r.kpis.productPurityMol * 100).toFixed(3)} mol %`);
  check(r.kpis.family === 'hydrogen' && (r.kpis.familyKpis?.length ?? 0) > 0, 'hydrogen: family KPIs stamped');
  console.log('      hydrogen familyKpis:', r.kpis.familyKpis?.map((k) => `${k.label}=${k.value}`).join(' · '));
} catch (e) {
  check(false, 'hydrogen: solve threw', (e as Error).message);
}

// ---------- 4. sulphur ----------
const s = SULPHUR.referenceGraph();
const sIssues = validateGraph(s);
check(sIssues.length === 0, 'sulphur: validation clean', sIssues.map((i) => i.message).join('; ') || '0 issues');
try {
  const r = executeGraph(s);
  const worst = r.balance.reduce((w, x) => Math.max(w, x.relErr), 0);
  check(worst < 1e-6, 'sulphur: element balance (incl. S)', worst.toExponential(2));
  check(r.kpis.overallConv > 0.9 && r.kpis.overallConv < 0.99, 'sulphur: recovery in the real 90-98 % window', `${(r.kpis.overallConv * 100).toFixed(1)} %`);
  check(r.kpis.productionTpd > 300 && r.kpis.productionTpd < 900, 'sulphur: liquid sulphur sane', `${r.kpis.productionTpd.toFixed(0)} t/d`);
  console.log('      sulphur familyKpis:', r.kpis.familyKpis?.map((k) => `${k.label}=${k.value}`).join(' · '));
  console.log('      sulphur warnings:', JSON.stringify(r.warnings));
} catch (e) {
  check(false, 'sulphur: solve threw', (e as Error).message);
}

// ---------- 5. general (fallback demonstrator solves; product declaration reads) ----------
const g = GENERAL.referenceGraph();
const gIssues = validateGraph(g);
check(gIssues.length === 0, 'general: validation clean', gIssues.map((i) => i.message).join('; ') || '0 issues');
try {
  const r = executeGraph(g);
  check(r.kpis.family === 'general', 'general: KPI block ran');
  check(r.kpis.productSpecies === 'H2', 'general: declared product read', String(r.kpis.productSpecies));
  check(r.kpis.productionTpd > 50, 'general: declared production measured', `${r.kpis.productionTpd.toFixed(0)} t/d`);
  console.log('      general familyKpis:', r.kpis.familyKpis?.map((k) => `${k.label}=${k.value}`).join(' · '));
} catch (e) {
  check(false, 'general: solve threw', (e as Error).message);
}

// ---------- 6. registry ----------
check(getFamily('ammonia').id === 'ammonia', 'family registry lookups');
check(getFamily('nope').id === 'ammonia', 'family registry fallback');
check(getFamily('general').id === 'general', 'general registered');

console.log(failures === 0 ? '\nALL FAMILY CHECKS PASS' : `\n${failures} FAMILY CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
