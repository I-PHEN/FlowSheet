/**
 * The ammonia family — SMR front end + Haber-Bosch synthesis loop.
 *
 * Everything here was the hard-coded ammonia context of v2: the presentation
 * layer (ex agent/blueprint.ts), the primer and conventions (ex prompts.ts),
 * the presets (ex protocol.ts PRESET_BRIEFS), and the KPI block — moved
 * VERBATIM from executor.ts so the identity gate still reproduces the legacy
 * numbers byte-for-byte. The reference topology stays in engine/reference.ts
 * (the legacy plant.ts identity gate depends on it).
 */

import type { FlowGraph, StreamState } from '@/lib/engine/graph';
import { referenceGraph } from '@/lib/engine/reference';
import type { Kpis, UnitResult } from '@/lib/engine/types';
import { LHV_CH4, SP } from '@/lib/engine/species';
import type { Moles } from '@/lib/engine/species';
import { tearInit } from '@/lib/engine/registry';
import { massFlow, total } from '@/lib/engine/thermo';
import { zeroN } from '@/lib/engine/units';
import type { KpiCtx, PlantFamily } from './types';
import { graphStreams } from './resolve';

const C = (celsius: number) => celsius + 273.15;

export const STAGES = [
  { n: 1 as const, label: 'FEED & REFORMING', blurb: 'make the hydrogen: natural gas + steam reform over Ni, process air adds nitrogen' },
  { n: 2 as const, label: 'SHIFT & PURIFICATION', blurb: 'clean it up: water-gas shift, knock out condensate, scrub CO2, methanate the traces' },
  { n: 3 as const, label: 'SYNTHESIS LOOP & COMPRESSION', blurb: 'make ammonia: compress, convert N2 + H2 over Fe, chill, separate liquid NH3, purge inerts, recirculate' },
];

/** equipment tags follow the reference PFD (M-101, R-102, …) */
export const PRESENTATION: Record<string, { tag: string; label: string; stage: 1 | 2 | 3; role: string }> = {
  SRC_NG: { tag: 'FQ-101', label: 'NATURAL GAS', stage: 1, role: 'natural-gas feed at battery limit' },
  SRC_ST: { tag: 'FQ-102', label: 'PROCESS STEAM', stage: 1, role: 'HP steam feed at battery limit' },
  SRC_AIR: { tag: 'FQ-103', label: 'PROCESS AIR', stage: 1, role: 'compressed air (N2 source, controller-trimmed)' },
  M1: { tag: 'M-101', label: 'FEED MIX', stage: 1, role: 'joins natural gas with steam' },
  R1: { tag: 'R-102', label: 'PRIMARY REFORMER', stage: 1, role: 'fired furnace — SMR + WGS equilibrium at ~805 °C' },
  R2: { tag: 'R-103', label: 'SECONDARY REFORMER', stage: 1, role: 'burns part of the H2 with air — adds N2, finishes reforming' },
  E1: { tag: 'E-101', label: 'WASTE HEAT BOILER', stage: 1, role: 'cools to shift inlet' },
  R3: { tag: 'R-104', label: 'HIGH-TEMP SHIFT', stage: 2, role: 'Fe-Cr shift: CO + H2O → CO2 + H2' },
  E4: { tag: 'E-102', label: 'INTERCOOLER', stage: 2, role: 'cools between shift beds' },
  R4: { tag: 'R-105', label: 'LOW-TEMP SHIFT', stage: 2, role: 'Cu-Zn shift drives CO down' },
  V1: { tag: 'V-101', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains shift condensate' },
  A1: { tag: 'C-101', label: 'CO2 REMOVAL', stage: 2, role: 'aMDEA scrub — CO2 offgas out' },
  R5: { tag: 'R-106', label: 'METHANATOR', stage: 2, role: 'traces carbon oxides to ppm' },
  V2: { tag: 'V-102', label: 'KNOCKOUT DRUM', stage: 2, role: 'drains methanation water' },
  C1: { tag: 'K-101', label: 'SYNGAS COMPRESSOR', stage: 3, role: 'make-up gas to ~150 bar' },
  M2: { tag: 'M-102', label: 'LOOP MIXER', stage: 3, role: 'joins make-up with recycle' },
  E3: { tag: 'E-103', label: 'FEED PREHEATER', stage: 3, role: 'sets converter inlet (loop tear point)' },
  R6: { tag: 'R-107', label: 'SYNTHESIS CONVERTER', stage: 3, role: '3-bed Fe converter makes NH3' },
  E2: { tag: 'E-104', label: 'CONDENSATION TRAIN', stage: 3, role: 'chills effluent to about −20 °C' },
  V3: { tag: 'V-103', label: 'NH3 SEPARATOR', stage: 3, role: 'splits liquid product from loop gas' },
  SP1: { tag: 'SP-101', label: 'PURGE SPLIT', stage: 3, role: 'small purge so inerts do not accumulate' },
  C2: { tag: 'K-102', label: 'CIRCULATOR', stage: 3, role: 'boosts recycle back to the mixer' },
};

export const PRIMER = `AMMONIA PRIMER (canonical SMR route — the teaching recipe):
1. Front end: ng-source + steam-source mix in the feed-mixer; the primary reformer converts CH4 + H2O over Ni at ~805 C; the secondary reformer burns part of the H2 with process air (adds N2, finishes reforming); the waste-heat boiler cools to shift inlet.
2. Shift section: high-temp shift (Fe-Cr) converts CO + H2O -> CO2 + H2, intercooler, low-temp shift (Cu-Zn) drives CO down.
3. Purification: knockout drum (condensate out), CO2 removal (aMDEA, CO2 offgas out), methanator traces carbon oxides to ppm, second knockout drum.
4. Synthesis loop: make-up compressor to ~150 bar, loop-mixer joins make-up with recycle, feed-preheater sets converter inlet, 3-bed converter makes NH3, condensation train chills to about -20 C, separator splits liquid product (letdown to ~2 bar) from loop gas, purge-split removes a small purge so inerts (CH4 + Ar) do not accumulate, circulator boosts the recycle back to the mixer.
5. The air controller trims process air so make-up H2/N2 = 3.0 (stoichiometric for NH3).
Unit spec defaults encode reference operating points — only set specs the brief asks for.`;

export function conventionsBlock(speciesDigest: string, catalogDigestText: string): string {
  return `PLANT CONVENTIONS (the plant-level KPI reader reads these exact ids — use them for the corresponding roles; everything else may be freely named):
- Unit ids: SRC_NG = natural gas source, R1 = primary reformer, R2 = secondary reformer, E2 = condensation train, C1 = make-up syngas compressor, C2 = loop circulator, SP1 = purge split.
- Stream ids: S16 = make-up syngas, S20 = converter feed, S21 = converter effluent, S24 = liquid ammonia product, S26 = purge, S27 = recycle gas.
- Stream classes: feed, syngas, loopgas, product, water, co2, purge.
- Species indexes: ${speciesDigest}.

STRUCTURAL RULES (the validator enforces these):
- Every inlet must be fed by exactly ONE stream. Every outlet must be connected (a stream with "to": null leaves the plant to the environment).
- The synthesis loop must contain the feed-preheater unit (its outlet T/P are spec-determined — that is what makes the recycle loop solvable).
- Only ONE independent recycle loop is supported in this version.
- The nh3-separator needs its internal self-loop: connect its "sepLiquid" outlet back into its own "letdownIn" inlet, and its "flash" outlet into the purge-split's "flash" inlet with "implicit": true.
- The air controller (add_controller) manipulates an air-source's flow to hold H2/N2 in the make-up stream; num=0 (H2), den=1 (N2), set=3.0.

UNIT CATALOG (in/out ports with phase: gas/liquid; specs with ranges and defaults):
${catalogDigestText}`;
}

export const AMMONIA: PlantFamily = {
  id: 'ammonia',
  name: 'Ammonia',
  route: 'SMR + Haber-Bosch loop',
  blurb: 'The canonical teaching plant: steam-methane reforming, shift + purification, and the high-pressure synthesis loop that fixes nitrogen from air.',
  productSpecies: 'NH3',
  speciesOfInterest: ['H2', 'N2', 'NH3', 'CH4', 'CO2'],
  hasLoop: true,
  stages: STAGES,
  presentation: PRESENTATION,
  primer: PRIMER,
  // assembled by the prompt builder with live digests (species + catalog)
  conventions: conventionsBlock,
  presets: [
    {
      label: 'Reference plant',
      text: 'Build the standard SMR ammonia plant: natural gas + steam reforming, secondary reforming with process air, two-stage water-gas shift, CO2 removal, methanation, then a high-pressure synthesis loop with make-up compression, converter, refrigerated condensation, separator, purge and recycle. Target roughly 800 t/day of liquid ammonia at the reference conditions.',
    },
    {
      label: 'Modest plant',
      text: 'Build a compact SMR ammonia plant for a teaching module: full front end (reforming, shift, CO2 removal, methanation) with a small synthesis loop, natural gas feed around 500 kmol/h, moderate loop pressure. Name key streams clearly so students can follow the hydrogen path.',
    },
    {
      label: 'Energy-lean loop',
      text: 'Build the standard SMR ammonia plant, but design the synthesis loop for low energy: deep chilling in the condensation train, a tight purge, and an efficient circulator. Keep the front end at reference conditions; report the specific energy result.',
    },
  ],
  tourFocus: ['M1', 'R1', 'R2', 'A1', 'C1', 'R6', 'E2', 'V3', 'SP1'],
  referenceGraph(): FlowGraph {
    const g = referenceGraph();
    return { ...g, family: 'ammonia' };
  },
  makeupStreamIds: ['S16', 'S18'],
  tearGuess: (makeup: Moles): Moles => tearInit(makeup),
  computeKpis(ctx: KpiCtx) {
    // ---- moved VERBATIM from executor.ts (the identity gate) ----
    const { states, unitRecs, specs, graph } = ctx;
    const S = (id: string): StreamState | undefined => states[id];
    const U = (id: string): UnitResult | undefined => unitRecs[id];
    // the verbatim legacy reads, equipment-anchored: structural resolution
    // first (on the reference graph both paths resolve to the same streams,
    // so the identity numbers are unchanged), S-id as the fallback
    const gs = graphStreams(graph, states);
    const nFeed = (gs.intoType('converter') ?? S('S20'))?.n ?? zeroN();
    const nEff = (gs.outOfType('converter', 'out') ?? S('S21'))?.n ?? zeroN();
    const product = (gs.outOfType('nh3-separator', 'product') ?? S('S24'))?.n ?? zeroN();
    const purge = (gs.outOfType('purge-split', 'purge') ?? S('S26'))?.n ?? zeroN();
    const recycle = (gs.outOfType('loop-circulator', 'out') ?? S('S27'))?.n ?? zeroN();
    const makeup = (gs.outOfType('syngas-compressor', 'out') ?? S('S16'))?.n ?? zeroN();
    const makeupTot = total(makeup);
    const feedTot = total(nFeed);
    const ngFeed = (specs['SRC_NG']?.flow as number | undefined) ?? 0;
    const chillT = (specs['E2']?.chillT as number | undefined) ?? -20;

    const inerts = feedTot > 0 ? (nFeed[4] + nFeed[5]) / feedTot : 0;
    const h2n2 = nFeed[1] > 1e-9 ? nFeed[0] / nFeed[1] : 0;
    const perPass = nFeed[1] > 1e-9 ? 1 - nEff[1] / nFeed[1] : 0;
    const overall = makeup[1] > 1e-9 ? 1 - purge[1] / makeup[1] : 0;
    const prodKg = massFlow(product);
    const prodTpd = (prodKg * 24) / 1000;
    const prodNH3kg = product[6] * SP.NH3.mw;
    const reformerDuty = U('R1')?.metrics[0]?.raw ?? 0;
    const chDuty = U('E2')?.metrics[1]?.raw ?? 0;
    const powerKW = (U('C1')?.metrics[0]?.raw ?? 0) * 1000 + (U('C2')?.metrics[0]?.raw ?? 0) + (chDuty / 2.4) * 1000;
    const feedGJd = (ngFeed * LHV_CH4 * 24) / 1e6;
    const fuelGJd = (reformerDuty * 3.6e6 * 24) / 1e6 / 0.92;
    const powerGJd = (powerKW * 24 * 3.6) / 1000;
    const specEnergy = prodTpd > 1e-9 ? (feedGJd + fuelGJd + powerGJd) / prodTpd : 0;
    const oxidesPpm = (() => {
      const s = S('S15');
      if (!s) return 0;
      const dry = total(s.n) - s.n[7];
      return dry > 0 ? ((s.n[2] + s.n[3]) / dry) * 1e6 : 0;
    })();

    const kpis: Kpis = {
      productionTpd: prodTpd,
      productPurityMol: prodKg > 0 ? product[6] / total(product) : 0,
      productPurityWt: prodKg > 0 ? prodNH3kg / prodKg : 0,
      perPassConv: perPass,
      overallConv: overall,
      loopInerts: inerts,
      h2n2Ratio: h2n2,
      makeupFlow: makeupTot,
      recycleMultiple: makeupTot > 1e-9 ? total(recycle) / makeupTot : 0,
      purgeFrac: (specs['SP1']?.purgeFrac as number | undefined) ?? 0,
      reformerDutyMW: reformerDuty,
      refrigerationDutyMW: chDuty,
      syngasComprPowerMW: U('C1')?.metrics[0]?.raw ?? 0,
      circulatorPowerKW: U('C2')?.metrics[0]?.raw ?? 0,
      specificEnergyGJt: specEnergy,
      airFlow: ctx.controlledAir ?? ((specs['SRC_AIR']?.flow as number | undefined) ?? 0),
      secondaryExitC: (U('R2')?.metrics[1]?.raw ?? 0) - 273.15,
      coSlipLTS: (() => {
        const s = S('S10');
        if (!s) return 0;
        const dry = total(s.n) - s.n[7];
        return dry > 0 ? s.n[2] / dry : 0;
      })(),
      oxidesAfterMeth: oxidesPpm,
      family: 'ammonia',
      productSpecies: 'NH3',
      familyKpis: [
        { label: 'Production', value: `${prodTpd.toFixed(0)} t/d NH3`, raw: prodTpd },
        { label: 'Purity', value: `${(kpis0(prodKg, product) * 100).toFixed(2)} wt %`, raw: kpis0(prodKg, product) },
        { label: 'Per-pass conversion', value: `${(perPass * 100).toFixed(1)} %`, raw: perPass },
        { label: 'Make-up H2/N2', value: h2n2.toFixed(3) },
        { label: 'Loop inerts', value: `${(inerts * 100).toFixed(1)} %`, raw: inerts },
        { label: 'Specific energy', value: `${specEnergy.toFixed(2)} GJ/t NH3`, raw: specEnergy },
      ],
    };

    const warnings: string[] = [];
    if (prodTpd > 1 && kpis.productPurityWt < 0.985) {
      warnings.push('Product purity below 98.5 wt % — dissolved gases high (check separator T/P)');
    }
    if (chDuty > 0 && C(chillT) > C(-5)) {
      warnings.push('Separator above −5 °C — substantial NH3 recycling through the loop');
    }
    return { kpis, warnings };
  },
};

function kpis0(prodKg: number, product: Moles): number {
  const prodNH3kg = product[6] * SP.NH3.mw;
  return prodKg > 0 ? prodNH3kg / prodKg : 0;
}
