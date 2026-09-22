'use client';

/**
 * BuildCanvas — the stage of the builder studio.
 *
 * The graph arrives piecewise from the agent's tool events, so the layout is
 * computed: BFS depth from the feed sources, depth-columns wrapped into
 * bands. New units fade in as the engineer places them; streams are
 * class-colored beziers with id pills, arrowheads, self-loops for internal
 * recycles, and off-canvas arrows for product/waste sinks.
 *
 * Inspection parity with the reference plant: drag to pan, wheel / pinch /
 * button zoom, FIT, hover tooltips on streams AND units. Stream tooltips
 * show live values — the engine is pure TypeScript, so the built graph is
 * re-solved lazily in the browser (cached per snapshot, never blocking the
 * build) and falls back to structural info when a mid-build graph does not
 * solve yet. Clicking a unit selects it for the spec inspector.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FlowGraph, StreamEdge } from '@/lib/engine/graph';
import { executeGraph } from '@/lib/engine';
import type { PlantResult } from '@/lib/engine/types';
import { SPECIES } from '@/lib/engine/species';
import { getUnitType, resolveSpecs } from '@/lib/engine/registry';
import { C, STREAM_STYLE, STREAM_W, STREAM_W_HI } from '@/lib/design/tokens';
import { buildGrid, routeStream, roundedPath, type RRect } from '@/lib/flowsheet/route';
import { pointAt, bboxOf, boxToAspect, type Box } from '@/lib/flowsheet/geom';
import { tweenView } from '@/lib/flowsheet/camera';
import { dotColor, type FlowSpec } from '@/lib/flowsheet/flowAnim';
import { glyphNode, inkInsetsFor } from '@/lib/flowsheet/glyphs';
import { UnitSymbol } from '@/components/flowsheet/Symbols';
import { FlowLayer } from '@/components/flowsheet/FlowLayer';

const it_flowActiveColor = 'var(--fs-gas)';
/** the routing obstacle — the glyph bounds plus a small pad. Lines stop at
 *  the equipment, not at a card edge: units are drawn as BARE P&ID symbols
 *  (the reference Diagram grammar), never boxed. */
const OB_W = 116;
const OB_H = 64;
const GLYPH_W = 96;
const GLYPH_H = 52;
const COL_W = 200; // obstacle + routing corridor
const ROW_H = 132; // obstacle + the label below + breathing room
const PAD = 48;
const BAND_GAP = 56;

/** choose the band count whose sheet aspect sits closest to a wide reading
 *  frame (~1.9:1). The stage is a wide pane — a near-square wrapped layout
 *  letterboxes into a small central block, which reads as “narrow canvas”.
 *  One band = a single left-to-right train (small plants stay one wide
 *  line); longer chains wrap into stacked bands that still fill the pane. */
function pickBands(cols: number, maxColLen: number): number {
  const TARGET = 1.9;
  let best = 1;
  let bestScore = Infinity;
  for (let b = 1; b <= cols; b++) {
    const w = PAD * 2 + Math.ceil(cols / b) * COL_W;
    const h = PAD * 2 + b * (maxColLen * ROW_H) + (b - 1) * BAND_GAP + 48;
    const score = Math.abs(Math.log(w / h / TARGET));
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

interface Placed {
  id: string;
  x: number;
  y: number;
  depth: number;
  col: number;
  band: number;
}

interface Layout {
  width: number;
  height: number;
  units: Map<string, Placed>;
  bandCount: number;
  /** rows per band — each band reserves only the height IT needs */
  bandRows: number[];
  /** top y of each band's content (index = band) */
  bandTops: number[];
  maxColLen: number;
}

function computeLayout(graph: FlowGraph): Layout {
  const units = graph.units;
  if (units.length === 0)
    return {
      width: 900,
      height: 360,
      units: new Map(),
      bandCount: 1,
      bandRows: [1],
      bandTops: [PAD],
      maxColLen: 1,
    };

  // adjacency (unit digraph, self-loops ignored)
  const preds = new Map<string, Set<string>>();
  const succs = new Map<string, Set<string>>();
  for (const u of units) {
    preds.set(u.id, new Set());
    succs.set(u.id, new Set());
  }
  for (const s of graph.streams) {
    if (s.to && s.to.unit !== s.from.unit) {
      preds.get(s.to.unit)?.add(s.from.unit);
      succs.get(s.from.unit)?.add(s.to.unit);
    }
  }

  // BFS depth from units with no predecessors (feeds)
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const u of units) {
    if ((preds.get(u.id) ?? new Set()).size === 0) {
      depth.set(u.id, 0);
      queue.push(u.id);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur) ?? 0;
    for (const next of succs.get(cur) ?? []) {
      const nd = d + 1;
      if ((depth.get(next) ?? Infinity) > nd) {
        depth.set(next, nd);
        queue.push(next);
      }
    }
  }
  // unreachable units (shouldn't happen post-validation) park at depth 0
  for (const u of units) if (!depth.has(u.id)) depth.set(u.id, 0);

  // group by depth, preserving insertion (build) order within a column
  const byDepth = new Map<number, string[]>();
  for (const u of units) {
    const d = depth.get(u.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(u.id);
  }
  const maxDepth = Math.max(...byDepth.keys());
  const maxColLen = Math.max(...[...byDepth.values()].map((v) => v.length), 1);

  // adaptive banding — the sheet aims for a wide frame (see pickBands)
  const cols = maxDepth + 1;
  const bandCount = pickBands(cols, maxColLen);
  const bandCols = Math.ceil(cols / bandCount);

  // PER-BAND ROW HEIGHTS: a band reserves only the rows its own columns
  // actually use — a 1-row band no longer inherits a 3-row gap, so the
  // sheet never stretches with voids (the #1 complaint about AI sheets)
  const bandRows: number[] = new Array(bandCount).fill(1);
  for (const [d, ids] of byDepth) {
    const b = Math.floor(d / bandCols);
    if (b >= 0 && b < bandCount) bandRows[b] = Math.max(bandRows[b], ids.length);
  }
  const bandTops: number[] = [];
  let bandAcc = PAD;
  for (let b = 0; b < bandCount; b++) {
    bandTops.push(bandAcc);
    bandAcc += bandRows[b] * ROW_H + BAND_GAP;
  }

  const placed = new Map<string, Placed>();
  for (const u of units) {
    const d = depth.get(u.id) ?? 0;
    const col = byDepth.get(d)!.indexOf(u.id);
    const band = Math.floor(d / bandCols);
    // wrap the chain into bands: column position within the band, band rows
    // stacked vertically — a long train stays readable and WIDE
    const x = PAD + (d % bandCols) * COL_W;
    const y = bandTops[band] + col * ROW_H + (band % 2 === 1 ? 24 : 0);
    placed.set(u.id, { id: u.id, x, y, depth: d, col, band });
  }

  // right slack only when the plant actually has sink streams — margin
  // labels ("NH3 PRODUCT", "PURGE TO FUEL") need room to breathe
  const hasSinks = graph.streams.some((s) => !s.to && !s.implicit);
  const width = PAD * 2 + bandCols * COL_W + (hasSinks ? 104 : 0);
  const height = bandAcc - BAND_GAP + PAD + 48;
  return {
    width: Math.max(width, 900),
    height: Math.max(height, 360),
    units: placed,
    bandCount,
    bandRows,
    bandTops,
    maxColLen,
  };
}

/** the free lane below a band's content — band flips and blocked sinks run
 *  their horizontals here (one uniform serpentine convention) */
function bandBottomLane(band: number, layout: Layout): number {
  return layout.bandTops[band] + layout.bandRows[band] * ROW_H + BAND_GAP / 2;
}

/** pull a route's terminal points from the OBSTACLE edge in to the symbol
 *  INK edge — lines and arrowheads visibly touch the equipment. The per-kind
 *  insets know each symbol's silhouette (a mixer's tip, a source's sphere). */
const KISS_X = (OB_W - GLYPH_W) / 2;
const KISS_Y = (OB_H - GLYPH_H) / 2;
function kissTerminals(
  pts: Array<[number, number]>,
  ra: RRect,
  inkA: [number, number],
  rb: RRect | null,
  inkB: [number, number] | null,
): Array<[number, number]> {
  if (pts.length < 2) return pts;
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
}

/** a pill sits on the calmest stretch: the midpoint of the LONGEST segment */
function pillAt(pts: Array<[number, number]>): { x: number; y: number } {
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
}

function Arrow({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const L = 11;
  const W = 5.5;
  return (
    <polygon
      points={`${x},${y} ${x - L * Math.cos(angle) + W * Math.sin(angle)},${y - L * Math.sin(angle) - W * Math.cos(angle)} ${x - L * Math.cos(angle) - W * Math.sin(angle)},${y - L * Math.sin(angle) + W * Math.cos(angle)}`}
      style={{ fill: color, pointerEvents: 'none' }}
    />
  );
}

const fmt = (x: number, d = 0) =>
  x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/** keep a view inside the layout bounds (some overhang allowed, like the reference canvas) */
function clampView(v: View, L: Layout): View {
  const w = Math.min(L.width * 1.6, Math.max(L.width / 5, v.w));
  const h = w * (L.height / L.width);
  const x = Math.min(L.width - w * 0.25, Math.max(-w * 0.75, v.x));
  const y = Math.min(L.height - h * 0.25, Math.max(-h * 0.75, v.y));
  return { x, y, w, h };
}

/** live-value solves, memoized per graph snapshot (mid-build snapshots may be
    unsolvable — null is cached too, so nothing ever blocks or re-solves) */
const solveCache = new WeakMap<FlowGraph, PlantResult | null>();

function solveFor(g: FlowGraph): PlantResult | null {
  if (!solveCache.has(g)) {
    let r: PlantResult | null = null;
    try {
      r = executeGraph(g);
    } catch {
      r = null; // mid-build snapshots may be unsolvable — that is fine
    }
    solveCache.set(g, r);
  }
  return solveCache.get(g) ?? null;
}

/** tooltip payload for a stream — live values when the graph solves, structure otherwise */
function streamTip(s: StreamEdge, result: PlantResult | null) {
  const rows: Array<{ k: string; v: string }> = [];
  const live = result?.streams[s.id];
  if (live) {
    const tot = live.n.reduce((a, b) => a + b, 0) || 1;
    const top = live.n
      .map((v, i) => ({ sp: SPECIES[i], x: v / tot }))
      .filter((e) => e.x > 0.005)
      .sort((a, b) => b.x - a.x)
      .slice(0, 4);
    rows.push(
      { k: 'T', v: `${fmt(live.T - 273.15)} °C` },
      { k: 'P', v: `${fmt(live.P / 1e5, 1)} bar` },
      { k: 'Flow', v: `${fmt(tot)} kmol/h` },
    );
    return {
      title: `${s.id} · ${s.name || s.cls}`,
      rows,
      foot: top.map((e) => `${e.sp} ${(e.x * 100).toFixed(1)}%`).join(' · '),
    };
  }
  rows.push(
    { k: 'from', v: s.from.unit },
    { k: 'to', v: s.to ? s.to.unit : 'sink' },
    { k: 'class', v: s.cls },
  );
  return { title: `${s.id} · ${s.name || s.cls}`, rows, foot: 'values appear once this snapshot solves' };
}

export interface BuildCanvasHandle {
  fit: () => void;
  /** Learn-mode camera: fly (animated, user-cancellable) to a unit or stream */
  flyToRef: (ref: { type: 'unit' | 'stream'; id: string }) => void;
}

export interface BuildCanvasProps {
  graph: FlowGraph | null;
  selected: string | null;
  onUnitClick?: (id: string) => void;
  onBackgroundClick?: () => void;
  /** when true (post-build) the live-value cache is warmed in the background */
  warm?: boolean;
}

type View = { x: number; y: number; w: number; h: number };
type Hover = { type: 'unit' | 'stream'; id: string } | null;

export const BuildCanvas = forwardRef<BuildCanvasHandle, BuildCanvasProps>(function BuildCanvas(
  { graph, selected, onUnitClick, onBackgroundClick, warm },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => (graph ? computeLayout(graph) : null), [graph]);
  // flow dots: material movement on the streams, speed from the SOLVER's
  // real molar flows (fast streams animate fast). Off by default when the
  // user prefers reduced motion.
  const [flowOn, setFlowOn] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  // solved molar flow per stream (drives dot speed + count + product tint)
  // — cached solve; null while a mid-build snapshot does not solve yet
  const flowInfo = useMemo(() => {
    if (!graph || !flowOn) return null;
    const r = solveFor(graph);
    if (!r) return null;
    let max = 0;
    const flow = new Map<string, number>();
    for (const [id, st] of Object.entries(r.streams)) {
      let t = 0;
      for (let i = 0; i < st.n.length; i++) t += st.n[i];
      flow.set(id, t);
      if (t > max) max = t;
    }
    return { flow, max, comp: r.streams, productSpecies: r.kpis.productSpecies };
  }, [graph, flowOn]);
  // the user's frame — null means "fit the whole layout". The effective view is
  // DERIVED (clamped against the current layout), so a growing canvas keeps
  // fitting while the user's zoomed frame stays clamped — no state syncing.
  const [view, setView] = useState<View | null>(null);
  const effView = useMemo(
    () =>
      layout
        ? view
          ? clampView(view, layout)
          : { x: 0, y: 0, w: layout.width, h: layout.height }
        : { x: 0, y: 0, w: 900, h: 360 },
    [view, layout],
  );
  const viewRef = useRef(effView);
  useEffect(() => {
    viewRef.current = effView;
  }, [effView]);
  // in-flight camera tween — cancelled by any user interaction
  const animRef = useRef<(() => void) | null>(null);
  const stopAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current();
      animRef.current = null;
    }
  }, []);
  const [hover, setHover] = useState<Hover>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const [hinted, setHinted] = useState(true);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);

  // entrance choreography: new ids animate once (≈700ms), then the class
  // releases so re-renders never replay the animation
  const doneRef = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!graph || graph.units.length === 0) {
      doneRef.current = new Set();
      setFresh(new Set());
      return;
    }
    const ids: string[] = [];
    for (const u of graph.units) if (!doneRef.current.has(u.id)) ids.push(u.id);
    for (const s of graph.streams) if (!doneRef.current.has(s.id)) ids.push(s.id);
    if (ids.length === 0) return;
    ids.forEach((id) => doneRef.current.add(id));
    setFresh((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.add(id));
      return n;
    });
    const t = window.setTimeout(() => {
      setFresh((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
    }, 760);
    return () => window.clearTimeout(t);
  }, [graph]);

  const fitView = useCallback(
    () => (layout ? { x: 0, y: 0, w: layout.width, h: layout.height } : { x: 0, y: 0, w: 900, h: 360 }),
    [layout],
  );

  // grid routing — corridors and lanes only, so a line can never cross a
  // unit. MEMOIZED on (graph, layout): hover re-renders must not re-route,
  // and the flow-dot specs below need a stable identity so the particle
  // layer never rebuilds its path tables mid-animation.
  const routed = useMemo(() => {
    if (!graph || !layout || graph.units.length === 0) return null;
    const pos = layout.units;
    const rects: RRect[] = graph.units.map((u) => {
      const p = pos.get(u.id)!;
      return { x: p.x, y: p.y, w: OB_W, h: OB_H, bandBottom: bandBottomLane(p.band, layout) };
    });
    const grid = buildGrid(rects, layout.width, layout.height);
    const pairSeen = new Map<string, number>();
    let recycleLanes = 0;

    const out = graph.streams.map((s) => {
      const st = STREAM_STYLE[s.cls] ?? STREAM_STYLE.syngas;
      const a = pos.get(s.from.unit);
      if (!a) return null;
      const rectOf = (id: string): RRect => {
        const p = pos.get(id)!;
        return { x: p.x, y: p.y, w: OB_W, h: OB_H, bandBottom: bandBottomLane(p.band, layout) };
      };
      let d = '';
      let endX = 0;
      let endY = 0;
      let endAngle = 0;
      let pill = { x: 0, y: 0 };
      let selfLoop = false;
      let pts: Array<[number, number]> | null = null;
      // a sink (stream leaving the plant) earns a margin annotation, the
      // drawing-office way: "NH3 PRODUCT", "PURGE TO FUEL" — never a bare
      // arrow stabbing into empty paper
      let sinkLabel: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' } | undefined;
      if (s.to && s.to.unit === s.from.unit) {
        // self-loop (internal recycle, e.g. separator letdown)
        selfLoop = true;
        const x0 = a.x + OB_W - 26;
        const y0 = a.y + OB_H;
        const x1 = a.x + 26;
        d = `M ${x0} ${y0} C ${x0 + 26} ${y0 + 34}, ${x1 - 26} ${y0 + 34}, ${x1} ${y0}`;
        endX = x1;
        endY = y0;
        endAngle = Math.PI; // pointing left into the unit
        pill = { x: (x0 + x1) / 2, y: y0 + 26 };
      } else {
        const ra = rectOf(s.from.unit);
        const rb = s.to ? rectOf(s.to.unit) : null;
        const forward = s.to
          ? (pos.get(s.to.unit)?.depth ?? 0) > a.depth
          : true;
        const key = `${s.from.unit}→${s.to?.unit ?? 'env'}`;
        const pairIndex = pairSeen.get(key) ?? 0;
        pairSeen.set(key, pairIndex + 1);
        const laneIndex = forward ? 0 : recycleLanes++;
        const r = routeStream(ra, rb, grid, forward, { pairIndex, laneIndex });
        // terminals kiss the symbol INK, not the invisible obstacle pad
        const inkA = inkInsetsFor(graph.units.find((u) => u.id === s.from.unit)?.type ?? '');
        const inkB = s.to
          ? inkInsetsFor(graph.units.find((u) => u.id === s.to!.unit)?.type ?? '')
          : null;
        pts = kissTerminals(r.pts, ra, inkA, rb, inkB);
        d = roundedPath(pts, 3); // CAD-crisp elbows — straight is the point
        const last = pts[pts.length - 1];
        endX = last[0];
        endY = last[1];
        endAngle = r.endAngle;
        pill = pillAt(pts);
        if (!s.to && !s.implicit) {
          const raw = (s.name || s.cls || 'OUT')
            .toUpperCase()
            .replace(/[^A-Z0-9 \u00b7\-]/g, '')
            .slice(0, 22);
          if (Math.abs(Math.abs(endAngle) - Math.PI / 2) < 0.1) {
            sinkLabel = { x: endX, y: endY + 20, text: raw, anchor: 'middle' };
          } else if (Math.abs(endAngle) < 0.1) {
            sinkLabel = { x: endX + 10, y: endY + 3.5, text: raw, anchor: 'start' };
          } else {
            sinkLabel = { x: endX - 10, y: endY + 3.5, text: raw, anchor: 'end' };
          }
        }
      }
      const pillW = 12 + s.id.length * 8;
      return { s, st, d, pts, endX, endY, endAngle, pill, pillW, selfLoop, sinkLabel };
    });

    // one collision pass: pills that landed on top of each other get a
    // vertical nudge (labels never share a lane silently)
    const placedPills: Array<{ x: number; y: number }> = [];
    for (const it of out) {
      if (!it || it.selfLoop) continue;
      const p = it.pill;
      if (placedPills.some((q) => Math.abs(q.x - p.x) < 30 && Math.abs(q.y - p.y) < 22)) {
        p.y += p.y > layout.height / 2 ? -18 : 18;
      }
      placedPills.push({ x: p.x, y: p.y });
    }
    return out;
  }, [graph, layout]);

  // flow-dot specs — the SOLVED state mapped onto the routed lines. Speed,
  // count, size from real molar flows; color from stream class unless the
  // stream carries the plant's declared product (then the product hue —
  // ammonia-rich gas green, sulphur-laden gas gold).
  const flowSpecs = useMemo(() => {
    if (!routed || !flowInfo) return [];
    const specs: FlowSpec[] = [];
    for (const it of routed) {
      if (!it || it.s.implicit) continue;
      const flow = flowInfo.flow.get(it.s.id) ?? 0;
      if (flow <= 1e-6) continue;
      const st = flowInfo.comp[it.s.id];
      specs.push({
        id: it.s.id,
        d: it.d,
        flow,
        color: dotColor(it.s.cls, st?.n, flowInfo.productSpecies),
        liquid: it.s.cls === 'product' || it.s.cls === 'water',
        pillAt: it.selfLoop ? undefined : 0.5,
      });
    }
    return specs;
  }, [routed, flowInfo]);

  // post-build: warm the cache so first hover is instant
  useEffect(() => {
    if (!warm || !graph) return;
    const g = graph;
    const t = window.setTimeout(() => solveFor(g), 400);
    return () => window.clearTimeout(t);
  }, [warm, graph]);

  /** letterbox-aware client→world mapping (view keeps the layout aspect) */
  const worldFromClient = useCallback((cx: number, cy: number) => {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    const L = layout!;
    const aspect = L.width / L.height;
    let dw = r.width;
    let dh = r.height;
    if (r.width / r.height > aspect) dw = r.height * aspect;
    else dh = r.width / aspect;
    const ox = (r.width - dw) / 2;
    const oy = (r.height - dh) / 2;
    const v = viewRef.current;
    return {
      x: v.x + ((cx - r.left - ox) / dw) * v.w,
      y: v.y + ((cy - r.top - oy) / dh) * v.h,
      pxPerWorld: dw / v.w,
    };
  }, [layout]);

  const zoomAtWorld = useCallback(
    (wx: number, wy: number, factor: number) => {
      stopAnim();
      setHinted(false);
      setView((v) => {
        const base = v ?? fitView();
        const nw = base.w / factor;
        const k = nw / base.w;
        return { x: wx - (wx - base.x) * k, y: wy - (wy - base.y) * k, w: nw, h: nw * (base.h / base.w) };
      });
    },
    [stopAnim, fitView],
  );

  const fit = useCallback(() => {
    stopAnim();
    setHinted(false);
    // a flight, not a cut — the tour's breathing camera pulls back to the
    // whole sheet between stops, so fit eases like every other move
    // (reduced motion: the shared tween lands instantly). It ends by
    // handing the frame back to the auto-fit contract (null view), so a
    // growing canvas keeps auto-fitting exactly like the old hard cut.
    const to = fitView();
    const cancel = tweenView(viewRef.current, to, {
      ms: 560,
      onUpdate: (v) => setView(v),
    });
    const done = window.setTimeout(() => {
      animRef.current = null;
      setView(null);
    }, 580);
    animRef.current = () => {
      cancel();
      window.clearTimeout(done); // the user took the camera mid-flight
    };
  }, [stopAnim, fitView]);

  /** Learn-mode camera: fly to a unit's node or a stream's routed line.
   *  Same math as the reference canvas's panTo — pad, aspect, clamp, tween —
   *  and any drag/wheel/pinch from the user cancels the flight instantly. */
  const flyToRef = useCallback(
    (f: { type: 'unit' | 'stream'; id: string }) => {
      if (!layout) return;
      let box: Box | null = null;
      if (f.type === 'unit') {
        const p = layout.units.get(f.id);
        if (p) box = { x: p.x, y: p.y, w: OB_W, h: OB_H + 30 }; // glyph + its label
      } else if (routed) {
        const it = routed.find((r) => r && r.s.id === f.id);
        if (it) {
          if (it.pts) box = bboxOf(it.pts, 30);
          else {
            // self-loop bezier hugs its own unit's bottom edge
            const p = layout.units.get(it.s.from.unit);
            if (p) box = { x: p.x, y: p.y, w: OB_W, h: OB_H + 74 };
          }
        }
      }
      if (!box) return;
      stopAnim();
      const target = clampView(
        boxToAspect(bboxOf([[box.x, box.y], [box.x + box.w, box.y + box.h]], 70), layout.width / layout.height),
        layout,
      );
      animRef.current = tweenView(viewRef.current, target, {
        ms: 620,
        onUpdate: (v) => setView(v),
      });
    },
    [layout, routed, stopAnim],
  );

  useImperativeHandle(ref, () => ({ fit, flyToRef }), [fit, flyToRef]);

  // wheel zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !layout) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const w = worldFromClient(e.clientX, e.clientY);
      zoomAtWorld(w.x, w.y, e.deltaY < 0 ? 1.14 : 1 / 1.14);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAtWorld, worldFromClient, layout]);

  // drag pan + pinch zoom + drag-vs-click suppression
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !layout) return;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let lastDist = 0;

    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      movedRef.current = false;
      lastDist = 0;
      stopAnim(); // the user owns the camera now
      if (pts.size === 1) setDragging(true);
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId)!;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      if (moved > 4) {
        movedRef.current = true;
        setHinted(false);
      }
      if (pts.size === 1) {
        const v = viewRef.current;
        const px = worldFromClient(prev.x, prev.y).pxPerWorld;
        setView({ x: v.x - (e.clientX - prev.x) / px, y: v.y - (e.clientY - prev.y) / px, w: v.w, h: v.h });
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist > 0 && dist > 0) {
          const w = worldFromClient((a.x + b.x) / 2, (a.y + b.y) / 2);
          zoomAtWorld(w.x, w.y, dist / lastDist);
        }
        lastDist = dist;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      lastDist = 0;
      if (pts.size === 0) setDragging(false);
      // allow click right after a suppressed drag ends
      window.setTimeout(() => {
        movedRef.current = false;
      }, 60);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [zoomAtWorld, worldFromClient, layout, stopAnim]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = viewRef.current;
    const pan = (fx: number, fy: number) =>
      setView({ x: v.x + v.w * fx, y: v.y + v.h * fy, w: v.w, h: v.h });
    if (e.key === '+' || e.key === '=') zoomAtWorld(v.x + v.w / 2, v.y + v.h / 2, 1.2);
    else if (e.key === '-') zoomAtWorld(v.x + v.w / 2, v.y + v.h / 2, 1 / 1.2);
    else if (e.key === 'f' || e.key === '0') fit();
    else if (e.key === 'ArrowLeft') pan(0.08, 0);
    else if (e.key === 'ArrowRight') pan(-0.08, 0);
    else if (e.key === 'ArrowUp') pan(0, 0.08);
    else if (e.key === 'ArrowDown') pan(0, -0.08);
    else return;
    e.preventDefault();
  };

  if (!graph || !layout || graph.units.length === 0) {
    return (
      <div className="relative h-full w-full" style={{ background: C.canvas }}>
        {/* the one coherent box, waiting for the flowsheet to be drawn on it */}
        <svg
          viewBox="0 0 900 360"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          <defs>
            <filter id="bcSheetShadow" x="-4%" y="-4%" width="108%" height="112%">
              <feDropShadow dx="0" dy="4" stdDeviation="7" floodOpacity="0.2" />
            </filter>
          </defs>
          <rect
            x={10}
            y={10}
            width={880}
            height={340}
            rx={6}
            strokeWidth={1.8}
            filter="url(#bcSheetShadow)"
            style={{ fill: C.sheet, stroke: C.bandLine }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="font-mono text-[13px] font-bold tracking-widest" style={{ color: C.inkFaint }}>
              THE SHEET IS WAITING
            </div>
            <div className="mt-2 max-w-[300px] text-[12.5px]" style={{ color: C.inkSoft }}>
              Units the engineer places will appear here, live, on one sheet — as the build runs.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { width: W, height: H, units: pos } = layout;
  const streams = routed!;

  const hoveredStream = hover?.type === 'stream' ? graph.streams.find((x) => x.id === hover.id) : undefined;
  const hoveredUnit = hover?.type === 'unit' ? graph.units.find((x) => x.id === hover.id) : undefined;

  const tipData = (() => {
    if (hoveredStream) return streamTip(hoveredStream, solveFor(graph));
    if (hoveredUnit) {
      const def = getUnitType(hoveredUnit.type);
      return {
        title: `${hoveredUnit.id} · ${def?.name ?? hoveredUnit.type}`,
        rows: [] as Array<{ k: string; v: string }>,
        foot: def ? def.model(resolveSpecs(hoveredUnit)) : hoveredUnit.type,
      };
    }
    return null;
  })();

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative h-full w-full overflow-hidden outline-none"
      style={{ background: C.canvas, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerMove={(e) => {
        const r = wrapRef.current?.getBoundingClientRect();
        if (r) {
          setTipPos({
            x: Math.min(e.clientX - r.left + 16, r.width - 250),
            y: e.clientY - r.top + 14,
          });
        }
      }}
    >
      <svg
        viewBox={`${effView.x} ${effView.y} ${effView.w} ${effView.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%', fontFamily: 'inherit' }}
        aria-label="Plant flowsheet being built by the AI agent"
        onClick={(e) => {
          if (e.target === e.currentTarget && !movedRef.current) onBackgroundClick?.();
        }}
      >
        <defs>
          {/* catalyst / packing hatch — shared with the reference canvas symbols */}
          <pattern id="fsHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" strokeWidth="1.3" style={{ stroke: C.inkSoft }} />
          </pattern>
          {/* the sheet lies ON the canvas — a soft shadow gives it that */}
          <filter id="bcSheetShadow" x="-4%" y="-4%" width="108%" height="112%">
            <feDropShadow dx="0" dy="4" stdDeviation="7" floodOpacity="0.2" />
          </filter>
        </defs>
        {/* one coherent sheet — the box the whole flowsheet is drawn on.
            It grows to wrap every unit the engineer places, so all bands of
            the plant (however many) lie on the same big thing. */}
        <rect
          x={10}
          y={10}
          width={W - 20}
          height={H - 20}
          rx={6}
          strokeWidth={1.8}
          filter="url(#bcSheetShadow)"
          style={{ fill: C.sheet, stroke: C.bandLine, pointerEvents: 'none' }}
        />
        {streams.map((it) =>
          it ? (
            <g key={it.s.id} opacity={it.s.implicit ? 0.55 : 1}>
              {/* fat invisible hit path — hover + live values */}
              <path
                d={it.d}
                fill="none"
                strokeWidth={16}
                stroke="rgba(0,0,0,0)"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onPointerEnter={() => setHover({ type: 'stream', id: it.s.id })}
                onPointerLeave={() => setHover((h) => (h?.id === it.s.id ? null : h))}
              />
              {/* the line draws itself in; dashed utilities skip the draw-on
                  so their dash pattern is never disturbed */}
              <path
                d={it.d}
                fill="none"
                pathLength={1}
                strokeWidth={hover?.id === it.s.id ? STREAM_W_HI : STREAM_W}
                strokeDasharray={it.st.dash}
                strokeLinecap="round"
                className={fresh.has(it.s.id) && !it.st.dash ? 'bd-draw' : undefined}
                style={{ stroke: it.st.color, pointerEvents: 'none' }}
              />
              <g className={fresh.has(it.s.id) ? 'bd-pop' : undefined} style={{ pointerEvents: 'none' }}>
                <Arrow x={it.endX} y={it.endY} angle={it.endAngle} color={it.st.color} />
              </g>
              {!it.s.implicit && (
                <g className={fresh.has(it.s.id) ? 'bd-late' : undefined} style={{ pointerEvents: 'none' }}>
                  <rect x={it.pill.x - it.pillW / 2} y={it.pill.y - 10} width={it.pillW} height={20} rx={10} strokeWidth={1.2} style={{ fill: C.paper, stroke: it.st.color }} />
                  <text x={it.pill.x} y={it.pill.y + 4.5} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {it.s.id}
                  </text>
                </g>
              )}
              {/* the margin annotation — where the stream leaves the plant */}
              {it.sinkLabel && (
                <g className={fresh.has(it.s.id) ? 'bd-late' : undefined} style={{ pointerEvents: 'none' }}>
                  <text
                    x={it.sinkLabel.x}
                    y={it.sinkLabel.y}
                    textAnchor={it.sinkLabel.anchor}
                    fontSize={10}
                    fontWeight={800}
                    letterSpacing={1.2}
                    style={{
                      fill: C.inkSoft,
                      stroke: C.sheet,
                      strokeWidth: 3.5,
                      paintOrder: 'stroke',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    {it.sinkLabel.text}
                  </text>
                </g>
              )}
            </g>
          ) : null,
        )}

        {graph.units.map((u) => {
          const p = pos.get(u.id)!;
          const def = getUnitType(u.type);
          const sel = selected === u.id;
          const cx = OB_W / 2;
          const freshU = fresh.has(u.id);
          return (
            <g
              key={u.id}
              // position as a CSS transform + glide transition: when the
              // layout re-packs mid-build, equipment SLIDES to its new spot
              // like a draftsman nudging the sheet — never a hard jump
              style={{
                transform: `translate(${p.x}px, ${p.y}px)`,
                cursor: 'pointer',
                ...(freshU ? {} : { transition: 'transform 480ms cubic-bezier(0.25, 0.8, 0.35, 1)' }),
              }}
              onClick={() => {
                if (!movedRef.current) onUnitClick?.(u.id);
              }}
              onPointerEnter={() => setHover({ type: 'unit', id: u.id })}
              onPointerLeave={() => setHover((h) => (h?.id === u.id ? null : h))}
            >
              {/* transparent hit area — visuals below are pointer-events:none
                  (covers the glyph AND its label block) */}
              <rect x={-12} y={-12} width={OB_W + 24} height={OB_H + 52} fill="rgba(0,0,0,0)" style={{ pointerEvents: 'all' }} />
              <g
                className={freshU ? 'bd-unit-in' : undefined}
                style={{ pointerEvents: 'none' }}
              >
                {/* selection halo wraps glyph + label, like the reference sheet */}
                {sel && (
                  <rect x={-10} y={-10} width={OB_W + 20} height={OB_H + 48} rx={12} style={{ fill: C.halo }} />
                )}
                {/* THE EQUIPMENT — a bare P&ID symbol, never a boxed card:
                    the same grammar as the reference canvas, so a plant keeps
                    its shape wherever it renders (library → builder → tour) */}
                <g transform={`translate(${cx - GLYPH_W / 2}, ${(OB_H - GLYPH_H) / 2})`}>
                  <UnitSymbol node={glyphNode(u.id, u.type, GLYPH_W, GLYPH_H)} hi={hover?.id === u.id} sel={sel} />
                </g>
                {/* tag + name below the symbol — a sheet-colored mask lets a
                    residual line pass BEHIND the words (drawing-office rule) */}
                <rect x={cx - 80} y={OB_H + 4} width={160} height={31} style={{ fill: C.sheet }} />
                <text
                  x={cx}
                  y={OB_H + 16}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  style={{ fill: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                >
                  {u.id}
                </text>
                <text
                  x={cx}
                  y={OB_H + 29}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={700}
                  letterSpacing={1.1}
                  style={{ fill: C.inkSoft }}
                >
                  {(def?.name ?? u.type).slice(0, 24).toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}

        {/* the drawing-office stamp — every issued sheet carries one */}
        <text
          x={W - 26}
          y={H - 22}
          textAnchor="end"
          fontSize={9.5}
          fontWeight={800}
          letterSpacing={1.4}
          style={{
            fill: C.inkFaint,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            pointerEvents: 'none',
          }}
        >
          {`${(graph.family ?? 'process').toUpperCase()} · AGENT-BUILT PFD · SHEET 1 OF 1`}
        </text>
      </svg>

      {/* material movement — dots on the solved flows, sharing the exact
          viewBox so pan/zoom carries them; toggled by ⌁ beside the zoom */}
      <FlowLayer view={effView} streams={flowSpecs} active={flowOn} />

      {/* hover tooltip */}
      {hover && tipData && (
        <div
          className="pointer-events-none absolute z-20 w-[240px] rounded-lg border px-3 py-2 text-[12px] leading-snug"
          style={{
            background: C.paper,
            borderColor: 'var(--fs-band-line)',
            color: C.ink,
            boxShadow: 'var(--fs-tip-shadow)',
            left: tipPos.x,
            top: tipPos.y,
          }}
        >
          <div className="mb-1 font-mono text-[11px] font-bold tracking-wide">{tipData.title}</div>
          {tipData.rows.map((r) => (
            <div key={r.k} className="flex justify-between gap-4">
              <span style={{ color: C.inkSoft }}>{r.k}</span>
              <span className="font-mono">{r.v}</span>
            </div>
          ))}
          {tipData.foot && (
            <div className="mt-1 border-t pt-1 font-mono text-[10.5px]" style={{ borderColor: 'var(--fs-band-line)', color: C.inkSoft }}>
              {tipData.foot}
            </div>
          )}
        </div>
      )}

      {/* first-visit hint */}
      {hinted && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-wide"
          style={{ background: 'var(--fs-paper-a95)', borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
        >
          Drag to pan · scroll to zoom · hover a stream · click a unit
        </div>
      )}

      {/* legend */}
      <div
        className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-1.5 text-[10.5px] font-semibold tracking-wide"
        style={{ background: 'var(--fs-paper-a95)', borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full" style={{ background: C.feed }} /> FEED
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full" style={{ background: C.gas }} /> PROCESS GAS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full" style={{ background: C.nh3 }} /> PRODUCT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed" style={{ borderColor: C.inkFaint }} />
          UTILITIES
        </span>
      </div>

      {/* zoom + flow controls */}
      <div
        className="absolute bottom-3 right-3 z-10 flex overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}
      >
        <button
          aria-label={flowOn ? 'Hide material flow animation' : 'Show material flow animation'}
          title={flowOn ? 'Hide material flow' : 'Show material flow (dot speed = real molar flow)'}
          onClick={() => setFlowOn((v) => !v)}
          className="hover-band h-8 w-10 border-l text-[11px] font-bold tracking-wider"
          style={{
            color: flowOn ? it_flowActiveColor : C.inkFaint,
            borderColor: 'var(--fs-band-line)',
          }}
        >
          ⌁
        </button>
        <button
          aria-label="Zoom out"
          className="hover-band h-8 w-8 border-l text-sm font-bold"
          style={{ color: C.ink }}
          onClick={() => {
            const v = viewRef.current;
            zoomAtWorld(v.x + v.w / 2, v.y + v.h / 2, 1 / 1.2);
          }}
        >
          −
        </button>
        <button
          aria-label="Zoom in"
          className="hover-band h-8 w-8 border-l text-sm font-bold"
          style={{ color: C.ink, borderColor: 'var(--fs-band-line)' }}
          onClick={() => {
            const v = viewRef.current;
            zoomAtWorld(v.x + v.w / 2, v.y + v.h / 2, 1.2);
          }}
        >
          +
        </button>
        <button
          aria-label="Fit to screen"
          className="hover-band h-8 w-10 border-l text-[11px] font-bold tracking-wider"
          style={{ color: C.ink, borderColor: 'var(--fs-band-line)' }}
          onClick={fit}
        >
          FIT
        </button>
      </div>
    </div>
  );
});

/** compact spec inspector for the selected unit (pure registry reads) */
export function UnitInspector({ graph, unitId, onClose }: { graph: FlowGraph; unitId: string; onClose: () => void }) {
  const u = graph.units.find((x) => x.id === unitId);
  if (!u) return null;
  const def = getUnitType(u.type);
  if (!def) return null;
  const specs = resolveSpecs(u);
  return (
    <div className="border-t px-4 py-3" style={{ background: C.paper }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[15px] font-extrabold" style={{ color: C.ink }}>
              {u.id}
            </span>
            <span className="text-[13px] font-bold" style={{ color: C.inkSoft }}>
              {def.name}
            </span>
          </div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: C.inkFaint }}>
            {def.model(specs)}
          </div>
        </div>
        <button onClick={onClose} className="hover-band shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={{ color: C.inkSoft }}>
          close
        </button>
      </div>
      {def.specFields.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {def.specFields.map((f) => {
            const val = specs[f.key];
            const changed = JSON.stringify(val) !== JSON.stringify(f.default);
            const shown = Array.isArray(val) ? `[${val.join(', ')}]` : String(val);
            return (
              <div key={f.key} className="flex items-baseline justify-between gap-2 border-b border-dashed py-0.5" style={{ borderColor: 'var(--fs-band-line)' }}>
                <span className="font-mono text-[11px]" style={{ color: C.inkSoft }}>
                  {f.key}
                  {f.unit ? ` (${f.unit})` : ''}
                </span>
                <span className="font-mono text-[11px] font-bold" style={{ color: changed ? C.ink : C.inkFaint }}>
                  {shown}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
