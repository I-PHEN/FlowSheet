/**
 * Pure presentational flowsheet SVG — the ONE-sheet PFD renderer.
 *
 * No hooks, no browser APIs: renders on the server (library thumbnails)
 * and inside the interactive canvas alike. Handlers are optional props;
 * the interactive wrapper supplies them, the static thumbnail does not.
 *
 * Every plant arrives as a PlantLayout (hand-authored prebuilt or
 * computed), and every plant gets the drawing-office treatment:
 *
 *   - a sheet frame + title block (the drawing is a document)
 *   - unit tag + name placed by the label engine, never under a line
 *   - sheet-colored masks behind whatever text a line cannot avoid, so
 *     residual crossings pass BEHIND words instead of through them
 *   - margin annotations clamped inside the sheet, nudged off lines
 *
 * All colors are CSS variable references — they must be applied through
 * inline `style` (SVG presentation attributes cannot resolve var()), which
 * also makes the whole diagram switch with the light/dark theme.
 */

import { C, FONT, STREAM_STYLE, STREAM_W, STREAM_W_HI } from '@/lib/design/tokens';
import { REFERENCE_LAYOUT, type PlantLayout, type StreamEdge } from '@/lib/flowsheet/layout';
import { placeAnnotations, placeUnitLabels, unitHitRect } from '@/lib/flowsheet/labels';
import { pointAt, polyLen } from '@/lib/flowsheet/geom';
import { UnitSymbol } from './Symbols';

export interface Focus {
  type: 'unit' | 'stream';
  id: string;
}

interface DiagramProps {
  /** the plant to draw (defaults to the SMR reference sheet) */
  layout?: PlantLayout;
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
      stroke="none"
      style={{ fill: color }}
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
        strokeWidth={emphasized ? STREAM_W_HI : STREAM_W}
        strokeDasharray={st.dash}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ stroke: st.color, pointerEvents: 'none' }}
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
          strokeWidth={emphasized ? 1.8 : 1.3}
          style={{ fill: C.paper, stroke: emphasized ? C.ink : st.color }}
        />
        <text
          x={pill.x}
          y={pill.y + 4}
          textAnchor="middle"
          fontSize={FONT.pill}
          fontWeight={700}
          style={{ fill: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {num}
        </text>
      </g>
    </g>
  );
}

export function Diagram({
  layout,
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
  const L = layout ?? REFERENCE_LAYOUT;
  const focusStream = focus?.type === 'stream' ? focus.id : null;
  const hoverStream = hover?.type === 'stream' ? hover.id : null;
  const activeStream = focusStream ?? hoverStream;
  const focusUnit = focus?.type === 'unit' ? focus.id : null;
  const hoverUnit = hover?.type === 'unit' ? hover.id : null;
  const activeUnit = focusUnit ?? hoverUnit;

  // ---- the drawing office: labels first, lines respect them ----
  const unitLabels = placeUnitLabels(L);
  const annotations = placeAnnotations(L);
  const tb = L.titleBlock;

  /** the surface a text block sits on — its mask must match the sheet */
  const surfaceFor = (r: { x: number; y: number; w: number; h: number }): string => {
    const onBand = L.zones.some(
      (z) =>
        r.x < z.x + z.w &&
        r.x + r.w > z.x &&
        r.y < z.y + z.h &&
        r.y + r.h > z.y,
    );
    return onBand ? C.band : C.canvas;
  };

  return (
    <svg
      viewBox={
        view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${L.canvas.w} ${L.canvas.h}`
      }
      width={L.canvas.w}
      height={L.canvas.h}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: C.canvas,
        fontFamily: 'inherit',
      }}
      aria-label="Process flow diagram"
    >
      <defs>
        <pattern
          id="fsHatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="7" strokeWidth="1.3" style={{ stroke: C.inkSoft }} />
        </pattern>
      </defs>

      {/* click-catcher background (deselect on empty canvas) */}
      {!isStatic && (
        <rect
          x={0}
          y={0}
          width={L.canvas.w}
          height={L.canvas.h}
          style={{ fill: C.canvas }}
          onClick={() => onBackgroundClick?.()}
        />
      )}

      {/* the sheet — a drawing is a document */}
      <rect
        x={L.sheet.x}
        y={L.sheet.y}
        width={L.sheet.w}
        height={L.sheet.h}
        rx={6}
        strokeWidth={1.6}
        style={{ fill: 'none', stroke: C.bandLine, pointerEvents: 'none' }}
      />

      {/* section bands */}
      {L.zones.map((b) => (
        <g key={b.id} style={{ pointerEvents: 'none' }}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={16}
            strokeWidth={1.4}
            style={{ fill: C.band, stroke: C.bandLine }}
          />
          <text
            x={b.x + 20}
            y={b.y + 28}
            fontSize={FONT.bandLabel}
            fontWeight={700}
            letterSpacing={2.6}
            style={{ fill: C.inkSoft }}
          >
            {b.label}
          </text>
        </g>
      ))}

      {/* zone walls */}
      {L.zoneDividers.map((d, i) => (
        <line
          key={i}
          x1={d.x1}
          y1={d.y1}
          x2={d.x2}
          y2={d.y2}
          strokeDasharray="3 5"
          style={{ stroke: C.bandLine, strokeWidth: 1.4, pointerEvents: 'none' }}
        />
      ))}

      {/* the title block */}
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={tb.x}
          y={tb.y}
          width={tb.w}
          height={tb.h}
          strokeWidth={1.4}
          style={{ fill: C.paper, stroke: C.bandLine }}
        />
        <text
          x={tb.x + 12}
          y={tb.y + 24}
          fontSize={12}
          fontWeight={800}
          letterSpacing={0.8}
          style={{ fill: C.ink }}
        >
          {tb.title}
        </text>
        <line
          x1={tb.x + 10}
          y1={tb.y + 34}
          x2={tb.x + tb.w - 10}
          y2={tb.y + 34}
          style={{ stroke: C.bandLine, strokeWidth: 1.2 }}
        />
        <text
          x={tb.x + 12}
          y={tb.y + 50}
          fontSize={9}
          fontWeight={700}
          letterSpacing={1.4}
          style={{ fill: C.inkSoft }}
        >
          {tb.subtitle}
        </text>
        <text
          x={tb.x + 12}
          y={tb.y + tb.h - 12}
          fontSize={8}
          fontWeight={600}
          letterSpacing={1.2}
          style={{ fill: C.inkFaint }}
        >
          {tb.foot}
        </text>
      </g>

      {/* margin annotations — masked, clamped inside the sheet */}
      {annotations.map((a, i) => (
        <g key={`${a.text}-${i}`} style={{ pointerEvents: 'none' }}>
          <rect
            x={a.rect.x - 3}
            y={a.rect.y}
            width={a.rect.w + 6}
            height={a.rect.h + 2}
            style={{ fill: surfaceFor(a.rect) }}
          />
          <text
            x={a.x}
            y={a.y}
            fontSize={FONT.annotation}
            fontWeight={600}
            letterSpacing={1.6}
            textAnchor={a.anchor}
            style={{ fill: C.inkSoft }}
          >
            {a.text}
          </text>
        </g>
      ))}

      {/* streams */}
      {L.streams.map((s) => (
        <StreamPath
          key={s.id}
          s={s}
          dim={activeStream != null && activeStream !== s.id}
          emphasized={activeStream === s.id}
          onEnter={isStatic ? undefined : onStreamEnter}
          onClick={isStatic ? undefined : onStreamClick}
        />
      ))}

      {/* unit halos (selection / tour spotlight) — box + its label */}
      {L.units.map((u) =>
        activeUnit === u.id ? (
          <rect
            key={`h-${u.id}`}
            x={unitHitRect(u, unitLabels.get(u.id), 13).x}
            y={unitHitRect(u, unitLabels.get(u.id), 13).y}
            width={unitHitRect(u, unitLabels.get(u.id), 13).w}
            height={unitHitRect(u, unitLabels.get(u.id), 13).h}
            rx={12}
            style={{ fill: C.halo, pointerEvents: 'none' }}
          />
        ) : null,
      )}

      {/* units */}
      {L.units.map((u) => {
        const lab = unitLabels.get(u.id);
        const hit = unitHitRect(u, lab, 9);
        return (
          <g key={u.id}>
            {/* hit area — follows the moved label so a click still lands */}
            {!isStatic && (
              <rect
                x={hit.x}
                y={hit.y}
                width={hit.w}
                height={hit.h}
                fill="rgba(0,0,0,0)"
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => onUnitEnter?.(u.id)}
                onPointerLeave={() => onUnitEnter?.(null)}
                onClick={() => onUnitClick?.(u.id)}
              />
            )}
            <g transform={`translate(${u.x}, ${u.y})`}>
              <UnitSymbol node={u} hi={hoverUnit === u.id} sel={focusUnit === u.id} />
            </g>
            {/* tag + name at the placed position, masked so any residual
                line passes BEHIND the words */}
            {lab && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={lab.rect.x - 3}
                  y={lab.rect.y + 3}
                  width={lab.rect.w + 6}
                  height={lab.rect.h - 5}
                  style={{ fill: surfaceFor(lab.rect) }}
                />
                <text
                  x={lab.cx}
                  y={lab.above ? lab.lowBy : lab.lowBy - 15}
                  textAnchor="middle"
                  fontSize={FONT.tag}
                  fontWeight={700}
                  style={{ fill: C.ink, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                >
                  {lab.above ? u.label : u.tag}
                </text>
                <text
                  x={lab.cx}
                  y={lab.lowBy}
                  textAnchor="middle"
                  fontSize={FONT.name}
                  fontWeight={600}
                  letterSpacing={1.2}
                  style={{ fill: C.inkSoft }}
                >
                  {lab.above ? u.tag : u.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
