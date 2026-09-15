/** Polyline geometry helpers for the flowsheet (world coordinates). */

export interface Pt {
  x: number;
  y: number;
  angle: number;
}

export function polyLen(pts: Array<[number, number]>): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}

/** Point + travel direction at fractional distance t along the polyline. */
export function pointAt(pts: Array<[number, number]>, t: number): Pt {
  const total = polyLen(pts);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= seg || i === pts.length - 1) {
      const f = seg === 0 ? 0 : want / seg;
      return {
        x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
        y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
        angle: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]),
      };
    }
    want -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], y: last[1], angle: 0 };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bboxOf(pts: Array<[number, number]>, pad = 0): Box {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad * 2, h: Math.max(...ys) - y + pad * 2 };
}

/** box slightly inset — for comfortable zoom on a unit/stream */
export function boxInset(b: Box, m: number): Box {
  return { x: b.x + m, y: b.y + m, w: b.w - m * 2, h: b.h - m * 2 };
}

/** scale a box to a target aspect (w/h) keeping its center */
export function boxToAspect(b: Box, aspect: number): Box {
  if (b.w / b.h > aspect) {
    const h = b.w / aspect;
    return { x: b.x, y: b.y + b.h / 2 - h / 2, w: b.w, h };
  }
  const w = b.h * aspect;
  return { x: b.x + b.w / 2 - w / 2, y: b.y, w, h: b.h };
}
