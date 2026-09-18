/**
 * Flow animation core — the "physics of the dots", PURE (no DOM).
 *
 * Philosophy: animate the SOLVED state, never the physics. Particles ride
 * the exact lines the sheet already draws; the solver's numbers decide how
 * fast, how many, how big, and what color they are. Nothing here invents
 * geometry or chemistry — it maps measured facts onto motion.
 *
 * The contract (FlowSpec) is deliberately canvas-agnostic: any renderer
 * that can draw a stream line as an SVG path and read the plant's solved
 * molar flows can emit one spec per stream. The grid-routed builder canvas,
 * the hand-authored reference sheet, and future conceptual plants (flow = 0
 * → dots simply never appear) all speak the same language.
 *
 * Scaling laws (world units; sheets are ~1800 wide, strokes 2.6):
 *   speed  — log-normalized molar flow: flows span decades (a 300 kmol/h
 *            purge beside a 25,000 kmol/h loop), so a linear map would
 *            either blur the loop or freeze the purge. Liquid services move
 *            at ~half speed — heavier material, calmer line.
 *   count  — even coverage along the line (a bead every ~150 units) capped
 *            at 5, floored at 1; near-dead streams (<2 % of max) run sparse.
 *            A global budget keeps 100-stream plants under ~260 dots.
 *   radius — grows with the square root of relative flow: the loop gas
 *            reads visibly fatter than the purge without cartoon scaling.
 *   color  — the stream's class color, EXCEPT streams carrying ≥ 10 mol%
 *            of the plant's DECLARED product species (kpis.productSpecies):
 *            those dots take the product hue. Converter effluent goes green
 *            on an ammonia loop; sulphur-laden Claus gas goes gold. The tint
 *            is data-driven — no family-specific code.
 */

import { C, STREAM_STYLE } from '@/lib/design/tokens';
import { SPECIES, type Moles } from '@/lib/engine/species';

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

/** One animatable stream, emitted by any canvas. World coordinates. */
export interface FlowSpec {
  id: string;
  /** the EXACT SVG path the line was drawn with (rounded corners,
   *  beziers, self-loops — the sampler handles any geometry) */
  d: string;
  /** total molar flow, kmol/h; ≤ 0 (or unknown) → the stream stays silent */
  flow: number;
  /** dot fill color */
  color: string;
  /** liquid service → slower, heavier dots */
  liquid?: boolean;
  /** fractional position of the stream-number pill (dots mask around it) */
  pillAt?: number;
}

// ---------------------------------------------------------------------------
// Scaling laws
// ---------------------------------------------------------------------------

/** world-units/second at speed multiplier 1 */
export const FLOW_SPEED = { min: 26, max: 150 } as const;
/** dot radius range, world units */
export const FLOW_R = { min: 2.1, max: 3.6 } as const;
/** global dot budget — the animation must never own the frame */
export const FLOW_BUDGET = 260;

/** log-normalized speed: 0 → FLOW_SPEED.min, max flow → FLOW_SPEED.max */
export function speedFor(flow: number, max: number, liquid = false): number {
  const f = max > 0 ? Math.min(1, flow / max) : 0;
  // log10(1 + 9f): 0 at f=0, 1 at f=1 — perceptual, not physical, time
  const t = Math.log10(1 + 9 * f);
  const v = FLOW_SPEED.min + (FLOW_SPEED.max - FLOW_SPEED.min) * t;
  return liquid ? v * 0.5 : v;
}

/** dot count for one stream: even coverage, importance-aware, capped */
export function dotCount(len: number, flow: number, max: number): number {
  if (!(flow > 0) || len < 20) return 0;
  const coverage = Math.round(len / 150) + 1;
  const sparse = max > 0 && flow / max < 0.02 ? 0.5 : 1;
  return Math.max(1, Math.min(5, Math.round(coverage * sparse)));
}

/** radius: grows with sqrt of relative flow */
export function radiusFor(flow: number, max: number): number {
  const f = max > 0 ? Math.min(1, flow / max) : 0;
  return FLOW_R.min + (FLOW_R.max - FLOW_R.min) * Math.sqrt(f);
}

/** apply the global budget: scale counts down (floor 1) until they fit */
export function applyBudget(counts: number[], budget = FLOW_BUDGET): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= budget || total === 0) return counts;
  const k = budget / total;
  return counts.map((n) => Math.max(1, Math.floor(n * k)));
}

// ---------------------------------------------------------------------------
// Product tint — composition-driven, family-agnostic
// ---------------------------------------------------------------------------

/** declared product species → product hue (data, not family code) */
const PRODUCT_TINT: Record<string, string> = {
  NH3: C.nh3,
  CH3OH: C.nh3,
  S2: C.sulfur,
};

/**
 * Does this stream carry the plant's product? ≥ 10 mol% of the declared
 * product species → the product hue; otherwise null (caller keeps the
 * class color). Declared product from PlantResult.kpis.productSpecies.
 */
export function tintFor(n: Moles | undefined, productSpecies?: string): string | null {
  if (!n || !productSpecies) return null;
  const tint = PRODUCT_TINT[productSpecies];
  if (!tint) return null;
  const i = (SPECIES as readonly string[]).indexOf(productSpecies);
  if (i < 0 || i >= n.length) return null;
  let tot = 0;
  for (const v of n) tot += v;
  if (tot <= 0) return null;
  return n[i] / tot >= 0.1 ? tint : null;
}

/** total molar flow of a solved stream, kmol/h */
export function totalFlow(n: Moles | undefined): number {
  if (!n) return 0;
  let t = 0;
  for (const v of n) t += v;
  return t;
}

/** dot color for a stream: product tint when carrying, class color otherwise */
export function dotColor(
  cls: string,
  n: Moles | undefined,
  productSpecies?: string,
): string {
  return tintFor(n, productSpecies) ?? (STREAM_STYLE[cls] ?? STREAM_STYLE.syngas).color;
}

// ---------------------------------------------------------------------------
// Path sampling — LUTs built once per geometry, read every frame
// ---------------------------------------------------------------------------

/** uniform arc-length samples of a path (built in FlowLayer via DOM
 *  getTotalLength/getPointAtLength — any geometry, corners and beziers) */
export interface PathLUT {
  xs: Float64Array;
  ys: Float64Array;
  /** number of samples */
  n: number;
  /** total path length, world units */
  len: number;
}

/** position at fraction t ∈ [0,1] (clamped) — O(1) linear interpolation */
export function sampleLUT(lut: PathLUT, t: number): { x: number; y: number } {
  const f = Math.max(0, Math.min(1, t)) * (lut.n - 1);
  const i = Math.min(lut.n - 2, Math.floor(f));
  const k = f - i;
  return {
    x: lut.xs[i] + (lut.xs[i + 1] - lut.xs[i]) * k,
    y: lut.ys[i] + (lut.ys[i + 1] - lut.ys[i]) * k,
  };
}

/**
 * Dot visibility at fraction t:
 *   - fade in/out over the first/last 6 % of the run (dots are born inside
 *     the line, not on the unit's edge)
 *   - masked around the number pill (± 20 world units) so a dot never
 *     slides across the stream's own label
 */
export function dotOpacity(t: number, len: number, pillAt?: number): number {
  const edge = Math.min(t, 1 - t) / 0.06;
  const fade = Math.max(0, Math.min(1, edge));
  if (pillAt == null || len <= 0) return fade;
  const half = 20 / len;
  const d = Math.abs(t - pillAt);
  if (d >= half) return fade;
  // smooth ramp back to full across the outer half of the window
  const k = Math.max(0, Math.min(1, (half - d) / (half * 0.5)));
  return fade * (1 - k);
}

/** deterministic per-stream phase offset so a re-render never reshuffles
 *  the dots (hash of the id; multiplier is irrational-ish to decorrelate) */
export function phaseFor(id: string, i: number, count: number): number {
  let h = 2166136261;
  for (let c = 0; c < id.length; c++) {
    h ^= id.charCodeAt(c);
    h = Math.imul(h, 16777619);
  }
  const jitter = ((h >>> 0) % 997) / 997;
  return (i / count + jitter * 0.618) % 1;
}
