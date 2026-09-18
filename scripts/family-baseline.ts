/**
 * Identity baseline — capture the ammonia plant's full solve output so the
 * family refactor and species appends can be proven non-destructive
 * (byte-identical numbers afterwards).
 *
 * Baseline v2 (species #3+#4 append + flashPT absent-species fix): the
 * maxRel convergence gate and K-updates now ignore ABSENT species — their PR
 * pseudo-fugacities settle on arbitrary schedules, which made the flash's
 * break-iteration depend on WHICH zero-flow species were in the array. The
 * fix is physics-correct; ammonia numbers moved once at the 1e-9-relative
 * convergence-tolerance level (e.g. production 795.6596441596 ->
 * 795.6596417281 t/d) and every literature-anchored physics window in
 * verify-families.ts still passes. This file is the byte-for-byte reference.
 *
 * Run: npx tsx scripts/family-baseline.ts
 */
import { referenceGraph } from '../src/lib/engine/reference';
import { executeGraph } from '../src/lib/engine/executor';
import { validateGraph } from '../src/lib/engine/validate';
import { writeFileSync } from 'fs';

const g = referenceGraph();
const issues = validateGraph(g);
if (issues.length > 0) {
  console.error('BASELINE GRAPH HAS ISSUES:', issues.map((i) => i.message));
  process.exit(1);
}
const r = executeGraph(g);
const out = {
  ok: r.ok,
  converged: r.converged,
  iterations: r.iterations,
  kpis: r.kpis,
  balance: r.balance,
  warnings: r.warnings,
  h2n2Err: r.h2n2Err,
  streams: Object.fromEntries(
    Object.entries(r.streams).map(([id, s]) => [id, { T: s.T, P: s.P, n: s.n, cls: s.cls }]),
  ),
  units: Object.fromEntries(
    Object.entries(r.units).map(([id, u]) => [id, { metrics: u.metrics, warnings: u.warnings }]),
  ),
};
writeFileSync('scripts/baselines/ammonia-baseline.json', JSON.stringify(out, null, 2));
console.log('baseline captured:');
console.log(`  converged=${r.converged} iters=${r.iterations} worstBalance=${r.balance.reduce((w, b) => Math.max(w, b.relErr), 0).toExponential(2)}`);
console.log(`  production=${r.kpis.productionTpd.toFixed(3)} t/d purity=${(r.kpis.productPurityWt * 100).toFixed(2)} wt%`);
console.log('  → scripts/baselines/ammonia-baseline.json');
