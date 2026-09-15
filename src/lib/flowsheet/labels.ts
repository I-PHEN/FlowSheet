/**
 * Label placement & collision — the drawing-office rules, as code.
 *
 * A flowsheet reads cleanly only when text never fights linework. Two
 * guarantees, applied by the renderer for EVERY plant (hand-authored
 * prebuilts and anything else that arrives as a PlantLayout):
 *
 *   1. unit tag + name never sit under a stream line — if the default
 *      spot below the symbol is crossed, the label steps aside (side,
 *      then above) to the first clear position on the sheet;
 *   2. margin annotations never leave the drawing sheet, and never have
 *      a line running through them.
 *
 * Whatever cannot be avoided is still legible: callers draw a sheet-
 * colored mask behind every text block, so a residual crossing passes
 * BEHIND the words instead of through them — the same convention the
 * stream number pills already use.
 *
 * Pure geometry, no DOM: text bounds are estimated from character
 * counts (generously — overestimating width keeps collisions rare).
 */

import type { PlantLayout, StreamEdge, UnitNode } from './layout';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---- text metrics (world units; canvas is 1800×880 reference scale) ----
// tag: 13px bold monospace → ~0.62em/char, padded
const TAG_CHAR = 8.4;
// name: 9.5px semibold uppercase sans + 1.2 tracking → ~0.8em/char, padded
const NAME_CHAR = 8.0;
// annotation: 11px semibold sans + 1.6 tracking, padded
const ANNO_CHAR = 9.4;

/** clearance kept between text and any stream line */
const STREAM_PAD = 5;
/** clearance between text and equipment boxes */
const BOX_PAD = 7;
/** clearance between two text blocks */
const TEXT_PAD = 5;

function tagWidth(t: string): number {
  return t.length * TAG_CHAR + 4;
}
function nameWidth(l: string): number {
  return l.length * NAME_CHAR + 4;
}
export function annoWidth(t: string): number {
  return t.length * ANNO_CHAR + 6;
}

/** the two-line block (tag over name) in its default spot below a unit */
function blockRect(u: UnitNode, cx: number, topY: number): Rect {
  const w = Math.max(tagWidth(u.tag), nameWidth(u.label));
  return { x: cx - w / 2, y: topY, w, h: 32 };
}

/** Liang–Barsky segment/rect test (pad inflates the rect) */
function segRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: Rect,
  pad: number,
): boolean {
  const rx = r.x - pad;
  const ry = r.y - pad;
  const rw = r.w + pad * 2;
  const rh = r.h + pad * 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, x1 - rx) &&
    clip(dx, rx + rw - x1) &&
    clip(-dy, y1 - ry) &&
    clip(dy, ry + rh - y1)
  );
}

export function polyHitsRect(pts: Array<[number, number]>, r: Rect, pad = 0): boolean {
  for (let i = 1; i < pts.length; i++) {
    if (segRect(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r, pad)) return true;
  }
  return false;
}

/** stream number pill bounds — text blocks also avoid these */
export function pillRects(streams: StreamEdge[]): Rect[] {
  return streams.map((s) => {
    const num = s.id.replace(/^S0?/, '');
    const w = 7 + num.length * 7.5 + 8;
    let acc = 0;
    const total = s.pts.reduce((L, p, i) => (i > 0 ? L + Math.hypot(p[0] - s.pts[i - 1][0], p[1] - s.pts[i - 1][1]) : L), 0);
    const want = Math.max(0, Math.min(1, s.labelAt ?? 0.5)) * total;
    let px = s.pts[s.pts.length - 1][0];
    let py = s.pts[s.pts.length - 1][1];
    for (let i = 1; i < s.pts.length; i++) {
      const seg = Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
      if (want <= acc + seg || i === s.pts.length - 1) {
        const f = seg === 0 ? 0 : (want - acc) / seg;
        px = s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * f;
        py = s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * f;
        break;
      }
      acc += seg;
    }
    return { x: px - w / 2, y: py - 11, w, h: 22 };
  });
}

function inSheet(r: Rect, sheet: Rect, pad = 6): boolean {
  return (
    r.x >= sheet.x + pad &&
    r.y >= sheet.y + pad &&
    r.x + r.w <= sheet.x + sheet.w - pad &&
    r.y + r.h <= sheet.y + sheet.h - pad
  );
}

export interface UnitLabel {
  /** center x of the block (absolute canvas coords) */
  cx: number;
  /** baseline of the lower text line (NAME when below, TAG when above) */
  lowBy: number;
  /** true when the block sits above the symbol (name on the top line) */
  above: boolean;
  /** block bounds — for masks, hit areas, halos */
  rect: Rect;
}

/**
 * Place every unit's tag+name on the sheet, in order, avoiding:
 *   stream lines (padded), equipment boxes, the sheet edge, the title
 *   block, zone captions, and the labels already placed. Candidates, in
 *   drawing-office preference: below-center → below-right → below-left
 *   → above variants.
 */
export function placeUnitLabels(layout: PlantLayout): Map<string, UnitLabel> {
  const { units, streams } = layout;
  const sheet: Rect = { x: layout.sheet.x, y: layout.sheet.y, w: layout.sheet.w, h: layout.sheet.h };
  const out = new Map<string, UnitLabel>();
  const taken: Rect[] = [];

  // fixed sheet furniture no text may touch
  const furniture: Rect[] = [
    {
      x: layout.titleBlock.x - 6,
      y: layout.titleBlock.y - 6,
      w: layout.titleBlock.w + 12,
      h: layout.titleBlock.h + 12,
    },
    ...layout.zones.map((z) => ({
      x: z.x + 14,
      y: z.y + 12,
      w: z.label.length * 9.6 + 10,
      h: 18,
    })),
    ...pillRects(streams).map((p) => ({
      x: p.x - 4,
      y: p.y - 4,
      w: p.w + 8,
      h: p.h + 8,
    })),
  ];

  const clear = (r: Rect): boolean => {
    if (!inSheet(r, sheet)) return false;
    for (const s of streams) if (polyHitsRect(s.pts, r, STREAM_PAD)) return false;
    for (const u of units) {
      if (
        r.x < u.x + u.w + BOX_PAD &&
        r.x + r.w + BOX_PAD > u.x &&
        r.y < u.y + u.h + BOX_PAD &&
        r.y + r.h + BOX_PAD > u.y
      )
        return false;
    }
    for (const f of furniture) {
      if (r.x < f.x + f.w && r.x + r.w > f.x && r.y < f.y + f.h && r.y + r.h > f.y) return false;
    }
    for (const t of taken) {
      if (
        r.x < t.x + t.w + TEXT_PAD &&
        r.x + r.w + TEXT_PAD > t.x &&
        r.y < t.y + t.h + TEXT_PAD &&
        r.y + r.h + TEXT_PAD > t.y
      )
        return false;
    }
    return true;
  };

  for (const u of units) {
    const w = Math.max(tagWidth(u.tag), nameWidth(u.label));
    const cx = u.x + u.w / 2;
    const belowY = u.y + u.h + 8;
    const aboveY = u.y - 8 - 32;
    const side = u.w / 2 + w / 2 + 12;
    const cands: Array<{ cx: number; topY: number; above: boolean }> = [
      { cx, topY: belowY, above: false },
      { cx: cx + side, topY: belowY, above: false },
      { cx: cx - side, topY: belowY, above: false },
      { cx, topY: aboveY, above: true },
      { cx: cx + side, topY: aboveY, above: true },
      { cx: cx - side, topY: aboveY, above: true },
    ];
    let pick = cands[0];
    for (const c of cands) {
      if (clear(blockRect(u, c.cx, c.topY))) {
        pick = c;
        break;
      }
    }
    const rect = blockRect(u, pick.cx, pick.topY);
    taken.push(rect);
    out.set(u.id, {
      cx: pick.cx,
      lowBy: pick.topY + 30,
      above: pick.above,
      rect,
    });
  }
  return out;
}

export interface PlacedAnnotation {
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  rect: Rect;
}

/**
 * Fit a margin annotation: clamp inside the sheet (text measured, never
 * clipped by the frame), then nudge vertically off any stream line.
 */
export function placeAnnotation(
  a: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' },
  streams: StreamEdge[],
  sheet: Rect,
  obstacles: Rect[] = [],
): PlacedAnnotation {
  const anchor = a.anchor ?? 'start';
  const w = annoWidth(a.text);
  const L = sheet.x + 12;
  const R = sheet.x + sheet.w - 12;
  let x = a.x;
  if (anchor === 'start') x = Math.min(Math.max(x, L), R - w);
  else if (anchor === 'end') x = Math.max(Math.min(x, R), L + w);
  else x = Math.min(Math.max(x, L + w / 2), R - w / 2);

  const rectAt = (yy: number): Rect => ({
    x: anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x,
    y: yy - 11,
    w,
    h: 13,
  });
  let y = a.y;
  for (const dy of [0, -15, 15, -29, 29]) {
    const r = rectAt(y + dy);
    if (r.y >= sheet.y + 8 && r.y + r.h <= sheet.y + sheet.h - 8) {
      const hitLine = streams.some((s) => polyHitsRect(s.pts, r, 3));
      const hitObs = obstacles.some(
        (o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y,
      );
      if (!hitLine && !hitObs) {
        y += dy;
        break;
      }
    }
  }
  return { x, y, text: a.text, anchor, rect: rectAt(y) };
}

export function placeAnnotations(layout: PlantLayout): PlacedAnnotation[] {
  const sheet: Rect = { x: layout.sheet.x, y: layout.sheet.y, w: layout.sheet.w, h: layout.sheet.h };
  const obstacles = pillRects(layout.streams);
  return layout.annotations.map((a) => placeAnnotation(a, layout.streams, sheet, obstacles));
}

/** union of a unit box and its label block, inflated — halo & hit geometry */
export function unitHitRect(u: UnitNode, lab: UnitLabel | undefined, pad: number): Rect {
  const r: Rect = { x: u.x, y: u.y, w: u.w, h: u.h };
  if (lab) {
    const x0 = Math.min(r.x, lab.rect.x);
    const y0 = Math.min(r.y, lab.rect.y);
    const x1 = Math.max(r.x + r.w, lab.rect.x + lab.rect.w);
    const y1 = Math.max(r.y + r.h, lab.rect.y + lab.rect.h);
    r.x = x0;
    r.y = y0;
    r.w = x1 - x0;
    r.h = y1 - y0;
  }
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}
