/**
 * The sulphur family — a Claus sulphur recovery unit (SRU).
 *
 * The plant refineries and gas plants build when the amine unit has done its
 * job: the acid gas (H2S + CO2) arrives at ~1.4 bar, a burner oxidizes EXACTLY
 * one third of the H2S to SO2, and the SO2 then burns the remaining H2S in
 * the classic Claus equilibrium — burn a third, react the rest, condense the
 * sulphur, repeat catalytically. Once-through, low pressure, no loop: the
 * chemistry IS the plant. The teaching arc: the 2:1 H2S:SO2 ratio is the
 * heartbeat, and every condenser removal drags the equilibrium forward.
 */

import type { FlowGraph, StreamEdge, StreamState } from '@/lib/engine/graph';
import type { Kpis } from '@/lib/engine/types';
import { SP } from '@/lib/engine/species';
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
 * Canonical teaching topology: 9 units, 12 streams, no loop, no controller,
 * everything just above atmospheric. Stream conventions: S01 = acid gas,
 * S02 = air, S06/S09/S12 = liquid sulphur products, S11 = tail gas.
 *
 * Air sizing for the reference feed (1000 kmol/h acid gas at 85 % H2S):
 * burn ⅓ of 850 = 283.3 H2S → 425 O2 → 2029 air. The engineer retunes it
 * when the acid gas changes — that tuning IS the lesson.
 */
export function sulphurReferenceGraph(): FlowGraph {
  return {
    family: 'sulphur',
    units: [
      { id: 'SRC_AG', type: 'acid-gas-source', specs: {} },
      { id: 'SRC_AIR', type: 'air-source', specs: { flow: 2030, T: 150, P: 1.5 } },
      { id: 'B1', type: 'claus-burner', specs: {} },
      { id: 'E1', type: 'whb-cooler', specs: { outletT: 300, dp: 0.05 } },
      { id: 'SC1', type: 'sulphur-condenser', specs: { outletT: 165, dp: 0.03 } },
      { id: 'R1', type: 'claus-converter', specs: { bedT: 320, approach: 0.9, dp: 0.05 } },
      { id: 'SC2', type: 'sulphur-condenser', specs: { outletT: 160, dp: 0.03 } },
      { id: 'R2', type: 'claus-converter', specs: { bedT: 240, approach: 0.9, dp: 0.05 } },
      { id: 'SC3', type: 'sulphur-condenser', specs: { outletT: 155, dp: 0.03 } },
    ],
    streams: [
      e('S01', 'Acid gas feed', 'feed', { unit: 'SRC_AG', port: 'out' }, { unit: 'B1', port: 'acid' }),
      e('S02', 'Claus air', 'feed', { unit: 'SRC_AIR', port: 'out' }, { unit: 'B1', port: 'air' }),
      e('S03', 'Burner effluent', 'syngas', { unit: 'B1', port: 'out' }, { unit: 'E1', port: 'in' }),
      e('S04', 'Cooled effluent', 'syngas', { unit: 'E1', port: 'out' }, { unit: 'SC1', port: 'in' }),
      e('S05', 'Condenser 1 vapor', 'syngas', { unit: 'SC1', port: 'vapor' }, { unit: 'R1', port: 'in' }),
      e('S06', 'Liquid sulphur 1', 'product', { unit: 'SC1', port: 'sulphur' }, null),
      e('S07', 'Converter 1 effluent', 'syngas', { unit: 'R1', port: 'out' }, { unit: 'SC2', port: 'in' }),
      e('S08', 'Condenser 2 vapor', 'syngas', { unit: 'SC2', port: 'vapor' }, { unit: 'R2', port: 'in' }),
      e('S09', 'Liquid sulphur 2', 'product', { unit: 'SC2', port: 'sulphur' }, null),
      e('S10', 'Converter 2 effluent', 'syngas', { unit: 'R2', port: 'out' }, { unit: 'SC3', port: 'in' }),
      e('S11', 'Tail gas to incinerator', 'purge', { unit: 'SC3', port: 'vapor' }, null),
      e('S12', 'Liquid sulphur 3', 'product', { unit: 'SC3', port: 'sulphur' }, null),
    ],
    controllers: [],
  };
}

export const STAGES = [
  { n: 1 as const, label: 'THERMAL STAGE', blurb: 'burn EXACTLY a third of the H2S with controlled air — the SO2 it makes is the oxidizer for everything that follows' },
  { n: 2 as const, label: 'CATALYTIC STAGE', blurb: 'alumina beds at 320/240 °C finish the Claus equilibrium on the gas the condensers keep feeding them' },
  { n: 3 as const, label: 'CONDENSE & PRODUCT', blurb: 'condensers drain liquid sulphur between beds — every removal drags the equilibrium forward; what survives is tail gas' },
];

export const PRESENTATION: Record<string, { tag: string; label: string; stage: 1 | 2 | 3; role: string }> = {
  SRC_AG: { tag: 'AG-101', label: 'ACID GAS', stage: 1, role: 'amine-regenerator acid gas (85 mol % H2S) at 1.4 bar' },
  SRC_AIR: { tag: 'AIR-101', label: 'CLAUS AIR', stage: 1, role: 'controlled combustion air — sized to burn exactly ⅓ of the H2S' },
  B1: { tag: 'B-101', label: 'CLAUS BURNER', stage: 1, role: 'thermal reactor: burn ⅓, then flame equilibrium makes S2 (~½ of the sulphur)' },
  E1: { tag: 'E-101', label: 'WASTE HEAT BOILER', stage: 1, role: 'HP steam off the 1100 °C+ flame before the first condenser' },
  SC1: { tag: 'SC-101', label: 'CONDENSER 1', stage: 3, role: 'drains the thermal-stage sulphur to the pit' },
  R1: { tag: 'R-102', label: 'CONVERTER 1', stage: 2, role: 'alumina bed at 320 °C — converts most of the remaining H2S' },
  SC2: { tag: 'SC-102', label: 'CONDENSER 2', stage: 3, role: 'removal again — the equilibrium gets another push' },
  R2: { tag: 'R-103', label: 'CONVERTER 2', stage: 2, role: 'cooler alumina bed at 240 °C — equilibrium is kinder when cold' },
  SC3: { tag: 'SC-103', label: 'CONDENSER 3', stage: 3, role: 'last sulphur drain; what leaves is tail gas to the incinerator' },
};

export const PRIMER = `SULPHUR PRIMER (canonical teaching route — the Claus plant):
1. Feed: acid-gas-source (amine acid gas: H2S + CO2 + a little water, ~1.4 bar) + air-source. The air flow is a DECISION: size it to burn EXACTLY one third of the H2S (1 mol O2 per 2 mol H2S burned — H2S + 1.5 O2 -> SO2 + H2O).
2. claus-burner (thermal reactor): the flame burns the third, then the Claus equilibrium (4 H2S + 2 SO2 <-> 3 S2 + 4 H2O) runs at the adiabatic flame temperature — roughly half the total sulphur forms here as S2.
3. whb-cooler recovers HP steam off the flame; sulphur-condenser 1 drains the thermal-stage sulphur as liquid (130-170 C).
4. claus-converter 1 (alumina, bed inlet ~320 C) converts most of the remaining H2S; sulphur-condenser 2 drains it.
5. claus-converter 2 (cooler bed, ~240 C) squeezes further; sulphur-condenser 3 drains the last liquid sulphur.
6. Tail gas (H2S + SO2 slip, N2, CO2, water) leaves to the incinerator. NO recycle loop, NO controller, NO compression — the plant is once-through and just above atmospheric.
Unit spec defaults encode reference operating points — only set specs the brief asks for.`;

export function conventionsBlock(speciesDigest: string, catalogDigestText: string): string {
  return `PLANT CONVENTIONS (the plant-level KPI reader reads these exact ids):
- Unit ids: SRC_AG = acid gas source, SRC_AIR = air source, B1 = Claus burner, E1 = waste-heat boiler, SC1/SC2/SC3 = sulphur condensers, R1/R2 = Claus converters.
- Stream ids: S01 = acid gas, S02 = air, S06/S09/S12 = liquid sulphur products, S11 = tail gas.
- Stream classes: feed, syngas, loopgas, product, water, co2, purge.
- Species indexes: ${speciesDigest}.

STRUCTURAL RULES (the validator enforces these):
- Every inlet must be fed by exactly ONE stream. Every outlet must be connected (a stream with "to": null leaves the plant to the environment).
- NO recycle loop and NO controller in the sulphur family — the plant is once-through at LOW pressure (1.1-1.6 bar); do NOT call add_controller or place loop units (loop-mixer, circulator, purge-split, syngas-compressor).
- Air sizing (REQUIRED — the default air flow is the ammonia plant's, NOT yours): burn exactly ⅓ of the H2S. O2 = 0.5 × H2S flow; air = O2 / 0.2095. Worked example for the default feed (1000 kmol/h acid gas at 85 mol % H2S): H2S = 850 → burn 283.3 → O2 = 425 → set flow on the air-source to ≈ 2029 kmol/h BEFORE your first solve. Re-size it whenever the acid-gas flow or H2S % changes.

UNIT CATALOG (in/out ports with phase: gas/liquid; specs with ranges and defaults):
${catalogDigestText}`;
}

export const SULPHUR: PlantFamily = {
  id: 'sulphur',
  name: 'Sulphur',
  route: 'Claus SRU (burn a third, react the rest)',
  blurb: 'The Claus lesson: burn exactly ⅓ of the H2S so the SO2 can burn the other ⅔ — sulphur condenses between alumina beds, and the tail gas is what the incinerator is for.',
  productSpecies: 'S2',
  speciesOfInterest: ['H2S', 'SO2', 'S2', 'H2O', 'CO2'],
  hasLoop: false,
  stages: STAGES,
  presentation: PRESENTATION,
  primer: PRIMER,
  conventions: conventionsBlock,
  presets: [
    {
      label: 'Reference plant',
      text: 'Build the standard Claus sulphur recovery unit: acid gas feed at 85 mol % H2S, controlled air to burn exactly a third of it, thermal reactor with waste-heat boiler, then two catalytic alumina converters at 320 and 240 °C with sulphur condensers between and after each. Around 550 tonnes per day of liquid sulphur.',
    },
    {
      label: 'Lean acid gas',
      text: 'Build the standard Claus plant, but the acid gas is lean — only 55 mol % H2S, the rest CO2. Size the air properly for the new feed and report the sulphur recovery you achieve.',
    },
    {
      label: 'Max recovery',
      text: 'Build the standard Claus plant tuned for maximum sulphur recovery: retune the air ratio and the converter bed temperatures, and push recovery as high as the chemistry allows. Report recovery and tail-gas H2S slip.',
    },
  ],
  tourFocus: ['B1', 'E1', 'SC1', 'R1', 'R2', 'SC3'],
  referenceGraph: sulphurReferenceGraph,
  makeupStreamIds: ['S01'],
  tearGuess: (makeup: Moles): Moles => makeup.slice(),
  computeKpis(ctx: KpiCtx) {
    const { states, unitRecs, specs, graph } = ctx;
    const S = (id: string): StreamState | undefined => states[id];
    // structural first (equipment-anchored), S-id fallback
    const gs = graphStreams(graph, states);
    const condenserIds = graph.units.filter((u) => u.type === 'sulphur-condenser').map((u) => u.id);
    const burnerId = gs.unitIdOfType('claus-burner');
    const burner = burnerId ? unitRecs[burnerId] : undefined;

    // sulphur feed: every S atom in the acid gas (H2S + any SO2 carried in)
    const agFlow = (specs['SRC_AG']?.flow as number | undefined) ?? 0;
    const h2sPct = (specs['SRC_AG']?.h2sPct as number | undefined) ?? 85;
    const acidGas = gs.outOfType('acid-gas-source', 'out') ?? S('S01');
    const sFeedAtoms = acidGas ? acidGas.n[12] + acidGas.n[13] : (agFlow * h2sPct) / 100;

    // liquid sulphur products — every condenser's sulphur port
    let s2Liq = 0; // kmol/h S2 total
    const stageTpd: number[] = [];
    for (const cid of condenserIds) {
      const st = gs.outOf(cid, 'sulphur');
      if (!st) continue;
      s2Liq += st.n[14];
      stageTpd.push((st.n[14] * SP.S2.mw * 24) / 1000);
    }
    const sLiqAtoms = s2Liq * 2;
    const recovery = sFeedAtoms > 1e-9 ? sLiqAtoms / sFeedAtoms : 0;
    const sTpd = (s2Liq * SP.S2.mw * 24) / 1000;

    // tail gas — the vapor off the LAST condenser (or the S-id fallback)
    const lastCond = condenserIds[condenserIds.length - 1];
    const tail = (lastCond ? gs.outOf(lastCond, 'vapor') : undefined) ?? S('S11');
    const tailN = tail?.n ?? zeroN();
    const tailTot = total(tailN);
    const h2sSlip = tailTot > 0 ? (tailN[12] / tailTot) * 100 : 0;
    const so2Slip = tailTot > 0 ? (tailN[13] / tailTot) * 100 : 0;
    const ratio = tailN[13] > 1e-9 ? tailN[12] / tailN[13] : 0;

    // burner facts (measured, not claimed)
    const flameT = burner?.metrics?.[0]?.raw ?? 0;
    const thermalFrac = burner?.metrics?.[3]?.raw ?? 0;

    const kpis: Kpis = {
      productionTpd: sTpd,
      productPurityMol: s2Liq > 1e-9 ? 1 : 0, // liquid sulphur product is essentially pure
      productPurityWt: s2Liq > 1e-9 ? 1 : 0,
      perPassConv: recovery,
      overallConv: recovery,
      loopInerts: 0,
      h2n2Ratio: ratio, // repurposed: H2S:SO2 tail-gas ratio (the Claus heartbeat)
      makeupFlow: agFlow,
      recycleMultiple: 0,
      purgeFrac: 0,
      reformerDutyMW: 0,
      refrigerationDutyMW: 0,
      syngasComprPowerMW: 0,
      circulatorPowerKW: 0,
      specificEnergyGJt: 0,
      airFlow: (specs['SRC_AIR']?.flow as number | undefined) ?? 0,
      secondaryExitC: flameT,
      coSlipLTS: h2sSlip,
      oxidesAfterMeth: so2Slip,
      family: 'sulphur',
      productSpecies: 'S2',
      familyKpis: [
        { label: 'Sulphur recovery', value: `${(recovery * 100).toFixed(1)} % of feed S`, raw: recovery },
        { label: 'Liquid sulphur', value: `${sTpd.toFixed(0)} t/d`, raw: sTpd },
        { label: 'Thermal stage share', value: `${((thermalFrac || 0) * 100).toFixed(0)} % of total S`, raw: thermalFrac },
        { label: 'Stage split (t/d)', value: stageTpd.map((t) => t.toFixed(0)).join(' / ') },
        { label: 'Tail-gas H2S slip', value: `${h2sSlip.toFixed(2)} mol %`, raw: h2sSlip },
        { label: 'Tail-gas SO2 slip', value: `${so2Slip.toFixed(2)} mol %`, raw: so2Slip },
        { label: 'H2S:SO2 in tail gas', value: ratio > 0 ? `${ratio.toFixed(1)} : 1 (healthy ≈ 2)` : '—' },
        { label: 'Flame temperature', value: `${(flameT || 0).toFixed(0)} °C`, raw: flameT },
      ],
    };
    const warnings: string[] = [];
    if (recovery < 0.9 && sFeedAtoms > 1) {
      warnings.push(`sulphur recovery ${(recovery * 100).toFixed(1)} % is below the 90-97 % a healthy Claus plant achieves — check the air ratio (burn exactly ⅓ of the H2S) and the converter bed temperatures`);
    }
    if (h2sSlip > 1 && sFeedAtoms > 1) {
      warnings.push(`tail-gas H2S slip ${h2sSlip.toFixed(2)} mol % is high — the catalytic section is under-converting (bed temperatures or air ratio)`);
    }
    return { kpis, warnings };
  },
};
