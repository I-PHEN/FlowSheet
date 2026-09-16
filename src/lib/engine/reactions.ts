import { N_SP, RG, SPECIES } from './species';
import type { Moles } from './species';

/**
 * Reaction equilibrium — ALL correlations numerically verified during the
 * research phase (see research/2c_ammonia_eng.md, tags [V]):
 *
 *  1. Gillespie–Beattie (1930) apparent Kp for NH3 synthesis, atm basis,
 *     pressure-dependent β/I table (verified against Larson–Dodge tables:
 *     450 °C/150 atm → 22.3 % eq NH3, 400 °C/200 atm → 38.2 %, …).
 *  2. K_SR1 (steam reforming)  = 1.198e13·exp(−26830/T)  [bar²]  (Zečević & Bolf 2020;
 *     reproduces 8.1 % dry CH4 slip at 800 °C / 30 bar / S–C 3).
 *  3. K_WGS (water-gas shift)  = 1.767e-2·exp(+4400/T)   [−]    (12.2 @ 400 °C, 133 @ 220 °C).
 *
 * Equilibrium solvers use nested bisection on reaction extents — monotone,
 * bracketed, and failure-free by construction (no Newton divergence).
 */

// ---------------------------------------------------------------------------
// Gillespie–Beattie
// ---------------------------------------------------------------------------

/** β/I table rows: [P_atm, beta, I] */
const GB_TABLE: Array<[number, number, number]> = [
  [10, 0.0, 1.993],
  [30, 3.4e-5, 2.021],
  [50, 1.256e-4, 2.090],
  [100, 1.256e-4, 2.113],
  [300, 1.256e-4, 2.206],
];

function gbParams(P_atm: number): { beta: number; I: number } {
  const P = Math.min(300, Math.max(10, P_atm));
  for (let k = 0; k < GB_TABLE.length - 1; k++) {
    const [p0, b0, i0] = GB_TABLE[k];
    const [p1, b1, i1] = GB_TABLE[k + 1];
    if (P >= p0 && P <= p1) {
      const w = (P - p0) / (p1 - p0);
      return { beta: b0 + w * (b1 - b0), I: i0 + w * (i1 - i0) };
    }
  }
  const last = GB_TABLE[GB_TABLE.length - 1];
  return { beta: last[1], I: last[2] };
}

/**
 * Gillespie–Beattie Kp for ½N2 + (3/2)H2 ⇌ NH3.
 * Partial pressures in atm; Kp in atm⁻¹.
 */
export function kpNH3(T: number, P_atm: number): number {
  const { beta, I } = gbParams(P_atm);
  const lg = 2074.8 / T - 2.4943 * Math.log10(T) - beta * T + 1.856e-7 * T * T + I;
  return Math.pow(10, lg);
}

/** Equilibrium NH3 mol fraction for a stoichiometric H2/N2=3 feed — for tests. */
export function eqNH3Fraction(T: number, P_atm: number): number {
  // 1 mol feed: N2 = 0.25, H2 = 0.75, extent ξ (N2 basis, full reaction)
  const K = Math.pow(kpNH3(T, P_atm), 2); // full reaction, atm⁻²
  const f = (xi: number) => {
    const n2 = 0.25 - xi;
    const h2 = 0.75 - 3 * xi;
    const nh3 = 2 * xi;
    const tot = 1 - 2 * xi;
    const pN2 = (n2 / tot) * P_atm;
    const pH2 = (h2 / tot) * P_atm;
    const pNH3 = (nh3 / tot) * P_atm;
    return (pNH3 * pNH3) / (pN2 * Math.pow(pH2, 3));
  };
  let lo = 0;
  let hi = 0.249999;
  if (f(hi) < K) return 2 * hi; // can't reach equilibrium
  for (let k = 0; k < 100; k++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) < K) lo = mid;
    else hi = mid;
  }
  const xi = 0.5 * (lo + hi);
  return (2 * xi) / (1 - 2 * xi);
}

// ---------------------------------------------------------------------------
// Reforming / shift equilibrium constants (bar basis)
// ---------------------------------------------------------------------------

/** K_SR1 = (p_CO·p_H2³)/(p_CH4·p_H2O) [bar²], p in bar */
export function kSR1(T: number): number {
  return 1.198e13 * Math.exp(-26830 / T);
}

/** K_WGS = (p_CO2·p_H2)/(p_CO·p_H2O) [−], p in bar */
export function kWGS(T: number): number {
  return 1.767e-2 * Math.exp(4400 / T);
}

// ---------------------------------------------------------------------------
// Generic SMR + WGS simultaneous equilibrium (signed extents)
// ---------------------------------------------------------------------------

export interface SmrWgsResult {
  n: Moles;
  xi1: number; // SMR extent, kmol/h (negative = methanation)
  xi2: number; // WGS extent, kmol/h (negative = reverse shift)
  reached: boolean; // true if equilibrium satisfied within bounds
}

/**
 * Solve simultaneous SR1 + WGS equilibrium at T [K], P [Pa].
 *
 * @param allowSMR false ⇒ methane reactions are kinetically frozen
 *                 (HTS/LTS on Fe–Cr / Cu–Zn catalysts: no methanation).
 * @param ate1 approach-to-equilibrium on CH4 reaction, K (temperature approach)
 * @param ate2 approach-to-equilibrium on WGS, K
 */
export function solveSmrWgs(
  nIn: Moles,
  T: number,
  P: number,
  allowSMR: boolean,
  ate1 = 0,
  ate2 = 0,
): SmrWgsResult {
  const P_bar = P / 1e5;
  const K1 = kSR1(T + ate1);
  const K2 = kWGS(T + ate2);

  const compose = (xi1: number, xi2: number): Moles => {
    const n = nIn.slice();
    n[4] += -xi1; // CH4
    n[7] += -xi1 - xi2; // H2O
    n[2] += xi1 - xi2; // CO
    n[0] += 3 * xi1 + xi2; // H2
    n[3] += xi2; // CO2
    return n;
  };

  const partials = (n: Moles): number[] => {
    let tot = 0;
    for (let i = 0; i < N_SP; i++) tot += Math.max(n[i], 0);
    if (tot <= 0) return new Array(N_SP).fill(0);
    return n.map((v) => (Math.max(v, 0) / tot) * P_bar);
  };

  const q2 = (xi1: number, xi2: number): number => {
    const p = partials(compose(xi1, xi2));
    const num = p[3] * p[0];
    const den = p[2] * p[7];
    if (den <= 0) return num > 0 ? Infinity : 0;
    return num / den;
  };

  const q1 = (xi1: number, xi2: number): number => {
    const p = partials(compose(xi1, xi2));
    const num = p[2] * Math.pow(p[0], 3);
    const den = p[4] * p[7];
    if (den <= 0) return num > 0 ? Infinity : 0;
    return num / den;
  };

  // ξ2 bounds for a given ξ1 (all flows must stay ≥ 0)
  const xi2Bounds = (xi1: number): [number, number] => {
    const co = nIn[2] + xi1;
    const h2o = nIn[7] - xi1;
    const co2 = nIn[3];
    const h2 = nIn[0] + 3 * xi1;
    const hi = Math.max(0, Math.min(co, h2o));
    const lo = -Math.max(0, Math.min(co2, h2));
    return [lo, hi];
  };

  // inner: ξ2 at WGS equilibrium for fixed ξ1 (bisection, Q2 monotone ↑ in ξ2)
  const solveXi2 = (xi1: number): number => {
    const [lo, hi] = xi2Bounds(xi1);
    const qLo = q2(xi1, lo);
    const qHi = q2(xi1, hi);
    if (qLo >= K2) return lo;
    if (qHi <= K2) return hi;
    let a = lo;
    let b = hi;
    for (let k = 0; k < 45; k++) {
      const mid = 0.5 * (a + b);
      if (q2(xi1, mid) < K2) a = mid;
      else b = mid;
    }
    return 0.5 * (a + b);
  };

  if (!allowSMR) {
    const xi2 = solveXi2(0);
    return { n: compose(0, xi2), xi1: 0, xi2, reached: true };
  }

  // outer: ξ1 at SR1 equilibrium, with ξ2 nested (Q1 monotone ↑ in ξ1)
  const fwdMax = Math.max(0, Math.min(nIn[4], nIn[7]));
  const revMax = Math.max(0, Math.min(nIn[2], nIn[0] / 3));
  const lo = -revMax;
  const hi = fwdMax;
  const qAt = (xi1: number) => q1(xi1, solveXi2(xi1));

  const qLo = qAt(lo);
  const qHi = qAt(hi);
  if (qLo >= K1) return { n: compose(lo, solveXi2(lo)), xi1: lo, xi2: solveXi2(lo), reached: false };
  if (qHi <= K1) return { n: compose(hi, solveXi2(hi)), xi1: hi, xi2: solveXi2(hi), reached: false };

  let a = lo;
  let b = hi;
  for (let k = 0; k < 50; k++) {
    const mid = 0.5 * (a + b);
    if (qAt(mid) < K1) a = mid;
    else b = mid;
  }
  const xi1 = 0.5 * (a + b);
  const xi2 = solveXi2(xi1);
  return { n: compose(xi1, xi2), xi1, xi2, reached: true };
}

// ---------------------------------------------------------------------------
// Methanator — dedicated solver on the methanation reaction set
//   M1: CO + 3H2 ⇌ CH4 + H2O     K1 = 1/K_SR1        [bar⁻²]
//   M2: CO2 + 4H2 ⇌ CH4 + 2H2O   K2 = 1/(K_SR1·K_WGS) [bar⁻²]
// The signed-extent SMR+WGS solver cannot reach the joint reverse corner
// (inner WGS equilibrium pins CO), so methanation is solved directly with
// alternating 1D bisections (each monotone; weakly coupled system).
// ---------------------------------------------------------------------------

export interface MethanatorResult {
  n: Moles;
  xiCO: number; // kmol/h CO methanated
  xiCO2: number; // kmol/h CO2 methanated
}

export function solveMethanator(nIn: Moles, T: number, P: number): MethanatorResult {
  const P_bar = P / 1e5;
  const K1 = 1 / kSR1(T);
  const K2 = 1 / (kSR1(T) * kWGS(T));

  const compose = (a: number, b: number): Moles => {
    const n = nIn.slice();
    n[2] -= a; // CO
    n[0] -= 3 * a + 4 * b; // H2
    n[4] += a + b; // CH4
    n[7] += a + 2 * b; // H2O
    n[3] -= b; // CO2
    return n;
  };

  const partials = (n: Moles): number[] => {
    let tot = 0;
    for (let i = 0; i < N_SP; i++) tot += Math.max(n[i], 0);
    if (tot <= 0) return new Array(N_SP).fill(0);
    return n.map((v) => (Math.max(v, 0) / tot) * P_bar);
  };

  const q1 = (a: number, b: number): number => {
    const p = partials(compose(a, b));
    const den = p[2] * Math.pow(p[0], 3);
    if (den <= 0) return Infinity;
    return (p[4] * p[7]) / den;
  };
  const q2 = (a: number, b: number): number => {
    const p = partials(compose(a, b));
    const den = p[3] * Math.pow(p[0], 4);
    if (den <= 0) return Infinity;
    return (p[4] * p[7] * p[7]) / den;
  };

  let a = 0;
  let b = 0;
  for (let alt = 0; alt < 60; alt++) {
    // solve extent a with b fixed (Q1 monotone ↑ in a)
    const aMax = Math.max(0, Math.min(nIn[2], (nIn[0] - 4 * b) / 3));
    let aNew = a;
    if (aMax <= 0) {
      aNew = 0;
    } else if (q1(0, b) >= K1) {
      aNew = 0;
    } else if (q1(aMax, b) <= K1) {
      aNew = aMax;
    } else {
      let lo = 0;
      let hi = aMax;
      for (let k = 0; k < 50; k++) {
        const mid = 0.5 * (lo + hi);
        if (q1(mid, b) < K1) lo = mid;
        else hi = mid;
      }
      aNew = 0.5 * (lo + hi);
    }
    // solve extent b with a fixed (Q2 monotone ↑ in b)
    const bMax = Math.max(0, Math.min(nIn[3], (nIn[0] - 3 * aNew) / 4));
    let bNew = b;
    if (bMax <= 0) {
      bNew = 0;
    } else if (q2(aNew, 0) >= K2) {
      bNew = 0;
    } else if (q2(aNew, bMax) <= K2) {
      bNew = bMax;
    } else {
      let lo = 0;
      let hi = bMax;
      for (let k = 0; k < 50; k++) {
        const mid = 0.5 * (lo + hi);
        if (q2(aNew, mid) < K2) lo = mid;
        else hi = mid;
      }
      bNew = 0.5 * (lo + hi);
    }
    const done = Math.abs(aNew - a) < 1e-11 && Math.abs(bNew - b) < 1e-11;
    a = aNew;
    b = bNew;
    if (done) break;
  }
  return { n: compose(a, b), xiCO: a, xiCO2: b };
}

export interface Nh3EqResult {
  xi: number; // kmol/h N2 reacted
  n: Moles;
  reached: boolean;
}

/**
 * Equilibrium extent for an adiabatic bed slice at T [K], P [Pa].
 * GB Kp in atm terms; returns extent (not yet multiplied by fractional approach).
 */
export function solveNh3Eq(nIn: Moles, T: number, P: number): Nh3EqResult {
  const P_atm = P / 101325;
  const K = Math.pow(kpNH3(T, P_atm), 2); // full reaction, atm⁻²

  const xiMax = Math.max(0, Math.min(nIn[1], nIn[0] / 3));
  // allow dissociation (negative extent) — warm condenser edge cases
  const xiMin = -Math.max(0, nIn[6] / 2);
  if (xiMax <= 0 && xiMin >= 0) return { xi: 0, n: nIn.slice(), reached: true };

  const compose = (xi: number): Moles => {
    const n = nIn.slice();
    n[1] -= xi;
    n[0] -= 3 * xi;
    n[6] += 2 * xi;
    return n;
  };

  const q = (xi: number): number => {
    const n = compose(xi);
    let tot = 0;
    for (let i = 0; i < N_SP; i++) tot += Math.max(n[i], 0);
    if (tot <= 0) return 0;
    const pN2 = (Math.max(n[1], 0) / tot) * P_atm;
    const pH2 = (Math.max(n[0], 0) / tot) * P_atm;
    const pNH3 = (Math.max(n[6], 0) / tot) * P_atm;
    return (pNH3 * pNH3) / (Math.max(pN2, 1e-300) * Math.pow(Math.max(pH2, 1e-300), 3));
  };

  const xiHi = xiMax * (1 - 1e-10);
  if (q(xiHi) <= K) {
    // equilibrium beyond reachable extent
    return { xi: xiMax, n: compose(xiMax), reached: false };
  }
  let a = xiMin;
  let b = Math.max(xiHi, xiMin + 1e-12);
  if (q(a) >= K) {
    // full dissociation limit
    return { xi: xiMin, n: compose(xiMin), reached: false };
  }
  for (let k = 0; k < 50; k++) {
    const mid = 0.5 * (a + b);
    if (q(mid) < K) a = mid;
    else b = mid;
  }
  const xi = 0.5 * (a + b);
  return { xi, n: compose(xi), reached: true };
}

// ---------------------------------------------------------------------------
// Methanol synthesis equilibrium (species #3 — the methanol family)
// ---------------------------------------------------------------------------
//
// Two parallel reactions over Cu/ZnO/Al2O3:
//   r1:  CO  + 2 H2 ⇌ CH3OH          ΔH°298 −90.5 kJ/mol, ΔS°298 −219.0 J/mol·K
//   r2:  CO2 + 3 H2 ⇌ CH3OH + H2O    ΔH°298 −49.3 kJ/mol, ΔS°298 −177.0 J/mol·K
//
// Kp from ΔG°(T) with constant-ΔCp correction (textbook method; ΔCp from the
// Cp(T) fits in species.ts): ln K = −ΔG°(T)/(R·T), bar basis (Δn = −2).
// Anchor check at 523 K (250 °C): K1 ≈ 2.4e−3 bar⁻², K2 ≈ 2.4e−5 bar⁻² —
// within a factor ~2 of the Graaf-era correlations, which is teaching-grade
// (the per-pass conversion story it tells matches industrial practice).

/** r1: CO + 2 H2 ⇌ CH3OH — K1 = p_MeOH / (p_CO · p_H2²) [bar⁻²] */
export function kpMeOH1(T: number): number {
  const dCp = -30.0;
  const dH = -90500 + dCp * (T - 298.15);
  const dS = -219.0 + dCp * Math.log(T / 298.15);
  return Math.exp(-(dH - T * dS) / (RG * T));
}

/** r2: CO2 + 3 H2 ⇌ CH3OH + H2O — K2 = (p_MeOH · p_H2O) / (p_CO2 · p_H2³) [bar⁻²] */
export function kpMeOH2(T: number): number {
  const dCp = -41.0;
  const dH = -49300 + dCp * (T - 298.15);
  const dS = -177.0 + dCp * Math.log(T / 298.15);
  return Math.exp(-(dH - T * dS) / (RG * T));
}

export interface MeohEqResult {
  /** extent of r1 (CO route), kmol/h */
  xi1: number;
  /** extent of r2 (CO2 route), kmol/h */
  xi2: number;
  n: Moles;
  reached: boolean;
}

/** apply both extents (indexes: CO 2, CO2 3, H2 0, H2O 7, CH3OH 11) */
export function composeMeoh(nIn: Moles, xi1: number, xi2: number): Moles {
  const n = nIn.slice();
  n[2] -= xi1;
  n[0] -= 2 * xi1;
  n[11] += xi1;
  n[3] -= xi2;
  n[0] -= 3 * xi2;
  n[11] += xi2;
  n[7] += xi2;
  return n;
}

/**
 * Simultaneous r1 + r2 equilibrium at T [K], P [Pa] — alternating bisection
 * on the two extents (each Q is monotone in its own extent, and the coupling
 * through H2 is weak), failure-free by construction like the NH3 solver.
 */
export function solveMeohEq(nIn: Moles, T: number, P: number): MeohEqResult {
  const P_bar = P / 1e5;
  const K1 = kpMeOH1(T);
  const K2 = kpMeOH2(T);

  const xi1Max = Math.max(0, Math.min(nIn[2], nIn[0] / 2));
  const xi2Max = Math.max(0, Math.min(nIn[3], nIn[0] / 3));

  const q = (x1: number, x2: number): [number, number] => {
    const n = composeMeoh(nIn, x1, x2);
    let tot = 0;
    for (let i = 0; i < N_SP; i++) tot += Math.max(n[i], 0);
    if (tot <= 0 || P_bar <= 0) return [0, 0];
    const p = (i: number) => (Math.max(n[i], 0) / tot) * P_bar;
    const pH2 = Math.max(p(0), 1e-300);
    const q1 = p(11) / (Math.max(p(2), 1e-300) * pH2 * pH2);
    const q2 = (p(11) * p(7)) / (Math.max(p(3), 1e-300) * pH2 * pH2 * pH2);
    return [q1, q2];
  };

  if (xi1Max <= 0 && xi2Max <= 0) return { xi1: 0, xi2: 0, n: nIn.slice(), reached: true };

  // alternating bisection: inner solves ξ1 at fixed ξ2 (Q1 ↓ in ξ1), then ξ2
  // at fixed ξ1 (Q2 ↓ in ξ2); both are bracketed [0, max]
  let x2 = 0;
  let x1 = 0;
  let reached = true;
  const bisect = (
    f: (v: number) => number,
    K: number,
    hiMax: number,
  ): { v: number; hitBound: boolean } => {
    const hi = Math.max(hiMax * (1 - 1e-10), 0);
    if (hi <= 0 || f(hi) < K) return { v: hi, hitBound: true }; // eq beyond reachable extent
    let a = 0;
    let b = hi;
    if (f(0) >= K) return { v: 0, hitBound: false }; // already past eq at zero extent
    for (let k = 0; k < 60; k++) {
      const mid = 0.5 * (a + b);
      if (f(mid) < K) a = mid;
      else b = mid;
    }
    return { v: 0.5 * (a + b), hitBound: false };
  };

  for (let outer = 0; outer < 30; outer++) {
    const r1 = bisect((v) => q(v, x2)[0], K1, xi1Max);
    if (r1.hitBound) reached = false;
    x1 = r1.v;
    const r2 = bisect((v) => q(x1, v)[1], K2, xi2Max);
    if (r2.hitBound) reached = false;
    const x2New = r2.v;
    if (Math.abs(x2New - x2) < 1e-9) {
      x2 = x2New;
      break;
    }
    x2 = x2New;
  }
  return { xi1: x1, xi2: x2, n: composeMeoh(nIn, x1, x2), reached };
}

export { RG };
