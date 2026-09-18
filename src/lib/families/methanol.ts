/**
 * The methanol family — SMR front end + CO2 removal + a methanol synthesis
 * loop over Cu/ZnO/Al2O3.
 *
 * The teaching contrast with ammonia: same front end (minus the methanator —
 * CO2 is a REACTANT here, not a poison), a cooler loop (80 bar, not 150), a
 * gentler converter (225 °C, not 400+), and NO controller — the make-up
 * H2/(CO+CO2) ratio is whatever the front end delivers, and the PURGE carries
 * the hydrogen excess. Students who met the ammonia loop see how the same
 * loop architecture serves a different chemistry.
 */

import type { FlowGraph, StreamEdge, StreamState } from '@/lib/engine/graph';
import type { Kpis, UnitResult } from '@/lib/engine/types';
import { LHV_CH4, SP } from '@/lib/engine/species';
import type { Moles } from '@/lib/engine/species';
import { total, massFlow } from '@/lib/engine/thermo';
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
 * Canonical teaching topology: 15 units, 16 streams, one loop, no controller.
 * HTS only, NO CO2 removal (CO2 is a reactant — the module ratio lands near
 * stoichiometric naturally). Stream conventions: S07 = make-up syngas, S11 =
 * converter feed, S15 = crude product, S18 = purge, S20 = recycle.
 */
export function methanolReferenceGraph(): FlowGraph {
  return {
    family: 'methanol',
    units: [
      { id: 'SRC_NG', type: 'ng-source', specs: {} },
      { id: 'SRC_ST', type: 'steam-source', specs: {} },
      { id: 'M1', type: 'feed-mixer', specs: {} },
      { id: 'R1', type: 'primary-reformer', specs: {} },
      { id: 'E1', type: 'whb-cooler', specs: {} },
      { id: 'R3', type: 'wgs-hts', specs: {} },
      { id: 'V1', type: 'ko-drum-shift', specs: {} },
      { id: 'C1', type: 'syngas-compressor', specs: { dischargeP: 85 } },
      { id: 'M2', type: 'loop-mixer', specs: { outletP: 80 } },
      { id: 'E3', type: 'feed-preheater', specs: { outletT: 225, outletP: 80 } },
      { id: 'R5', type: 'meoh-converter', specs: {} },
      { id: 'E5', type: 'whb-cooler', specs: { outletT: 40, dp: 1 } },
      { id: 'MS1', type: 'meoh-separator', specs: {} },
      { id: 'SP1', type: 'purge-split', specs: { purgeFrac: 0.12 } },
      { id: 'C2', type: 'loop-circulator', specs: { dischargeP: 80 } },
    ],
    streams: [
      e('S01', 'Natural gas feed', 'feed', { unit: 'SRC_NG', port: 'out' }, { unit: 'M1', port: 'ng' }),
      e('S02', 'Process steam', 'feed', { unit: 'SRC_ST', port: 'out' }, { unit: 'M1', port: 'steam' }),
      e('S03', 'Mixed feed', 'syngas', { unit: 'M1', port: 'out' }, { unit: 'R1', port: 'in' }),
      e('S04', 'Primary effluent', 'syngas', { unit: 'R1', port: 'out' }, { unit: 'E1', port: 'in' }),
      e('S05', 'HTS feed', 'syngas', { unit: 'E1', port: 'out' }, { unit: 'R3', port: 'in' }),
      e('S06', 'HTS effluent', 'syngas', { unit: 'R3', port: 'out' }, { unit: 'V1', port: 'in' }),
      e('S07', 'Treated gas (KO vapor)', 'syngas', { unit: 'V1', port: 'vapor' }, { unit: 'C1', port: 'in' }),
      e('S08', 'Condensate to BFW', 'water', { unit: 'V1', port: 'liquid' }, null),
      e('S09', 'Compressed make-up', 'syngas', { unit: 'C1', port: 'out' }, { unit: 'M2', port: 'makeup' }),
      e('S10', 'Loop gas (mixer out)', 'loopgas', { unit: 'M2', port: 'out' }, { unit: 'E3', port: 'in' }),
      e('S11', 'Converter feed', 'loopgas', { unit: 'E3', port: 'out' }, { unit: 'R5', port: 'in' }),
      e('S12', 'Converter effluent', 'loopgas', { unit: 'R5', port: 'out' }, { unit: 'E5', port: 'in' }),
      e('S13', 'Chilled effluent', 'loopgas', { unit: 'E5', port: 'out' }, { unit: 'MS1', port: 'chilled' }),
      // separator internal self-loop (mirrors the ammonia separator)
      e('S14', 'Separator liquid', 'product', { unit: 'MS1', port: 'sepLiquid' }, { unit: 'MS1', port: 'letdownIn' }),
      e('S15', 'Crude methanol product', 'product', { unit: 'MS1', port: 'product' }, null),
      e('S16', 'Letdown flash vapor', 'purge', { unit: 'MS1', port: 'flash' }, { unit: 'SP1', port: 'flash' }, true),
      e('S17', 'Separator gas', 'loopgas', { unit: 'MS1', port: 'gas' }, { unit: 'SP1', port: 'gas' }),
      e('S18', 'Purge', 'purge', { unit: 'SP1', port: 'purge' }, null),
      e('S19', 'Recycle gas', 'loopgas', { unit: 'SP1', port: 'recycle' }, { unit: 'C2', port: 'in' }),
      e('S20', 'Circulator out', 'loopgas', { unit: 'C2', port: 'out' }, { unit: 'M2', port: 'recycle' }),
    ],
    controllers: [],
  };
}

export const STAGES = [
  { n: 1 as const, label: 'FEED & REFORMING', blurb: 'make the syngas: natural gas + steam over Ni — keep the CO2, it is a reactant here' },
  { n: 2 as const, label: 'SHIFT & CO2 TRIM', blurb: 'shift CO to hydrogen, then trim (not remove) CO2 so the module ratio lands near 2' },
  { n: 3 as const, label: 'METHANOL LOOP', blurb: '80 bar over Cu/ZnO/Al2O3 at 225 °C — condense the crude, purge the hydrogen excess, recirculate' },
];

export const PRESENTATION: Record<string, { tag: string; label: string; stage: 1 | 2 | 3; role: string }> = {
  SRC_NG: { tag: 'FQ-101', label: 'NATURAL GAS', stage: 1, role: 'natural-gas feed at battery limit' },
  SRC_ST: { tag: 'FQ-102', label: 'PROCESS STEAM', stage: 1, role: 'HP steam feed at battery limit (S/C about 3)' },
  M1: { tag: 'M-101', label: 'FEED MIX', stage: 1, role: 'joins natural gas with steam' },
  R1: { tag: 'R-102', label: 'PRIMARY REFORMER', stage: 1, role: 'fired furnace — SMR + WGS equilibrium at ~805 °C' },
  E1: { tag: 'E-101', label: 'WASTE HEAT BOILER', stage: 1, role: 'cools to shift inlet' },
  R3: { tag: 'R-104', label: 'HIGH-TEMP SHIFT', stage: 2, role: 'Fe-Cr shift — but NO LTS and NO CO2 removal: carbon oxides are food' },
  V1: { tag: 'V-101', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains shift condensate' },
  C1: { tag: 'K-101', label: 'SYNGAS COMPRESSOR', stage: 3, role: 'make-up gas to ~85 bar' },
  M2: { tag: 'M-102', label: 'LOOP MIXER', stage: 3, role: 'joins make-up with recycle gas' },
  E3: { tag: 'E-103', label: 'FEED PREHEATER', stage: 3, role: 'sets converter inlet at 225 °C' },
  R5: { tag: 'R-107', label: 'METHANOL CONVERTER', stage: 3, role: '3-bed Cu/ZnO/Al2O3 — the heart' },
  E5: { tag: 'E-104', label: 'LOOP COOLER', stage: 3, role: 'chills to 40 °C so crude methanol condenses' },
  MS1: { tag: 'V-103', label: 'CRUDE SEPARATOR', stage: 3, role: 'splits liquid crude from loop gas' },
  SP1: { tag: 'SP-101', label: 'PURGE SPLIT', stage: 3, role: 'purge carries the hydrogen excess — no controller needed' },
  C2: { tag: 'K-102', label: 'LOOP CIRCULATOR', stage: 3, role: 'boosts the recycle back to loop pressure' },
};

export const PRIMER = `METHANOL PRIMER (canonical teaching route — the methanol loop):
1. Front end: ng-source + steam-source mix in the feed-mixer; the primary reformer converts CH4 + H2O over Ni at ~805 C; waste-heat boiler cools to shift inlet.
2. Shift section: high-temp shift ONLY (no LTS — keep the CO), knockout drum drains condensate. NO CO2 removal and NO methanator — CO2 is a reactant and carbon oxides are food, not poison; the module ratio M = (H2 - CO2) / (CO + CO2) lands near its stoichiometric 2 all by itself.
5. Methanol loop: make-up compressor to ~85 bar, loop-mixer joins make-up with recycle, feed-preheater sets converter inlet at 225 C, 3-bed meoh-converter over Cu/ZnO/Al2O3, loop cooler chills to 40 C, crude separator splits liquid crude methanol (letdown to 2 bar), purge-split removes a PURGE that carries the hydrogen excess (no controller in this family), circulator boosts the recycle back to the mixer.
Unit spec defaults encode reference operating points — only set specs the brief asks for.`;

export function conventionsBlock(speciesDigest: string, catalogDigestText: string): string {
  return `PLANT CONVENTIONS (the plant-level KPI reader reads these exact ids):
- Unit ids: SRC_NG = natural gas source, R1 = primary reformer, R3 = high-temp shift, V1 = knockout drum, C1 = make-up syngas compressor, R5 = methanol converter, MS1 = crude separator, SP1 = purge split, C2 = loop circulator.
- Stream ids: S07 = make-up syngas, S11 = converter feed, S12 = converter effluent, S15 = crude methanol product, S18 = purge, S20 = recycle.
- Stream classes: feed, syngas, loopgas, product, water, co2, purge.
- Species indexes: ${speciesDigest}.

STRUCTURAL RULES (the validator enforces these):
- Every inlet must be fed by exactly ONE stream. Every outlet must be connected (a stream with "to": null leaves the plant to the environment).
- The synthesis loop must contain the feed-preheater unit (its outlet T/P are spec-determined — that is what makes the recycle loop solvable).
- Only ONE independent recycle loop is supported.
- The meoh-separator needs its internal self-loop: connect its "sepLiquid" outlet back into its own "letdownIn" inlet, and its "flash" outlet into the purge-split's "flash" inlet with "implicit": true.
- NO controller in the methanol family — the purge carries the hydrogen excess; do NOT call add_controller.

UNIT CATALOG (in/out ports with phase: gas/liquid; specs with ranges and defaults):
${catalogDigestText}`;
}

export const METHANOL: PlantFamily = {
  id: 'methanol',
  name: 'Methanol',
  route: 'SMR + methanol loop over Cu/ZnO/Al2O3',
  blurb: 'The loop chemistry contrast: same front end as ammonia (minus the methanator — CO2 is food here), a cooler 80-bar loop, and a purge that carries the hydrogen excess instead of a controller.',
  productSpecies: 'CH3OH',
  speciesOfInterest: ['H2', 'CO', 'CO2', 'CH3OH', 'H2O'],
  hasLoop: true,
  stages: STAGES,
  presentation: PRESENTATION,
  primer: PRIMER,
  conventions: conventionsBlock,
  presets: [
    {
      label: 'Reference plant',
      text: 'Build the standard methanol plant: natural gas steam reforming, high-temp shift only, NO CO2 removal (CO2 is a reactant), then an 80-bar synthesis loop with make-up compression, Cu/ZnO/Al2O3 converter at 225 °C, condensation, crude separator, purge and recycle. Report crude production and purity.',
    },
    {
      label: 'Module-tuned',
      text: 'Build the standard methanol plant, but push the module ratio as close to 2.0 as the front end allows — tune the shift temperature and steam ratio, and report what per-pass conversion you achieve.',
    },
  ],
  tourFocus: ['R1', 'A1', 'C1', 'R5', 'MS1', 'SP1'],
  referenceGraph: methanolReferenceGraph,
  makeupStreamIds: ['S12'],
  // loop-gas first guess: ~4.5× make-up at make-up composition (H2-rich,
  // carbon-lean after the separator) — damped-DS + Broyden refine it
  tearGuess: (makeup: Moles): Moles => makeup.map((v) => v * 4.5),
  computeKpis(ctx: KpiCtx) {
    const { states, unitRecs, specs, graph } = ctx;
    const S = (id: string): StreamState | undefined => states[id];
    const U = (id: string): UnitResult | undefined => unitRecs[id];
    // structural first (equipment-anchored), S-id fallback
    const gs = graphStreams(graph, states);
    const feed = (gs.intoType('meoh-converter') ?? S('S11'))?.n ?? zeroN();
    const eff = (gs.outOfType('meoh-converter', 'out') ?? S('S12'))?.n ?? zeroN();
    const product = (gs.outOfType('meoh-separator', 'product') ?? S('S15'))?.n ?? zeroN();
    const purge = (gs.outOfType('purge-split', 'purge') ?? S('S18'))?.n ?? zeroN();
    const recycle = (gs.outOfType('loop-circulator', 'out') ?? S('S20'))?.n ?? zeroN();
    const makeup = (gs.intoType('syngas-compressor') ?? S('S07'))?.n ?? zeroN();

    const feedTot = total(feed);
    const makeupTot = total(makeup);
    const carbonIn = feed[2] + feed[3];
    const carbonOut = eff[2] + eff[3];
    const perPass = carbonIn > 1e-9 ? 1 - carbonOut / carbonIn : 0;
    const moduleM = feed[2] + feed[3] > 1e-9 ? (feed[0] - feed[3]) / (feed[2] + feed[3]) : 0;
    const inerts = feedTot > 0 ? (feed[4] + feed[5]) / feedTot : 0;
    const prodKg = massFlow(product);
    const prodTpd = (prodKg * 24) / 1000;
    const prodMeOHkg = product[11] * SP.CH3OH.mw;
    const overall = makeupTot > 1e-9 ? 1 - total(purge) / makeupTot : 0;

    const ngFeed = (specs['SRC_NG']?.flow as number | undefined) ?? 0;
    const reformerDuty = U('R1')?.metrics[0]?.raw ?? 0;
    const feedGJd = (ngFeed * LHV_CH4 * 24) / 1e6;
    const fuelGJd = (reformerDuty * 3.6e6 * 24) / 1e6 / 0.92;
    const powerKW = (U('C1')?.metrics[0]?.raw ?? 0) * 1000 + (U('C2')?.metrics[0]?.raw ?? 0);
    const powerGJd = (powerKW * 24 * 3.6) / 1000;
    const specEnergy = prodTpd > 1e-9 ? (feedGJd + fuelGJd + powerGJd) / prodTpd : 0;

    const purityMol = prodKg > 0 ? product[11] / total(product) : 0;
    const purityWt = prodKg > 0 ? prodMeOHkg / prodKg : 0;
    const kpis: Kpis = {
      productionTpd: prodTpd,
      productPurityMol: purityMol,
      productPurityWt: purityWt,
      perPassConv: perPass,
      overallConv: overall,
      loopInerts: inerts,
      h2n2Ratio: moduleM, // repurposed: module ratio M
      makeupFlow: makeupTot,
      recycleMultiple: makeupTot > 1e-9 ? total(recycle) / makeupTot : 0,
      purgeFrac: (specs['SP1']?.purgeFrac as number | undefined) ?? 0,
      reformerDutyMW: reformerDuty,
      refrigerationDutyMW: 0,
      syngasComprPowerMW: U('C1')?.metrics[0]?.raw ?? 0,
      circulatorPowerKW: U('C2')?.metrics[0]?.raw ?? 0,
      specificEnergyGJt: specEnergy,
      airFlow: 0,
      secondaryExitC: 0,
      coSlipLTS: 0,
      oxidesAfterMeth: 0,
      family: 'methanol',
      productSpecies: 'CH3OH',
      familyKpis: [
        { label: 'Crude MeOH', value: `${prodTpd.toFixed(0)} t/d`, raw: prodTpd },
        { label: 'Purity', value: `${(purityMol * 100).toFixed(1)} mol % / ${(purityWt * 100).toFixed(1)} wt %` },
        { label: 'Per-pass carbon conversion', value: `${(perPass * 100).toFixed(1)} %`, raw: perPass },
        { label: 'Module ratio M', value: `${moduleM.toFixed(2)} (stoichiometric 2.0)`, raw: moduleM },
        { label: 'Loop inerts', value: `${(inerts * 100).toFixed(1)} %`, raw: inerts },
        { label: 'Specific energy', value: `${specEnergy.toFixed(1)} GJ/t MeOH`, raw: specEnergy },
      ],
    };
    const warnings: string[] = [];
    if (prodTpd > 1 && kpis.productPurityWt < 0.55) {
      warnings.push('crude purity below 70 wt % — too much water in the crude (check loop cooler temperature)');
    }
    return { kpis, warnings };
  },
};

