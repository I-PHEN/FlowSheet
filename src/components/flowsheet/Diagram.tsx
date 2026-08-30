/**
 * Pure presentational flowsheet SVG — bands, streams, symbols, tags.
 *
 * No hooks, no browser APIs: renders on the server (library thumbnail)
 * and inside the interactive canvas alike. Handlers are optional props;
 * the interactive wrapper supplies them, the static thumbnail does not.
 */

import { C, FONT, STREAM_STYLE, STREAM_W, STREAM_W_HI } from '@/lib/design/tokens';
import {
  ANNOTATIONS,
  BANDS,
  CANVAS,
  STREAMS,
  UNITS,
  type StreamEdge,
} from '@/lib/flowsheet/layout';
import { pointAt, polyLen } from '@/lib/flowsheet/geom';
import { UnitSymbol } from './Symbols';

export interface Focus {
  type: 'unit' | 'stream';
  id: string;
}

interface DiagramProps {
  /** controlled viewBox (pan/zoom); default = full canvas */
  view?: { x: number; y: number; w: number; h: number };
  /** focused unit/stream (halo + emphasis) — selection or tour spotlight */
  focus?: Focus | null;
  /** hovered unit/stream (stroke emphasis only) */
  hover?: Focus | null;
  onUnitEnter?: (id: string | null) => void;
  onUnitClick?: (id: string) => void;
  onStreamEnter?: (id: string | null) => void;
  onStreamClick?: (id: string) => void;
  /** click on empty canvas (deselect) */
  onBackgroundClick?: () => void;
  /** suppress interactivity (thumbnail) */
  static?: boolean;
}

function Arrow({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const L = 10;
  const W = 5;
  return (
    <polygon
      points={`${x},${y} ${x - L * Math.cos(angle) + W * Math.sin(angle)},${y - L * Math.sin(angle) - W * Math.cos(angle)} ${x - L * Math.cos(angle) - W * Math.sin(angle)},${y - L * Math.sin(angle) + W * Math.cos(angle)}`}
      fill={color}
      stroke="none"
    />
  );
}

function StreamPath({
  s,
  dim,
  emphasized,
  onEnter,
  onClick,
}: {
  s: StreamEdge;
  dim: boolean;
  emphasized: boolean;
  onEnter?: (id: string | null) => void;
  onClick?: (id: string) => void;
}) {
  const st = STREAM_STYLE[s.cls] ?? STREAM_STYLE.syngas;
  const d = s.pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const end = pointAt(s.pts, 1);
  // direction chevron mid-line on long runs only (short runs: end arrow suffices)
  const showMid = polyLen(s.pts) > 200 && s.labelAt != null;
  const mid = showMid ? pointAt(s.pts, (s.labelAt ?? 0.5) + 0.07) : null;
  const pill = pointAt(s.pts, s.labelAt ?? 0.5);
  const num = s.id.replace(/^S0?/, '');
  const pillW = 7 + num.length * 7.5;

  return (
    <g opacity={dim ? 0.24 : 1} style={{ transition: 'opacity 160ms' }}>
      {/* fat invisible hit path */}
      {!s && null}
      {onEnter && (
        <path
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0)"
          strokeWidth={18}
          style={{ pointerEvents: 'stroke', cursor: onClick ? 'pointer' : 'default' }}
          onPointerEnter={() => onEnter(s.id)}
          onPointerLeave={() => onEnter(null)}
          onClick={() => onClick?.(s.id)}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={st.color}
        strokeWidth={emphasized ? STREAM_W_HI : STREAM_W}
        strokeDasharray={st.dash}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      <Arrow x={end.x} y={end.y} angle={end.angle} color={st.color} />
      {mid && <Arrow x={mid.x} y={mid.y} angle={mid.angle} color={st.color} />}
      {/* stream number pill */}
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={pill.x - pillW / 2}
          y={pill.y - 9}
          width={pillW}
          height={18}
          rx={9}
          fill={C.paper}
          stroke={emphasized ? C.ink : st.color}
          strokeWidth={emphasized ? 1.8 : 1.3}
        />
        <text
          x={pill.x}
          y={pill.y + 4}
          textAnchor="middle"
          fontSize={FONT.pill}
          fontWeight={700}
          fill={C.ink}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {num}
        </text>
      </g>
    </g>
  );
}

export function Diagram({
  view,
  focus,
  hover,
  onUnitEnter,
  onUnitClick,
  onStreamEnter,
  onStreamClick,
  onBackgroundClick,
  static: isStatic,
}: DiagramProps) {
  const focusStream = focus?.type === 'stream' ? focus.id : null;
  const hoverStream = hover?.type === 'stream' ? hover.id : null;
  const activeStream = focusStream ?? hoverStream;
  const focusUnit = focus?.type === 'unit' ? focus.id : null;
  const hoverUnit = hover?.type === 'unit' ? hover.id : null;
  const activeUnit = focusUnit ?? hoverUnit;

  return (
    <svg
      viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${CANVAS.w} ${CANVAS.h}`}
      width={CANVAS.w}
      height={CANVAS.h}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: C.canvas,
        fontFamily: 'inherit',
      }}
      aria-label="Ammonia plant process flow diagram"
    >
      <defs>
        <pattern
          id="fsHatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="7" stroke={C.inkSoft} strokeWidth="1.3" />
        </pattern>
      </defs>

      {/* click-catcher background (deselect on empty canvas) */}
      {!isStatic && (
        <rect
          x={0}
          y={0}
          width={CANVAS.w}
          height={CANVAS.h}
          fill={C.canvas}
          onClick={() => onBackgroundClick?.()}
        />
      )}

      {/* section bands */}
      {BANDS.map((b) => (
        <g key={b.id} style={{ pointerEvents: 'none' }}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={16}
            fill={C.band}
            stroke={C.bandLine}
            strokeWidth={1.4}
          />
          <text
            x={b.x + 20}
            y={b.y + 28}
            fontSize={FONT.bandLabel}
            fontWeight={700}
            letterSpacing={2.6}
            fill={C.inkSoft}
          >
            {b.label}
          </text>
        </g>
      ))}

      {/* margin annotations */}
      {ANNOTATIONS.map((a) => (
        <text
          key={a.text + a.x}
          x={a.x}
          y={a.y}
          fontSize={FONT.annotation}
          fontWeight={600}
          letterSpacing={1.6}
          fill={C.inkSoft}
          textAnchor={a.anchor ?? 'start'}
          style={{ pointerEvents: 'none' }}
        >
          {a.text}
        </text>
      ))}

      {/* streams */}
      {STREAMS.map((s) => (
        <StreamPath
          key={s.id}
          s={s}
          dim={activeStream != null && activeStream !== s.id}
          emphasized={activeStream === s.id}
          onEnter={isStatic ? undefined : onStreamEnter}
          onClick={isStatic ? undefined : onStreamClick}
        />
      ))}

      {/* unit halos (selection / tour spotlight) */}
      {UNITS.map((u) =>
        activeUnit === u.id ? (
          <rect
            key={`h-${u.id}`}
            x={u.x - 14}
            y={u.y - 14}
            width={u.w + 28}
            height={u.h + 56}
            rx={12}
            fill={C.halo}
            style={{ pointerEvents: 'none' }}
          />
        ) : null,
      )}

      {/* units */}
      {UNITS.map((u) => (
        <g key={u.id} transform={`translate(${u.x}, ${u.y})`}>
          <g
            style={{
              pointerEvents: 'none',
              cursor: isStatic ? 'default' : 'pointer',
            }}
          >
            <UnitSymbol node={u} hi={hoverUnit === u.id} sel={focusUnit === u.id} />
          </g>
          {/* hit area */}
          {!isStatic && (
            <rect
              x={-10}
              y={-10}
              width={u.w + 20}
              height={u.h + 52}
              fill="rgba(0,0,0,0)"
              style={{ cursor: 'pointer' }}
              onPointerEnter={() => onUnitEnter?.(u.id)}
              onPointerLeave={() => onUnitEnter?.(null)}
              onClick={() => onUnitClick?.(u.id)}
            />
          )}
          {/* tag + name */}
          <g style={{ pointerEvents: 'none' }}>
            <text
              x={u.w / 2}
              y={u.h + 20}
              textAnchor="middle"
              fontSize={FONT.tag}
              fontWeight={700}
              fill={C.ink}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {u.tag}
            </text>
            <text
              x={u.w / 2}
              y={u.h + 34}
              textAnchor="middle"
              fontSize={FONT.name}
              fontWeight={600}
              letterSpacing={1.2}
              fill={C.inkSoft}
            >
              {u.label}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
