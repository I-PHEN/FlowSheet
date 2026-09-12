/**
 * Convergence machinery — extracted VERBATIM from the legacy plant.ts
 * (solveLinear9, the air-controller secant, and the damped-DS + Broyden
 * tear loop). Same operations in the same order, parameterized only by
 * callbacks, so the graph executor reproduces the legacy numbers and
 * solver traces exactly. Generalizing these for other species is a later
 * concern (D2+); do not "clean them up" — the identity gate reads this
 * file's behavior byte-for-byte.
 */

import type { Moles } from './species';
import { ATOMS, ATOM_MATRIX, N_SP } from './species';
import { total } from './thermo';
import type { SolverTraceRow } from './types';

/** Solve a 9×9 (N_SP×N_SP) dense linear system by Gaussian elimination
 * with partial pivoting. Returns null if singular. */
export function solveLinear9(AIn: number[][], b: number[]): number[] | null {
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
// Secant controller (design-time feedback) — port of solveAir's loop
// ---------------------------------------------------------------------------

export interface SecantEval<T> {
  /** residual f(x); the controller drives this toward 0 */
  val: number;
  /** full state of this evaluation (executor snapshots the section) */
  state: T;
}

/**
 * Secant + bracketing search, ported verbatim from the legacy H2/N2 air
 * controller: f decreasing in x, bracket maintained [xLo, xHi] with
 * f(xLo) > 0 > f(xHi), best-so-far tracking, 30 iterations, tol 0.003.
 */
export function solveSecant<T>(x0: number, x1: number, f: (x: number) => SecantEval<T>): { x: number; state: T; err: number } {
  let r0 = f(x0);
  let r1 = f(x1);
  let xLo = r0.val > r1.val ? x0 : x1;
  let xHi = r0.val > r1.val ? x1 : x0;
  let fLo = Math.max(r0.val, r1.val);
  let fHi = Math.min(r0.val, r1.val);
  let best =
    Math.abs(r1.val) < Math.abs(r0.val) ? { x: x1, state: r1.state, err: r1.val } : { x: x0, state: r0.state, err: r0.val };

  for (let k = 0; k < 30; k++) {
    if (Math.abs(best.err) < 0.003) break;
    let x2: number;
    if (Math.abs(r1.val - r0.val) < 1e-12) {
      x2 = 0.5 * (xLo + xHi);
    } else {
      x2 = x1 - (r1.val * (x1 - x0)) / (r1.val - r0.val);
    }
    if (x2 < 50 || x2 > 20000 || x2 < xLo || x2 > xHi) x2 = 0.5 * (xLo + xHi);
    const r2 = f(x2);
    if (Math.abs(r2.val) < Math.abs(best.err)) best = { x: x2, state: r2.state, err: r2.val };
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
  void fLo;
  void fHi;
  return best;
}

// ---------------------------------------------------------------------------
// Tear-stream convergence — port of run()'s damped-DS + Broyden block
// ---------------------------------------------------------------------------

export interface TearLoopOut {
  x: Moles;
  g: Moles;
  converged: boolean;
  iterations: number;
  trace: SolverTraceRow[];
}

/**
 * Converge g(x) = x on the torn stream flows. Verbatim port of the legacy
 * loop: 4 damped direct-substitution passes to enter the basin, then
 * Broyden quasi-Newton with trust region, step limiting, rank-1 updates
 * and stall resets. gFn is called exactly where the legacy code called
 * loopPass — the executor's closure keeps the latest section state.
 */
export function solveTearLoop(gFn: (x: Moles) => Moles, tear0: Moles, resid: (a: Moles, b: Moles) => number): TearLoopOut {
  const trace: SolverTraceRow[] = [];
  let converged = false;
  const TOL = 1e-7;
  const MAXIT = 60;

  // --- stage 1: damped direct substitution to enter the basin ---
  let x = tear0.slice();
  let g = gFn(x);
  let err = resid(g, x);
  trace.push({ iter: 1, err, method: 'damped-DS' });
  let gPrev: Moles = g.slice();
  let xPrevDS: Moles = x.slice();
  for (let k = 1; k < 4; k++) {
    const xOld = x;
    const gOld = g;
    x = x.map((v, i) => v + 0.5 * (g[i] - v));
    g = gFn(x);
    gPrev = gOld;
    xPrevDS = xOld;
    err = resid(g, x);
    trace.push({ iter: k + 1, err, method: 'damped-DS' });
  }

  // --- stage 2: Broyden quasi-Newton on F(x) = g(x) − x ---
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
    const F: Moles = g.map((v, i) => v - x[i]);
    const rhs = F.map((v) => -v);
    const dx = solveLinear9(J, rhs);
    if (!dx) {
      x = x.map((v, i) => v + 0.5 * (g[i] - v));
      g = gFn(x);
      trace.push({ iter: iter + 1, err: resid(g, x), method: 'damped-DS' });
      continue;
    }
    let xMax = 0;
    for (let i = 0; i < N_SP; i++) xMax = Math.max(xMax, x[i]);
    let stepMax = 0;
    for (let i = 0; i < N_SP; i++) stepMax = Math.max(stepMax, Math.abs(dx[i]));
    const cap = 0.6 * Math.max(xMax, 1);
    if (stepMax > cap) for (let i = 0; i < N_SP; i++) dx[i] *= cap / stepMax;

    let xn: Moles = x.map((v, i) => Math.max(0, v + dx[i]));
    let gn = gFn(xn);
    let errN = resid(gn, xn);
    let tries = 0;
    while (errN > 3 * err && tries < 3) {
      for (let i = 0; i < N_SP; i++) dx[i] *= 0.5;
      xn = x.map((v, i) => Math.max(0, v + dx[i]));
      gn = gFn(xn);
      errN = resid(gn, xn);
      tries++;
    }

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
    trace.push({ iter: iter + 1, err: errN, method: 'broyden' });
    if (iter - lastImprovementIter > 6) {
      for (let i = 0; i < N_SP; i++) {
        for (let j = 0; j < N_SP; j++) J[i][j] = 0;
        J[i][i] = -0.5;
      }
      lastImprovementIter = iter;
    }
  }
  const iterations = Math.min(iter + 1, MAXIT);
  if (resid(g, x) < TOL) converged = true;
  return { x, g, converged, iterations, trace };
}

/** Convergence residual: flow mismatch + atom-balance mismatch scaled by
 * each element's own make-up atom flow (verbatim from legacy run()).
 * NOTE: the flow term's scale is total(b) — the CURRENT tear value —
 * recomputed on every call, exactly as the legacy closure did. */
export function makeResid(makeup: Moles): (a: Moles, b: Moles) => number {
  const makeupAtoms: number[] = ATOMS.map((_, e) => {
    let s = 0;
    for (let i = 0; i < N_SP; i++) s += ATOM_MATRIX[e][i] * makeup[i];
    return Math.max(s, 1);
  });
  return (a: Moles, b: Moles): number => {
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
}
