/**
 * Generates a library record (SavedPlant JSON) holding the FULL reference
 * plant graph + KPIs, so the builder canvas can be screenshot-verified
 * without waiting for a live LLM build.
 *
 * Output: /home/z/my-project/scripts/ref-plant-record.json
 */
import { baseCase, run } from '../src/lib/engine';
import { buildGraph } from '../src/lib/engine/reference';
import { writeFileSync } from 'fs';

const g = buildGraph(baseCase());
const r = run(baseCase());

const rec = {
  slug: 'ref-plant-verify',
  name: 'Reference plant (verification)',
  brief: 'Build the standard ammonia plant at the reference operating point.',
  savedAt: new Date().toISOString(),
  graph: g,
  kpis: r.kpis,
  verdict: {
    verdict: 'pass',
    score: 95,
    summary: 'Canonical route, converged, on target — verification record.',
    strengths: ['complete front end', 'healthy loop'],
    issues: [],
    suggestions: [],
  },
  productionTpd: r.kpis.productionTpd,
};

writeFileSync('/home/z/my-project/scripts/ref-plant-record.json', JSON.stringify([rec]));
console.log(`ok: ${g.units.length} units, ${g.streams.length} streams, ${r.kpis.productionTpd.toFixed(1)} t/d`);
