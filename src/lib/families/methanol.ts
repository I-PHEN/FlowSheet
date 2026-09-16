/**
 * The methanol family — SMR front end + methanol synthesis loop.
 *
 * The teaching counterpoint to ammonia: the SAME front end machinery (steam
 * reforming of natural gas) feeding a DIFFERENT synthesis loop — Cu/ZnO/Al2O3
 * catalyst at 200–280 °C making methanol from CO/CO2 + H2. No secondary
 * reformer and no shift: CO is a reactant here, not a poison. The loop runs
 * hydrogen-rich (pure SMR gas has module ratio M ≈ 3 against the ideal 2) —
 * the purge carries the excess hydrogen, which is itself a teaching point.
 */

import type { FlowGraph, StreamEdge, StreamState } from '@/lib/engine/graph';
import type { Kpis, UnitResult } from '@/lib/engine/types';
import { LHV_CH4, N_SP, SP } from '@/lib/engine/species';
import type { Moles } from '@/lib/engine/species';
import { massFlow, total } from '@/lib/engine/thermo';
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
 * Canonical teaching topology: 14 units, 19 streams (18 recorded + 1 implicit
 * letdown line), NO controller (the hydrogen excess is handled by the purge).
 *
 * Stream ids follow the family conventions: S07 = dry make-up syngas,
 * S10 = converter feed, S11 = converter effluent, S13 = crude methanol,
 * S15 = purge, S16 = recycle.
 */
export function methanolReferenceGraph(): FlowGraph {
  return {
    family: 'methanol',
    units: [
      { id: 'SRC_NG', type: 'ng-source', specs: { flow: 500 } },
      { id: 'SRC_ST', type: 'steam-source', specs: { flow: 1250 } },
      { id: 'M1', type: 'feed-mixer', specs: { steamCarbon: 2.5 } },
      { id: 'R1', type: 'primary-reformer', specs: { outletT: 860 } },
      { id: 'E1', type: 'whb-cooler', specs: { outletT: 40 } },
      { id: 'V1', type: 'ko-drum-shift', specs: {} },
      { id: 'C1', type: 'syngas-compressor', specs: { stages: 2, dischargeP: 80 } },
      { id: 'M2', type: 'loop-mixer', specs: { outletP: 77 } },
      { id: 'E3', type: 'feed-preheater', specs: { outletT: 225, outletP: 77 } },
      { id: 'R6', type: 'meoh-converter', specs: {} },
      { id: 'E2', type: 'condensation-train', specs: { chillT: 25 } },
      { id: 'V3', type: 'meoh-separator', specs: {} },
      { id: 'SP1', type: 'purge-split', specs: { purgeFrac: 0.06 } },
      { id: 'C2', type: 'loop-circulator', specs: { dischargeP: 80 } },
    ],
    streams: [
      e('S01', 'Natural gas feed', 'feed', { unit: 'SRC_NG', port: 'out' }, { unit: 'M1', port: 'ng' }),
      e('S02', 'Process steam', 'feed', { unit: 'SRC_ST', port: 'out' }, { unit: 'M1', port: 'steam' }),
      e('S03', 'Mixed feed', 'syngas', { unit: 'M1', port: 'out' }, { unit: 'R1', port: 'in' }),
      e('S04', 'Reformer effluent', 'syngas', { unit: 'R1', port: 'out' }, { unit: 'E1', port: 'in' }),
      e('S05', 'Cooled syngas', 'syngas', { unit: 'E1', port: 'out' }, { unit: 'V1', port: 'in' }),
      e('S06', 'Condensate to BFW', 'water', { unit: 'V1', port: 'liquid' }, null),
      e('S07', 'Dry make-up syngas', 'syngas', { unit: 'V1', port: 'vapor' }, { unit: 'C1', port: 'in' }),
      e('S08', 'HP make-up syngas', 'syngas', { unit: 'C1', port: 'out' }, { unit: 'M2', port: 'makeup' }),
      e('S09', 'Loop mix', 'loopgas', { unit: 'M2', port: 'out' }, { unit: 'E3', port: 'in' }),
      e('S10', 'Converter feed', 'loopgas', { unit: 'E3', port: 'out' }, { unit: 'R6', port: 'in' }),
      e('S11', 'Converter effluent', 'loopgas', { unit: 'R6', port: 'out' }, { unit: 'E2', port: 'in' }),
      e('S12', 'Chilled loop gas', 'loopgas', { unit: 'E2', port: 'out' }, { unit: 'V3', port: 'chilled' }),
      e('S13S', 'Separator liquid', 'product', { unit: 'V3', port: 'sepLiquid' }, { unit: 'V3', port: 'letdownIn' }),
      e('S13', 'Crude methanol product', 'product', { unit: 'V3', port: 'product' }, null),
      e('S14', 'Separator gas', 'loopgas', { unit: 'V3', port: 'gas' }, { unit: 'SP1', port: 'gas' }),
      e('IF1', 'Letdown flash vapor', 'purge', { unit: 'V3', port: 'flash' }, { unit: 'SP1', port: 'flash' }, true),
      e('S15', 'Purge to fuel', 'purge', { unit: 'SP1', port: 'purge' }, null),
      e('S16', 'Recycle gas', 'loopgas', { unit: 'SP1', port: 'recycle' }, { unit: 'C2', port: 'in' }),
      e('S17', 'Circulator discharge', 'loopgas', { unit: 'C2', port: 'out' }, { unit: 'M2', port: 'recycle' }),
    ],
    controllers: [],
  };
}

export const STAGES = [
  { n: 1 as const, label: 'FEED & REFORMING', blurb: 'make the syngas: natural gas + steam reform over Ni — hotter than ammonia, no air, no shift: CO is a reactant now' },
  { n: 2 as const, label: 'COOLING & COMPRESSION', blurb: 'dry it and squeeze it: knock out the condensate, compress the make-up to loop pressure' },
  { n: 3 as const, label: 'SYNTHESIS LOOP', blurb: 'make methanol: CO/CO2 + H2 over Cu/ZnO catalyst, condense crude MeOH, purge the hydrogen excess, recirculate' },
];

export const PRESENTATION: Record<string, { tag: string; label: string; stage: 1 | 2 | 3; role: string }> = {
  SRC_NG: { tag: 'FQ-101', label: 'NATURAL GAS', stage: 1, role: 'natural-gas feed at battery limit' },
  SRC_ST: { tag: 'FQ-102', label: 'PROCESS STEAM', stage: 1, role: 'steam feed (S/C about 2.5)' },
  M1: { tag: 'M-101', label: 'FEED MIX', stage: 1, role: 'joins natural gas with steam' },
  R1: { tag: 'R-102', label: 'PRIMARY REFORMER', stage: 1, role: 'fired furnace — SMR at ~860 °C, no air, no shift section' },
  E1: { tag: 'E-101', label: 'SYNGAS COOLER', stage: 2, role: 'cools to ambient for condensate knockout' },
  V1: { tag: 'V-101', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains the reforming condensate' },
  C1: { tag: 'K-101', label: 'SYNGAS COMPRESSOR', stage: 2, role: 'make-up gas to ~80 bar' },
  M2: { tag: 'M-102', label: 'LOOP MIXER', stage: 3, role: 'joins make-up with recycle' },
  E3: { tag: 'E-103', label: 'FEED PREHEATER', stage: 3, role: 'sets converter inlet (loop tear point)' },
  R6: { tag: 'R-107', label: 'METHANOL CONVERTER', stage: 3, role: '3-bed Cu/ZnO converter makes CH3OH from CO/CO2 + H2' },
  E2: { tag: 'E-104', label: 'CONDENSATION TRAIN', stage: 3, role: 'chills effluent so crude methanol condenses' },
  V3: { tag: 'V-103', label: 'MeOH SEPARATOR', stage: 3, role: 'splits crude methanol from loop gas' },
  SP1: { tag: 'SP-101', label: 'PURGE SPLIT', stage: 3, role: 'purges the hydrogen excess and inerts' },
  C2: { tag: 'K-102', label: 'CIRCULATOR', stage: 3, role: 'boosts the recycle back to the mixer' },
};

export const PRIMER = `METHANOL PRIMER (canonical teaching route — the counterpoint to ammonia):
1. Front end: ng-source + steam-source (S/C about 2.5) mix in the feed-mixer; the primary reformer runs HOTTER than ammonia (~860 C) because there is no secondary reformer to finish the job.
2. NO secondary reformer, NO shift section: CO and CO2 are REACTANTS for methanol — converting them to H2 would ruin the stoichiometry.
3. Cooling + compression: the syngas cooler drops the gas to ~40 C, the knockout drum drains condensate, the make-up compressor raises it to ~80 bar.
4. Synthesis loop: loop-mixer joins make-up with recycle, feed-preheater sets converter inlet (~225 C), the 3-bed methanol converter makes CH3OH over Cu/ZnO/Al2O3, the condensation train chills to ~25 C, the crude-methanol separator splits liquid product (letdown to ~2 bar) from loop gas, the purge-split removes the hydrogen excess + inerts (pure SMR gas is H2-rich: module ratio M = (H2 - CO2)/(CO + CO2) runs near 3 against the ideal 2), the circulator boosts the recycle back to the mixer.
5. NO controller: the hydrogen excess is handled by the purge, not by trimming a feed.
Unit spec defaults encode reference operating points — only set specs the brief asks for.`;

export function conventionsBlock(speciesDigest: string, catalogDigestText: string): string {
  return `PLANT CONVENTIONS (the plant-level KPI reader reads these exact ids):
- Unit ids: SRC_NG = natural gas source, R1 = primary reformer, E2 = condensation train, C1 = make-up syngas compressor, C2 = loop circulator, SP1 = purge split, R6 = methanol converter, V3 = crude-methanol separator.
- Stream ids: S07 = dry make-up syngas, S10 = converter feed, S11 = converter effluent, S13 = crude methanol product, S15 = purge, S16 = recycle gas.
- Stream classes: feed, syngas, loopgas, product, water, co2, purge.
- Species indexes: ${speciesDigest}.

STRUCTURAL RULES (the validator enforces these):
- Every inlet must be fed by exactly ONE stream. Every outlet must be connected (a stream with "to": null leaves the plant to the environment).
- The synthesis loop must contain the feed-preheater unit (its outlet T/P are spec-determined — that is what makes the recycle loop solvable).
- Only ONE independent recycle loop is supported in this version.
- The meoh-separator needs its internal self-loop: connect its "sepLiquid" outlet back into its own "letdownIn" inlet, and its "flash" outlet into the purge-split's "flash" inlet with "implicit": true.
- NO controller in the methanol family — do not call add_controller.

UNIT CATALOG (in/out ports with phase: gas/liquid; specs with ranges and defaults):
${catalogDigestText}`;
}

export const METHANOL: PlantFamily = {
  id: 'methanol',
  name: 'Methanol',
  route: 'SMR + methanol synthesis loop',
  blurb: 'The counterpoint to ammonia: the same reforming front end feeding a different loop — CO and CO2 over copper catalyst become methanol, and the purge carries the hydrogen excess.',
  productSpecies: 'CH3OH',
  speciesOfInterest: ['H2', 'CO', 'CO2', 'CH3OH', 'CH4', 'H2O'],
  hasLoop: true,
  stages: STAGES,
  presentation: PRESENTATION,
  primer: PRIMER,
  conventions: conventionsBlock,
  presets: [
    {
      label: 'Reference plant',
      text: 'Build the standard methanol plant: natural gas + steam reforming at high temperature, waste-heat cooling, condensate knockout, make-up compression to about 80 bar, then a methanol synthesis loop with a three-bed converter, condensation, crude-methanol separator, a purge for the hydrogen excess, and a recycle circulator. Medium scale, around 1,500 tonnes per day of crude methanol.',
    },
    {
      label: 'Teaching module',
      text: 'Build a compact methanol plant for a teaching module: steam reforming of natural gas and a small synthesis loop at moderate pressure. Name key streams clearly so students can follow the carbon path from methane to methanol.',
    },
  ],
  tourFocus: ['M1', 'R1', 'C1', 'R6', 'E2', 'V3', 'SP1'],
  referenceGraph: methanolReferenceGraph,
  makeupStreamIds: ['S07', 'S08'],
  tearGuess: (makeup: Moles): Moles => {
    // loop-gas guess: 4.5x make-up composition with a little product slip
    const f0 = total(makeup) * 4.5;
    const y0 = new Array(N_SP).fill(0);
    const mt = Math.max(total(makeup), 1e-9);
    for (let i = 0; i < N_SP; i++) y0[i] = (makeup[i] / mt) * 0.97; // dilute: product + water appear in loop
    y0[11] += 0.02; // CH3OH
    y0[7] += 0.01; // H2O
    const tear: Moles = new Array(N_SP).fill(0);
    for (let i = 0; i < N_SP; i++) tear[i] = f0 * y0[i];
    return tear;
  },
  computeKpis(ctx: KpiCtx) {
    const { states, unitRecs, specs, graph } = ctx;
    const S = (id: string): StreamState | undefined => states[id];
    const U = (id: string): UnitResult | undefined => unitRecs[id];
    // structural first (equipment-anchored — immune to id drift), S-id fallback
    const gs = graphStreams(graph, states);
    const nFeed = (gs.intoType('meoh-converter') ?? S('S10'))?.n ?? zeroN();
    const nEff = (gs.outOfType('meoh-converter', 'out') ?? S('S11'))?.n ?? zeroN();
    const product = (gs.outOfType('meoh-separator', 'product') ?? S('S13'))?.n ?? zeroN();
    const purge = (gs.outOfType('purge-split', 'purge') ?? S('S15'))?.n ?? zeroN();
    const recycle = (gs.outOfType('loop-circulator', 'out') ?? S('S16'))?.n ?? zeroN();
    const makeup = (gs.outOfType('syngas-compressor', 'out') ?? S('S07'))?.n ?? zeroN();
    const makeupTot = total(makeup);
    const feedTot = total(nFeed);
    const ngFeed = (specs['SRC_NG']?.flow as number | undefined) ?? 0;

    const carbonIn = nFeed[2] + nFeed[3];
    const carbonOut = nEff[2] + nEff[3];
    const perPass = carbonIn > 1e-9 ? 1 - carbonOut / carbonIn : 0;
    const makeupCarbon = makeup[2] + makeup[3];
    const purgeCarbon = purge[2] + purge[3];
    const overall = makeupCarbon > 1e-9 ? 1 - purgeCarbon / makeupCarbon : 0;
    const inerts = feedTot > 0 ? (nFeed[4] + nFeed[1] + nFeed[5]) / feedTot : 0; // CH4 + N2 + Ar
    const moduleRatio = nFeed[2] + nFeed[3] > 1e-9 ? (nFeed[0] - nFeed[3]) / (nFeed[2] + nFeed[3]) : 0;

    const prodKg = massFlow(product);
    const prodTpd = (prodKg * 24) / 1000;
    const prodMeOHkg = product[11] * SP.CH3OH.mw;
    const prodWt = prodKg > 0 ? prodMeOHkg / prodKg : 0;
    const reformerDuty = U('R1')?.metrics[0]?.raw ?? 0;
    const chDuty = U('E2')?.metrics[1]?.raw ?? 0;
    const powerKW = (U('C1')?.metrics[0]?.raw ?? 0) * 1000 + (U('C2')?.metrics[0]?.raw ?? 0) + (chDuty > 0 ? 0 : 0);
    const feedGJd = (ngFeed * LHV_CH4 * 24) / 1e6;
    const fuelGJd = (reformerDuty * 3.6e6 * 24) / 1e6 / 0.92;
    const powerGJd = (powerKW * 24 * 3.6) / 1000;
    const specEnergy = prodTpd > 1e-9 ? (feedGJd + fuelGJd + powerGJd) / prodTpd : 0;

    const kpis: Kpis = {
      productionTpd: prodTpd,
      productPurityMol: total(product) > 0 ? product[11] / total(product) : 0,
      productPurityWt: prodWt,
      perPassConv: perPass,
      overallConv: overall,
      loopInerts: inerts,
      h2n2Ratio: 0,
      makeupFlow: makeupTot,
      recycleMultiple: makeupTot > 1e-9 ? total(recycle) / makeupTot : 0,
      purgeFrac:
        (specs['SP1'] ?? specs[gs.unitIdOfType('purge-split') ?? ''] ?? ({} as Record<string, number>)).purgeFrac as number | undefined ?? 0,
      reformerDutyMW: reformerDuty,
      refrigerationDutyMW: chDuty,
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
        { label: 'MeOH purity', value: `${(prodWt * 100).toFixed(1)} wt %`, raw: prodWt },
        { label: 'Per-pass carbon conversion', value: `${(perPass * 100).toFixed(1)} %`, raw: perPass },
        { label: 'Module ratio M', value: moduleRatio.toFixed(2) },
        { label: 'Loop inerts', value: `${(inerts * 100).toFixed(1)} %`, raw: inerts },
        { label: 'Specific energy', value: `${specEnergy.toFixed(2)} GJ/t MeOH`, raw: specEnergy },
      ],
    };

    const warnings: string[] = [];
    if (prodTpd > 1 && prodWt < 0.8) {
      warnings.push('Crude methanol below 80 wt % — water high (check the KO drum and the converter CO2 route)');
    }
    return { kpis, warnings };
  },
};
