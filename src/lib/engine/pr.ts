import { N_SP, RG, SP, SPECIES } from './species';

/**
 * Peng–Robinson (1976) equation of state with quadratic van der Waals
 * mixing rules (k_ij = 0 — no binary interaction parameters; acceptable
 * teaching-grade assumption for NH3–H2–N2–CH4–Ar at 253 K/14.5 MPa,
 * documented limitation. Research C2: cubic EOS is the right tool here;
 * CoolProp/Cantera cannot do this flash.)
 */

function kappa(omega: number): number {
  return 0.37464 + 1.54226 * omega - 0.26992 * omega * omega;
}

/** pure-component a·α(T), Pa²·m⁶/mol² */
function aAlpha(i: number, T: number): number {
  const sp = SP[SPECIES[i]];
  const a = 0.45724 * (RG * RG * sp.tc * sp.tc) / sp.pc;
  const tr = T / sp.tc;
  const alpha = Math.pow(1 + kappa(sp.omega) * (1 - Math.sqrt(tr)), 2);
  return a * alpha;
}

/** pure-component b, m³/mol */
function bPure(i: number): number {
  const sp = SP[SPECIES[i]];
  return 0.0778 * (RG * sp.tc) / sp.pc;
}

const bArr: number[] = SPECIES.map((_, i) => bPure(i));

/**
 * Cubic roots of Z³ − (1−B)Z² + (A−3B²−2B)Z − (AB−B²−B³) = 0.
 * Returns sorted roots (all real roots; complex case → single root repeated).
 */
function cubicRoots(A: number, B: number): number[] {
  const c2 = -(1 - B);
  const c1 = A - 3 * B * B - 2 * B;
  const c0 = -(A * B - B * B - B * B * B);
  // depress: Z = x − c2/3
  const p = c1 - (c2 * c2) / 3;
  const q = (2 * c2 * c2 * c2) / 27 - (c2 * c1) / 3 + c0;
  const shift = -c2 / 3;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  if (disc > 1e-14) {
    // one real root
    const sq = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + sq);
    const v = Math.cbrt(-q / 2 - sq);
    return [u + v + shift];
  }
  // three real roots — trigonometric method
  const r = Math.sqrt(Math.max(0, -(p * p * p) / 27));
  const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
  const m = 2 * Math.sqrt(Math.max(0, -p / 3));
  const roots = [
    m * Math.cos(phi / 3) + shift,
    m * Math.cos((phi + 2 * Math.PI) / 3) + shift,
    m * Math.cos((phi + 4 * Math.PI) / 3) + shift,
  ];
  return roots.sort((a, b) => a - b);
}

export interface PrMixture {
  Z: number;
  /** ln φ_i */
  lnPhi: number[];
}

/**
 * Fugacity coefficients of every species in a mixture at (y, T, P).
 * Z selection: largest root (vapor-like) by default; pass 'liquid' for smallest.
 */
export function prFugacity(y: number[], T: number, P: number, phase: 'vapor' | 'liquid' = 'vapor'): PrMixture {
  // mixture a, b
  let aMix = 0;
  let bMix = 0;
  for (let i = 0; i < N_SP; i++) {
    bMix += y[i] * bArr[i];
    for (let j = 0; j < N_SP; j++) {
      aMix += y[i] * y[j] * Math.sqrt(aAlpha(i, T) * aAlpha(j, T));
    }
  }
  const A = (aMix * P) / (RG * RG * T * T);
  const B = (bMix * P) / (RG * T);
  const roots = cubicRoots(A, B);
  const Z = roots.length === 1 ? roots[0] : phase === 'vapor' ? roots[roots.length - 1] : roots[0];

  const lnPhi: number[] = new Array(N_SP).fill(0);
  const sqrt2 = Math.SQRT2;
  const logZB = Math.log(Math.max(Z - B, 1e-12)); // ln(Z − B)
  for (let i = 0; i < N_SP; i++) {
    // Σ_j y_j a_ij / a_mix
    let sumA = 0;
    for (let j = 0; j < N_SP; j++) {
      sumA += y[j] * Math.sqrt(aAlpha(i, T) * aAlpha(j, T));
    }
    const AbyB = A / (2 * sqrt2 * B);
    const bracket = 2 * (aMix > 0 ? sumA / aMix : 0) - (bMix > 0 ? bArr[i] / bMix : 0);
    const logArg = (Z + (1 + sqrt2) * B) / Math.max(Z + (1 - sqrt2) * B, 1e-12);
    lnPhi[i] =
      (bArr[i] / bMix) * (Z - 1) - logZB - AbyB * bracket * Math.log(Math.max(logArg, 1e-300));
  }
  return { Z, lnPhi };
}

/** Compressibility factor of a mixture (vapor root) — for compressor work */
export function prZ(y: number[], T: number, P: number): number {
  return prFugacity(y, T, P, 'vapor').Z;
}

/**
 * PR residual (departure) enthalpy of a mixture, J/mol.
 * H^R = RT(Z−1) + [T·∂a/∂T − a]/(2√2·b) · ln[(Z+(1+√2)B)/(Z+(1−√2)B)]
 * Captures latent heat across phase changes (condenser duty).
 */
export function prEnthalpyDep(y: number[], T: number, P: number, phase: 'vapor' | 'liquid'): number {
  const N = y.length;
  let aMix = 0;
  let bMix = 0;
  let dAdT = 0;
  const A = new Array(N).fill(0);
  const dA = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const sp = SP[SPECIES[i]];
    const ai = 0.45724 * (RG * RG * sp.tc * sp.tc) / sp.pc;
    const tr = T / sp.tc;
    const kap = kappa(sp.omega);
    const sqAlpha = 1 + kap * (1 - Math.sqrt(tr));
    A[i] = ai * sqAlpha * sqAlpha;
    // dα/dT = −κ·√α / (Tc·√Tr)
    dA[i] = ai * 2 * sqAlpha * (-kap / (2 * sp.tc * Math.sqrt(tr)));
    bMix += y[i] * bArr[i];
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const t_ij = Math.sqrt(A[i] * A[j]);
      aMix += y[i] * y[j] * t_ij;
      dAdT += y[i] * y[j] * t_ij * (dA[i] / (2 * A[i]) + dA[j] / (2 * A[j]));
    }
  }
  const Aa = (aMix * P) / (RG * RG * T * T);
  const Bb = (bMix * P) / (RG * T);
  const roots = cubicRoots(Aa, Bb);
  const Z = roots.length === 1 ? roots[0] : phase === 'vapor' ? roots[roots.length - 1] : roots[0];
  const logArg = (Z + (1 + Math.SQRT2) * Bb) / Math.max(Z + (1 - Math.SQRT2) * Bb, 1e-12);
  const term = (T * dAdT - aMix) / (2 * Math.SQRT2 * bMix);
  return RG * T * (Z - 1) + term * Math.log(Math.max(logArg, 1e-300));
}
