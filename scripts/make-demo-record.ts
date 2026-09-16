/**
 * Build a complete methanol PlantRecord (solved KPIs + docent-style tour) for
 * browser E2E injection — tests the project viewer + tour player without
 * burning LLM quota. Writes /tmp/meoh-record.json.
 */
import { writeFileSync } from 'fs';
import { METHANOL } from '../src/lib/families/methanol';
import { executeGraph } from '../src/lib/engine/executor';
import { validateGraph } from '../src/lib/engine/validate';

const graph = METHANOL.referenceGraph();
const issues = validateGraph(graph);
if (issues.length > 0) throw new Error(issues.map((i) => i.message).join('; '));
const r = executeGraph(graph);
const worst = r.balance.reduce((w, b) => Math.max(w, b.relErr), 0);
console.log(`solved: converged=${r.converged} iters=${r.iterations} worstBalance=${worst.toExponential(2)}`);
console.log(`crude: ${r.kpis.productionTpd.toFixed(0)} t/d at ${(r.kpis.productPurityWt * 100).toFixed(1)} wt %`);

const rec = {
  id: 'p3meohdemo',
  name: 'Methanol plant — SMR + Cu/ZnO loop',
  brief:
    'Build the standard methanol plant: natural gas + steam reforming at high temperature, waste-heat cooling, condensate knockout, make-up compression to about 80 bar, then a methanol synthesis loop with a three-bed converter, condensation, crude-methanol separator, a purge for the hydrogen excess, and a recycle circulator.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schemaVersion: 2,
  ownerId: 'e2e-demo',
  graph,
  kpis: r.kpis,
  verdict: {
    verdict: 'pass',
    score: 87,
    summary: `Solver-certified: converged in ${r.iterations} iterations, element balance closed to ${worst.toExponential(1)}, crude methanol ${r.kpis.productionTpd.toFixed(0)} t/d at ${(r.kpis.productPurityWt * 100).toFixed(1)} wt % on the canonical SMR + Cu/ZnO route.`,
    strengths: ['canonical methanol route, one loop, purge present', 'converged and element-balanced'],
    issues: [],
    suggestions: [],
  },
  productionTpd: r.kpis.productionTpd,
  source: 'user',
  family: 'methanol',
  tour: {
    id: 'docent-methanol-demo',
    chip: 'Walk my plant',
    title: 'The methanol plant, end to end',
    steps: [
      {
        ref: { type: 'unit', id: 'M1' },
        title: 'Two ingredients',
        text: `Every methanol plant starts with carbon and hydrogen in the wrong shape. Natural gas and steam meet here at a steam-to-carbon ratio near 2.5 — from this mixer to the converter, everything that happens is chemistry rearranging these two into methanol.`,
      },
      {
        ref: { type: 'unit', id: 'R1' },
        title: 'Splitting methane, hotter than ammonia',
        text: `The primary reformer cracks methane with steam over nickel catalyst at about 860 degrees Celsius — hotter than the ammonia plant, because here there is no secondary reformer to finish the job. Methane and water become carbon monoxide and hydrogen, and that carbon monoxide is not a poison anymore — it is a reactant.`,
      },
      {
        ref: { type: 'unit', id: 'C1' },
        title: 'Squeeze before you synthesize',
        text: `Methanol synthesis is a volume-shrinking reaction, so pressure is your friend. The make-up compressor raises the dried syngas to about 80 bar before it joins the loop. Watch the pressure climb as you follow the gas forward.`,
      },
      {
        ref: { type: 'unit', id: 'R6' },
        title: 'Where methanol is born',
        text: `The three-bed converter is the heart of the plant. Over copper catalyst at 225 to 245 degrees Celsius, carbon monoxide and carbon dioxide each combine with hydrogen to form methanol — about ${((r.kpis.perPassConv || 0.4) * 100).toFixed(0)} percent of the carbon converts on every pass, which is why the loop needs several passes to finish the job.`,
      },
      {
        ref: { type: 'unit', id: 'V3' },
        title: 'Catching the product',
        text: `The chilled separator splits the loop: crude methanol drops out as liquid — ${r.kpis.productionTpd.toFixed(0)} tonnes per day at ${(r.kpis.productPurityWt * 100).toFixed(0)} percent purity — while the unreacted gas stays in the loop. The liquid lets down to 2 bar and degasses on its way out.`,
      },
      {
        ref: { type: 'unit', id: 'SP1' },
        title: 'The hydrogen excess',
        text: `Pure steam-reforming gas is hydrogen-rich — the module ratio runs near 3 against the ideal 2 — so the purge split sends the excess hydrogen and inerts to fuel instead of letting them build up. This is the honest cost of making methanol from natural gas alone.`,
      },
      {
        ref: { type: 'stream', id: 'S13' },
        title: 'The product line',
        text: `Follow the crude methanol stream to the battery limit. ${r.kpis.productionTpd.toFixed(0)} tonnes per day, solver-certified, every number on this sheet was computed by the process engine — not drawn, not guessed. Click any unit to inspect it yourself.`,
      },
    ],
  },
};

writeFileSync('/tmp/meoh-record.json', JSON.stringify(rec));
console.log('record written: /tmp/meoh-record.json', `(${(JSON.stringify(rec).length / 1024).toFixed(0)} KB)`);
