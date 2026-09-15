import { AIR_COMP, ATOM_MATRIX, ATOMS, LHV_CH4, N_SP, SP, SPECIES } from './species';
import type { Moles } from './species';
import { enthalpyRate, massFlow, total } from './thermo';
import type {
  ElementBalance,
  Kpis,
  PlantResult,
  SolverTraceRow,
  Stream,
  UnitResult,
} from './types';
import { executeGraph } from './executor';
import { buildGraph } from './reference';
import {
  adiabaticEqReactor,
  compressorTrain,
  converterBed,
  cooler,
  co2Removal,
  flashDrum,
  isenthalpicFlash,
  mixStreams,
  methanator,
  phaseEnthalpyRate,
  primaryReformer,
  secondaryReformer,
  zeroN,
} from './units';

/**
 * Steam-methane-reforming ammonia flowsheet — sequential-modular solution.
 *
 * Front end (no recycle): feed mixer → primary reformer → secondary reformer
 * (dual-zone) → WHB → HTS → LTS → knockout → CO2 removal → methanator →
 * knockout → syngas compression.
 *
 * Synthesis loop (one tear): loop mixer → preheater → 3-bed converter →
 * condensation train → separator → purge split → circulator → back to mixer.
 *
 * Make-up is added AFTER condensation; purge taken BEFORE make-up (EFMA BAT
 * arrangement — research Q6). Air flow is the design DOF that sets make-up
 * H2/N2 = 3 (research C3), solved by a secant controller.
 */

const C = (celsius: number) => celsius + 273.15;
const BAR = (b: number) => b * 1e5;
const MW = (kJh: number) => kJh / 3.6e6;
const d1 = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));
const d2 = (x: number) => x.toFixed(2);

// ---------------------------------------------------------------------------
// Plant specification — every field is a UI-editable knob with a physical range
// ---------------------------------------------------------------------------

export interface PlantSpec {
  // feed & front end
  ngFeed: number; // kmol/h CH4            [100 .. 3000]
  steamCarbon: number; // mol/mol           [2.0 .. 5.0]
  frontEndP: number; // bar                 [20 .. 45]
  primaryT: number; // °C outlet            [700 .. 900]
  primaryATE: number; // K on CH4 eq        [0 .. 40]
  // secondary reformer
  airAuto: boolean; // H2/N2 controller on/off
  airFlow: number; // kmol/h (manual)       [100 .. 6000]
  h2n2Set: number; // make-up H2/N2 target  [2.5 .. 3.3]
  secondaryATE: number; // K on CH4 eq      [0 .. 80]
  // shift section
  htsInletT: number; // °C                  [300 .. 400]
  htsATE: number; // K                      [0 .. 50]
  ltsInletT: number; // °C                  [180 .. 240]
  ltsATE: number; // K                      [0 .. 60]
  // purification
  co2Residual: number; // ppmvd             [20 .. 2000]
  co2h2Slip: number; // fraction            [0 .. 0.010]
  methInletT: number; // °C                 [250 .. 360]
  // synthesis loop
  loopP: number; // bar                     [80 .. 250]
  bed1T: number; // °C                      [350 .. 450]
  bed2T: number; // °C                      [380 .. 470]
  bed3T: number; // °C                      [380 .. 460]
  bedApproach: [number, number, number]; // fractional [0.5 .. 0.99] per bed
  chillT: number; // °C                     [-40 .. 30]
  purgeFrac: number; // of separator gas    [0.01 .. 0.25]
  // machinery
  comprStages: number; // 1..5
  etaP: number; // polytropic eff.          [0.60 .. 0.85]
  dpConverter: number; // bar               [1 .. 8]
  dpCondenser: number; // bar               [1 .. 6]
}

export function baseCase(): PlantSpec {
  return {
    ngFeed: 1000,
    steamCarbon: 3.0,
    frontEndP: 30,
    primaryT: 805,
    primaryATE: 10,
    airAuto: true,
    airFlow: 1560,
    h2n2Set: 3.0,
    secondaryATE: 30,
    htsInletT: 340,
    htsATE: 20,
    ltsInletT: 205,
    ltsATE: 15,
    co2Residual: 300,
    co2h2Slip: 0.003,
    methInletT: 300,
    loopP: 150,
    bed1T: 400,
    bed2T: 430,
    bed3T: 415,
    bedApproach: [0.9, 0.9, 0.9],
    chillT: -20,
    purgeFrac: 0.028,
    comprStages: 3,
    etaP: 0.75,
    dpConverter: 3,
    dpCondenser: 2,
  };
}

// fixed internal conditions (documented; promoted to specs in later phases)
const STEAM_T = C(400);
const AIR_T = C(180);
const KO_T = C(40);
const INTERCOOL_T = C(40);
const WC_T = C(35); // cooling-water temperature (splits condenser duty)

// pressure cascade offsets from frontEndP, bar
const DP = {
  mixer: 1,
  primary: 0,
  secondary: 1.5,
  whb: 2,
  hts: 2.5,
  ltsIn: 3,
  lts: 3.5,
  ko1: 4,
  co2: 5,
  meth: 5.5,
  ko2: 6,
} as const;

interface FrontEnd {
  streams: Record<string, Stream>;
  units: Record<string, UnitResult>;
  makeup: Moles;
  warnings: string[];
}

const st = (id: string, name: string, T: number, P: number, n: Moles, cls: Stream['cls']): Stream => ({
  id,
  name,
  T,
  P,
  n,
  cls,
});

/** One sequential pass through the front end at a given air flow. */
export function frontEndPass(spec: PlantSpec, airKmol: number): FrontEnd {
  const streams: Record<string, Stream> = {};
  const units: Record<string, UnitResult> = {};
  const warnings: string[] = [];
  const P0 = spec.frontEndP;

  // ---- feed section ----
  const ng: Moles = zeroN();
  ng[4] = spec.ngFeed;
  const steam: Moles = zeroN();
  steam[7] = spec.ngFeed * spec.steamCarbon;
  const air: Moles = AIR_COMP.map((f) => f * airKmol);

  const ngS = st('S01', 'Natural gas feed', C(40), BAR(P0 + 2), ng, 'feed');
  const steamS = st('S02', 'Process steam', STEAM_T, BAR(P0 + 2), steam, 'feed');
  const airS = st('S05', 'Process air', AIR_T, BAR(P0 + 0.5), air, 'feed');
  streams.S01 = ngS;
  streams.S02 = steamS;
  streams.S05 = airS;

  const mixed = mixStreams(
    [
      { n: ng, T: C(40), P: BAR(P0 + 2) },
      { n: steam, T: STEAM_T, P: BAR(P0 + 2) },
    ],
    BAR(P0 + DP.mixer),
  );
  streams.S03 = st('S03', 'Mixed feed', mixed.T, BAR(P0 + DP.mixer), mixed.n, 'syngas');
  units.M1 = {
    id: 'M1',
    name: 'Feed mixer',
    model: 'Adiabatic mixing of natural gas and process steam',
    metrics: [
      { label: 'Mixed flow', value: `${d1(total(mixed.n))} kmol/h` },
      { label: 'Steam/carbon', value: d2(spec.steamCarbon) },
      { label: 'Mixer outlet T', value: `${d1(mixed.T - 273.15)} °C` },
    ],
    warnings: [],
  };

  // ---- primary reformer ----
  const pP = BAR(P0 + DP.primary);
  const prim = primaryReformer(mixed.n, mixed.T, C(spec.primaryT), pP, spec.primaryATE, 10);
  streams.S04 = st('S04', 'Primary effluent', prim.T, pP, prim.n, 'syngas');
  if (!prim.reached) warnings.push('R1: CH4 equilibrium not reachable within bounds');
  units.R1 = {
    id: 'R1',
    name: 'Primary reformer',
    model: 'Fired furnace — SMR + WGS equilibrium at outlet T (K_SR1, K_WGS; ATE on CH4)',
    metrics: [
      { label: 'Furnace duty', value: `${d1(MW(prim.dutyKJh))} MW`, raw: MW(prim.dutyKJh) },
      { label: 'Outlet T', value: `${d1(prim.T - 273.15)} °C` },
      { label: 'CH4 slip (dry)', value: `${(prim.ch4SlipDry * 100).toFixed(2)} %` },
      { label: 'H2 (dry)', value: `${(prim.h2Dry * 100).toFixed(1)} %` },
      { label: 'CH4 conversion', value: `${d1((1 - prim.n[4] / Math.max(ng[4], 1e-9)) * 100)} %` },
    ],
    warnings: prim.reached ? [] : ['equilibrium not reached'],
  };

  // ---- secondary reformer (dual zone) ----
  const secP = BAR(P0 - DP.secondary);
  const sec = secondaryReformer(prim.n, prim.T, air, AIR_T, secP, spec.secondaryATE, 15);
  streams.S06 = st('S06', 'Secondary effluent', sec.T, secP, sec.n, 'syngas');
  units.R2 = {
    id: 'R2',
    name: 'Secondary reformer',
    model: 'Zone 1 adiabatic H2 combustion → Zone 2 catalytic SMR+WGS equilibrium (research C3)',
    metrics: [
      { label: 'Combustion-zone T', value: `${d1(sec.tCombust - 273.15)} °C`, raw: sec.tCombust },
      { label: 'Catalytic exit T', value: `${d1(sec.T - 273.15)} °C`, raw: sec.T },
      { label: 'CH4 slip (dry)', value: `${(sec.ch4SlipDry * 100).toFixed(2)} %` },
      { label: 'CO (dry)', value: `${(sec.coDry * 100).toFixed(1)} %` },
      { label: 'O2 remaining', value: `${d2(sec.o2Remaining)} kmol/h` },
    ],
    warnings: sec.o2Remaining > 0.5 ? ['residual O2 after combustion zone'] : [],
  };

  // ---- WHB + HTS ----
  const whbP = BAR(P0 - DP.whb);
  const whb = cooler(sec.n, sec.T, C(spec.htsInletT), whbP);
  streams.S07 = st('S07', 'HTS feed', whb.T, whbP, whb.n, 'syngas');
  units.E1 = {
    id: 'E1',
    name: 'Waste-heat boiler',
    model: 'Cools secondary effluent to HTS inlet (HP steam generation implied)',
    metrics: [{ label: 'Duty', value: `${d1(MW(whb.dutyKJh))} MW`, raw: MW(whb.dutyKJh) }],
    warnings: [],
  };

  const htsP = BAR(P0 - DP.hts);
  const hts = adiabaticEqReactor(whb.n, whb.T, htsP, false, 0, spec.htsATE);
  streams.S08 = st('S08', 'HTS effluent', hts.TOut, htsP, hts.n, 'syngas');
  units.R3 = {
    id: 'R3',
    name: 'High-temp shift',
    model: 'Adiabatic WGS equilibrium on Fe-Cr catalyst (methane reactions frozen)',
    metrics: [
      { label: 'Outlet T', value: `${d1(hts.TOut - 273.15)} °C` },
      { label: 'CO (dry)', value: `${(hts.coDry * 100).toFixed(2)} %` },
      { label: 'ΔT (adiabatic rise)', value: `${d1(hts.TOut - whb.T)} K` },
    ],
    warnings: [],
  };

  // ---- LTS ----
  const ltsInP = BAR(P0 - DP.ltsIn);
  const ltsIn = cooler(hts.n, hts.TOut, C(spec.ltsInletT), ltsInP);
  streams.S09 = st('S09', 'LTS feed', ltsIn.T, ltsInP, ltsIn.n, 'syngas');
  units.E4 = {
    id: 'E4',
    name: 'Shift intercooler',
    model: 'Cools HTS effluent to LTS inlet',
    metrics: [{ label: 'Duty', value: `${d1(MW(ltsIn.dutyKJh))} MW`, raw: MW(ltsIn.dutyKJh) }],
    warnings: [],
  };

  const ltsP = BAR(P0 - DP.lts);
  const lts = adiabaticEqReactor(ltsIn.n, ltsIn.T, ltsP, false, 0, spec.ltsATE);
  streams.S10 = st('S10', 'LTS effluent', lts.TOut, ltsP, lts.n, 'syngas');
  units.R4 = {
    id: 'R4',
    name: 'Low-temp shift',
    model: 'Adiabatic WGS equilibrium on Cu-Zn catalyst (methane reactions frozen)',
    metrics: [
      { label: 'Outlet T', value: `${d1(lts.TOut - 273.15)} °C` },
      { label: 'CO (dry)', value: `${(lts.coDry * 100).toFixed(3)} %` },
      { label: 'ΔT (adiabatic rise)', value: `${d1(lts.TOut - ltsIn.T)} K` },
    ],
    warnings: [],
  };

  // ---- knockout 1 ----
  const ko1P = BAR(P0 - DP.ko1);
  const ko1 = flashDrum(lts.n, lts.TOut, KO_T, ko1P, 7);
  streams.S11 = st('S11', 'Treated gas (KO1 vapor)', KO_T, ko1P, ko1.vapor, 'syngas');
  streams.S12 = st('S12', 'Condensate to BFW', KO_T, ko1P, ko1.liquid, 'water');
  units.V1 = {
    id: 'V1',
    name: 'Knockout drum 1',
    model: 'PT flash (Peng-Robinson) — condenses shift steam',
    metrics: [
      { label: 'Condensate', value: `${d1(massFlow(ko1.liquid))} kg/h` },
      { label: 'Vapor fraction', value: d2(ko1.beta) },
    ],
    warnings: [],
  };

  // ---- CO2 removal ----
  const co2P = BAR(P0 - DP.co2);
  const co2 = co2Removal(ko1.vapor, spec.co2Residual, spec.co2h2Slip);
  streams.S13 = st('S13', 'CO2-lean gas', C(45), co2P, co2.gas, 'syngas');
  streams.S14 = st('S14', 'CO2 to storage', C(60), BAR(1.8), co2.offgas, 'co2');
  units.A1 = {
    id: 'A1',
    name: 'CO2 removal',
    model: 'aMDEA black box — spec residual ppmvd and H2 co-absorption (research Q5)',
    metrics: [
      { label: 'CO2 removed', value: `${d1(co2.co2Removed)} kmol/h` },
      { label: 'Residual CO2', value: `${d1(co2.residualPpm)} ppmvd` },
      { label: 'H2 slip', value: `${d1(co2.offgas[0])} kmol/h` },
      { label: 'Regeneration duty', value: `${d1(MW(co2.co2Removed * 45e3))} MW (est. 45 MJ/kmol)` },
    ],
    warnings: [],
  };

  // ---- methanator ----
  const methP = BAR(P0 - DP.meth);
  const meth = methanator(co2.gas, C(spec.methInletT), methP);
  const oxidesPpm = meth.oxidesPpmDry;
  streams.S15 = st('S15', 'Methanator effluent', meth.TOut, methP, meth.n, 'syngas');
  units.R5 = {
    id: 'R5',
    name: 'Methanator',
    model: 'Adiabatic CO/CO2 methanation equilibrium — carbon oxides to ppm',
    metrics: [
      { label: 'Outlet T', value: `${d1(meth.TOut - 273.15)} °C` },
      { label: 'CO+CO2 out', value: `${d1(oxidesPpm)} ppmvd` },
      { label: 'ΔT (rise)', value: `${d1(meth.TOut - C(spec.methInletT))} K` },
    ],
    warnings: oxidesPpm > 10 ? ['carbon oxides above 10 ppm — synthesis catalyst at risk'] : [],
  };

  // ---- knockout 2 ----
  const ko2P = BAR(P0 - DP.ko2);
  const ko2 = flashDrum(meth.n, meth.TOut, KO_T, ko2P, 7);
  streams.S16 = st('S16', 'Make-up syngas', KO_T, ko2P, ko2.vapor, 'syngas');
  streams.S17 = st('S17', 'Condensate to BFW', KO_T, ko2P, ko2.liquid, 'water');
  units.V2 = {
    id: 'V2',
    name: 'Knockout drum 2',
    model: 'PT flash (Peng-Robinson) — removes methanation water',
    metrics: [
      { label: 'Condensate', value: `${d1(massFlow(ko2.liquid))} kg/h` },
      { label: 'Vapor fraction', value: d2(ko2.beta) },
    ],
    warnings: [],
  };

  return { streams, units, makeup: ko2.vapor, warnings };
}

// ---------------------------------------------------------------------------
// Synthesis loop
// ---------------------------------------------------------------------------

interface LoopPass {
  streams: Record<string, Stream>;
  units: Record<string, UnitResult>;
  /** g(x): new converter-feed flows implied by tear value x */
  g: Moles;
  warnings: string[];
  product: Moles;
  purge: Moles;
  recycle: Moles;
  nFeed: Moles;
  nEff: Moles;
}

export function loopPass(spec: PlantSpec, makeup: Moles, tear: Moles): LoopPass {
  const streams: Record<string, Stream> = {};
  const units: Record<string, UnitResult> = {};
  const warnings: string[] = [];
  const loopP = BAR(spec.loopP);
  const feedP = loopP;

  // converter: 3 adiabatic beds with interbed cooling
  const beds: Array<{ n: Moles; T: number; xi: number; nh3Out: number; nh3In: number }> = [];
  let cur = { n: tear, T: C(spec.bed1T) };
  const bedTs = [C(spec.bed1T), C(spec.bed2T), C(spec.bed3T)];
  let interbedDuty = 0;
  for (let b = 0; b < 3; b++) {
    const bed = converterBed(cur.n, cur.T, feedP, spec.bedApproach[b]);
    beds.push({ n: bed.n, T: bed.TOut, xi: bed.xi, nh3Out: bed.nh3Out, nh3In: bed.nh3In });
    if (b < 2) {
      const nextT = Math.min(bed.TOut, bedTs[b + 1]);
      interbedDuty += enthalpyRate(bed.n, bed.TOut) - enthalpyRate(bed.n, nextT);
      cur = { n: bed.n, T: nextT };
    } else {
      cur = { n: bed.n, T: bed.TOut };
    }
  }
  const nEff = cur.n;
  const tEff = cur.T;
  const effP = BAR(spec.loopP - spec.dpConverter);
  streams.S20 = st('S20', 'Converter feed', C(spec.bed1T), feedP, tear, 'loopgas');
  streams.S21 = st('S21', 'Converter effluent', tEff, effP, nEff, 'loopgas');
  const totIn = total(tear);
  const totOut = total(nEff);
  const nh3InPct = totIn > 0 ? (tear[6] / totIn) * 100 : 0;
  const nh3OutPct = totOut > 0 ? (nEff[6] / totOut) * 100 : 0;
  const perPass = tear[1] > 1e-9 ? (1 - nEff[1] / tear[1]) * 100 : 0;
  const bedMetrics = beds.flatMap((b, i) => [
    { label: `Bed ${i + 1} NH3 in→out`, value: `${(b.nh3In * 100).toFixed(1)} → ${(b.nh3Out * 100).toFixed(1)} %` },
    { label: `Bed ${i + 1} outlet T`, value: `${d1(b.T - 273.15)} °C` },
  ]);
  units.R6 = {
    id: 'R6',
    name: 'Synthesis converter',
    model: '3 adiabatic beds, fractional approach to G-B equilibrium per bed (research C1)',
    metrics: [
      ...bedMetrics,
      { label: 'NH3 (converter in→out)', value: `${nh3InPct.toFixed(1)} → ${nh3OutPct.toFixed(1)} %` },
      { label: 'Per-pass N2 conversion', value: `${d1(perPass)} %`, raw: perPass },
      { label: 'Interbed duty', value: `${d1(MW(interbedDuty))} MW` },
    ],
    warnings: [],
  };

  // condensation train: water cooler → refrigerated chiller (phase-aware duty:
  // PR residual enthalpy captures the NH3 latent heat)
  const condP = BAR(spec.loopP - spec.dpConverter - spec.dpCondenser);
  const wc = cooler(nEff, tEff, WC_T, condP);
  const ch = cooler(wc.n, wc.T, C(spec.chillT), condP);
  const chillDuty =
    phaseEnthalpyRate(wc.n, WC_T, condP, 'vapor') -
    (phaseEnthalpyRate(ch.n, C(spec.chillT), condP, 'vapor') +
      0); // gas-side only here; latent part added at the separator below
  streams.S22 = st('S22', 'Chilled loop gas', ch.T, condP, ch.n, 'loopgas');

  // separator
  const sep = flashDrum(ch.n, ch.T, ch.T, condP, 6);
  // true condensation duty (feed vapor → two-phase product) with PR departure
  const condDuty =
    phaseEnthalpyRate(nEff, tEff, BAR(spec.loopP - spec.dpConverter), 'vapor') -
    (phaseEnthalpyRate(sep.vapor, ch.T, condP, 'vapor') +
      phaseEnthalpyRate(sep.liquid, ch.T, condP, 'liquid'));
  // refrigeration portion: everything below cooling-water temperature
  const refrDuty =
    phaseEnthalpyRate(nEff, WC_T, BAR(spec.loopP - spec.dpConverter), 'vapor') -
    (phaseEnthalpyRate(sep.vapor, ch.T, condP, 'vapor') +
      phaseEnthalpyRate(sep.liquid, ch.T, condP, 'liquid'));
  void chillDuty;

  streams.S24S = st('S24S', 'Separator liquid', sep.T, condP, sep.liquid, 'product');
  streams.S25 = st('S25', 'Separator gas', sep.T, condP, sep.vapor, 'loopgas');

  // product letdown drum: isenthalpic flash to 2 bar — self-refrigerating
  // degassing of dissolved H2/N2/CH4/Ar (vapor to purge, liquid to storage)
  const LETDOWN_P = BAR(2);
  const letdown = isenthalpicFlash(sep.liquid, sep.T, condP, LETDOWN_P);
  streams.S24 = st('S24', 'Liquid ammonia product', letdown.T, LETDOWN_P, letdown.liquid, 'product');
  const prodTpd = (massFlow(letdown.liquid) * 24) / 1000;
  const prodKg = massFlow(letdown.liquid);
  const prodNH3kg = letdown.liquid[6] * SP.NH3.mw;
  const recovered = nEff[6] > 1e-9 ? letdown.liquid[6] / nEff[6] : 0;
  const sepMolPurity = total(letdown.liquid) > 0 ? letdown.liquid[6] / total(letdown.liquid) : 0;
  units.E2 = {
    id: 'E2',
    name: 'Condensation train',
    model: 'Water cooler (35 °C) + refrigerated chiller — PR residual enthalpy for latent heat',
    metrics: [
      { label: 'Condensation duty', value: `${d1(MW(condDuty))} MW`, raw: MW(condDuty) },
      { label: 'Refrigeration duty', value: `${d1(MW(refrDuty))} MW`, raw: MW(refrDuty) },
      { label: 'Refrig. shaft power', value: `${d1(MW(refrDuty) / 2.4)} MW (COP 2.4)` },
    ],
    warnings: [],
  };
  units.V3 = {
    id: 'V3',
    name: 'Ammonia separator + letdown',
    model: 'PT flash at loop P, then product letdown to 2 bar (degassing)',
    metrics: [
      { label: 'Product', value: `${d1(prodTpd)} t/d`, raw: prodTpd },
      {
        label: 'Purity',
        value: `${(sepMolPurity * 100).toFixed(2)} mol % / ${((prodNH3kg / Math.max(prodKg, 1e-9)) * 100).toFixed(2)} wt %`,
      },
      { label: 'NH3 recovered', value: `${(recovered * 100).toFixed(1)} %` },
      { label: 'Separator T', value: `${d1(sep.T - 273.15)} °C` },
      { label: 'Letdown T', value: `${d1(letdown.T - 273.15)} °C / 2 bar` },
      { label: 'Flashed vapor', value: `${(letdown.flashedFrac * 100).toFixed(1)} % of liquid` },
    ],
    warnings: letdown.liquid[6] <= 0 ? ['no ammonia condensation — check separator T'] : [],
  };

  // purge split (letdown vapor joins the purge stream — fuel gas)
  const purgeN = sep.vapor.map((v, i) => v * spec.purgeFrac + letdown.vapor[i]);
  const recycleN = sep.vapor.map((v) => v * (1 - spec.purgeFrac));
  streams.S26 = st('S26', 'Purge to fuel', sep.T, condP, purgeN, 'purge');
  streams.S27 = st('S27', 'Recycle gas', sep.T, condP, recycleN, 'loopgas');
  units.SP1 = {
    id: 'SP1',
    name: 'Purge split',
    model: 'Controls loop inert inventory (CH4 + Ar from make-up and air)',
    metrics: [
      { label: 'Purge flow', value: `${d1(total(purgeN))} kmol/h` },
      { label: 'Purge fraction', value: `${(spec.purgeFrac * 100).toFixed(1)} %` },
      { label: 'Purge NH3 loss', value: `${d1((purgeN[6] * SP.NH3.mw * 24) / 1000)} t/d` },
    ],
    warnings: [],
  };

  // circulator
  const circ = compressorTrain(recycleN, sep.T, condP, loopP, 1, spec.etaP, C(40));
  streams.S23 = st('S23', 'Circulator discharge', circ.T, loopP, circ.n, 'loopgas');
  units.C2 = {
    id: 'C2',
    name: 'Loop circulator',
    model: 'Single-stage centrifugal booster, polytropic',
    metrics: [
      { label: 'Shaft power', value: `${d1(circ.powerKW)} kW`, raw: circ.powerKW },
      { label: 'Boost', value: `${(condP / 1e5).toFixed(1)} → ${spec.loopP.toFixed(1)} bar` },
      { label: 'Discharge T', value: `${d1(circ.T - 273.15)} °C` },
    ],
    warnings: [],
  };

  // loop mixer (make-up after condensation, after purge — EFMA BAT)
  const mix = mixStreams(
    [
      { n: makeup, T: KO_T, P: loopP },
      { n: circ.n, T: circ.T, P: loopP },
    ],
    loopP,
  );
  streams.S18 = st('S18', 'HP make-up syngas', KO_T, loopP, makeup, 'syngas');
  streams.S19 = st('S19', 'Loop mix', mix.T, loopP, mix.n, 'loopgas');
  units.M2 = {
    id: 'M2',
    name: 'Loop mixer',
    model: 'Make-up added after condensation, after purge (EFMA BAT arrangement)',
    metrics: [
      { label: 'Converter feed', value: `${d1(total(mix.n))} kmol/h` },
      { label: 'Recycle multiple', value: d2(total(recycleN) / Math.max(total(makeup), 1e-9)) },
      { label: 'Mixed T', value: `${d1(mix.T - 273.15)} °C` },
    ],
    warnings: [],
  };
  units.E3 = {
    id: 'E3',
    name: 'Feed preheater',
    model: `Implied feed/effluent exchange to bed-1 inlet (${spec.bed1T.toFixed(0)} °C)`,
    metrics: [
      {
        label: 'Preheat duty',
        value: `${d1(MW(enthalpyRate(mix.n, C(spec.bed1T)) - enthalpyRate(mix.n, mix.T)))} MW`,
      },
    ],
    warnings: [],
  };

  return {
    streams,
    units,
    g: mix.n,
    warnings,
    product: letdown.liquid,
    purge: purgeN,
    recycle: recycleN,
    nFeed: tear,
    nEff,
  };
}

/** Solve a 9×9 (N_SP×N_SP) dense linear system by Gaussian elimination
 *  with partial pivoting. Returns null if singular. */
function solveLinear9(AIn: number[][], b: number[]): number[] | null {
  const n = AIn.length;
  const A = AIn.map((row) => row.slice());
  const x = b.slice();
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    if (Math.abs(A[piv][col]) < 1e-14) return null;
    if (piv !== col) {
      const tmpRow = A[piv];
      A[piv] = A[col];
      A[col] = tmpRow;
      const tmpX = x[piv];
      x[piv] = x[col];
      x[col] = tmpX;
    }
    const d = A[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      x[r] -= f * x[col];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / A[r][r];
    if (!Number.isFinite(x[r])) return null;
  }
  return x;
}

// ---------------------------------------------------------------------------
// Air controller — secant on air flow to hit make-up H2/N2 (research C3)
// ---------------------------------------------------------------------------

function solveAir(spec: PlantSpec): { air: number; fe: FrontEnd; err: number | null } {
  if (!spec.airAuto) {
    const fe = frontEndPass(spec, spec.airFlow);
    return { air: spec.airFlow, fe, err: null };
  }
  let x0 = Math.max(200, 1.3 * spec.ngFeed);
  let x1 = Math.max(300, 1.6 * spec.ngFeed);
  const f = (air: number) => {
    const fe = frontEndPass(spec, air);
    const n2 = fe.makeup[1];
    const h2 = fe.makeup[0];
    return { val: n2 > 1e-9 ? h2 / n2 - spec.h2n2Set : 0, fe };
  };
  let r0 = f(x0);
  let r1 = f(x1);
  // maintain bracket [xLo, xHi] with f(xLo) > 0 > f(xHi) (f decreasing in air)
  let xLo = r0.val > r1.val ? x0 : x1;
  let xHi = r0.val > r1.val ? x1 : x0;
  let fLo = Math.max(r0.val, r1.val);
  let fHi = Math.min(r0.val, r1.val);
  let best = Math.abs(r1.val) < Math.abs(r0.val) ? { air: x1, fe: r1.fe, err: r1.val } : { air: x0, fe: r0.fe, err: r0.val };

  for (let k = 0; k < 30; k++) {
    if (Math.abs(best.err ?? 1) < 0.003) break;
    // secant step
    let x2: number;
    if (Math.abs(r1.val - r0.val) < 1e-12) {
      x2 = 0.5 * (xLo + xHi);
    } else {
      x2 = x1 - (r1.val * (x1 - x0)) / (r1.val - r0.val);
    }
    if (x2 < 50 || x2 > 20000 || x2 < xLo || x2 > xHi) x2 = 0.5 * (xLo + xHi);
    const r2 = f(x2);
    if (Math.abs(r2.val) < Math.abs(best.err ?? 1)) best = { air: x2, fe: r2.fe, err: r2.val };
    if (r2.val > 0) {
      xLo = x2;
      fLo = r2.val;
    } else {
      xHi = x2;
      fHi = r2.val;
    }
    x0 = x1;
    r0 = r1;
    x1 = x2;
    r1 = r2;
  }
  return { air: best.air, fe: best.fe, err: best.err };
}

// ---------------------------------------------------------------------------
// Public solve entry points
// ---------------------------------------------------------------------------

/**
 * runLegacy — the ORIGINAL hand-wired implementation, kept VERBATIM as the
 * identity oracle for Engine 2.0: scripts/graph-tests.ts asserts
 * run(spec) ≡ runLegacy(spec) across the spec envelope. Once D2's agent
 * builds plants through the graph path and the gate has baked, this
 * function (plus frontEndPass/loopPass/solveAir) gets deleted.
 */
export function runLegacy(spec: PlantSpec): PlantResult {
  const t0 = performance.now();
  const warnings: string[] = [];

  // 1) front end with air controller
  const { air, fe, err: h2n2Resid } = solveAir(spec);
  const streams: Record<string, Stream> = { ...fe.streams };
  const units: Record<string, UnitResult> = { ...fe.units };
  if (h2n2Resid !== null && Math.abs(h2n2Resid) > 0.01) {
    warnings.push(`H2/N2 controller did not fully converge (residual ${h2n2Resid.toFixed(3)})`);
  }

  // syngas compressor
  const c1InP = BAR(spec.frontEndP - DP.ko2);
  const c1 = compressorTrain(fe.makeup, KO_T, c1InP, BAR(spec.loopP), spec.comprStages, spec.etaP, INTERCOOL_T);
  units.C1 = {
    id: 'C1',
    name: 'Syngas compressor',
    model: `${spec.comprStages}-stage polytropic train with intercooling (research Q7)`,
    metrics: [
      { label: 'Shaft power', value: `${d1(c1.powerKW / 1000)} MW`, raw: c1.powerKW / 1000 },
      { label: 'Stage ratio', value: d2(c1.stageRatios[0]) },
      { label: 'Discharge', value: `${d1(c1.T - 273.15)} °C / ${spec.loopP} bar` },
      { label: 'Intercooling duty', value: `${d1(MW(c1.intercoolDutyKJh))} MW` },
    ],
    warnings: [],
  };

  // 2) synthesis loop — tear on converter-feed flows
  const makeup = fe.makeup;
  const makeupTot = total(makeup);
  // initial tear: close to expected answer (research Q9 tip)
  const tear0: Moles = zeroN();
  const f0 = makeupTot * 5;
  const y0 = new Array(N_SP).fill(0); // H2 N2 CO CO2 CH4 AR NH3 H2O O2 (+ appended species → 0)
  const base = [0.58, 0.195, 0, 0, 0.11, 0.033, 0.025, 0, 0];
  for (let i = 0; i < Math.min(base.length, N_SP); i++) y0[i] = base[i];
  for (let i = 0; i < N_SP; i++) tear0[i] = f0 * y0[i];

  const trace: SolverTraceRow[] = [];
  let converged = false;
  let iterations = 0;
  const TOL = 1e-7;
  const MAXIT = 60;

  // convergence residual: flow mismatch AND atom-balance mismatch scaled by
  // each element's own make-up atom flow (Ar is tiny vs total — a /total scale
  // would hide inert mismatches that still break the element balance)
  const makeupAtoms: number[] = ATOMS.map((_, e) => {
    let s = 0;
    for (let i = 0; i < N_SP; i++) s += ATOM_MATRIX[e][i] * makeup[i];
    return Math.max(s, 1);
  });
  const resid = (a: Moles, b: Moles): number => {
    const scale = Math.max(total(b), 1e-9);
    let worst = 0;
    for (let i = 0; i < N_SP; i++) {
      worst = Math.max(worst, Math.abs(a[i] - b[i]) / scale);
    }
    for (let e = 0; e < ATOMS.length; e++) {
      let s = 0;
      for (let i = 0; i < N_SP; i++) s += ATOM_MATRIX[e][i] * (a[i] - b[i]);
      worst = Math.max(worst, Math.abs(s) / makeupAtoms[e]);
    }
    return worst;
  };

  // --- stage 1: damped direct substitution to enter the basin ---
  let x = tear0.slice();
  let pass = loopPass(spec, makeup, x);
  let g = pass.g;
  let lastPass: LoopPass = pass;
  let err = resid(g, x);
  trace.push({ iter: 1, err, method: 'damped-DS' });
  let gPrev: Moles = g.slice();
  let xPrevDS: Moles = x.slice();
  for (let k = 1; k < 4; k++) {
    const xOld = x;
    x = x.map((v, i) => v + 0.5 * (g[i] - v));
    pass = loopPass(spec, makeup, x);
    lastPass = pass;
    gPrev = g;
    xPrevDS = xOld;
    g = pass.g;
    err = resid(g, x);
    trace.push({ iter: k + 1, err, method: 'damped-DS' });
  }

  // --- stage 2: Broyden quasi-Newton on F(x) = g(x) − x ---
  // initial diagonal Jacobian from the last DS secant
  const J: number[][] = Array.from({ length: N_SP }, () => new Array(N_SP).fill(0));
  for (let i = 0; i < N_SP; i++) {
    const dxi = x[i] - xPrevDS[i];
    const dgi = g[i] - gPrev[i];
    J[i][i] = Math.abs(dxi) > 1e-12 ? Math.max(-0.99, Math.min(0.99, dgi / dxi - 1)) : -0.5;
  }

  let lastImprovementIter = 4;
  let iter = 4;
  for (; iter < MAXIT; iter++) {
    err = resid(g, x);
    if (err < TOL) {
      converged = true;
      break;
    }
    // F = g − x ; solve J·dx = x − g
    const F: Moles = g.map((v, i) => v - x[i]);
    const rhs = F.map((v) => -v);
    const dx = solveLinear9(J, rhs);
    if (!dx) {
      // singular → damped DS fallback
      x = x.map((v, i) => v + 0.5 * (g[i] - v));
      pass = loopPass(spec, makeup, x);
      g = pass.g;
      trace.push({ iter: iter + 1, err: resid(g, x), method: 'damped-DS' });
      continue;
    }
    // trust region: cap the step
    let xMax = 0;
    for (let i = 0; i < N_SP; i++) xMax = Math.max(xMax, x[i]);
    let stepMax = 0;
    for (let i = 0; i < N_SP; i++) stepMax = Math.max(stepMax, Math.abs(dx[i]));
    const cap = 0.6 * Math.max(xMax, 1);
    if (stepMax > cap) for (let i = 0; i < N_SP; i++) dx[i] *= cap / stepMax;

    let xn: Moles = x.map((v, i) => Math.max(0, v + dx[i]));
    let passN = loopPass(spec, makeup, xn);
    let gn = passN.g;
    let errN = resid(gn, xn);
    // step-limiting: halve while clearly worse
    let tries = 0;
    while (errN > 3 * err && tries < 3) {
      for (let i = 0; i < N_SP; i++) dx[i] *= 0.5;
      xn = x.map((v, i) => Math.max(0, v + dx[i]));
      passN = loopPass(spec, makeup, xn);
      gn = passN.g;
      errN = resid(gn, xn);
      tries++;
    }

    // good Broyden rank-1 update: J += (dF − J·dx)·dxᵀ / (dxᵀdx)
    let dxdx = 0;
    for (let i = 0; i < N_SP; i++) dxdx += dx[i] * dx[i];
    if (dxdx > 1e-20) {
      const Jdx = new Array(N_SP).fill(0);
      for (let i = 0; i < N_SP; i++) {
        let s = 0;
        for (let j = 0; j < N_SP; j++) s += J[i][j] * dx[j];
        Jdx[i] = s;
      }
      const dF = new Array(N_SP).fill(0);
      for (let i = 0; i < N_SP; i++) dF[i] = gn[i] - xn[i] - F[i];
      for (let i = 0; i < N_SP; i++) {
        const coef = (dF[i] - Jdx[i]) / dxdx;
        for (let j = 0; j < N_SP; j++) J[i][j] += coef * dx[j];
      }
    }

    if (errN < err) lastImprovementIter = iter;
    x = xn;
    g = gn;
    pass = passN;
    lastPass = passN;
    trace.push({ iter: iter + 1, err: errN, method: 'broyden' });
    // stalled Broyden → reset the Jacobian to a fresh diagonal secant
    if (iter - lastImprovementIter > 6) {
      for (let i = 0; i < N_SP; i++) {
        for (let j = 0; j < N_SP; j++) J[i][j] = 0;
        J[i][i] = -0.5;
      }
      lastImprovementIter = iter;
    }
  }
  iterations = Math.min(iter + 1, MAXIT);
  if (resid(g, x) < TOL) converged = true;
  if (converged) {
    // final pass at the converged point for exact stream consistency
    lastPass = loopPass(spec, makeup, x);
  }
  if (!converged) warnings.push('Synthesis loop did not converge — results are the last iteration');

  const lp: LoopPass = lastPass;
  Object.assign(streams, lp.streams);
  Object.assign(units, lp.units);
  warnings.push(...fe.warnings, ...lp.warnings);

  // 3) element balance (feed + air vs products + purge + drains + offgas)
  const inlets: Moles = zeroN();
  for (let i = 0; i < N_SP; i++) inlets[i] = streams.S01.n[i] + streams.S02.n[i] + streams.S05.n[i];
  const outlets: Moles = zeroN();
  for (const sid of ['S12', 'S14', 'S17', 'S24', 'S26']) {
    for (let i = 0; i < N_SP; i++) outlets[i] += streams[sid].n[i];
  }
  const balance: ElementBalance[] = ATOMS.map((el, e) => {
    let vIn = 0;
    let vOut = 0;
    for (let i = 0; i < N_SP; i++) {
      vIn += inlets[i] * ATOM_MATRIX[e][i];
      vOut += outlets[i] * ATOM_MATRIX[e][i];
    }
    return {
      element: el as string,
      in: vIn,
      out: vOut,
      relErr: vIn > 1e-9 ? Math.abs(vOut - vIn) / vIn : 0,
    };
  });

  // 4) KPIs
  const nFeed = lp.nFeed;
  const feedTot = total(nFeed);
  const inerts = feedTot > 0 ? (nFeed[4] + nFeed[5]) / feedTot : 0;
  const h2n2 = nFeed[1] > 1e-9 ? nFeed[0] / nFeed[1] : 0;
  const perPass = nFeed[1] > 1e-9 ? (1 - lp.nEff[1] / nFeed[1]) : 0;
  const overall = makeup[1] > 1e-9 ? 1 - lp.purge[1] / makeup[1] : 0;
  const prodKg = massFlow(lp.product);
  const prodTpd = (prodKg * 24) / 1000;
  const prodNH3kg = lp.product[6] * SP.NH3.mw;
  const reformerDuty = units.R1.metrics[0].raw ?? 0;
  const wcDuty = units.E2.metrics[0].raw ?? 0;
  const chDuty = units.E2.metrics[1].raw ?? 0;
  const powerKW =
    (units.C1.metrics[0].raw ?? 0) * 1000 + (units.C2.metrics[0].raw ?? 0) + (chDuty / 2.4) * 1000;
  const feedGJd = (spec.ngFeed * LHV_CH4 * 24) / 1e6;
  const fuelGJd = (reformerDuty * 3.6e6 * 24) / 1e6 / 0.92;
  const powerGJd = (powerKW * 24 * 3.6) / 1000;
  const specEnergy = prodTpd > 1e-9 ? (feedGJd + fuelGJd + powerGJd) / prodTpd : 0;
  const oxidesPpm = (() => {
    const s = streams.S15;
    const dry = total(s.n) - s.n[7];
    return dry > 0 ? ((s.n[2] + s.n[3]) / dry) * 1e6 : 0;
  })();

  const kpis: Kpis = {
    productionTpd: prodTpd,
    productPurityMol: prodKg > 0 ? lp.product[6] / total(lp.product) : 0,
    productPurityWt: prodKg > 0 ? prodNH3kg / prodKg : 0,
    perPassConv: perPass,
    overallConv: overall,
    loopInerts: inerts,
    h2n2Ratio: h2n2,
    makeupFlow: makeupTot,
    recycleMultiple: makeupTot > 1e-9 ? total(lp.recycle) / makeupTot : 0,
    purgeFrac: spec.purgeFrac,
    reformerDutyMW: reformerDuty,
    refrigerationDutyMW: chDuty,
    syngasComprPowerMW: units.C1.metrics[0].raw ?? 0,
    circulatorPowerKW: units.C2.metrics[0].raw ?? 0,
    specificEnergyGJt: specEnergy,
    airFlow: air,
    secondaryExitC: (units.R2.metrics[1].raw ?? 0) - 273.15,
    coSlipLTS: (() => {
      const s = streams.S10;
      const dry = total(s.n) - s.n[7];
      return dry > 0 ? s.n[2] / dry : 0;
    })(),
    oxidesAfterMeth: oxidesPpm,
  };

  // sanity warnings for the operator
  if (prodTpd > 1 && kpis.productPurityWt < 0.985) {
    warnings.push('Product purity below 98.5 wt % — dissolved gases high (check separator T/P)');
  }
  if (chDuty > 0 && C(spec.chillT) > C(-5)) {
    warnings.push('Separator above −5 °C — substantial NH3 recycling through the loop');
  }

  const solveMs = performance.now() - t0;

  return {
    ok: true,
    converged,
    iterations,
    solveMs,
    streams,
    units,
    kpis,
    solverTrace: trace,
    balance,
    warnings: [...new Set(warnings)],
    h2n2Err: h2n2Resid,
  };
}

/**
 * run — the public solve. Engine 2.0 path: express the plant as a FlowGraph
 * (reference topology + this spec applied), then walk it with the graph
 * executor. Identical numbers to runLegacy — enforced by the identity gate.
 */
export function run(spec: PlantSpec): PlantResult {
  return executeGraph(buildGraph(spec));
}
