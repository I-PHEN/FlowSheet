/**
 * Grid router — collision-free stream routing for computed layouts.
 *
 * The builder canvas and the project thumbnails place units on a grid:
 * depth columns wrapped into bands. That structure gives us two families
 * of guaranteed-empty channels:
 *
 *   corridors — vertical strips between adjacent columns (plus margins)
 *   lanes     — horizontal strips between adjacent rows (plus margins)
 *
 * Every route is assembled from segments that live entirely inside a
 * corridor or a lane, so a stream can NEVER pass over a unit box —
 * which is where the unit's name lives. Whatever the agent builds,
 * however it recycles, lines and names never touch.
 *
 * Rules (real-drawing conventions, adapted to the grid):
 *   forward, adjacent column  → one corridor: out the right edge,
 *                               jog in the corridor, into the left edge
 *   forward, skipping columns → corridor + lane hop over/under the
 *                               columns in between
 *   forward, same column      → straight drop into the top (the band
 *                               wrap reads as a vertical continuation)
 *   recycle (backward)        → corridor down to a lane BELOW both
 *                               units, run back, rise into the target
 *                               (bottom entry when clear, right-side
 *                               entry otherwise)
 *   sink (leaves the plant)   → short arrow off toward the margin
 */

export interface RRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RouteGrid {
  /** sorted distinct column LEFT edges */
  colXs: number[];
  /** sorted distinct row TOP edges */
  rowYs: number[];
  /** all placed unit boxes (occupancy checks) */
  rects: RRect[];
  width: number;
  height: number;
}

export interface RoutedStream {
  pts: Array<[number, number]>;
  /** arrowhead direction at the end (radians, 0 = right) */
  endAngle: number;
}

export function buildGrid(rects: RRect[], width: number, height: number): RouteGrid {
  const colSet = new Set<number>();
  const rowSet = new Set<number>();
  for (const r of rects) {
    colSet.add(Math.round(r.x));
    rowSet.add(Math.round(r.y));
  }
  return {
    colXs: [...colSet].sort((a, b) => a - b),
    rowYs: [...rowSet].sort((a, b) => a - b),
    rects,
    width,
    height,
  };
}

const eps = 1.5;

/** vertical corridor between a rect's column and the next (or the margin) */
function corridorRight(r: RRect, g: RouteGrid): number {
  const next = g.colXs.find((x) => x > r.x + eps);
  if (next === undefined) return Math.min(r.x + r.w + 30, g.width - 10);
  return (r.x + r.w + next) / 2;
}

/** vertical corridor between the previous column and a rect's column */
function corridorLeft(r: RRect, g: RouteGrid): number {
  const prev = [...g.colXs].reverse().find((x) => x < r.x - eps);
  if (prev === undefined) return Math.max(r.x - 30, 10);
  // previous column shares the unit width in these grids
  const prevRight = prev + (g.rects.find((q) => Math.round(q.x) === prev)?.w ?? r.w);
  return (prevRight + r.x) / 2;
}

/** horizontal lane between a rect's row and the next (or the margin) */
function laneBelow(y: number, g: RouteGrid): { y: number; nextTop: number | null } {
  const bottom = (() => {
    const r = g.rects.find((q) => Math.round(q.y) === Math.round(y));
    return y + (r?.h ?? 0);
  })();
  const nextTop = g.rowYs.find((v) => v > y + eps) ?? null;
  if (nextTop === null) return { y: Math.min(bottom + 26, g.height - 12), nextTop: null };
  return { y: (bottom + nextTop) / 2, nextTop };
}

/** horizontal lane between the previous row and a rect's row */
function laneAbove(y: number, g: RouteGrid): number {
  const prev = [...g.rowYs].reverse().find((v) => v < y - eps);
  if (prev === undefined) return Math.max(y - 26, 12);
  const prevBottom = prev + (g.rects.find((q) => Math.round(q.y) === prev)?.h ?? 0);
  return (prevBottom + y) / 2;
}

/** is the vertical span at x, from y0 to y1, free of unit boxes? */
function verticalClear(x: number, y0: number, y1: number, g: RouteGrid, skip: RRect[]): boolean {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  for (const r of g.rects) {
    if (skip.includes(r)) continue;
    if (x > r.x - 3 && x < r.x + r.w + 3 && hi > r.y + 3 && lo < r.y + r.h - 3) return false;
  }
  return true;
}

/** columns strictly between two x positions */
function columnsBetween(x0: number, x1: number, g: RouteGrid): number[] {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  return g.colXs.filter((x) => x > lo + eps && x < hi - eps);
}

export interface RouteOpts {
  /** stagger index among parallel streams on the same pair */
  pairIndex?: number;
  /** stagger index among recycle lanes */
  laneIndex?: number;
}

export function routeStream(
  a: RRect,
  b: RRect | null,
  g: RouteGrid,
  forward: boolean,
  opts: RouteOpts = {},
): RoutedStream {
  const { pairIndex = 0, laneIndex = 0 } = opts;
  const sy = a.y + a.h / 2;

  // ---- sink: leaves the plant toward the margin ----
  if (!b) {
    const ex = Math.min(a.x + a.w + 64, g.width - 8);
    return { pts: [[a.x + a.w, sy], [ex, sy]], endAngle: 0 };
  }

  const ey = b.y + b.h / 2;
  const sameCol = Math.abs(b.x - a.x) <= eps;

  if (forward) {
    // ---- same column: the band wrap — drop into the top ----
    if (sameCol && b.y > a.y) {
      const cx = a.x + a.w / 2;
      if (verticalClear(cx, a.y + a.h, b.y, g, [a, b])) {
        return { pts: [[cx, a.y + a.h], [cx, b.y]], endAngle: Math.PI / 2 };
      }
      const xc = corridorRight(a, g);
      return { pts: [[a.x + a.w, sy], [xc, sy], [xc, ey], [b.x, ey]], endAngle: 0 };
    }

    const rightward = b.x > a.x + eps;
    if (rightward) {
      const xc = (a.x + a.w + b.x) / 2 + pairIndex * 14;
      if (columnsBetween(a.x, b.x, g).length === 0) {
        // adjacent column — one corridor jog
        return { pts: [[a.x + a.w, sy], [xc, sy], [xc, ey], [b.x, ey]], endAngle: 0 };
      }
      // skipping columns — hop over/under them in the row lane
      const xc0 = corridorRight(a, g);
      const xc1 = corridorLeft(b, g);
      const laneY = b.y >= a.y ? laneBelow(a.y, g).y : laneAbove(a.y, g);
      return {
        pts: [
          [a.x + a.w, sy],
          [xc0, sy],
          [xc0, laneY],
          [xc1, laneY],
          [xc1, ey],
          [b.x, ey],
        ],
        endAngle: 0,
      };
    }

    // leftward forward (serpentine band flip): mirror of the above
    const xc = (b.x + b.w + a.x) / 2 - pairIndex * 14;
    if (columnsBetween(b.x, a.x, g).length === 0) {
      return { pts: [[a.x, sy], [xc, sy], [xc, ey], [b.x + b.w, ey]], endAngle: Math.PI };
    }
    const xc0 = corridorLeft(a, g);
    const xc1 = corridorRight(b, g);
    const laneY = b.y >= a.y ? laneBelow(a.y, g).y : laneAbove(a.y, g);
    return {
      pts: [
        [a.x, sy],
        [xc0, sy],
        [xc0, laneY],
        [xc1, laneY],
        [xc1, ey],
        [b.x + b.w, ey],
      ],
      endAngle: Math.PI,
    };
  }

  // ---- recycle: down a corridor, back along a lane below both ----
  const xc0 = corridorRight(a, g);
  const lowerY = Math.max(a.y, b.y);
  const { y: baseLane, nextTop } = laneBelow(lowerY, g);
  let laneY = baseLane + laneIndex * 15;
  if (nextTop !== null) laneY = Math.min(laneY, nextTop - 9);
  else laneY = Math.min(laneY, g.height - 10);

  // preferred: rise straight into the target's bottom
  const bcx = b.x + b.w / 2;
  if (verticalClear(bcx, laneY, b.y + b.h, g, [b])) {
    return {
      pts: [
        [a.x + a.w, sy],
        [xc0, sy],
        [xc0, laneY],
        [bcx, laneY],
        [bcx, b.y + b.h],
      ],
      endAngle: -Math.PI / 2,
    };
  }
  // fallback: rise in the corridor beside the target, enter its right side
  const xc1 = corridorRight(b, g);
  return {
    pts: [
      [a.x + a.w, sy],
      [xc0, sy],
      [xc0, laneY],
      [xc1, laneY],
      [xc1, ey],
      [b.x + b.w, ey],
    ],
    endAngle: Math.PI,
  };
}

/**
 * Polyline → SVG path with softly rounded corners (radius clamped to
 * half the shorter adjoining segment, so tight routes stay tidy).
 */
export function roundedPath(pts: Array<[number, number]>, r = 10): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const r1 = Math.min(r, l1 / 2);
    const r2 = Math.min(r, l2 / 2);
    const ux1 = (cx - px) / l1;
    const uy1 = (cy - py) / l1;
    const ux2 = (nx - cx) / l2;
    const uy2 = (ny - cy) / l2;
    d += ` L ${cx - ux1 * r1} ${cy - uy1 * r1} Q ${cx} ${cy} ${cx + ux2 * r2} ${cy + uy2 * r2}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}
