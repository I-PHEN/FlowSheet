/**
 * Equipment symbol library — one grammar, distinct silhouettes.
 *
 * Every symbol is drawn inside its unit box (local coords 0..w, 0..h),
 * stroked in ink on a paper fill so equipment is the brightest object on
 * the canvas. Silhouettes are deliberately distinct: a ChE reader should
 * identify the equipment class from outline alone (furnace ≠ reactor ≠
 * exchanger ≠ drum ≠ compressor ≠ column).
 */

import type { CSSProperties } from 'react';
import { C, DIAGRAM_STROKE } from '@/lib/design/tokens';
import type { UnitNode } from '@/lib/flowsheet/layout';

interface SymProps {
  node: UnitNode;
  /** emphasized (hover) */
  hi?: boolean;
  /** selected */
  sel?: boolean;
}

/**
 * Base equipment style — ink outline on paper fill. Returned as a STYLE
 * object (never spread as attributes) because the colors are CSS variable
 * references, which SVG presentation attributes cannot resolve. Same for
 * `thin` below.
 */
const stroke = (hi?: boolean, sel?: boolean): CSSProperties => ({
  stroke: C.ink,
  strokeWidth: sel ? DIAGRAM_STROKE + 1.1 : hi ? DIAGRAM_STROKE + 0.6 : DIAGRAM_STROKE,
  fill: C.paper,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
});

export function UnitSymbol({ node, hi, sel }: SymProps) {
  const { w, h, kind } = node;
  const s = stroke(hi, sel);
  const thin: CSSProperties = { stroke: C.inkSoft, strokeWidth: 1.3, fill: 'none' };

  switch (kind) {
    case 'mixer':
      return (
        <g>
          <path
            d={`M 3 ${h * 0.16} L ${w * 0.58} ${h * 0.5} L 3 ${h * 0.84} Z`}
            style={s}
          />
          <circle cx={w * 0.24} cy={h * 0.5} r={2.2} style={{ fill: C.ink, stroke: 'none' }} />
        </g>
      );

    case 'splitter':
      return (
        <g>
          <path
            d={`M ${w - 3} ${h * 0.16} L ${w * 0.42} ${h * 0.5} L ${w - 3} ${h * 0.84} Z`}
            style={s}
          />
          <circle cx={w * 0.76} cy={h * 0.5} r={2.2} style={{ fill: C.ink, stroke: 'none' }} />
        </g>
      );

    case 'furnace':
      return (
        <g>
          {/* stack stub on the roof */}
          <rect x={w * 0.1} y={-12} width={13} height={14} rx={2} style={s} />
          {/* firebox */}
          <rect x={4} y={2} width={w - 8} height={h - 8} rx={3} style={s} />
          {/* reforming tubes (two rows) */}
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={`t${i}`}
              x1={w * 0.16 + i * ((w * 0.68) / 6)}
              y1={h * 0.16}
              x2={w * 0.16 + i * ((w * 0.68) / 6)}
              y2={h * 0.6}
              style={thin}
            />
          ))}
          {/* burner flames along the floor */}
          {[0.22, 0.5, 0.78].map((f) => (
            <path
              key={f}
              d={`M ${w * f - 9} ${h - 13} L ${w * f} ${h * 0.68} L ${w * f + 9} ${h - 13} Z`}
              style={s}
            />
          ))}
        </g>
      );

    case 'secondary':
      return (
        <g>
          {/* air nozzle on the cone */}
          <rect x={w / 2 - 7} y={0} width={14} height={13} rx={2} style={s} />
          {/* refractory cone (combustion zone) */}
          <path d={`M ${w * 0.08} 4 L ${w * 0.92} 4 L ${w * 0.74} ${h * 0.3} L ${w * 0.26} ${h * 0.3} Z`} style={s} />
          {/* shell */}
          <rect x={w * 0.26} y={h * 0.3} width={w * 0.48} height={h * 0.66} rx={4} style={s} />
          {/* catalyst bed */}
          <rect x={w * 0.26 + 5} y={h * 0.58} width={w * 0.48 - 10} height={h * 0.34} fill="url(#fsHatch)" style={{ stroke: C.inkSoft }} strokeWidth={1.2} />
        </g>
      );

    case 'hex':
      return (
        <g>
          {/* shell */}
          <rect x={2} y={h * 0.24} width={w - 4} height={h * 0.52} rx={h * 0.26} style={s} />
          {/* tube sheet */}
          <line x1={w * 0.26} y1={h * 0.24} x2={w * 0.26} y2={h * 0.76} style={{ stroke: C.ink, strokeWidth: 1.6 }} />
          {/* tube pass */}
          <line x1={w * 0.26 + 6} y1={h * 0.5} x2={w - 8} y2={h * 0.5} strokeDasharray="5 4" style={{ stroke: C.inkSoft, strokeWidth: 1.4 }} />
        </g>
      );

    case 'reactor':
      return (
        <g>
          <rect x={w * 0.1} y={2} width={w * 0.8} height={h - 6} rx={w * 0.26} style={s} />
          {/* catalyst bed */}
          <rect x={w * 0.1 + 6} y={h * 0.3} width={w * 0.8 - 12} height={h * 0.42} fill="url(#fsHatch)" style={{ stroke: C.inkSoft }} strokeWidth={1.2} />
          {/* bed retention lines */}
          <line x1={w * 0.1 + 6} y1={h * 0.3} x2={w * 0.9 - 6} y2={h * 0.3} style={thin} />
          <line x1={w * 0.1 + 6} y1={h * 0.72} x2={w * 0.9 - 6} y2={h * 0.72} style={thin} />
        </g>
      );

    case 'column':
      return (
        <g>
          <rect x={4} y={2} width={w - 8} height={h - 4} rx={10} style={s} />
          {/* trays */}
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={i}
              x1={11}
              y1={h * 0.1 + i * ((h * 0.72) / 6)}
              x2={w - 11}
              y2={h * 0.1 + i * ((h * 0.72) / 6)}
              style={thin}
            />
          ))}
          {/* packed polishing section */}
          <rect x={11} y={h * 0.82} width={w - 22} height={h * 0.13} fill="url(#fsHatch)" style={{ stroke: C.inkSoft }} strokeWidth={1.1} />
        </g>
      );

    case 'drum':
      return (
        <g>
          <rect x={2} y={4} width={w - 4} height={h - 24} rx={(h - 24) / 2} style={s} />
          {/* boot */}
          <rect x={w / 2 - 9} y={h - 22} width={18} height={20} rx={2} style={s} />
          {/* liquid level */}
          <line x1={10} y1={h - 26} x2={w - 10} y2={h - 26} strokeDasharray="6 4" style={{ stroke: C.inkSoft, strokeWidth: 1.2 }} />
        </g>
      );

    case 'vdrum':
      return (
        <g>
          <rect x={2} y={2} width={w - 4} height={h - 26} rx={(w - 4) / 2} style={s} />
          {/* boot */}
          <rect x={w / 2 - 11} y={h - 26} width={22} height={24} rx={2} style={s} />
          {/* liquid level */}
          <line x1={w / 2} y1={h * 0.66} x2={w / 2} y2={h - 26} strokeDasharray="6 4" style={{ stroke: C.inkSoft, strokeWidth: 1.2 }} />
        </g>
      );

    case 'compressor':
      return (
        <g>
          <path
            d={`M 3 ${h * 0.18} L ${w * 0.55} ${h * 0.3} L ${w - 3} ${h * 0.5} L ${w * 0.55} ${h * 0.7} L 3 ${h * 0.82} Z`}
            style={s}
          />
          <circle cx={w * 0.3} cy={h * 0.5} r={3} style={{ fill: C.ink, stroke: 'none' }} />
          <circle cx={w * 0.3} cy={h * 0.5} r={h * 0.26} style={{ stroke: C.inkSoft, strokeWidth: 1.2, fill: 'none' }} />
        </g>
      );

    case 'converter':
      return (
        <g>
          <rect x={w * 0.08} y={2} width={w * 0.84} height={h - 6} rx={w * 0.2} style={s} />
          {/* three catalyst beds */}
          {[0.14, 0.44, 0.74].map((f, i) => (
            <g key={i}>
              <rect
                x={w * 0.08 + 8}
                y={h * f}
                width={w * 0.84 - 16}
                height={h * 0.18}
                fill="url(#fsHatch)"
                style={{ stroke: C.inkSoft }}
                strokeWidth={1.2}
              />
            </g>
          ))}
          {/* quench-gas inlets between beds */}
          {[0.36, 0.66].map((f) => (
            <line
              key={f}
              x1={0}
              y1={h * f}
              x2={w * 0.08}
              y2={h * f}
              style={{ stroke: C.ink, strokeWidth: 2 }}
            />
          ))}
        </g>
      );

    case 'source':
      // battery-limit source — a sphere (the feed comes from "outside")
      return (
        <g>
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 3} style={s} />
          {/* latitude hint, so the circle reads as a vessel not a disc */}
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={Math.min(w, h) / 2 - 3}
            ry={(Math.min(w, h) / 2 - 3) * 0.36}
            style={{ stroke: C.inkSoft, strokeWidth: 1.2, fill: 'none' }}
          />
        </g>
      );

    case 'dcolumn':
      // the distillation tower — tall, many trays, feed nozzle mid-height
      return (
        <g>
          <rect x={5} y={2} width={w - 10} height={h - 4} rx={12} style={s} />
          {/* alternating sieve trays (short / long) */}
          {Array.from({ length: 14 }).map((_, i) => {
            const ty = h * 0.05 + (i * (h * 0.9)) / 13;
            const long = i % 2 === 0;
            return (
              <line
                key={i}
                x1={long ? 12 : 12 + (w - 24) * 0.22}
                y1={ty}
                x2={long ? w - 12 : w - 12 - (w - 24) * 0.22}
                y2={ty}
                style={thin}
              />
            );
          })}
          {/* the feed stage nozzle (side stub at tray 8 of 14) */}
          <line
            x1={0}
            y1={h * 0.05 + (7 * (h * 0.9)) / 13}
            x2={5}
            y2={h * 0.05 + (7 * (h * 0.9)) / 13}
            style={{ stroke: C.ink, strokeWidth: 2 }}
          />
        </g>
      );

    default:
      return <rect x={2} y={2} width={w - 4} height={h - 4} rx={3} style={s} />;
  }
}
