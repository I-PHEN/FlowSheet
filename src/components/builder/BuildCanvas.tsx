'use client';

/**
 * BuildCanvas — the live flowsheet canvas of the AI builder.
 *
 * The reference plant's Diagram uses a hand-tuned layout; here the graph
 * arrives piecewise from the agent's tool events, so the layout is computed:
 * BFS depth from the feed sources, depth-columns wrapped into bands, units
 * stacked within columns. New units fade in as the engineer places them;
 * streams are class-colored beziers with id pills, arrowheads, self-loops
 * for internal recycles, and off-canvas arrows for product/waste sinks.
 *
 * Clicking a unit selects it — the page shows a spec inspector built from
 * the live registry (pure client-side: no engine solve, no server calls).
 */

import { useMemo, useState } from 'react';
import type { FlowGraph } from '@/lib/engine/graph';
import { getUnitType, resolveSpecs } from '@/lib/engine/registry';
import { C, STREAM_STYLE, STREAM_W } from '@/lib/design/tokens';

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

export interface BuildCanvasProps {
  graph: FlowGraph | null;
  selected: string | null;
  onUnitClick?: (id: string) => void;
}

export function BuildCanvas({ graph, selected, onUnitClick }: BuildCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const layout = useMemo(() => (graph ? computeLayout(graph) : null), [graph]);

  if (!graph || !layout || graph.units.length === 0) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: C.canvas }}>
        <div className="text-center">
          <div className="font-mono text-[13px] font-bold tracking-widest" style={{ color: C.inkFaint }}>
            EMPTY CANVAS
          </div>
          <div className="mt-2 max-w-[300px] text-[12.5px]" style={{ color: C.inkSoft }}>
            Units the engineer places will appear here, live, as the build runs.
          </div>
        </div>
      </div>
    );
  }

  const { width: W, height: H, units: pos } = layout;
  const vx = (W * (1 - 1 / zoom)) / 2;
  const vy = (H * (1 - 1 / zoom)) / 2;

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

  return (
    <div className="relative h-full" style={{ background: C.canvas }}>
      <svg
        viewBox={`${vx} ${vy} ${W / zoom} ${H / zoom}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%', fontFamily: 'inherit' }}
        aria-label="Plant flowsheet being built by the AI agent"
      >
        {streams.map((it) =>
          it ? (
            <g key={it.s.id} opacity={it.s.implicit ? 0.55 : 1}>
              <path d={it.d} fill="none" strokeWidth={STREAM_W} strokeDasharray={it.st.dash} strokeLinecap="round" style={{ stroke: it.st.color, pointerEvents: 'none' }} />
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
            <g key={u.id} transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'pointer' }} onClick={() => onUnitClick?.(u.id)}>
              {/* transparent hit area — visuals below are pointer-events:none */}
              <rect x={-10} y={-10} width={NODE_W + 20} height={NODE_H + 20} fill="rgba(0,0,0,0)" style={{ pointerEvents: 'all' }} />
              <g className="bd-unit-in" style={{ pointerEvents: 'none' }}>
                {sel && <rect x={-9} y={-9} width={NODE_W + 18} height={NODE_H + 18} rx={14} style={{ fill: C.halo }} />}
                <rect width={NODE_W} height={NODE_H} rx={11} strokeWidth={sel ? 2.6 : 1.8} style={{ fill: C.paper, stroke: sel ? C.ink : C.inkFaint }} />
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

      {/* zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        {[
          { label: '−', act: () => setZoom((z) => Math.max(0.7, z - 0.25)) },
          { label: `${Math.round(zoom * 100)}%`, act: () => setZoom(1), wide: true },
          { label: '+', act: () => setZoom((z) => Math.min(4, z + 0.25)) },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.act}
            className="hover-band rounded-lg border px-2 py-1 font-mono text-[11px] font-bold"
            style={{ color: C.ink, minWidth: b.wide ? 46 : 28, background: C.paper }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
