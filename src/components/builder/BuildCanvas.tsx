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

const NODE_W = 168;
const NODE_H = 74;
const COL_W = 236;
const ROW_H = 124;
const PAD = 48;
const BAND_COLS = 8; // wrap the chain into readable bands

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
}

function computeLayout(graph: FlowGraph): Layout {
  const units = graph.units;
  if (units.length === 0) return { width: 900, height: 360, units: new Map(), bandCount: 1 };

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

  const bandCount = Math.floor(maxDepth / BAND_COLS) + 1;
  const bandGap = 64;
  const placed = new Map<string, Placed>();
  for (const u of units) {
    const d = depth.get(u.id) ?? 0;
    const col = byDepth.get(d)!.indexOf(u.id);
    const band = Math.floor(d / BAND_COLS);
    // wrap the chain into bands: column position within the band, band rows
    // stacked vertically — keeps the canvas near-square instead of 20-wide
    const x = PAD + (d % BAND_COLS) * COL_W;
    const y = PAD + band * (maxColLen * ROW_H + bandGap) + col * ROW_H + (band % 2 === 1 ? 24 : 0);
    placed.set(u.id, { id: u.id, x, y, depth: d, col, band });
  }

  const width = PAD * 2 + Math.min(maxDepth + 1, BAND_COLS) * COL_W;
  const height = PAD * 2 + bandCount * (maxColLen * ROW_H) + (bandCount - 1) * bandGap + 48;
  return { width: Math.max(width, 900), height: Math.max(height, 360), units: placed, bandCount };
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
  const [hover, setHover] = useState<Hover>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const [hinted, setHinted] = useState(true);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);

  const fitView = useCallback(
    () => (layout ? { x: 0, y: 0, w: layout.width, h: layout.height } : { x: 0, y: 0, w: 900, h: 360 }),
    [layout],
  );

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
      setHinted(false);
      setView((v) => {
        const base = v ?? fitView();
        const nw = base.w / factor;
        const k = nw / base.w;
        return { x: wx - (wx - base.x) * k, y: wy - (wy - base.y) * k, w: nw, h: nw * (base.h / base.w) };
      });
    },
    [fitView],
  );

  const fit = useCallback(() => {
    setHinted(false);
    setView(null);
  }, []);

  useImperativeHandle(ref, () => ({ fit }));

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
  }, [zoomAtWorld, worldFromClient, layout]);

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
      <div className="flex h-full items-center justify-center" style={{ background: C.canvas }}>
        <div className="text-center">
          <div className="font-mono text-[13px] font-bold tracking-widest" style={{ color: C.inkFaint }}>
            THE CANVAS IS WAITING
          </div>
          <div className="mt-2 max-w-[300px] text-[12.5px]" style={{ color: C.inkSoft }}>
            Units the engineer places will appear here, live, as the build runs.
          </div>
        </div>
      </div>
    );
  }

  const { width: W, height: H, units: pos } = layout;

  const streams = graph.streams.map((s) => {
    const st = STREAM_STYLE[s.cls] ?? STREAM_STYLE.syngas;
    const a = pos.get(s.from.unit);
    let d = '';
    let endX = 0;
    let endY = 0;
    let endAngle = 0;
    if (!a) return null;
    if (s.to && s.to.unit === s.from.unit) {
      // self-loop (internal recycle, e.g. separator letdown)
      const x0 = a.x + NODE_W - 26;
      const y0 = a.y + NODE_H;
      const x1 = a.x + 26;
      d = `M ${x0} ${y0} C ${x0 + 26} ${y0 + 34}, ${x1 - 26} ${y0 + 34}, ${x1} ${y0}`;
      endX = x1;
      endY = y0;
      endAngle = Math.PI; // pointing left into the unit
    } else {
      const sx = a.x + NODE_W;
      const sy = a.y + NODE_H / 2;
      const b = s.to ? pos.get(s.to.unit) : undefined;
      const ex = b ? b.x : a.x + NODE_W + 74;
      const ey = b ? b.y + NODE_H / 2 : sy;
      const dx = Math.max(48, Math.abs(ex - sx) / 2);
      d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`;
      endX = ex;
      endY = ey;
      endAngle = b ? (ey < sy ? -0.28 : ey > sy ? 0.28 : 0) : 0;
    }
    const midX = (a.x + NODE_W + endX) / 2;
    const midY = (a.y + NODE_H / 2 + endY) / 2 + (s.to && s.to.unit === s.from.unit ? 26 : 0);
    const pillW = 12 + s.id.length * 8;
    return { s, st, d, endX, endY, endAngle, midX, midY, pillW };
  });

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
              <path
                d={it.d}
                fill="none"
                strokeWidth={hover?.id === it.s.id ? STREAM_W_HI : STREAM_W}
                strokeDasharray={it.st.dash}
                strokeLinecap="round"
                style={{ stroke: it.st.color, pointerEvents: 'none' }}
              />
              <Arrow x={it.endX} y={it.endY} angle={it.endAngle} color={it.st.color} />
              {!it.s.implicit && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={it.midX - it.pillW / 2} y={it.midY - 10} width={it.pillW} height={20} rx={10} strokeWidth={1.2} style={{ fill: C.paper, stroke: it.st.color }} />
                  <text x={it.midX} y={it.midY + 4.5} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {it.s.id}
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
          return (
            <g
              key={u.id}
              transform={`translate(${p.x}, ${p.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (!movedRef.current) onUnitClick?.(u.id);
              }}
              onPointerEnter={() => setHover({ type: 'unit', id: u.id })}
              onPointerLeave={() => setHover((h) => (h?.id === u.id ? null : h))}
            >
              {/* transparent hit area — visuals below are pointer-events:none */}
              <rect x={-10} y={-10} width={NODE_W + 20} height={NODE_H + 20} fill="rgba(0,0,0,0)" style={{ pointerEvents: 'all' }} />
              <g className="bd-unit-in" style={{ pointerEvents: 'none' }}>
                {sel && <rect x={-9} y={-9} width={NODE_W + 18} height={NODE_H + 18} rx={14} style={{ fill: C.halo }} />}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={11}
                  strokeWidth={sel ? 2.6 : 1.8}
                  style={{ fill: C.paper, stroke: sel ? C.ink : hover?.id === u.id ? C.inkSoft : C.inkFaint }}
                />
                <text x={12} y={24} fontSize={15} fontWeight={800} style={{ fill: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {u.id}
                </text>
                <text x={12} y={44} fontSize={11.5} fontWeight={600} style={{ fill: C.inkSoft }}>
                  {(def?.name ?? u.type).slice(0, 26)}
                </text>
                <text x={12} y={62} fontSize={9.5} fontWeight={600} letterSpacing={0.8} style={{ fill: C.inkFaint }}>
                  {u.type}
                </text>
                <circle cx={0} cy={NODE_H / 2} r={4} style={{ fill: C.inkFaint }} />
                <circle cx={NODE_W} cy={NODE_H / 2} r={4} style={{ fill: C.inkFaint }} />
              </g>
            </g>
          );
        })}
      </svg>

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
          <span className="h-[3px] w-5 rounded-full" style={{ background: C.nh3 }} /> NH3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed" style={{ borderColor: C.inkFaint }} />
          UTILITIES
        </span>
      </div>

      {/* zoom controls */}
      <div
        className="absolute bottom-3 right-3 z-10 flex overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}
      >
        <button
          aria-label="Zoom out"
          className="hover-band h-8 w-8 text-sm font-bold"
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
