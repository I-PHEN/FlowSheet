/**
 * The general family — free process design from the physics basics.
 *
 * Every other family is a ROUTE (a canonical teaching topology the engineer
 * is asked to follow). This one is the opposite: no route at all. The agent
 * receives the BASICS — the species that exist, the chemistry the engine
 * knows how to equilibrate, the separation physics available — and composes
 * whatever plant the brief describes from the full unit catalog: hybrids,
 * subsets, capture plants, plants no family describes.
 *
 * The product is DECLARED, not assumed: the engineer calls declare_product
 * (stream + species), and the generic KPI reader computes production, purity
 * and recovery against everything fed in from the environment. The critic
 * judges against the BRIEF and the PHYSICS (converged? balanced? produces
 * the declared product at meaningful scale?) — never against a textbook
 * route, because there isn't one.
 *
 * referenceGraph() is a fallback demonstrator only (the simplest complete
 * plant) — general builds are authored by the agent, never stamped from a
 * template.
 */

import type { FlowGraph, StreamEdge, StreamState } from '@/lib/engine/graph';
import { hydrogenReferenceGraph } from './hydrogen';
import type { Kpis } from '@/lib/engine/types';
import { SPECIES, SP } from '@/lib/engine/species';
import type { Moles } from '@/lib/engine/species';
import { total, massFlow } from '@/lib/engine/thermo';
import { zeroN } from '@/lib/engine/units';
import { getUnitType } from '@/lib/engine/registry';
import type { KpiCtx, PlantFamily } from './types';

export const STAGES = [
  { n: 1 as const, label: 'MAKE IT', blurb: 'feeds and reactors — chemistry that turns what you have into what you want' },
  { n: 2 as const, label: 'CLEAN IT', blurb: 'separations — knockouts, scrubs, adsorption, distillation; each one moves the equilibrium too' },
  { n: 3 as const, label: 'GET IT OUT', blurb: 'the product stream leaves to the environment; everything else is recycle, purge, or waste' },
];

export const PRESENTATION: Record<string, { tag: string; label: string; stage: 1 | 2 | 3; role: string }> = {};

export const PRIMER = `PROCESS DESIGN BASICS (there is NO canonical route here — you compose from first principles):

THE SPECIES THAT EXIST (the simulator can carry exactly these):
H2, N2, CO, CO2, CH4, AR, NH3, H2O, O2, C6H6 (benzene), C7H8 (toluene), CH3OH, H2S, SO2, S2 (sulphur vapour).
Anything outside this table cannot be made, removed, or measured — choose feeds and products from this list.

THE CHEMISTRY THE ENGINE KNOWS (reaction sets and where they run):
- Steam reforming: CH4 + H2O <-> CO + 3 H2 (primary-reformer, ~800 C, Ni)
- Water-gas shift: CO + H2O <-> CO2 + H2 (wgs-hts ~400 C Fe-Cr, wgs-lts ~220 C Cu-Zn; also equilibrates inside the reformer)
- Methanation: CO + 3 H2 <-> CH4 + H2O (methanator — the reverse of reforming; poisons nothing but consumes H2)
- Ammonia synthesis: N2 + 3 H2 <-> 2 NH3 (converter, 150 bar, promoted iron; per-pass ~15-25 %)
- Methanol synthesis: CO + 2 H2 <-> CH3OH and CO2 + 3 H2 <-> CH3OH + H2O (meoh-converter, ~80 bar, 225 C, Cu/ZnO/Al2O3)
- H2S combustion: H2S + 1.5 O2 -> SO2 + H2O (claus-burner; O2-limiting — burns exactly what the air provides)
- Claus reaction: 2 H2S + SO2 <-> 3 S + 2 H2O (claus-burner flame + claus-converter alumina beds)

THE SEPARATION PHYSICS AVAILABLE:
- PT flash (ko-drum, nh3-separator, meoh-separator): splits phases by Peng-Robinson equilibrium — condenses whatever is heavy enough at the T you set
- Absorption (co2-removal): takes CO2 out of gas to a residual spec
- Pressure-swing adsorption (psa): splits gas into a high-purity H2 product and a tailgas — works on ANY hydrogen-bearing gas
- Distillation (distillation-column): separates the benzene/toluene pair (teaching template)
- Condensation on spec (whb-cooler, intercooler, chiller, sulphur-condenser): cool to a T and (for sulphur) drop the condensable out
- Compression (syngas-compressor, loop-circulator) raises pressure; every reactor and scrubber has a pressure drop

DESIGN HEURISTICS THAT KEEP PLANTS SOLVABLE:
- Stoichiometry first: count atoms. If the brief wants NH3 you need N2 + 3 H2 somewhere upstream; if it wants CH3OH you need (CO + 2 H2) or (CO2 + 3 H2).
- Inerts accumulate in any recycle loop — a purge (purge-split) is how real plants shed them. Without a purge a loop with inerts has no steady state.
- ONE recycle loop maximum. The loop must contain the feed-preheater (spec-determined outlet) so the solver can tear it.
- Reaction then separation, or separation then reaction — reactors like clean feeds, separations like reacted mixtures. Order by temperature and pressure: do hot things first, compress once, chill at the end.
- Every source is a unit (ng-source, steam-source, air-source, acid-gas-source, syngas-feed, column-feed); every product/waste is a stream with "to": null.
- declare_product on the stream that carries the brief's product OUT of the plant — the KPI reader measures production, purity and recovery from that declaration.`;

export function conventionsBlock(speciesDigest: string, catalogDigestText: string): string {
  return `PLANT CONVENTIONS (general build — no route, no canonical ids):
- Species indexes: ${speciesDigest}.
- Stream classes: feed, syngas, loopgas, product, water, co2, purge.

STRUCTURAL RULES (the validator enforces these):
- Every inlet must be fed by exactly ONE stream. Every outlet must be connected (a stream with "to": null leaves the plant to the environment).
- At most ONE independent recycle loop; if you build one it MUST contain the feed-preheater, and a purge-split to shed inerts.
- Controllers (add_controller) manipulate a source's flow to hold a species ratio at a stream — use one only if the brief demands tight ratio control.

PRODUCT DECLARATION (REQUIRED before you declare done):
- declare_product {stream, species} — the stream carrying the brief's product out of the plant, and the product species name (e.g. "H2", "NH3", "CH3OH", "S2"). The KPI reader computes production, purity and recovery from it; without a declaration the plant scores zero on brief satisfaction.

UNIT CATALOG (in/out ports with phase: gas/liquid; specs with ranges and defaults):
${catalogDigestText}`;
}

const e = (
  id: string,
  name: string,
  cls: StreamEdge['cls'],
  from: { unit: string; port: string },
  to: { unit: string; port: string } | null,
  implicit = false,
): StreamEdge => ({ id, name, cls, from, to, implicit });

/** fallback demonstrator — the simplest complete plant; general builds are
 *  authored by the agent, never stamped from this */
export function generalReferenceGraph(): FlowGraph {
  const g = hydrogenReferenceGraph();
  return { ...g, family: 'general', product: { stream: 'S13', species: 'H2' } };
}

export const GENERAL: PlantFamily = {
  id: 'general',
  name: 'General',
  route: 'free process design from the physics basics',
  blurb: 'No recipe, no canonical route: the species, the chemistry, the separations — and your own flowsheet. Build the plant the brief describes, declare the product, and let the physics judge it.',
  productSpecies: '*',
  speciesOfInterest: [...SPECIES],
  hasLoop: true, // loops allowed — generic tear machinery handles them
  stages: STAGES,
  presentation: PRESENTATION,
  primer: PRIMER,
  conventions: conventionsBlock,
  presets: [
    {
      label: 'Hydrogen + methanator guard',
      text: 'Build a hydrogen plant that ends with a methanator guard bed for ultra-pure hydrogen (CO and CO2 down to ppm) before the PSA. Reformer, two-stage shift, CO2 removal, methanator, knockout, then PSA. Report purity and recovery.',
    },
    {
      label: 'Once-through ammonia',
      text: 'Build an ammonia plant WITHOUT the synthesis loop: reforming, secondary reforming with air, shift, CO2 removal, methanation, then a single-pass converter at 150 bar with condensation and separator — no recycle, no purge, no circulator. Report how much ammonia a single pass makes and why real plants loop.',
    },
    {
      label: 'CO2 capture plant',
      text: 'Build a carbon-capture plant for flue gas: an air-like feed rich in N2 with CO2 (use an acid-gas-source with low H2S is wrong — instead feed a syngas-feed or use co2-removal directly on a suitable source), amine absorption, and a clean gas out. Declare CO2 as the product on the offgas stream and report the capture rate.',
    },
    {
      label: 'Sulphur with a third bed',
      text: 'Build a Claus sulphur plant with THREE catalytic converters instead of two (beds at 320, 260, 240 °C, condensers between each). Report whether the third bed is worth it — sulphur recovery versus the two-bed plant.',
    },
  ],
  tourFocus: [],
  referenceGraph: generalReferenceGraph,
  makeupStreamIds: [],
  // generic loop-gas guess: 4.5× the make-up at its own composition — crude,
  // but damped-DS + Broyden refine it; families with loops provide better
  tearGuess: (makeup: Moles): Moles => makeup.map((v) => v * 4.5),
  computeKpis(ctx: KpiCtx) {
    const { states, graph } = ctx;
    const decl = graph.product;
    const kpis: Kpis = {
      productionTpd: 0,
      productPurityMol: 0,
      productPurityWt: 0,
      perPassConv: 0,
      overallConv: 0,
      loopInerts: 0,
      h2n2Ratio: 0,
      makeupFlow: 0,
      recycleMultiple: 0,
      purgeFrac: 0,
      reformerDutyMW: 0,
      refrigerationDutyMW: 0,
      syngasComprPowerMW: 0,
      circulatorPowerKW: 0,
      specificEnergyGJt: 0,
      airFlow: 0,
      secondaryExitC: 0,
      coSlipLTS: 0,
      oxidesAfterMeth: 0,
      family: 'general',
      productSpecies: decl?.species ?? '',
    };

    if (!decl) {
      return {
        kpis,
        warnings: ['no product declared — call declare_product {stream, species} on the product stream so the KPI reader can measure the plant'],
      };
    }
    const spIdx = SPECIES.indexOf(decl.species as (typeof SPECIES)[number]);
    if (spIdx < 0) {
      return {
        kpis,
        warnings: [`declared product "${decl.species}" is not a species the engine carries (${SPECIES.join(', ')})`],
      };
    }
    const prod: StreamState | undefined = states[decl.stream];
    if (!prod) {
      return {
        kpis,
        warnings: [`declared product stream "${decl.stream}" does not exist (or never solved) — declare the stream that carries the product out of the plant`],
      };
    }

    // production + purity from the declared stream
    const prodTot = total(prod.n);
    const prodMol = prod.n[spIdx];
    const prodTpd = (massFlow(prod.n) * 24) / 1000; // total stream mass
    const prodSpeciesTpd = (prodMol * SP[SPECIES[spIdx]].mw * 24) / 1000;
    const purityMol = prodTot > 0 ? prodMol / prodTot : 0;
    const purityWt = prodTot > 0 ? (prodMol * SP[SPECIES[spIdx]].mw) / Math.max(massFlow(prod.n), 1e-9) : 0;

    // recovery: product species OUT vs the same species fed in from every
    // source unit (units with no inlets). When the declared species is MADE
    // in-plant (H2 from CH4, S2 from H2S), species recovery is meaningless —
    // but for sulphur-bearing products we can do honest S-ATOM accounting:
    // S atoms out in the product stream vs S atoms fed in every form.
    let fedIn = 0;
    for (const u of graph.units) {
      const def = getUnitType(u.type);
      if (!def || def.ports.in.length > 0) continue;
      for (const s of graph.streams) {
        if (s.from.unit === u.id) {
          const st = states[s.id];
          if (st) fedIn += st.n[spIdx];
        }
      }
    }
    const recovery = fedIn > 1e-9 ? prodMol / fedIn : 0;

    // S-atom recovery (S2/SO2/H2S declared, H2S/SO2/S2 fed)
    const S_SPECIES = ['H2S', 'SO2', 'S2'];
    const sAtoms = (n: number[]): number => S_SPECIES.reduce((acc, name) => {
      const idx = SPECIES.indexOf(name as (typeof SPECIES)[number]);
      return acc + (idx >= 0 ? Math.max(n[idx], 0) * (name === 'S2' ? 2 : 1) : 0);
    }, 0);
    let sFed = 0;
    let sOut = 0;
    if (!S_SPECIES.includes(decl.species)) {
      // not an S plant — leave zero
    } else {
      sOut = sAtoms(prod.n);
      for (const u of graph.units) {
        const def = getUnitType(u.type);
        if (!def || def.ports.in.length > 0) continue;
        for (const s of graph.streams) {
          if (s.from.unit === u.id) {
            const st = states[s.id];
            if (st) sFed += sAtoms(st.n);
          }
        }
      }
    }
    const sRecovery = sFed > 1e-9 ? sOut / sFed : 0;
    const recoveryLabel = fedIn > 1e-9
      ? `Recovery of feed ${decl.species}`
      : S_SPECIES.includes(decl.species) && sFed > 1e-9
        ? 'S-atom recovery (vs all S fed)'
        : '';

    kpis.productionTpd = prodSpeciesTpd;
    kpis.productPurityMol = purityMol;
    kpis.productPurityWt = purityWt;
    kpis.overallConv = fedIn > 1e-9 ? recovery : sRecovery;
    kpis.perPassConv = kpis.overallConv; // best generic proxy
    kpis.makeupFlow = fedIn;
    void prodTpd;

    kpis.familyKpis = [
      { label: 'Declared product', value: `${decl.species} via stream ${decl.stream}` },
      { label: 'Production', value: `${prodSpeciesTpd.toFixed(1)} t/d of ${decl.species}`, raw: prodSpeciesTpd },
      { label: 'Purity', value: `${(purityMol * 100).toFixed(2)} mol % / ${(purityWt * 100).toFixed(2)} wt %`, raw: purityMol },
      ...(recoveryLabel
        ? [{ label: recoveryLabel, value: `${((fedIn > 1e-9 ? recovery : sRecovery) * 100).toFixed(1)} %`, raw: fedIn > 1e-9 ? recovery : sRecovery }]
        : []),
      { label: 'Plant size', value: `${graph.units.length} units · ${graph.streams.length} streams` },
    ];
    return { kpis, warnings: [] };
  },
};
