'use client';

/**
 * MiniFlow — a flowsheet in miniature, drawn in the SAME visual grammar
 * the app's real sheet uses: the flowsheet library's P&ID silhouettes
 * (furnace ≠ reactor ≠ exchanger ≠ drum — a ChE reader identifies the
 * class from outline alone), each with its equipment tag and name called
 * out beneath it the way the drawing office does, class-colored streams
 * with arrowheads. Pure SVG, no hooks — used by the hero's looping demo
 * and by the project grid's thumbnails.
 *
 * A unit WITH a `kind` renders the real UnitSymbol; a unit without one
 * falls back to the labeled box (defensive — every known engine type
 * maps to a kind in miniLayout below).
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
import { UnitSymbol } from '@/components/flowsheet/Symbols';
import type { UnitKind, UnitNode } from '@/lib/flowsheet/layout';

export interface MiniUnit {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** the real silhouette from the flowsheet symbol library */
  kind?: UnitKind;
  /** equipment tag ("R-102") — shown above the name like the real sheet */
  tag?: string;
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
  // several symbols (reactor, converter, column, …) hatch their catalyst
  // beds with url(#fsHatch). Same id + same definition as the Diagram's
  // own defs, so coexistence on one page is harmless (identical pattern).
  const symbolic = units.some((u) => u.kind);
  return (
    <svg
      viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${canvas.w} ${canvas.h}`}
      className={className}
      style={{ color: C.ink, transition: 'opacity 500ms', opacity: faded ? 0 : 1 }}
      aria-hidden="true"
    >
      {(dots || symbolic) && (
        <defs>
          {dots && (
            <pattern id="mfDots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1.3" cy="1.3" r="1.3" style={{ fill: C.bandLine }} />
            </pattern>
          )}
          {symbolic && (
            <pattern id="fsHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" strokeWidth="1.3" style={{ stroke: C.inkSoft }} />
            </pattern>
          )}
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
        // the real thing — the same silhouette the flowsheet sheet draws
        if (u.kind) {
          const node: UnitNode = {
            id: u.id,
            tag: u.tag ?? '',
            label: u.label,
            x: u.x,
            y: u.y,
            w: u.w,
            h: u.h,
            kind: u.kind,
          };
          const cx = u.x + u.w / 2;
          return (
            <g key={u.id} className="mf-settle">
              <g transform={`translate(${u.x}, ${u.y})`}>
                <UnitSymbol node={node} />
              </g>
              {u.tag ? (
                <>
                  <text
                    x={cx}
                    y={u.y + u.h + 15}
                    textAnchor="middle"
                    style={{
                      fill: C.ink,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    {u.tag}
                  </text>
                  <text
                    x={cx}
                    y={u.y + u.h + 28}
                    textAnchor="middle"
                    style={{ fill: C.inkSoft, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em' }}
                  >
                    {u.label}
                  </text>
                </>
              ) : (
                <text
                  x={cx}
                  y={u.y + u.h + 12}
                  textAnchor="middle"
                  style={{ fill: C.inkSoft, fontSize: 8, fontWeight: 600, letterSpacing: '0.06em' }}
                >
                  {u.label}
                </text>
              )}
            </g>
          );
        }
        // fallback — the labeled box (unknown kinds only)
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

const TH_COL = 170;
const TH_COL_W = 118; // column content width — units center inside it
const TH_BAND = 4; // columns per band before wrapping

/** every engine unit type → its real silhouette from the symbol library */
const TYPE_KIND: Record<string, UnitKind> = {
  'ng-source': 'source',
  'steam-source': 'source',
  'air-source': 'source',
  'syngas-feed': 'source',
  'column-feed': 'source',
  'acid-gas-source': 'source',
  'feed-mixer': 'mixer',
  'loop-mixer': 'mixer',
  'primary-reformer': 'furnace',
  'claus-burner': 'furnace',
  'secondary-reformer': 'secondary',
  'whb-cooler': 'hex',
  intercooler: 'hex',
  'feed-preheater': 'hex',
  'condensation-train': 'hex',
  chiller: 'hex',
  'feed-heater': 'hex',
  'sulphur-condenser': 'hex',
  'wgs-hts': 'reactor',
  'wgs-lts': 'reactor',
  methanator: 'reactor',
  'claus-converter': 'reactor',
  psa: 'reactor',
  'ko-drum-shift': 'drum',
  'ko-drum-meth': 'drum',
  'co2-removal': 'column',
  'syngas-compressor': 'compressor',
  'loop-circulator': 'compressor',
  converter: 'converter',
  'meoh-converter': 'converter',
  'nh3-separator': 'vdrum',
  'meoh-separator': 'vdrum',
  'flash-drum': 'vdrum',
  'purge-split': 'splitter',
  'distillation-column': 'dcolumn',
};

/** symbol-appropriate box sizes — portrait vessels are portrait, the
 *  furnace is the big box it is on the real sheet, hexes stay squat */
const KIND_SIZE: Record<UnitKind, { w: number; h: number }> = {
  mixer: { w: 56, h: 46 },
  splitter: { w: 56, h: 46 },
  furnace: { w: 112, h: 88 },
  secondary: { w: 88, h: 86 },
  hex: { w: 66, h: 54 },
  reactor: { w: 58, h: 72 },
  column: { w: 64, h: 116 },
  dcolumn: { w: 78, h: 148 },
  drum: { w: 66, h: 54 },
  vdrum: { w: 64, h: 98 },
  compressor: { w: 64, h: 54 },
  converter: { w: 82, h: 146 },
  source: { w: 50, h: 50 },
};

const kindOf = (type: string): UnitKind | undefined => TYPE_KIND[type];
const sizeOf = (u: { type: string }): { w: number; h: number } => {
  const k = kindOf(u.type);
  return (k && KIND_SIZE[k]) || { w: 118, h: 52 };
};

/**
 * Deterministic thumbnail layout — a compact cousin of the builder's
 * computed stage: BFS depth columns wrapped into serpentine bands.
 * Units carry their real symbol kinds and kind-appropriate sizes, centered
 * in their column; row stride follows the tallest unit stacked so far.
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
  const unitById = new Map(units.map((u) => [u.id, u]));

  // per-column row heights (units stack inside a column; stride = tallest
  // unit so far), then per-band heights from the tallest column
  const colOffsets = new Map<number, number[]>(); // d → cumulative y offsets
  const colHeight = new Map<number, number>();
  for (let d = 0; d <= maxDepth; d++) {
    const offs: number[] = [];
    let acc = 0;
    for (const id of rows[d]) {
      offs.push(acc);
      acc += sizeOf(unitById.get(id)!).h + 26;
    }
    colOffsets.set(d, offs);
    colHeight.set(d, Math.max(0, acc - 26));
  }

  const bandH = new Array(bandCount).fill(0);
  for (let d = 0; d <= maxDepth; d++) {
    const b = Math.floor(d / TH_BAND);
    bandH[b] = Math.max(bandH[b], colHeight.get(d) ?? 0);
  }

  const pos = new Map<string, { x: number; y: number }>();
  const sizeById = new Map<string, { w: number; h: number }>();
  const bandY = new Array(bandCount).fill(0);
  let acc = 30;
  for (let b = 0; b < bandCount; b++) {
    bandY[b] = acc;
    acc += bandH[b] + 46; // +46: recycle lane
  }

  for (const u of units) {
    const d = depth.get(u.id) ?? 0;
    const band = Math.floor(d / TH_BAND);
    const inBandCol = d % TH_BAND;
    const inBandRow = rows[d].indexOf(u.id);
    const flip = band % 2 === 1; // serpentine: next band starts under the end
    const col = flip ? TH_BAND - 1 - inBandCol : inBandCol;
    const sz = sizeOf(u);
    sizeById.set(u.id, sz);
    pos.set(u.id, {
      // centered in the column's content width
      x: 30 + col * TH_COL + (TH_COL_W - sz.w) / 2,
      y: bandY[band] + (colOffsets.get(d)?.[inBandRow] ?? 0),
    });
  }

  let maxX = 0;
  let maxY = 0;
  for (const u of units) {
    const p = pos.get(u.id)!;
    const sz = sizeById.get(u.id)!;
    maxX = Math.max(maxX, p.x + sz.w);
    maxY = Math.max(maxY, p.y + sz.h);
  }
  const canvasW = maxX + 78; // room for sink arrows
  const canvasH = maxY + 42;

  const miniUnits: MiniUnit[] = units.map((u) => {
    const p = pos.get(u.id)!;
    const sz = sizeById.get(u.id)!;
    return {
      id: u.id,
      label: (getUnitType(u.type)?.name ?? u.type).toUpperCase(),
      x: p.x,
      y: p.y,
      w: sz.w,
      h: sz.h,
      kind: kindOf(u.type),
    };
  });
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
