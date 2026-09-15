'use client';

/**
 * MiniFlow — a flowsheet in miniature, drawn in the builder stage's visual
 * language: rounded equipment nodes with wrapped labels, class-colored
 * streams with arrowheads. Pure SVG, no hooks — used by the hero's
 * looping demo and by the project grid's thumbnails.
 *
 * Motion is mount-driven: elements reveal themselves with the same
 * choreography the builder canvas uses (equipment settles, streams draw
 * themselves in), so a caller revealing pieces over time gets the build
 * feel for free. An optional `view` drives the hero's drifting camera.
 */

import { C, STREAM_STYLE, STREAM_W } from '@/lib/design/tokens';
import type { FlowGraph } from '@/lib/engine/graph';
import { getUnitType } from '@/lib/engine/registry';
import { buildGrid, roundedPath, routeStream, type RRect } from '@/lib/flowsheet/route';

export interface MiniUnit {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MiniStream {
  id: string;
  /** path in canvas space */
  d: string;
  cls?: string;
  /** end arrowhead position + angle (radians, 0 = pointing right) */
  arrow?: { x: number; y: number; angle: number };
}

export interface MiniFlowProps {
  canvas: { w: number; h: number };
  units: MiniUnit[];
  streams: MiniStream[];
  /** small stream annotations (natural gas, steam, …) */
  labels?: Array<{ x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }>;
  /** dim everything (hero reset moment) */
  faded?: boolean;
  /** controlled camera (hero); default = the full canvas */
  view?: { x: number; y: number; w: number; h: number };
  /** faint dot grid on the sheet — the engineering-canvas feel */
  dots?: boolean;
  className?: string;
}

function Arrow({ x, y, angle }: { x: number; y: number; angle: number }) {
  const L = 9;
  const W = 4.4;
  return (
    <polygon
      points={`${x},${y} ${x - L * Math.cos(angle) + W * Math.sin(angle)},${y - L * Math.sin(angle) - W * Math.cos(angle)} ${x - L * Math.cos(angle) - W * Math.sin(angle)},${y - L * Math.sin(angle) + W * Math.cos(angle)}`}
      stroke="none"
      style={{ fill: 'currentColor' }}
    />
  );
}

/** wrap a label into at most two lines of ≤12 chars */
function wrap(label: string): [string, string] {
  if (label.length <= 12) return [label, ''];
  const words = label.split(' ');
  if (words.length >= 2) {
    let l1 = '';
    let i = 0;
    while (i < words.length - 1 && (l1 + ' ' + words[i]).trim().length <= 12) {
      l1 = `${l1} ${words[i]}`.trim();
      i++;
    }
    const l2 = words.slice(i).join(' ');
    if (l2 && l2.length <= 14) return [l1, l2];
    return [l1, `${l2.slice(0, 13)}…`];
  }
  return [label.slice(0, 11), ''];
}

export function MiniFlow({ canvas, units, streams, labels, faded, view, dots, className }: MiniFlowProps) {
  return (
    <svg
      viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${canvas.w} ${canvas.h}`}
      className={className}
      style={{ color: C.ink, transition: 'opacity 500ms', opacity: faded ? 0 : 1 }}
      aria-hidden="true"
    >
      {dots && (
        <defs>
          <pattern id="mfDots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.3" cy="1.3" r="1.3" style={{ fill: C.bandLine }} />
          </pattern>
        </defs>
      )}
      {dots && <rect x={0} y={0} width={canvas.w} height={canvas.h} fill="url(#mfDots)" />}
      {streams.map((s) => {
        const st = STREAM_STYLE[s.cls ?? 'syngas'] ?? STREAM_STYLE.syngas;
        return (
          <g key={s.id}>
            {/* the line draws itself in; dashed utilities then fade their
                pattern over the solid draw, which steps aside */}
            <path
              d={s.d}
              fill="none"
              pathLength={1}
              className={st.dash ? 'mf-draw mf-draw-out' : 'mf-draw'}
              style={{ stroke: st.color }}
              strokeWidth={STREAM_W * 0.72}
              strokeLinecap="round"
            />
            {st.dash && (
              <path
                d={s.d}
                fill="none"
                className="mf-dash-in"
                style={{ stroke: st.color }}
                strokeWidth={STREAM_W * 0.72}
                strokeDasharray={st.dash}
                strokeLinecap="round"
              />
            )}
            {s.arrow && (
              <g style={{ color: st.color }} className="mf-pop">
                <Arrow {...s.arrow} />
              </g>
            )}
          </g>
        );
      })}
      {units.map((u) => {
        const [l1, l2] = wrap(u.label);
        return (
          <g key={u.id} className="mf-settle">
            <rect
              x={u.x}
              y={u.y}
              width={u.w}
              height={u.h}
              rx={9}
              style={{ fill: C.paper, stroke: C.bandLine }}
              strokeWidth={1.6}
            />
            {l2 ? (
              <>
                <text
                  x={u.x + u.w / 2}
                  y={u.y + u.h / 2 - 4}
                  textAnchor="middle"
                  style={{ fill: C.ink, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.03em' }}
                >
                  {l1}
                </text>
                <text
                  x={u.x + u.w / 2}
                  y={u.y + u.h / 2 + 10}
                  textAnchor="middle"
                  style={{ fill: C.inkSoft, fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}
                >
                  {l2}
                </text>
              </>
            ) : (
              <text
                x={u.x + u.w / 2}
                y={u.y + u.h / 2 + 4}
                textAnchor="middle"
                style={{ fill: C.ink, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em' }}
              >
                {l1}
              </text>
            )}
          </g>
        );
      })}
      {labels?.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor ?? 'middle'}
          className="mf-label"
          style={{ fill: C.inkFaint, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em' }}
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// FlowGraph (engine) → positioned miniature (project thumbnails)
// ---------------------------------------------------------------------------

const TH_W = 118;
const TH_H = 52;
const TH_COL = 170;
const TH_BAND = 4; // columns per band before wrapping
const TH_ROW = 150; // vertical stride per band

/**
 * Deterministic thumbnail layout — a compact cousin of the builder's
 * computed stage: BFS depth columns wrapped into serpentine bands.
 * Streams are routed by the shared grid router (corridors + lanes), so
 * a thumbnail line never crosses a unit, whatever the graph.
 */
export function miniLayout(graph: FlowGraph): {
  canvas: { w: number; h: number };
  units: MiniUnit[];
  streams: MiniStream[];
} {
  const units = graph.units;
  if (units.length === 0) return { canvas: { w: 640, h: 200 }, units: [], streams: [] };

  const succs = new Map<string, Set<string>>();
  for (const u of units) succs.set(u.id, new Set());
  for (const s of graph.streams) {
    if (s.to && s.to.unit !== s.from.unit) succs.get(s.from.unit)?.add(s.to.unit);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const u of units) {
    const hasPred = graph.streams.some((s) => s.to?.unit === u.id && s.to.unit !== s.from.unit);
    if (!hasPred) {
      depth.set(u.id, 0);
      queue.push(u.id);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of succs.get(cur) ?? []) {
      const nd = (depth.get(cur) ?? 0) + 1;
      if ((depth.get(next) ?? Infinity) > nd) {
        depth.set(next, nd);
        queue.push(next);
      }
    }
  }
  for (const u of units) if (!depth.has(u.id)) depth.set(u.id, 0);

  // group by depth (column), preserving graph order within a column
  const cols = new Map<number, string[]>();
  for (const u of units) {
    const d = depth.get(u.id) ?? 0;
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d)!.push(u.id);
  }
  const maxDepth = Math.max(...cols.keys());
  const rows = Array.from({ length: maxDepth + 1 }, (_, d) => cols.get(d) ?? []);

  // serpentine band wrap: band b holds columns [b*TH_BAND, (b+1)*TH_BAND)
  const bandCount = Math.max(1, Math.ceil((maxDepth + 1) / TH_BAND));
  const bandRows = Array.from({ length: bandCount }, () => 0);
  for (let d = 0; d <= maxDepth; d++) {
    const b = Math.floor(d / TH_BAND);
    bandRows[b] = Math.max(bandRows[b], rows[d].length);
  }

  const pos = new Map<string, { x: number; y: number }>();
  const bandY = new Array(bandCount).fill(0);
  let acc = 30;
  for (let b = 0; b < bandCount; b++) {
    bandY[b] = acc;
    acc += Math.max(1, bandRows[b]) * (TH_H + 26) + 46; // +46: recycle lane
  }

  for (const u of units) {
    const d = depth.get(u.id) ?? 0;
    const band = Math.floor(d / TH_BAND);
    const inBandCol = d % TH_BAND;
    const inBandRow = rows[d].indexOf(u.id);
    const flip = band % 2 === 1; // serpentine: next band starts under the end
    const col = flip ? TH_BAND - 1 - inBandCol : inBandCol;
    pos.set(u.id, {
      x: 30 + col * TH_COL,
      y: bandY[band] + inBandRow * (TH_H + 26),
    });
  }

  let maxX = 0;
  let maxY = 0;
  for (const p of pos.values()) {
    maxX = Math.max(maxX, p.x + TH_W);
    maxY = Math.max(maxY, p.y + TH_H);
  }
  const canvasW = maxX + 78; // room for sink arrows
  const canvasH = maxY + 42;

  const miniUnits: MiniUnit[] = units.map((u) => ({
    id: u.id,
    label: (getUnitType(u.type)?.name ?? u.type).toUpperCase(),
    x: pos.get(u.id)!.x,
    y: pos.get(u.id)!.y,
    w: TH_W,
    h: TH_H,
  }));
  const um = new Map(miniUnits.map((u) => [u.id, u]));

  // grid routing — corridors and lanes only, lines never touch a unit
  const rects: RRect[] = miniUnits.map((u) => ({ x: u.x, y: u.y, w: u.w, h: u.h }));
  const grid = buildGrid(rects, canvasW, canvasH);
  const pairSeen = new Map<string, number>();
  let recycleLanes = 0;

  const miniStreams: MiniStream[] = [];
  for (const s of graph.streams) {
    const from = um.get(s.from.unit);
    if (!from) continue;
    if (s.to && s.to.unit === s.from.unit) continue; // self loops: skip in miniature
    const toEp = s.to;
    const to = toEp ? um.get(toEp.unit) : undefined;
    const a: RRect = { x: from.x, y: from.y, w: from.w, h: from.h };
    const b: RRect | null = to ? { x: to.x, y: to.y, w: to.w, h: to.h } : null;
    const forward =
      to && toEp ? (depth.get(toEp.unit) ?? 0) > (depth.get(s.from.unit) ?? 0) : true;
    const key = `${s.from.unit}→${toEp?.unit ?? 'env'}`;
    const pairIndex = pairSeen.get(key) ?? 0;
    pairSeen.set(key, pairIndex + 1);
    const laneIndex = forward ? 0 : recycleLanes++;
    const r = routeStream(a, b, grid, forward, { pairIndex, laneIndex });
    const last = r.pts[r.pts.length - 1];
    miniStreams.push({
      id: s.id,
      d: roundedPath(r.pts, 8),
      cls: s.cls,
      arrow: { x: last[0], y: last[1], angle: r.endAngle },
    });
  }

  return { canvas: { w: canvasW, h: canvasH }, units: miniUnits, streams: miniStreams };
}
