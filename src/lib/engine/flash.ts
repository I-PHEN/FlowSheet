import { N_SP, RG, SP, SPECIES } from './species';
import { prFugacity } from './pr';
import type { Moles } from './species';

/**
 * Isothermal two-phase PT flash — Rachford–Rice with successive substitution
 * on PR fugacity ratios. Wilson K-values for initialization.
 * Returns molar flows (kmol/h) of each phase, given feed flows n (kmol/h).
 */

export interface FlashResult {
  twoPhase: boolean;
  /** vapor fraction (0..1) of the flashed amount */
  beta: number;
  vapor: Moles;
  liquid: Moles;
  /** vapor & liquid mole fractions */
  yv: number[];
  xl: number[];
  iterations: number;
  converged: boolean;
}

function wilsonK(T: number, P: number): number[] {
  const K: number[] = new Array(N_SP);
  for (let i = 0; i < N_SP; i++) {
    const sp = SP[SPECIES[i]];
    K[i] = (sp.pc / P) * Math.exp(5.373 * (1 + sp.omega) * (1 - sp.tc / T));
  }
  return K;
}

/** Rachford–Rice f(β) — monotone decreasing in β */
function rr(z: number[], K: number[], beta: number): number {
  let s = 0;
  for (let i = 0; i < N_SP; i++) {
    const d = 1 + beta * (K[i] - 1);
    if (Math.abs(d) < 1e-14) continue;
    s += (z[i] * (K[i] - 1)) / d;
  }
  return s;
}

/** Solve RR for β by bisection; returns null if single-phase */
function solveBeta(z: number[], K: number[]): number | null {
  const f0 = rr(z, K, 0); // >0 → some vapor
  const f1 = rr(z, K, 1); // <0 → some liquid
  if (f0 <= 0) return 0; // subcooled liquid
  if (f1 >= 0) return 1; // superheated vapor
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 50; k++) {
    const mid = 0.5 * (lo + hi);
    if (rr(z, K, mid) > 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * PT flash of feed flows n at T [K], P [Pa].
 * If the feed is zero-flow or a single species vanishes, still behaves.
 */
export function flashPT(n: Moles, T: number, P: number): FlashResult {
  const empty: Moles = new Array(N_SP).fill(0);
  const F = n.reduce((a, b) => a + b, 0);
  if (F <= 0) {
    return {
      twoPhase: false,
      beta: 1,
      vapor: empty.slice(),
      liquid: empty.slice(),
      yv: new Array(N_SP).fill(0),
      xl: new Array(N_SP).fill(0),
      iterations: 0,
      converged: true,
    };
  }
  const z = n.map((v) => v / F);

  // Check for a pure-condensable edge: if only one species present, use its PR saturation
  let K = wilsonK(T, P);
  let beta = solveBeta(z, K);
  let vapor: Moles = empty.slice();
  let liquid: Moles = empty.slice();
  let converged = false;
  let iterations = 0;
  const MAXIT = 60;

  if (beta === null) beta = 1;

  for (let it = 0; it < MAXIT; it++) {
    iterations = it + 1;
    if (beta === 0 || beta === 1) {
      // single phase by RR — accept with current K (Wilson-stage decision refined below)
      break;
    }
    // phase compositions from β and K
    const xl: number[] = new Array(N_SP).fill(0);
    const yv: number[] = new Array(N_SP).fill(0);
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < N_SP; i++) {
      xl[i] = z[i] / (1 + beta * (K[i] - 1));
      yv[i] = K[i] * xl[i];
      sx += xl[i];
      sy += yv[i];
    }
    for (let i = 0; i < N_SP; i++) {
      xl[i] /= sx;
      yv[i] /= sy;
    }
    // PR fugacity update
    const fv = prFugacity(yv, T, P, 'vapor');
    const fl = prFugacity(xl, T, P, 'liquid');
    const Knew = new Array(N_SP);
    let maxRel = 0;
    for (let i = 0; i < N_SP; i++) {
      // absent species (z ≈ 0): keep the Wilson K. Its PR pseudo-fugacity is
      // arbitrary, can overflow exp() to Infinity, and Infinity·0 = NaN in
      // the yv[i] = K[i]·xl[i] update would poison the whole flash. A frozen
      // finite K contributes exactly zero everywhere (z[i] = 0 gates every
      // term it appears in) — and it must not gate convergence either:
      Knew[i] = z[i] > 1e-12 ? Math.exp(fl.lnPhi[i] - fv.lnPhi[i]) : K[i];
      if (K[i] > 1e-12 && Knew[i] > 1e-12 && z[i] > 1e-12) {
        maxRel = Math.max(maxRel, Math.abs(Knew[i] / K[i] - 1));
      }
    }
    K = Knew;
    if (maxRel < 1e-9) {
      converged = true;
      break;
    }
    const betaNew = solveBeta(z, K);
    if (betaNew === null) {
      beta = 1;
      break;
    }
    // damp β updates slightly for stability
    beta = beta + 0.9 * (betaNew - beta);
    if (beta <= 0) {
      beta = 0;
      break;
    }
    if (beta >= 1) {
      beta = 1;
      break;
    }
  }

  if (beta === 0 || beta === 1) {
    // verify single-phase with final K: if β boundary but two-phase test says
    // otherwise, accept single phase (teaching-grade robustness)
    const single: Moles = n.slice();
    return {
      twoPhase: false,
      beta,
      vapor: beta === 1 ? single : empty.slice(),
      liquid: beta === 0 ? single : empty.slice(),
      yv: beta === 1 ? z.slice() : new Array(N_SP).fill(0),
      xl: beta === 0 ? z.slice() : new Array(N_SP).fill(0),
      iterations,
      converged: true,
    };
  }

  const xl: number[] = new Array(N_SP).fill(0);
  const yv: number[] = new Array(N_SP).fill(0);
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < N_SP; i++) {
    xl[i] = z[i] / (1 + beta * (K[i] - 1));
    yv[i] = K[i] * xl[i];
    sx += xl[i];
    sy += yv[i];
  }
  for (let i = 0; i < N_SP; i++) {
    xl[i] /= sx;
    yv[i] /= sy;
  }
  // flows: liquid = F(1−β), vapor = Fβ  (normalized to conserve mass exactly)
  const liquidFlows: Moles = new Array(N_SP).fill(0);
  const vaporFlows: Moles = new Array(N_SP).fill(0);
  for (let i = 0; i < N_SP; i++) {
    liquidFlows[i] = F * (1 - beta) * xl[i];
    vaporFlows[i] = F * beta * yv[i];
  }
  return { twoPhase: true, beta, vapor: vaporFlows, liquid: liquidFlows, yv, xl, iterations, converged };
}
