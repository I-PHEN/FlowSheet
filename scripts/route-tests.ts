/**
 * ROUTE TESTS — the stream-routing laws behind clean AI builds.
 *
 * Run: bun scripts/route-tests.ts
 *
 * The laws (each one closes an owner-visible defect):
 *   SINK SAFETY   — a sink arrow may never cross a unit in the next column;
 *                   blocked sinks drop to the band-bottom lane and exit there
 *   RECYCLE SIDE  — a recycle loop leaves on the side NEARER its target;
 *                   loops ending left never wander right first
 *   BAND WRAP     — a band flip runs its horizontal in the band-bottom lane
 *                   (passed via RRect.bandBottom), not at the source's row
 *   GLYPH KISS    — kissTerminals pulls endpoints from the invisible
 *                   obstacle pad to the glyph edge (Δx=10, Δy=6)
 *   PILL PLACEMENT — pills sit on the midpoint of the LONGEST segment, and
 *                   colliding pills get nudged apart
 */

import {
  buildGrid,
  routeStream,
  type RRect,
  type RouteGrid,
} from '../src/lib/flowsheet/route';

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** does any segment of the polyline cross a rect (with margin)? */
function crosses(pts: Array<[number, number]>, r: RRect, m = 3): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    // all segments here are axis-aligned
    const lo = Math.min(x0, x1) - m;
    const hi = Math.max(x0, x1) + m;
    const vlo = Math.min(y0, y1) - m;
    const vhi = Math.max(y0, y1) + m;
    if (hi > r.x && lo < r.x + r.w && vhi > r.y && vlo < r.y + r.h) return true;
  }
  return false;
}

function gridOf(rects: RRect[], w = 1200, h = 700): RouteGrid {
  return buildGrid(rects, w, h);
}

console.log('\n── sink safety ──');
{
  // A sink at col 0, a neighbor at col 1 on the same row
  const A: RRect = { x: 48, y: 48, w: 116, h: 64, bandBottom: 400 };
  const N: RRect = { x: 248, y: 48, w: 116, h: 64, bandBottom: 400 };
  const g = gridOf([A, N]);
  const r = routeStream(A, null, g, true);
  check('blocked sink avoids the neighbor unit', !crosses(r.pts, N, 0),
    JSON.stringify(r.pts));
  check('blocked sink drops below the source row', r.pts.some((p) => p[1] > A.y + A.h));
  // clear sink (no neighbor) goes straight right
  const A2: RRect = { x: 48, y: 48, w: 116, h: 64 };
  const g2 = gridOf([A2]);
  const r2 = routeStream(A2, null, g2, true);
  check('clear sink is a straight right run', r2.pts.length === 2 && r2.pts[1][1] === r2.pts[0][1]);
}

console.log('\n── recycle side choice ──');
{
  // Loop compressor (right) back to mixer (left): must leave a's LEFT side
  const MIX: RRect = { x: 48, y: 48, w: 116, h: 64 };
  const R1: RRect = { x: 448, y: 48, w: 116, h: 64 };
  const g = gridOf([MIX, R1]);
  const r = routeStream(R1, MIX, g, false);
  check('leftward recycle leaves the source LEFT edge', Math.abs(r.pts[0][0] - R1.x) < 0.5,
    `first x ${r.pts[0][0]} vs ${R1.x}`);
  const maxX = Math.max(...r.pts.map((p) => p[0]));
  check('leftward recycle never passes the source right edge', maxX <= R1.x + R1.w + 0.5,
    `max x ${maxX}`);
  // And a rightward recycle still leaves right
  const r2 = routeStream(MIX, R1, g, false);
  check('rightward recycle leaves the source RIGHT edge', Math.abs(r2.pts[0][0] - (MIX.x + MIX.w)) < 0.5);
}

console.log('\n── band-bottom wrap ──');
{
  // End of band 1 (right) → start of band 2 (left, lower): the horizontal
  // must run at the source's bandBottom lane, not its own row
  const BAND_BOTTOM = 420;
  const A: RRect = { x: 648, y: 180, w: 116, h: 64, bandBottom: BAND_BOTTOM };
  const B: RRect = { x: 48, y: 500, w: 116, h: 64, bandBottom: 860 };
  // something mid-band below a that the old path would have cut past
  const MID: RRect = { x: 448, y: 312, w: 116, h: 64, bandBottom: BAND_BOTTOM };
  const g = gridOf([A, B, MID], 1200, 900);
  const r = routeStream(A, B, g, true); // forward (depth increases), leftward
  const horizontalYs = r.pts
    .filter((_, i) => i > 0 && i < r.pts.length - 1)
    .filter((p, i, arr) => i < arr.length - 1 && Math.abs(p[1] - arr[i + 1][1]) < 0.5 && Math.abs(p[0] - arr[i + 1][0]) > 50)
    .map((p) => p[1]);
  check(
    'band flip runs its long horizontal at the band-bottom lane',
    horizontalYs.some((y) => Math.abs(y - BAND_BOTTOM) < 0.5),
    `horizontal ys: ${horizontalYs.join(',')}`,
  );
  check('band flip does not cross the mid-band unit', !crosses(r.pts, MID, 0));
}

console.log('\n── glyph kiss (ink-aware, helper re-implemented verbatim) ──');
{
  const OB_W = 116, OB_H = 64, GLYPH_W = 96, GLYPH_H = 52;
  const KISS_X = (OB_W - GLYPH_W) / 2; // 10
  const KISS_Y = (OB_H - GLYPH_H) / 2; // 6
  const { inkInsetsFor } = await import('../src/lib/flowsheet/glyphs');
  const kiss = (
    pts: Array<[number, number]>,
    ra: RRect,
    inkA: [number, number],
    rb: RRect | null,
    inkB: [number, number] | null,
  ) => {
    const out = pts.map((p) => [p[0], p[1]] as [number, number]);
    const f = out[0];
    if (Math.abs(f[0] - (ra.x + ra.w)) < 0.5) f[0] = ra.x + ra.w - KISS_X - inkA[1];
    else if (Math.abs(f[0] - ra.x) < 0.5) f[0] = ra.x + KISS_X + inkA[0];
    if (Math.abs(f[1] - (ra.y + ra.h)) < 0.5) f[1] = ra.y + ra.h - KISS_Y;
    else if (Math.abs(f[1] - ra.y) < 0.5) f[1] = ra.y + KISS_Y;
    if (rb && inkB) {
      const l = out[out.length - 1];
      if (Math.abs(l[0] - rb.x) < 0.5) l[0] = rb.x + KISS_X + inkB[0];
      else if (Math.abs(l[0] - (rb.x + rb.w)) < 0.5) l[0] = rb.x + rb.w - KISS_X - inkB[1];
      if (Math.abs(l[1] - rb.y) < 0.5) l[1] = rb.y + KISS_Y;
      else if (Math.abs(l[1] - (rb.y + rb.h)) < 0.5) l[1] = rb.y + rb.h - KISS_Y;
    }
    return out;
  };
  // a full-box symbol (furnace): the pull is just the obstacle pad (10)
  const A: RRect = { x: 100, y: 100, w: OB_W, h: OB_H };
  const B: RRect = { x: 400, y: 100, w: OB_W, h: OB_H };
  const g = gridOf([A, B]);
  const raw = routeStream(A, B, g, true).pts;
  const inkF = inkInsetsFor('primary-reformer');
  check('furnace insets are the near-full-box pair', inkF[0] === 4 && inkF[1] === 4);
  const kissed = kiss(raw, A, inkF, B, inkF);
  check(
    'start pulled to the furnace INK edge (pad+inset = 14)',
    Math.abs(kissed[0][0] - (raw[0][0] - KISS_X - 4)) < 0.5,
  );
  // a mixer target: the entering line must reach the triangle's tip side
  // (left inset 3 → pull = 10+3) and a stream LEAVING a mixer rightward
  // must start at the tip (right inset 40 → pull = 10+40)
  const inkM = inkInsetsFor('feed-mixer');
  check('mixer insets know the triangle silhouette', inkM[0] === 3 && inkM[1] === 40);
  const kissed2 = kiss(raw, A, inkM, B, inkF);
  check(
    'leaving a mixer starts at its tip (pad+40)',
    Math.abs(kissed2[0][0] - (raw[0][0] - KISS_X - 40)) < 0.5,
  );
  // same-column top-drop: the y inset applies
  const C: RRect = { x: 100, y: 300, w: OB_W, h: OB_H };
  const raw2 = routeStream(A, C, gridOf([A, C]), true).pts;
  const kissed3 = kiss(raw2, A, inkF, C, inkF);
  check(
    'top-entry end pulled down to the glyph top (Δy=6)',
    Math.abs(kissed3[kissed3.length - 1][1] - (raw2[raw2.length - 1][1] + KISS_Y)) < 0.5,
  );
}

console.log('\n── pill placement ──');
{
  // longest segment midpoint (helper re-implemented verbatim)
  const pillAt = (pts: Array<[number, number]>) => {
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (len > bestLen) {
        bestLen = len;
        best = i;
      }
    }
    return { x: (pts[best][0] + pts[best + 1][0]) / 2, y: (pts[best][1] + pts[best + 1][1]) / 2 };
  };
  const pts: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [210, 10], // the 200-long run — the calmest stretch
  ];
  const p = pillAt(pts);
  check('pill sits on the longest segment midpoint', p.x === 110 && p.y === 10, JSON.stringify(p));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
