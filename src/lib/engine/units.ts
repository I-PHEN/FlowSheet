import { N_SP, SPECIES } from './species';
import type { Moles } from './species';
import { SP as SP_DATA } from './species';
import { enthalpyRate, kMix, total, fracs } from './thermo';
import { prZ, prFugacity, prEnthalpyDep } from './pr';
import { flashPT } from './flash';
import { solveSmrWgs, solveNh3Eq, solveMethanator } from './reactions';
import type { FlashResult } from './flash';

/**
 * Phase-aware stream enthalpy rate, kJ/h: ideal-gas + formation + PR residual.
 * The residual term captures latent heat (condenser duty). Vapor phase assumed
 * for single-phase gas streams; 'liquid' for the liquid product.
 */
export function phaseEnthalpyRate(
  n: Moles,
  T: number,
  P: number,
  phase: 'vapor' | 'liquid',
): number {
  const F = total(n);
  const ideal = enthalpyRate(n, T);
  if (F <= 0) return ideal;
  const y = fracs(n);
  const dep = prEnthalpyDep(y, T, P, phase); // J/mol
  return ideal + F * dep; // kmol/h × kJ/mol = kJ/h  (numerically J/mol·kmol = kJ)
}

/**
 * Unit operations — pure functions. All flows kmol/h, T in K, P in Pa,
 * duties in kJ/h unless named otherwise.
 */

const zeroN = (): Moles => new Array(N_SP).fill(0);

/**
 * Fixed point T* = f(T*) via secant with damped fallback.
 * f must be smooth and monotone-ish; used for adiabatic reactor temperatures.
 */
export function secantFixedT(f: (T: number) => number, T0: number, tol = 1e-6, maxIter = 25): number {
  let T = T0;
  let TPrev = T0 - 5;
  let fPrev = f(TPrev);
  for (let k = 0; k < maxIter; k++) {
    const fVal = f(T);
    const dT = T - TPrev;
    if (Math.abs(fVal - T) < tol) return T;
    let TNext: number;
    if (Math.abs(fVal - fPrev) > 1e-12 && Math.abs(dT) > 1e-12) {
      const slope = (fVal - fPrev) / dT;
      if (Math.abs(slope - 1) < 1e-9) return fVal;
      TNext = fVal + ((fVal - T) * slope) / (1 - slope);
      // guard wild steps
      if (Math.abs(TNext - T) > 400) TNext = T + 0.7 * (fVal - T);
    } else {
      TNext = T + 0.7 * (fVal - T);
    }
    TPrev = T;
    fPrev = fVal;
    T = TNext;
    if (!Number.isFinite(T)) return T0;
  }
  return f(T);
}

/** Adiabatic outlet temperature: H(nOut, T) = H(nIn, TIn) */
export function adiabaticT(nIn: Moles, TIn: number, nOut: Moles): number {
  const target = enthalpyRate(nIn, TIn);
  let lo = 100;
  let hi = 2200;
  for (let k = 0; k < 50; k++) {
    const mid = 0.5 * (lo + hi);
    if (enthalpyRate(nOut, mid) < target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export interface MixIn {
  n: Moles;
  T: number;
  P: number;
}

/** Adiabatic (enthalpy-consistent) mixing at pressure P */
export function mixStreams(streams: MixIn[], P: number): { n: Moles; T: number } {
  const n = zeroN();
  for (const s of streams) for (let i = 0; i < N_SP; i++) n[i] += s.n[i];
  // bisection on mixture temperature
  let target = 0;
  for (const s of streams) target += enthalpyRate(s.n, s.T);
  let lo = 100;
  let hi = 2000;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (enthalpyRate(n, mid) < target) lo = mid;
    else hi = mid;
  }
  return { n, T: 0.5 * (lo + hi) };
}

// ---------------------------------------------------------------------------
// Primary reformer — specified outlet T (fired furnace), SMR+WGS equilibrium
// ---------------------------------------------------------------------------

export interface ReformerResult {
  n: Moles;
  T: number;
  dutyKJh: number;
  ch4SlipDry: number;
  coDry: number;
  h2Dry: number;
  xi1: number;
  xi2: number;
  reached: boolean;
}

export function primaryReformer(
  nIn: Moles,
  TIn: number,
  TOut: number,
  P: number,
  ate1: number,
  ate2: number,
): ReformerResult {
  const res = solveSmrWgs(nIn, TOut, P, true, ate1, ate2);
  const duty = enthalpyRate(res.n, TOut) - enthalpyRate(nIn, TIn);
  const dry = res.n.slice();
  dry[7] = 0; // exclude steam
  const dryTot = dry.reduce((a, b) => a + b, 0);
  return {
    n: res.n,
    T: TOut,
    dutyKJh: duty,
    ch4SlipDry: dryTot > 0 ? dry[4] / dryTot : 0,
    coDry: dryTot > 0 ? dry[2] / dryTot : 0,
    h2Dry: dryTot > 0 ? dry[0] / dryTot : 0,
    xi1: res.xi1,
    xi2: res.xi2,
    reached: res.reached,
  };
}

// ---------------------------------------------------------------------------
// Secondary reformer — dual zone (research C3):
//   zone 1: adiabatic combustion (O2 → H2 first, then CH4, then CO)
//   zone 2: adiabatic catalytic SMR+WGS equilibrium (fixed-point on T)
// ---------------------------------------------------------------------------

export interface SecondaryResult {
  n: Moles;
  T: number;
  tCombust: number;
  dutyKJh: number; // ~0 (adiabatic overall)
  ch4SlipDry: number;
  coDry: number;
  o2Remaining: number;
}

function combustion(nGas: Moles, nAir: Moles): Moles {
  const n = nGas.slice();
  for (let i = 0; i < N_SP; i++) n[i] += nAir[i];
  let o2 = n[8];
  // 1) H2 + ½O2 → H2O
  const h2burn = Math.min(n[0], 2 * o2);
  n[0] -= h2burn;
  n[7] += h2burn;
  o2 -= h2burn / 2;
  // 2) CH4 + 2O2 → CO2 + 2H2O
  const ch4burn = Math.min(n[4], o2 / 2);
  n[4] -= ch4burn;
  n[3] += ch4burn;
  n[7] += 2 * ch4burn;
  o2 -= 2 * ch4burn;
  // 3) CO + ½O2 → CO2
  const coburn = Math.min(n[2], 2 * o2);
  n[2] -= coburn;
  n[3] += coburn;
  o2 -= coburn / 2;
  n[8] = Math.max(0, o2);
  return n;
}

export function secondaryReformer(
  nGas: Moles,
  TGas: number,
  nAir: Moles,
  TAir: number,
  P: number,
  ate1: number,
  ate2: number,
): SecondaryResult {
  // zone 1 — combustion + adiabatic mixing (enthalpy-consistent with the two feed temperatures)
  const nComb = combustion(nGas, nAir);
  const hTarget = enthalpyRate(nGas, TGas) + enthalpyRate(nAir, TAir);
  let lo = 200;
  let hi = 3000;
  for (let k = 0; k < 50; k++) {
    const mid = 0.5 * (lo + hi);
    if (enthalpyRate(nComb, mid) < hTarget) lo = mid;
    else hi = mid;
  }
  const tComb = 0.5 * (lo + hi);

  // zone 2 — adiabatic catalytic equilibrium (secant on T)
  const solveAt = (Tg: number) => {
    const r = solveSmrWgs(nComb, Tg, P, true, ate1, ate2);
    return { T: adiabaticT(nComb, tComb, r.n), r };
  };
  let res = solveAt(tComb).r;
  const T = secantFixedT((Tg) => solveAt(Tg).T, tComb, 1e-6, 20);
  res = solveAt(T).r;
  const dry = res.n.slice();
  dry[7] = 0;
  const dryTot = dry.reduce((a, b) => a + b, 0);
  return {
    n: res.n,
    T,
    tCombust: tComb,
    dutyKJh: 0,
    ch4SlipDry: dryTot > 0 ? dry[4] / dryTot : 0,
    coDry: dryTot > 0 ? dry[2] / dryTot : 0,
    o2Remaining: res.n[8],
  };
}

// ---------------------------------------------------------------------------
// Adiabatic equilibrium reactor (HTS, LTS, methanator)
// ---------------------------------------------------------------------------

export interface AdEqResult {
  n: Moles;
  TOut: number;
  xi1: number;
  xi2: number;
  coDry: number;
}

export function adiabaticEqReactor(
  nIn: Moles,
  TIn: number,
  P: number,
  allowSMR: boolean,
  ate1 = 0,
  ate2 = 0,
): AdEqResult {
  const solveAt = (T: number) => {
    const r = solveSmrWgs(nIn, T, P, allowSMR, ate1, ate2);
    return { T: adiabaticT(nIn, TIn, r.n), r };
  };
  const T = secantFixedT((Tg) => solveAt(Tg).T, TIn, 1e-6, 20);
  const res = solveAt(T).r;
  const dry = res.n.slice();
  dry[7] = 0;
  const dryTot = dry.reduce((a, b) => a + b, 0);
  return { n: res.n, TOut: T, xi1: res.xi1, xi2: res.xi2, coDry: dryTot > 0 ? dry[2] / dryTot : 0 };
}

// ---------------------------------------------------------------------------
// Methanator — adiabatic, dedicated methanation equilibrium solver
// ---------------------------------------------------------------------------

export interface MethResult {
  n: Moles;
  TOut: number;
  xiCO: number;
  xiCO2: number;
  oxidesPpmDry: number;
}

export function methanator(nIn: Moles, TIn: number, P: number): MethResult {
  const solveAt = (T: number) => {
    const r = solveMethanator(nIn, T, P);
    return { T: adiabaticT(nIn, TIn, r.n), r };
  };
  const T = secantFixedT((Tg) => solveAt(Tg).T, TIn, 1e-6, 20);
  const res = solveAt(T).r;
  const dryTot = total(res.n) - res.n[7];
  return {
    n: res.n,
    TOut: T,
    xiCO: res.xiCO,
    xiCO2: res.xiCO2,
    oxidesPpmDry: dryTot > 0 ? ((res.n[2] + res.n[3]) / dryTot) * 1e6 : 0,
  };
}

// ---------------------------------------------------------------------------
// Cooler / heater — specified outlet T and P
// ---------------------------------------------------------------------------

export interface CoolerResult {
  n: Moles;
  T: number;
  dutyKJh: number;
}

export function cooler(nIn: Moles, TIn: number, TOut: number, POut: number): CoolerResult {
  return {
    n: nIn,
    T: TOut,
    dutyKJh: enthalpyRate(nIn, TOut) - enthalpyRate(nIn, TIn),
  };
}

// ---------------------------------------------------------------------------
// Flash drum — PT flash (PR EOS)
// ---------------------------------------------------------------------------

export interface DrumResult {
  vapor: Moles;
  liquid: Moles;
  T: number;
  P: number;
  dutyKJh: number; // duty needed to reach flash T (if fed hotter)
  beta: number;
  liquidPurity: number; // mole fraction of key liquid species
  flash: FlashResult;
}

export function flashDrum(
  nIn: Moles,
  TIn: number,
  T: number,
  P: number,
  liquidKey: 7 | 6 = 7, // H2O for knockouts, NH3 for separator
): DrumResult {
  const fl = flashPT(nIn, T, P);
  const duty =
    enthalpyRate(fl.vapor, T) + enthalpyRate(fl.liquid, T) - enthalpyRate(nIn, TIn);
  const liqTot = total(fl.liquid);
  return {
    vapor: fl.vapor,
    liquid: fl.liquid,
    T,
    P,
    dutyKJh: duty,
    beta: fl.beta,
    liquidPurity: liqTot > 0 ? fl.liquid[liquidKey] / liqTot : 0,
    flash: fl,
  };
}

// ---------------------------------------------------------------------------
// CO2 removal — spec-based black box (research Q5: residual ppmvd + H2 slip)
// ---------------------------------------------------------------------------

export interface Co2Result {
  gas: Moles;
  offgas: Moles;
  co2Removed: number;
  residualPpm: number;
}

export function co2Removal(
  nIn: Moles,
  residualPpmDry: number,
  h2SlipFrac: number,
): Co2Result {
  const gas = nIn.slice();
  const offgas = zeroN();
  const dryTot = total(nIn) - nIn[7];
  const co2Out = Math.min(gas[3], (residualPpmDry * 1e-6 * Math.max(dryTot, 0)) || 0);
  offgas[3] = Math.max(0, gas[3] - co2Out);
  gas[3] = co2Out;
  // H2 slip to offgas (amines co-absorption)
  const h2slip = gas[0] * h2SlipFrac;
  offgas[0] += h2slip;
  gas[0] -= h2slip;
  const dryOut = total(gas) - gas[7];
  return {
    gas,
    offgas,
    co2Removed: offgas[3],
    residualPpm: dryOut > 0 ? (gas[3] / dryOut) * 1e6 : 0,
  };
}

// ---------------------------------------------------------------------------
// Isenthalpic (adiabatic) letdown — self-refrigerating flash
// ---------------------------------------------------------------------------

export interface LetdownResult {
  T: number;
  vapor: Moles;
  liquid: Moles;
  flashedFrac: number;
}

/**
 * Throttle a liquid stream from (TFeed, PFeed) to POut at constant enthalpy.
 * Bisection on flash temperature: H(vapor) + H(liquid) = H(feed).
 */
export function isenthalpicFlash(
  nFeed: Moles,
  TFeed: number,
  PFeed: number,
  POut: number,
): LetdownResult {
  const hFeed = phaseEnthalpyRate(nFeed, TFeed, PFeed, 'liquid');
  const flashAt = (T: number) => flashPT(nFeed, T, POut);
  const hAt = (T: number) => {
    const fl = flashAt(T);
    return {
      h: phaseEnthalpyRate(fl.vapor, T, POut, 'vapor') + phaseEnthalpyRate(fl.liquid, T, POut, 'liquid'),
      fl,
    };
  };
  // H(T) increasing in T: solve H(T) = hFeed — secant with bracketing fallback
  let lo = 120;
  let hi = TFeed;
  let T = Math.max(150, TFeed - 15); // first guess: some self-refrigeration
  let TPrev = T + 10;
  const r0 = hAt(TPrev);
  let hPrev = r0.h;
  let best = r0.fl;
  for (let k = 0; k < 24; k++) {
    const r = hAt(T);
    best = r.fl;
    if (Math.abs(r.h - hFeed) < 1e-4) break;
    // maintain bracket
    if (r.h < hFeed) lo = Math.max(lo, T);
    else hi = Math.min(hi, T);
    let TNext: number;
    if (Math.abs(r.h - hPrev) > 1e-10) {
      TNext = T + ((hFeed - r.h) * (T - TPrev)) / (r.h - hPrev);
      if (TNext < lo || TNext > hi || !Number.isFinite(TNext)) TNext = 0.5 * (lo + hi);
    } else {
      TNext = 0.5 * (lo + hi);
    }
    TPrev = T;
    hPrev = r.h;
    T = TNext;
  }
  const fl = flashAt(T);
  const fTot = total(nFeed);
  return {
    T,
    vapor: fl.vapor,
    liquid: fl.liquid,
    flashedFrac: fTot > 0 ? total(fl.vapor) / fTot : 0,
  };
}

// ---------------------------------------------------------------------------
// Compressor — polytropic, N stages with intercooling (research Q7)
// ---------------------------------------------------------------------------

export interface CompressorResult {
  n: Moles;
  T: number;
  P: number;
  powerKW: number; // shaft, per stage sum
  intercoolDutyKJh: number;
  stageRatios: number[];
}

export function compressorTrain(
  nIn: Moles,
  TIn: number,
  PIn: number,
  POut: number,
  stages: number,
  etaP: number,
  intercoolT: number,
): CompressorResult {
  const r = Math.pow(POut / PIn, 1 / stages);
  let T = TIn;
  let powerKW = 0;
  let intercoolDuty = 0;
  const stageRatios: number[] = [];
  const y = fracs(nIn);
  for (let s = 0; s < stages; s++) {
    const k = kMix(nIn, T);
    const e = (k - 1) / (k * etaP);
    const Z = Math.max(0.2, Math.min(1.6, prZ(y, T, PIn * Math.pow(r, s))));
    const wMol = (Z * 8.314462618 * T * (1 / e) * (Math.pow(r, e) - 1)); // J/mol
    const F = total(nIn); // kmol/h
    powerKW += (F * 1000 * wMol) / 3600 / 1000; // kW
    stageRatios.push(r);
    T = T * Math.pow(r, e);
    // intercool (not after the last stage)
    if (s < stages - 1) {
      intercoolDuty += enthalpyRate(nIn, intercoolT) - enthalpyRate(nIn, T);
      T = intercoolT;
    }
  }
  return { n: nIn, T, P: POut, powerKW, intercoolDutyKJh: intercoolDuty, stageRatios };
}

// ---------------------------------------------------------------------------
// Synthesis converter bed — adiabatic, fractional approach to equilibrium
// ---------------------------------------------------------------------------

export interface BedResult {
  n: Moles;
  TOut: number;
  xi: number; // actual N2 reacted
  xiEq: number; // equilibrium N2 reacted at outlet T
  nh3In: number;
  nh3Out: number;
  reached: boolean;
}

function composeNh3(nIn: Moles, xi: number): Moles {
  const n = nIn.slice();
  n[1] -= xi;
  n[0] -= 3 * xi;
  n[6] += 2 * xi;
  return n;
}

export function converterBed(nIn: Moles, TIn: number, P: number, eta: number): BedResult {
  const totIn = total(nIn);
  const nh3In = totIn > 0 ? nIn[6] / totIn : 0;
  let xi = 0;
  let xiEq = 0;
  let reached = true;
  const solveAt = (T: number) => {
    const eq = solveNh3Eq(nIn, T, P);
    const x = eta * eq.xi;
    return { T: adiabaticT(nIn, TIn, composeNh3(nIn, x)), xi: x, xiEq: eq.xi, reached: eq.reached };
  };
  const r0 = solveAt(TIn + 40);
  const T = secantFixedT((Tg) => solveAt(Tg).T, TIn + 40, 1e-6, 20);
  const rf = solveAt(T);
  xi = rf.xi;
  xiEq = rf.xiEq;
  reached = rf.reached;
  const nOut = composeNh3(nIn, xi);
  const totOut = total(nOut);
  void r0;
  return {
    n: nOut,
    TOut: T,
    xi,
    xiEq,
    nh3In,
    nh3Out: totOut > 0 ? nOut[6] / totOut : 0,
    reached,
  };
}

// ---------------------------------------------------------------------------
// Distillation column — the classic binary design-verification problem
// (McCabe–Thiele / Lewis–Sorel stage stepping with constant relative
// volatility from the PR EOS). Given xD, R, N and the feed tray, find xB so
// that stepping exactly N equilibrium stages lands on the reboiler.
// ---------------------------------------------------------------------------

export interface DistillColumnResult {
  /** products, kmol/h */
  D: number;
  B: number;
  /** distillate / bottoms mole fraction of the light key */
  xD: number;
  xB: number;
  /** vapor in equilibrium with the reboiler liquid */
  yB: number;
  /** internal flows, kmol/h — rectifying section */
  V: number;
  L: number;
  /** internal flows, kmol/h — stripping section */
  Vbar: number;
  Lbar: number;
  boilupRatio: number;
  /** temperatures, K */
  Ttop: number;
  Tbot: number;
  TdewTop: number;
  TdewBot: number;
  /** condenser / reboiler duty, kJ/h (reboiler closed by overall balance) */
  QcKJh: number;
  QrKJh: number;
  /** minimum reflux ratio at the current feed condition */
  Rmin: number;
  /** feed thermal condition (1 = saturated liquid) */
  q: number;
  /** relative volatility from the PR EOS at the feed bubble point */
  alpha: number;
  /** Fenske minimum stages at total reflux for the achieved split */
  Nmin: number;
  /** feed tray (from the top) that gives the leanest bottoms at this N and R */
  feedStageOptimal: number;
  /** true when R < Rmin — the column refuses to fake a separation */
  pinched: boolean;
}

const spAt = (i: number) => SP_DATA[SPECIES[i]];

/** Wilson K-values for the binary pair — seeds the PR refinement */
function wilsonKPair(iLight: number, iHeavy: number, T: number, P: number): [number, number] {
  const k = (s: (typeof SP_DATA)[(typeof SPECIES)[number]]) =>
    (s.pc / P) * Math.exp(5.373 * (1 + s.omega) * (1 - s.tc / T));
  return [k(spAt(iLight)), k(spAt(iHeavy))];
}

/**
 * PR-refined K-values of the binary pair for a liquid composition x at T, P.
 * Starts from Wilson and refines fugacities on both phases — the same
 * machinery the PT flash uses, evaluated directly so the bubble/dew searches
 * stay cheap.
 */
function kPairPR(
  iLight: number,
  iHeavy: number,
  xLight: number,
  T: number,
  P: number,
): [number, number] {
  const z = new Array(N_SP).fill(0);
  z[iLight] = xLight;
  z[iHeavy] = 1 - xLight;
  let [kL, kH] = wilsonKPair(iLight, iHeavy, T, P);
  for (let it = 0; it < 12; it++) {
    const y = new Array(N_SP).fill(0);
    y[iLight] = kL * xLight;
    y[iHeavy] = kH * (1 - xLight);
    const sy = y[iLight] + y[iHeavy];
    if (sy <= 1e-12) break;
    y[iLight] /= sy;
    y[iHeavy] /= sy;
    const fv = prFugacity(y, T, P, 'vapor');
    const fl = prFugacity(z, T, P, 'liquid');
    const kLn = Math.exp(fl.lnPhi[iLight] - fv.lnPhi[iLight]);
    const kHn = Math.exp(fl.lnPhi[iHeavy] - fv.lnPhi[iHeavy]);
    const done = Math.abs(kLn / kL - 1) < 1e-10 && Math.abs(kHn / kH - 1) < 1e-10;
    kL = kLn;
    kH = kHn;
    if (done) break;
  }
  return [kL, kH];
}

/** bubble point of the binary at P (ΣK·x = 1), K from PR with Wilson seed */
function bubbleTPair(iLight: number, iHeavy: number, xLight: number, P: number): number {
  let lo = 200;
  let hi = 700;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    const [kL, kH] = kPairPR(iLight, iHeavy, xLight, mid, P);
    // ΣK·x rises with T; bubble is where it crosses 1 from below
    if (kL * xLight + kH * (1 - xLight) > 1) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/** dew point of the binary at P (Σy/K = 1) */
function dewTPair(iLight: number, iHeavy: number, yLight: number, P: number): number {
  let lo = 200;
  let hi = 700;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    const [kL, kH] = kPairPR(iLight, iHeavy, yLight, mid, P);
    // Σy/K falls with T; dew is where it crosses 1 from above
    if (yLight / kL + (1 - yLight) / kH > 1) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** binary helper — build an N_SP flow vector from a total and light fraction */
function binaryMoles(flow: number, xLight: number, iLight: number, iHeavy: number): Moles {
  const n = new Array(N_SP).fill(0);
  n[iLight] = flow * xLight;
  n[iHeavy] = flow * (1 - xLight);
  return n;
}

/** full-mixture molar enthalpy (formation + sensible + PR residual), J/mol */
function hMol(n: Moles, T: number, P: number, phase: 'vapor' | 'liquid'): number {
  const t = total(n);
  if (t <= 0) return 0;
  return enthalpyRate(n, T) / t + prEnthalpyDep(fracs(n), T, P, phase);
}

/** mixture Cp of the binary pair at ~350 K, J/(mol·K) */
function cpPair(iLight: number, iHeavy: number, xLight: number): number {
  const a = spAt(iLight);
  const b = spAt(iHeavy);
  const T = 350;
  return xLight * (a.cpA + a.cpB * T) + (1 - xLight) * (b.cpA + b.cpB * T);
}

/**
 * The design-verification column solve.
 *
 * @param nFeed  feed molar flows (only the two key species are used), kmol/h
 * @param TFeed  feed temperature, K
 * @param Ptop   column top pressure, Pa
 * @param Pbot   column bottom pressure, Pa
 * @param iLight species index of the light key
 * @param iHeavy species index of the heavy key
 * @param xD     distillate purity target (mole fraction light key)
 * @param R      reflux ratio L/D
 * @param N      equilibrium stages including the reboiler
 * @param nf     feed tray counted from the top (1 = top tray)
 */
export function distillationColumn(
  nFeed: Moles,
  TFeed: number,
  Ptop: number,
  Pbot: number,
  iLight: number,
  iHeavy: number,
  xD: number,
  R: number,
  N: number,
  nf: number,
): DistillColumnResult {
  const F = nFeed[iLight] + nFeed[iHeavy];
  const zF = F > 0 ? nFeed[iLight] / F : 0.5;

  // --- relative volatility at the feed bubble point (PR, Wilson-seeded) ---
  const Tbub = bubbleTPair(iLight, iHeavy, zF, Ptop);
  const Tdew = dewTPair(iLight, iHeavy, zF, Ptop);
  const [kLb, kHb] = kPairPR(iLight, iHeavy, zF, Tbub, Ptop);
  const alpha = Math.max(1.05, kLb / kHb);
  const yEq = (x: number) => (alpha * x) / (1 + (alpha - 1) * x);
  const xEq = (y: number) => y / Math.max(1e-12, alpha - (alpha - 1) * y);

  // --- feed thermal condition q ---
  // Between the saturation points: q = 1 − β from the PT flash.
  // Outside: sensible-heat corrections against the latent heat at Tbub.
  const fl = flashPT(nFeed, TFeed, Ptop);
  const lambda = Math.max(
    5e3,
    hMol(binaryMoles(1, zF, iLight, iHeavy), Tbub, Ptop, 'vapor') -
      hMol(binaryMoles(1, zF, iLight, iHeavy), Tbub, Ptop, 'liquid'),
  ); // J/mol
  const cpF = cpPair(iLight, iHeavy, zF);
  let q: number;
  if (fl.twoPhase) q = 1 - fl.beta;
  else if (fl.beta === 0) q = 1 + (cpF * Math.max(0, Tbub - TFeed)) / lambda;
  else q = -(cpF * Math.max(0, TFeed - Tdew)) / lambda;

  // --- minimum reflux from the q-line / equilibrium pinch ---
  let xP = zF;
  let yP = yEq(zF);
  if (Math.abs(q - 1) > 1e-9) {
    const ql = (x: number) => (q / (q - 1)) * x - zF / (q - 1);
    const f = (x: number) => ql(x) - yEq(x);
    // the q-line crosses the equilibrium curve once, but from opposite
    // directions for q < 1 (slope negative) and q > 1 (slope positive) —
    // orient the bisection from the sign at the lean end
    const crossingUp = f(0) < 0;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 60; k++) {
      const mid = 0.5 * (lo + hi);
      if ((f(mid) > 0) === crossingUp) hi = mid;
      else lo = mid;
    }
    xP = 0.5 * (lo + hi);
    yP = yEq(xP);
  }
  const mMin = (xD - yP) / Math.max(1e-9, xD - xP);
  const Rmin = Math.max(0.05, mMin / Math.max(1e-9, 1 - mMin));

  // --- the stage stepping: given an xB guess, the liquid left in the
  //     reboiler after N equilibrium stages (Lewis–Sorel, constant α).
  //     Infeasible (pinch / reversal / degenerate flows) → NaN. ---
  const stepToReboiler = (xB: number, nfCand: number): number => {
    const Dc = (F * (zF - xB)) / (xD - xB);
    const Bc = F - Dc;
    if (!(Dc > 1e-9) || !(Bc > 1e-9)) return NaN;
    const Lc = R * Dc;
    const Vc = (R + 1) * Dc;
    const Lbc = Lc + q * F;
    const Vbc = Vc - (1 - q) * F;
    if (!(Vbc > 1e-9) || !(Lbc > 1e-9)) return NaN;
    const mR = R / (R + 1);
    const bR = xD / (R + 1);
    const mS = Lbc / Vbc;
    const bS = -(Bc / Vbc) * xB;
    let y = xD; // total condenser
    let x = xD;
    for (let s = 1; s <= N; s++) {
      x = xEq(y);
      if (!Number.isFinite(x) || x < 0 || x > 1) return NaN;
      if (s === N) break;
      const yNext = s <= nfCand ? mR * x + bR : mS * x + bS;
      // operating line crossing equilibrium (or reversing) = pinch
      if (!(yNext > 1e-9) || yNext >= y - 1e-12) return NaN;
      y = yNext;
    }
    return x;
  };

  // --- shoot on xB: lean → rich grid scan for the first sign change,
  //     then bisect. The scan remembers the LAST lean point with g > 0 so
  //     the bracket always straddles the root (the rich end may also turn
  //     infeasible — D → 0 — which the bisection treats as "too rich"). ---
  const solveXB = (nfCand: number): number => {
    let lo = -1;
    let hi = -1;
    // geometric grid, lean (zF·1e-5) → rich (zF): brackets sharp splits
    // (many stages / high purity) as well as easy ones in 48 probes
    const G = 48;
    const xAt = (k: number) => zF * Math.pow(10, -5 + (5 * k) / G);
    for (let k = 1; k <= G; k++) {
      const xB = xAt(k);
      const xN = stepToReboiler(xB, nfCand);
      if (!Number.isFinite(xN)) {
        if (lo >= 0) {
          hi = xB;
          break;
        }
        continue;
      }
      if (xN - xB > 0) lo = xB;
      else if (lo >= 0) {
        hi = xB;
        break;
      }
    }
    if (lo < 0 || hi < 0) return NaN;
    let a = lo;
    let b = hi;
    for (let k = 0; k < 70; k++) {
      const mid = 0.5 * (a + b);
      const xN = stepToReboiler(mid, nfCand);
      if (!Number.isFinite(xN) || xN - mid <= 0) b = mid;
      else a = mid;
    }
    return 0.5 * (a + b);
  };

  const xB = solveXB(nf);
  const pinched = !Number.isFinite(xB);
  const xBFinal = pinched ? zF : xB;

  const D = pinched ? 0 : (F * (zF - xBFinal)) / (xD - xBFinal);
  const B = F - D;
  const L = R * D;
  const V = (R + 1) * D;
  const Lbar = L + q * F;
  const Vbar = Math.max(0, V - (1 - q) * F);
  const yB = yEq(xBFinal);

  // --- optimal feed tray: the nf that leans xB the most at this N and R
  //     (scanned even when the current tray pinches, so the diagnosis can
  //     point at the right tray) ---
  let feedStageOptimal = nf;
  {
    let best = pinched ? Infinity : xBFinal;
    for (let cand = 2; cand <= N - 1; cand++) {
      if (cand === nf) continue;
      const xbc = solveXB(cand);
      if (Number.isFinite(xbc) && xbc < best - 1e-12) {
        best = xbc;
        feedStageOptimal = cand;
      }
    }
  }

  // --- temperatures from the PR pair saturation points ---
  const Ttop = bubbleTPair(iLight, iHeavy, xD, Ptop);
  const Tbot = bubbleTPair(iLight, iHeavy, xBFinal, Pbot);
  const TdewTop = dewTPair(iLight, iHeavy, xD, Ptop);
  const TdewBot = dewTPair(iLight, iHeavy, yB, Pbot);

  // --- duties: condenser from the PR-residual enthalpies, reboiler closed
  //     by the overall energy balance (a cold feed honestly raises Qr) ---
  const nD = binaryMoles(D, xD, iLight, iHeavy);
  const nB = binaryMoles(B, xBFinal, iLight, iHeavy);
  const nV = binaryMoles(V, xD, iLight, iHeavy);
  const hD = hMol(nD, Ttop, Ptop, 'liquid');
  const hB = hMol(nB, Tbot, Pbot, 'liquid');
  const hVtop = hMol(nV, TdewTop, Ptop, 'vapor');
  const hFeed = fl.twoPhase
    ? fl.beta * hMol(fl.vapor, TFeed, Ptop, 'vapor') +
      (1 - fl.beta) * hMol(fl.liquid, TFeed, Ptop, 'liquid')
    : hMol(nFeed, TFeed, Ptop, fl.beta === 0 ? 'liquid' : 'vapor');
  const QcKJh = (V * (hVtop - hD)) / 1000; // kmol/h × J/mol = kJ/h
  const QrKJh = (D * hD + B * hB + QcKJh * 1000 - F * hFeed) / 1000;

  // --- Fenske minimum stages for the achieved split ---
  const Nmin =
    xBFinal > 1e-9 && xBFinal < 1 - 1e-9
      ? Math.log((xD / (1 - xD)) * ((1 - xBFinal) / xBFinal)) / Math.log(alpha)
      : 0;

  return {
    D,
    B,
    xD,
    xB: xBFinal,
    yB,
    V,
    L,
    Vbar,
    Lbar,
    boilupRatio: B > 1e-9 ? Vbar / B : 0,
    Ttop,
    Tbot,
    TdewTop,
    TdewBot,
    QcKJh,
    QrKJh,
    Rmin,
    q,
    alpha,
    Nmin,
    feedStageOptimal,
    pinched,
  };
}

export { zeroN };
