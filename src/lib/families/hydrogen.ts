/**
 * The hydrogen family — SMR front end + shift + CO2 removal + PSA.
 *
 * The simplest teaching plant: a ONCE-THROUGH flowsheet with no recycle loop
 * at all. That absence is the lesson — students who met the ammonia and
 * methanol loops see that purification can replace recirculation: the PSA
 * splits the gas into a high-purity hydrogen product and a fuel tailgas, and
 * nothing comes back around.
 */

import type { FlowGraph, StreamEdge, StreamState } from '@/lib/engine/graph';
import type { Kpis, UnitResult } from '@/lib/engine/types';
import { LHV_CH4, SP } from '@/lib/engine/species';
import type { Moles } from '@/lib/engine/species';
import { total } from '@/lib/engine/thermo';
import { zeroN } from '@/lib/engine/units';
import type { KpiCtx, PlantFamily } from './types';
import { graphStreams } from './resolve';

const e = (
  id: string,
  name: string,
  cls: StreamEdge['cls'],
  from: { unit: string; port: string },
  to: { unit: string; port: string } | null,
  implicit = false,
): StreamEdge => ({ id, name, cls, from, to, implicit });

/**
 * Canonical teaching topology: 11 units, 14 streams, no loop, no controller.
 * Stream conventions: S01 = natural gas, S12 = PSA feed, S13 = H2 product,
 * S14 = tailgas.
 */
export function hydrogenReferenceGraph(): FlowGraph {
  return {
    family: 'hydrogen',
    units: [
      { id: 'SRC_NG', type: 'ng-source', specs: {} },
      { id: 'SRC_ST', type: 'steam-source', specs: {} },
      { id: 'M1', type: 'feed-mixer', specs: {} },
      { id: 'R1', type: 'primary-reformer', specs: {} },
      { id: 'E1', type: 'whb-cooler', specs: {} },
      { id: 'R3', type: 'wgs-hts', specs: {} },
      { id: 'E4', type: 'intercooler', specs: {} },
      { id: 'R4', type: 'wgs-lts', specs: {} },
      { id: 'V1', type: 'ko-drum-shift', specs: {} },
      { id: 'A1', type: 'co2-removal', specs: {} },
      { id: 'P1', type: 'psa', specs: {} },
    ],
    streams: [
      e('S01', 'Natural gas feed', 'feed', { unit: 'SRC_NG', port: 'out' }, { unit: 'M1', port: 'ng' }),
      e('S02', 'Process steam', 'feed', { unit: 'SRC_ST', port: 'out' }, { unit: 'M1', port: 'steam' }),
      e('S03', 'Mixed feed', 'syngas', { unit: 'M1', port: 'out' }, { unit: 'R1', port: 'in' }),
      e('S04', 'Primary effluent', 'syngas', { unit: 'R1', port: 'out' }, { unit: 'E1', port: 'in' }),
      e('S05', 'HTS feed', 'syngas', { unit: 'E1', port: 'out' }, { unit: 'R3', port: 'in' }),
      e('S06', 'HTS effluent', 'syngas', { unit: 'R3', port: 'out' }, { unit: 'E4', port: 'in' }),
      e('S07', 'LTS feed', 'syngas', { unit: 'E4', port: 'out' }, { unit: 'R4', port: 'in' }),
      e('S08', 'LTS effluent', 'syngas', { unit: 'R4', port: 'out' }, { unit: 'V1', port: 'in' }),
      e('S09', 'Treated gas (KO vapor)', 'syngas', { unit: 'V1', port: 'vapor' }, { unit: 'A1', port: 'in' }),
      e('S10', 'Condensate to BFW', 'water', { unit: 'V1', port: 'liquid' }, null),
      e('S11', 'CO2 to storage', 'co2', { unit: 'A1', port: 'offgas' }, null),
      e('S12', 'CO2-lean gas', 'syngas', { unit: 'A1', port: 'gas' }, { unit: 'P1', port: 'in' }),
      e('S13', 'Hydrogen product', 'product', { unit: 'P1', port: 'product' }, null),
      e('S14', 'PSA tailgas to fuel', 'purge', { unit: 'P1', port: 'tailgas' }, null),
    ],
    controllers: [],
  };
}

export const STAGES = [
  { n: 1 as const, label: 'FEED & REFORMING', blurb: 'make the hydrogen: natural gas + steam reform over Ni — every carbon atom exists to surrender its hydrogen' },
  { n: 2 as const, label: 'SHIFT & CO2 REMOVAL', blurb: 'squeeze more hydrogen out (water-gas shift), knock out condensate, scrub the CO2' },
  { n: 3 as const, label: 'PSA PURIFICATION', blurb: 'split the gas: adsorbents catch everything that is not hydrogen — product out, tailgas to fuel, NOTHING recirculates' },
];

export const PRESENTATION: Record<string, { tag: string; label: string; stage: 1 | 2 | 3; role: string }> = {
  SRC_NG: { tag: 'FQ-101', label: 'NATURAL GAS', stage: 1, role: 'natural-gas feed at battery limit' },
  SRC_ST: { tag: 'FQ-102', label: 'PROCESS STEAM', stage: 1, role: 'HP steam feed at battery limit (S/C about 3)' },
  M1: { tag: 'M-101', label: 'FEED MIX', stage: 1, role: 'joins natural gas with steam' },
  R1: { tag: 'R-102', label: 'PRIMARY REFORMER', stage: 1, role: 'fired furnace — SMR + WGS equilibrium at ~805 °C' },
  E1: { tag: 'E-101', label: 'WASTE HEAT BOILER', stage: 1, role: 'cools to shift inlet' },
  R3: { tag: 'R-104', label: 'HIGH-TEMP SHIFT', stage: 2, role: 'Fe-Cr shift: CO + H2O → CO2 + H2' },
  E4: { tag: 'E-102', label: 'INTERCOOLER', stage: 2, role: 'cools between shift beds' },
  R4: { tag: 'R-105', label: 'LOW-TEMP SHIFT', stage: 2, role: 'Cu-Zn shift drives CO down' },
  V1: { tag: 'V-101', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains shift condensate' },
  A1: { tag: 'C-101', label: 'CO2 REMOVAL', stage: 2, role: 'aMDEA scrub — CO2 offgas out' },
  P1: { tag: 'PS-101', label: 'PSA UNIT', stage: 3, role: 'adsorbent beds release a 99.95 % hydrogen product; everything else leaves as tailgas' },
};

export const PRIMER = `HYDROGEN PRIMER (canonical teaching route — the once-through plant):
1. Front end: ng-source + steam-source (S/C about 3) mix in the feed-mixer; the primary reformer converts CH4 + H2O over Ni at ~805 C.
2. Shift section: high-temp shift (Fe-Cr) converts CO + H2O -> CO2 + H2, intercooler, low-temp shift (Cu-Zn) drives CO down — shift matters here because CO is wasted carbon, not a reactant.
3. Purification: knockout drum (condensate out), CO2 removal (aMDEA, CO2 offgas out). NO methanator — the PSA tolerates what the scrubber misses.
4. The PSA unit splits the treated gas: a high-purity hydrogen product (99.95 mol %) plus a fuel tailgas. NO recycle loop, NO controller, NO circulator — the plant is once-through.
Unit spec defaults encode reference operating points — only set specs the brief asks for.`;

export function conventionsBlock(speciesDigest: string, catalogDigestText: string): string {
  return `PLANT CONVENTIONS (the plant-level KPI reader reads these exact ids):
- Unit ids: SRC_NG = natural gas source, R1 = primary reformer, A1 = CO2 removal, P1 = PSA unit.
- Stream ids: S01 = natural gas feed, S12 = PSA feed, S13 = hydrogen product, S14 = PSA tailgas.
- Stream classes: feed, syngas, loopgas, product, water, co2, purge.
- Species indexes: ${speciesDigest}.

STRUCTURAL RULES (the validator enforces these):
- Every inlet must be fed by exactly ONE stream. Every outlet must be connected (a stream with "to": null leaves the plant to the environment).
- NO recycle loop and NO controller in the hydrogen family — the plant is once-through; do NOT call add_controller or place loop units (loop-mixer, circulator, purge-split).

UNIT CATALOG (in/out ports with phase: gas/liquid; specs with ranges and defaults):
${catalogDigestText}`;
}

export const HYDROGEN: PlantFamily = {
  id: 'hydrogen',
  name: 'Hydrogen',
  route: 'SMR + shift + PSA (once-through)',
  blurb: 'The once-through lesson: reforming and shift make the hydrogen, the PSA takes it out at 99.95 %, and nothing comes back around — no loop at all.',
  productSpecies: 'H2',
  speciesOfInterest: ['H2', 'CH4', 'CO', 'CO2', 'H2O'],
  hasLoop: false,
  stages: STAGES,
  presentation: PRESENTATION,
  primer: PRIMER,
  conventions: conventionsBlock,
  presets: [
    {
      label: 'Reference plant',
      text: 'Build the standard hydrogen plant: natural gas steam reforming, two-stage water-gas shift, condensate knockout, CO2 removal, and pressure-swing adsorption delivering a high-purity hydrogen product with fuel tailgas. Around 100 tonnes per day of hydrogen at 99.95 % purity.',
    },
    {
      label: 'Max recovery',
      text: 'Build the standard hydrogen plant, but tune the PSA for maximum hydrogen recovery. Keep the front end at reference conditions and report the recovery and purity you achieve.',
    },
  ],
  tourFocus: ['M1', 'R1', 'R3', 'R4', 'A1', 'P1'],
  referenceGraph: hydrogenReferenceGraph,
  makeupStreamIds: ['S01'],
  tearGuess: (makeup: Moles): Moles => makeup.slice(),
  computeKpis(ctx: KpiCtx) {
    const { states, unitRecs, specs, graph } = ctx;
    const S = (id: string): StreamState | undefined => states[id];
    const U = (id: string): UnitResult | undefined => unitRecs[id];
    // structural first (equipment-anchored — immune to id drift), S-id fallback
    const gs = graphStreams(graph, states);
    const product = (gs.outOfType('psa', 'product') ?? S('S13'))?.n ?? zeroN();
    const psaFeed = (gs.intoType('psa') ?? S('S12'))?.n ?? zeroN();
    const tailgas = (gs.outOfType('psa', 'tailgas') ?? S('S14'))?.n ?? zeroN();
    const ngFeed = (specs['SRC_NG']?.flow as number | undefined) ?? 0;

    const prodTot = total(product);
    const prodTpd = (product[0] * SP.H2.mw * 24) / 1000;
    const prodPurity = prodTot > 0 ? product[0] / prodTot : 0;
    const recovery = psaFeed[0] > 1e-9 ? product[0] / psaFeed[0] : 0;
    const reformerDuty = U('R1')?.metrics[0]?.raw ?? 0;
    const feedGJd = (ngFeed * LHV_CH4 * 24) / 1e6;
    const fuelGJd = (reformerDuty * 3.6e6 * 24) / 1e6 / 0.92;
    // H2 LHV = 120 GJ/t → production in GJ/d vs feed + fuel in — the plant-efficiency metric
    const h2GJd = prodTpd * 120;
    const thermalEff = feedGJd + fuelGJd > 1e-9 ? h2GJd / (feedGJd + fuelGJd) : 0;
    const specEnergy = prodTpd > 1e-9 ? (feedGJd + fuelGJd) / prodTpd : 0;
    const prodNm3h = product[0] * 22.414; // kmol/h → Nm³/h (ideal, 0 °C)

    const kpis: Kpis = {
      productionTpd: prodTpd,
      productPurityMol: prodPurity,
      productPurityWt: prodPurity, // pure hydrogen: mol ≈ wt
      perPassConv: 0,
      overallConv: recovery,
      loopInerts: 0,
      h2n2Ratio: 0,
      makeupFlow: total(psaFeed),
      recycleMultiple: 0,
      purgeFrac: 0,
      reformerDutyMW: reformerDuty,
      refrigerationDutyMW: 0,
      syngasComprPowerMW: 0,
      circulatorPowerKW: 0,
      specificEnergyGJt: specEnergy,
      airFlow: 0,
      secondaryExitC: 0,
      coSlipLTS: 0,
      oxidesAfterMeth: 0,
      family: 'hydrogen',
      productSpecies: 'H2',
      familyKpis: [
        { label: 'H2 production', value: `${prodTpd.toFixed(0)} t/d (${Math.round(prodNm3h).toLocaleString()} Nm³/h)`, raw: prodTpd },
        { label: 'Purity', value: `${(prodPurity * 100).toFixed(3)} mol %`, raw: prodPurity },
        { label: 'H2 recovery', value: `${(recovery * 100).toFixed(1)} %`, raw: recovery },
        { label: 'Thermal efficiency', value: `${(thermalEff * 100).toFixed(1)} % (H2 LHV out / feed + fuel in)`, raw: thermalEff },
        { label: 'Tailgas fuel', value: `${total(tailgas).toFixed(0)} kmol/h` },
        { label: 'Specific energy', value: `${specEnergy.toFixed(1)} GJ/t H2`, raw: specEnergy },
      ],
    };
    return { kpis, warnings: [] };
  },
};
