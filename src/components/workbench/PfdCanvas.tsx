'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlantResult, Stream } from '@/lib/engine/types';
import { SPECIES } from '@/lib/engine/species';
import { total, massFlow, mwMix } from '@/lib/engine/thermo';
import {
  ANNOTATIONS,
  CANVAS,
  STREAMS,
  UNITS,
  UNIT_VALUE_LINES,
} from '@/lib/workbench/layout';
import type { UnitNode } from '@/lib/workbench/layout';

interface Props {
  result: PlantResult;
  selectedUnit: string | null;
  selectedStream: string | null;
  onSelectUnit: (id: string | null) => void;
  onSelectStream: (id: string | null) => void;
}

interface TooltipState {
  x: number;
  y: number;
  stream: Stream | null;
}

function polylineMid(pts: Array<[number, number]>, frac: number): [number, number] {
  const segs: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(d);
    totalLen += d;
  }
  let target = totalLen * frac;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const t = segs[i] > 0 ? target / segs[i] : 0;
      return [
        pts[i][0] + t * (pts[i + 1][0] - pts[i][0]),
        pts[i][1] + t * (pts[i + 1][1] - pts[i][1]),
      ];
    }
    target -= segs[i];
  }
  return pts[pts.length - 1];
}

const fmt = (x: number, d = 1) =>
  Math.abs(x) >= 1000 ? x.toFixed(0) : x.toFixed(d);

export function PfdCanvas({ result, selectedUnit, selectedStream, onSelectUnit, onSelectStream }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const [wrapSize, setWrapSize] = useState({ w: 900, h: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hover, setHover] = useState<TooltipState | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // only pan from the background (not units/streams)
      if ((e.target as Element).closest('[data-unit],[data-stream]')) return;
      dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [view],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (hover) {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (rect) setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, stream: hover.stream });
      }
      const d = dragRef.current;
      if (!d) return;
      setView((v) => ({ ...v, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) }));
    },
    [hover],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const k2 = Math.min(3.2, Math.max(0.45, v.k * (e.deltaY < 0 ? 1.12 : 0.893)));
      // zoom about the cursor
      const tx2 = mx - ((mx - v.tx) * k2) / v.k;
      const ty2 = my - ((my - v.ty) * k2) / v.k;
      return { k: k2, tx: tx2, ty: ty2 };
    });
  }, []);

  const zoomBtn = (f: number) => {
    const mx = wrapSize.w / 2;
    const my = wrapSize.h / 2;
    setView((v) => {
      const k2 = Math.min(3.2, Math.max(0.45, v.k * f));
      return { k: k2, tx: mx - ((mx - v.tx) * k2) / v.k, ty: my - ((my - v.ty) * k2) / v.k };
    });
  };

  const fit = () => setView({ tx: 0, ty: 0, k: 1 });

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[#0b0f13] select-none"
      style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        onPointerUp();
        setHover(null);
      }}
      onWheel={onWheel}
    >
      <svg className="h-full w-full" viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="wbGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="#1a2530" />
          </pattern>
          {[
            ['feed', '#8fa3b2'],
            ['syngas', '#c3ccd4'],
            ['loopgas', '#6fb6d9'],
            ['product', '#f2a93b'],
            ['water', '#6c93b5'],
            ['co2', '#86b892'],
            ['purge', '#d98c8c'],
          ].map(([c, hex]) => (
            <marker
              key={c}
              id={`arr-${c}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill={hex} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
          <rect x={0} y={0} width={CANVAS.w} height={CANVAS.h} fill="url(#wbGrid)" />

          {/* ── streams ─────────────────────────────────────────── */}
          {STREAMS.map((edge) => {
            const s = result.streams[edge.id];
            if (!s) return null;
            const d = edge.pts.map((p) => p.join(',')).join(' ');
            const selected = selectedStream === edge.id;
            const mid = polylineMid(edge.pts, edge.labelAt ?? 0.5);
            return (
              <g key={edge.id} data-stream={edge.id}>
                <polyline
                  points={d}
                  fill="none"
                  className={`st-${edge.cls} ${selected ? '' : 'wb-flow'}`}
                  stroke={selected ? '#f2a93b' : undefined}
                  strokeWidth={selected ? 2.2 : 1.4}
                  markerEnd={`url(#arr-${edge.cls})`}
                  opacity={0.9}
                />
                {/* invisible hit area */}
                <polyline
                  points={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: 'pointer' }}
                  onPointerEnter={(e) => {
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (rect) setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, stream: s });
                  }}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => {
                    onSelectStream(edge.id);
                    onSelectUnit(null);
                  }}
                />
                <text
                  x={mid[0]}
                  y={mid[1] - 5}
                  textAnchor="middle"
                  fontSize={10}
                  className="wb-mono"
                  fill={selected ? '#f2a93b' : '#7a90a0'}
                >
                  {edge.id}
                </text>
              </g>
            );
          })}

          {/* ── units ───────────────────────────────────────────── */}
          {UNITS.map((u) => (
            <UnitSymbol
              key={u.id}
              node={u}
              unit={result.units[u.id]}
              selected={selectedUnit === u.id}
              values={UNIT_VALUE_LINES[u.id] ?? []}
              onClick={() => {
                onSelectUnit(u.id);
                onSelectStream(null);
              }}
            />
          ))}

          {/* ── margin annotations ──────────────────────────────── */}
          {ANNOTATIONS.map((a) => (
            <text
              key={a.text + a.x}
              x={a.x}
              y={a.y}
              fontSize={10}
              letterSpacing={1.2}
              fill="#7a90a0"
              className="wb-mono"
            >
              {a.text}
            </text>
          ))}

          {/* title block */}
          <g transform={`translate(${CANVAS.w - 320},${CANVAS.h - 84})`}>
            <rect width="300" height="68" fill="#10161c" stroke="#1f2a34" />
            <line x1="0" y1="22" x2="300" y2="22" stroke="#1f2a34" />
            <line x1="0" y1="44" x2="300" y2="44" stroke="#1f2a34" />
            <text x="10" y="15" fontSize="10" fill="#8ca0ae" letterSpacing={1.5} className="wb-mono">
              AMMONIA PLANT — SMR ROUTE
            </text>
            <text x="10" y="37" fontSize="9" fill="#5c7080" className="wb-mono">
              PROCESS FLOW DIAGRAM · 19 UNITS · 28 STREAMS
            </text>
            <text x="10" y="59" fontSize="9" fill="#5c7080" className="wb-mono">
              SEQ-MODULAR SOLVER · PR EOS · G-B EQUILIBRIUM
            </text>
            <text x="290" y="59" fontSize="9" fill="#f2a93b" textAnchor="end" className="wb-mono">
              REV A
            </text>
          </g>
        </g>
      </svg>

      {/* zoom controls */}
      <div className="absolute bottom-3 left-3 flex gap-1">
        {[
          { t: '+', fn: () => zoomBtn(1.25) },
          { t: '−', fn: () => zoomBtn(0.8) },
          { t: 'FIT', fn: fit },
        ].map((b) => (
          <button
            key={b.t}
            onClick={b.fn}
            className="wb-panel wb-mono h-7 min-w-7 px-2 text-[11px] text-[#8ca0ae] hover:text-[#dce5ec] hover:border-[#2c3d4b]"
          >
            {b.t}
          </button>
        ))}
      </div>

      {/* legend */}
      <div className="wb-panel absolute top-3 left-3 px-2.5 py-2">
        <div className="wb-label mb-1.5">STREAM CLASSES</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            ['feed', 'FEED'],
            ['syngas', 'SYNGAS'],
            ['loopgas', 'LOOP GAS'],
            ['product', 'NH3 PRODUCT'],
            ['water', 'CONDENSATE'],
            ['co2', 'CO2'],
            ['purge', 'PURGE'],
          ].map(([c, label]) => (
            <div key={c} className="flex items-center gap-1.5">
              <svg width="18" height="4">
                <line x1="0" y1="2" x2="18" y2="2" className={`st-${c}`} strokeWidth="2" />
              </svg>
              <span className="wb-mono text-[9px] text-[#8ca0ae]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* stream tooltip */}
      {hover?.stream && (
        <div
          className="wb-panel pointer-events-none absolute z-20 w-64 shadow-xl"
          style={{
            left: Math.min(hover.x + 14, wrapSize.w - 270),
            top: Math.min(hover.y + 12, wrapSize.h - 250),
          }}
        >
          <div className="border-b border-[#1f2a34] px-2.5 py-1.5">
            <div className="wb-mono text-[11px] text-[#f2a93b]">
              {hover.stream.id} · {hover.stream.name}
            </div>
          </div>
          <div className="px-2.5 py-1.5">
            <div className="wb-mono grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] text-[#c2ced8]">
              <span className="text-[#5c7080]">T</span>
              <span className="text-right">{fmt(hover.stream.T - 273.15)} °C</span>
              <span className="text-[#5c7080]">P</span>
              <span className="text-right">{fmt(hover.stream.P / 1e5)} bar</span>
              <span className="text-[#5c7080]">FLOW</span>
              <span className="text-right">{fmt(total(hover.stream.n))} kmol/h</span>
              <span className="text-[#5c7080]">MASS</span>
              <span className="text-right">{fmt(massFlow(hover.stream.n) / 1000)} t/h</span>
              <span className="text-[#5c7080]">MW</span>
              <span className="text-right">{fmt(mwMix(hover.stream.n), 2)}</span>
            </div>
            <div className="mt-1.5 border-t border-[#1f2a34] pt-1.5">
              {SPECIES.map((sp, i) =>
                hover.stream!.n[i] > 0.001 ? (
                  <div key={sp} className="wb-mono grid grid-cols-2 gap-x-3 text-[10px] text-[#8ca0ae]">
                    <span>{sp}</span>
                    <span className="text-right text-[#c2ced8]">
                      {((hover.stream!.n[i] / Math.max(total(hover.stream!.n), 1e-9)) * 100).toFixed(2)} %
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unit symbols — plain engineering line-work
// ---------------------------------------------------------------------------

function UnitSymbol({
  node,
  unit,
  selected,
  values,
  onClick,
}: {
  node: UnitNode;
  unit: PlantResult['units'][string] | undefined;
  selected: boolean;
  values: number[];
  onClick: () => void;
}) {
  const { x, y, w, h, kind, label } = node;
  const stroke = selected ? '#f2a93b' : '#93a7b5';
  const fill = '#10161c';
  const cx = x + w / 2;
  return (
    <g
      data-unit={node.id}
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      opacity={1}
    >
      {/* hit rect */}
      <rect x={-8} y={-8} width={w + 16} height={h + 16} fill="transparent" />

      {kind === 'mixer' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={w / 2 - 12} y={h / 2 - 12} width={24} height={24} />
          <line x1={w / 2 - 12} y1={h / 2} x2={w / 2 + 12} y2={h / 2} strokeWidth={1} strokeDasharray="3 3" />
        </g>
      )}

      {kind === 'furnace' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={8} y={10} width={w - 16} height={h - 10} />
          {/* stack */}
          <rect x={w - 34} y={-14} width={14} height={26} fill={fill} />
          {/* tubes */}
          <line x1={22} y1={22} x2={22} y2={h - 14} />
          <line x1={34} y1={22} x2={34} y2={h - 14} />
          <line x1={46} y1={22} x2={46} y2={h - 14} />
          <line x1={58} y1={22} x2={58} y2={h - 14} />
          <line x1={70} y1={22} x2={70} y2={h - 14} />
          {/* flames */}
          <path d={`M 16 ${h - 6} q 8 -10 16 0`} fill="none" strokeWidth={1.1} />
          <path d={`M 40 ${h - 6} q 8 -10 16 0`} fill="none" strokeWidth={1.1} />
          <path d={`M 64 ${h - 6} q 8 -10 16 0`} fill="none" strokeWidth={1.1} />
        </g>
      )}

      {kind === 'secondary' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={6} y={8} width={w - 12} height={h - 8} />
          <rect x={11} y={13} width={w - 22} height={h - 18} strokeWidth={0.9} />
          {/* burner air nozzle */}
          <line x1={cx} y1={8} x2={cx} y2={-6} strokeWidth={1.2} />
          <path d={`M ${cx - 6} -6 L ${cx + 6} -6 L ${cx} 2 z`} fill={stroke} strokeWidth={0.6} />
          {/* catalyst checker */}
          <line x1={16} y1={h - 26} x2={w - 16} y2={h - 26} strokeWidth={0.9} strokeDasharray="4 3" />
          <line x1={16} y1={h - 16} x2={w - 16} y2={h - 16} strokeWidth={0.9} strokeDasharray="4 3" />
        </g>
      )}

      {kind === 'hex' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 4} />
          <path
            d={`M ${w / 2 - 12} ${h / 2 - 8} h6 v6 h6 v-6 h6 v6 h6`}
            fill="none"
            strokeWidth={1.1}
          />
        </g>
      )}

      {kind === 'reactor' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={w / 2 - 16} y={4} width={32} height={h - 8} rx={10} />
          {/* catalyst hatch */}
          <line x1={w / 2 - 10} y1={h - 12} x2={w / 2 + 10} y2={h - 12} strokeWidth={1} />
          <line x1={w / 2 - 10} y1={h - 16} x2={w / 2 + 10} y2={h - 16} strokeWidth={1} />
          <line x1={w / 2 - 10} y1={h - 20} x2={w / 2 + 10} y2={h - 20} strokeWidth={1} />
        </g>
      )}

      {kind === 'column' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={w / 2 - 18} y={2} width={36} height={h - 4} />
          <ellipse cx={w / 2} cy={2} rx={18} ry={4} strokeWidth={1.1} />
          <ellipse cx={w / 2} cy={h - 2} rx={18} ry={4} strokeWidth={1.1} />
          <line x1={w / 2 - 18} y1={h * 0.35} x2={w / 2 + 18} y2={h * 0.35} strokeDasharray="5 4" strokeWidth={0.9} />
          <line x1={w / 2 - 18} y1={h * 0.68} x2={w / 2 + 18} y2={h * 0.68} strokeDasharray="5 4" strokeWidth={0.9} />
        </g>
      )}

      {kind === 'drum' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={2} y={h / 2 - 12} width={w - 4} height={24} rx={12} />
          <line x1={w * 0.22} y1={h / 2 + 6} x2={w * 0.78} y2={h / 2 + 6} strokeWidth={1} strokeDasharray="4 3" />
        </g>
      )}

      {kind === 'vdrum' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={w / 2 - 22} y={2} width={44} height={h - 34} rx={16} />
          {/* liquid level */}
          <line x1={w / 2 - 16} y1={h - 62} x2={w / 2 + 16} y2={h - 62} strokeWidth={1} strokeDasharray="4 3" />
          {/* internal letdown drum */}
          <rect x={w / 2 - 12} y={h - 26} width={24} height={20} rx={9} strokeWidth={1.1} />
          <line x1={w / 2} y1={h - 34} x2={w / 2} y2={h - 26} strokeWidth={1} />
        </g>
      )}

      {kind === 'compressor' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 4} />
          <path d={`M ${w / 2 - 9} ${h / 2 - 8} L ${w / 2 + 10} ${h / 2} L ${w / 2 - 9} ${h / 2 + 8} z`} fill="none" strokeWidth={1.1} />
          <line x1={w / 2 + 13} y1={h / 2} x2={w - 2} y2={h / 2} strokeWidth={1.1} />
        </g>
      )}

      {kind === 'splitter' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.4}>
          <rect x={w / 2 - 13} y={h / 2 - 13} width={26} height={26} />
          <line x1={w / 2 - 6} y1={h / 2 - 13} x2={w / 2 - 6} y2={h / 2 + 13} strokeWidth={0.9} strokeDasharray="3 2" />
          <line x1={w / 2 + 6} y1={h / 2 - 13} x2={w / 2 + 6} y2={h / 2 + 13} strokeWidth={0.9} strokeDasharray="3 2" />
        </g>
      )}

      {kind === 'converter' && (
        <g stroke={stroke} fill={fill} strokeWidth={1.5}>
          <rect x={10} y={2} width={w - 20} height={h - 4} rx={14} />
          {/* three catalyst beds */}
          {[0.14, 0.44, 0.74].map((fy) => (
            <rect
              key={fy}
              x={18}
              y={h * fy}
              width={w - 36}
              height={h * 0.18}
              strokeWidth={1}
              strokeDasharray="none"
              fill="#1a232d"
            />
          ))}
          {/* interbed nozzles */}
          <line x1={w - 10} y1={h * 0.4} x2={w + 6} y2={h * 0.4} strokeWidth={1.1} />
          <line x1={w - 10} y1={h * 0.7} x2={w + 6} y2={h * 0.7} strokeWidth={1.1} />
        </g>
      )}

      {/* selection highlight */}
      {selected && (
        <rect
          x={-5}
          y={-5}
          width={w + 10}
          height={h + 10}
          fill="none"
          stroke="#f2a93b"
          strokeWidth={1}
          strokeDasharray="5 3"
        />
      )}

      {/* label */}
      <text
        x={w / 2}
        y={h + 14}
        textAnchor="middle"
        fontSize={9}
        letterSpacing={0.8}
        fill={selected ? '#f2a93b' : '#8ca0ae'}
        className="wb-mono"
      >
        {label}
      </text>

      {/* live values */}
      {unit &&
        values.map((mi, k) =>
          unit.metrics[mi] ? (
            <text
              key={k}
              x={w / 2}
              y={h + 27 + k * 12}
              textAnchor="middle"
              fontSize={9.5}
              fill={selected ? '#f2a93b' : '#8fa6b5'}
              className="wb-mono"
            >
              {unit.metrics[mi].value}
            </text>
          ) : null,
        )}
    </g>
  );
}
