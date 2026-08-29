import { N_SP, RG, SP, SPECIES } from './species';
import type { Moles } from './species';

/**
 * Ideal-gas thermodynamics with formation enthalpies.
 * Reference state: elements at 298.15 K. Valid 273–800 K (linear Cp).
 * All molar quantities in J/mol or J/(mol·K).
 */

export const T_REF = 298.15;

/** Total molar flow, kmol/h */
export function total(n: Moles): number {
  let s = 0;
  for (let i = 0; i < N_SP; i++) s += n[i];
  return s;
}

/** Mole fractions (guarded against zero flow) */
export function fracs(n: Moles): number[] {
  const t = total(n);
  if (t <= 0) return new Array(N_SP).fill(0);
  return n.map((v) => v / t);
}

/** Mixture Cp at T, J/(mol·K) */
export function cpMix(n: Moles, T: number): number {
  const t = total(n);
  if (t <= 0) return 29.1;
  let s = 0;
  for (let i = 0; i < N_SP; i++) {
    const sp = SP[SPECIES[i]];
    s += n[i] * (sp.cpA + sp.cpB * T);
  }
  return s / t;
}

/** Mixture average molecular weight, kg/kmol */
export function mwMix(n: Moles): number {
  const t = total(n);
  if (t <= 0) return 0;
  let s = 0;
  for (let i = 0; i < N_SP; i++) s += n[i] * SP[SPECIES[i]].mw;
  return s / t;
}

/** Mass flow, kg/h */
export function massFlow(n: Moles): number {
  let s = 0;
  for (let i = 0; i < N_SP; i++) s += n[i] * SP[SPECIES[i]].mw;
  return s;
}

/** Mixture enthalpy rate at (T, n): kJ/h. Includes formation enthalpies.
 *  Note: kmol/h × J/mol = kJ/h numerically (1 kmol·J/mol = 1000 J = 1 kJ). */
export function enthalpyRate(n: Moles, T: number): number {
  let s = 0;
  for (let i = 0; i < N_SP; i++) {
    const sp = SP[SPECIES[i]];
    const h =
      sp.hf + sp.cpA * (T - T_REF) + 0.5 * sp.cpB * (T * T - T_REF * T_REF); // J/mol
    s += n[i] * h;
  }
  return s; // kJ/h
}

/** Sensible+formation enthalpy rate difference used for duties (kJ/h) */
export function dutyKJh(nIn: Moles, TIn: number, nOut: Moles, TOut: number): number {
  return enthalpyRate(nOut, TOut) - enthalpyRate(nIn, TIn);
}

/** Adiabatic mixing temperature for streams (enthalpy-consistent), K */
export function mixTemperature(streams: Array<{ n: Moles; T: number }>): number {
  // Solve Σ n·h(T) = Σ n·h(T_i) for T — monotone in T → bisection.
  let hTarget = 0;
  let nTot = 0;
  for (const s of streams) {
    hTarget += enthalpyRate(s.n, s.T);
    nTot += total(s.n);
  }
  if (nTot <= 0) return T_REF;
  let lo = 50;
  let hi = 1600;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    const nMix: Moles = new Array(N_SP).fill(0);
    for (const s of streams) for (let i = 0; i < N_SP; i++) nMix[i] += s.n[i];
    if (enthalpyRate(nMix, mid) < hTarget) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Heat-capacity ratio k = Cp/Cv for the mixture (ideal-gas Cv = Cp − R) */
export function kMix(n: Moles, T: number): number {
  const cp = cpMix(n, T);
  return cp / (cp - RG);
}

export { total as totalFlow };
