'use client';

/**
 * FlowLayer — material movement on a solved flowsheet.
 *
 * Architecture (see lib/flowsheet/flowAnim.ts for the laws):
 *
 *   1. OVERLAY, NOT INTRUSION. This renders its own absolutely-positioned
 *      <svg> with the SAME viewBox as the host diagram and the same
 *      preserveAspectRatio — so it is pixel-locked to the drawing and rides
 *      pan/zoom for free (both are just viewBox changes). Diagram.tsx stays
 *      a pure server-renderable component; library thumbnails never mount
 *      this layer. The future Learn-mode camera zooms the same viewBox, so
 *      particles will zoom with the narration at no extra cost.
 *
 *   2. SAMPLE, DON'T SIMULATE. Each stream's SVG path is measured once
 *      (getTotalLength + getPointAtLength, 48 uniform samples → PathLUT).
 *      Any geometry the router can draw — rounded corners, beziers,
 *      self-loops — animates correctly because we sample the very path the
 *      line was drawn with.
 *
 *   3. FULLY IMPERATIVE, ONE LOOP, ZERO RE-RENDERS. The dots belong to this
 *      layer alone, so they are created and driven by DOM calls inside two
 *      effects (geometry effect builds circles; animation effect runs the
 *      single requestAnimationFrame). React renders only the empty frame —
 *      container, svg, hidden measuring paths — and re-renders it ONLY when
 *      the viewBox moves (pan/zoom) or the plant changes. Hover/selection
 *      dimming and the speed multiplier travel through refs so they never
 *      restart the loop.
 */

import { useEffect, useRef } from 'react';
import {
  applyBudget,
  dotCount,
  dotOpacity,
  phaseFor,
  radiusFor,
  sampleLUT,
  speedFor,
  type FlowSpec,
  type PathLUT,
} from '@/lib/flowsheet/flowAnim';

/** samples per path — corners stay smooth, memory stays tiny */
const LUT_N = 48;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Dot {
  streamId: string;
  lut: PathLUT;
  /** world-units/second */
  speed: number;
  /** 0..1 phase offset along the path */
  offset: number;
  pillAt?: number;
}

interface PlacedDot {
  el: SVGCircleElement;
  d: Dot;
}

interface FlowLayerProps {
  /** must equal the host diagram's viewBox (pan/zoom lock) */
  view: { x: number; y: number; w: number; h: number };
  /** one spec per stream; geometry identity should be stable (useMemo in
   *  the host) so LUTs are not rebuilt on hover or pan */
  streams: FlowSpec[];
  /** dots fade out via CSS when off; the loop stops entirely */
  active: boolean;
  /** global speed multiplier (ref-read; changes never restart the loop) */
  speedMul?: number;
  /** when set, dots of every OTHER stream dim to 0.24 (selection parity
   *  with StreamPath's own dimming) */
  dimExcept?: string | null;
}

export function FlowLayer({ view, streams, active, speedMul = 1, dimExcept }: FlowLayerProps) {
  const measureRef = useRef<SVGGElement>(null);
  const dotsHostRef = useRef<SVGGElement>(null);
  /** circles created by the geometry effect, read by the animation effect */
  const placedRef = useRef<PlacedDot[]>([]);

  // live-tunable knobs — ref-only so the loop never restarts
  const speedRef = useRef(speedMul);
  useEffect(() => {
    speedRef.current = speedMul;
  }, [speedMul]);
  const dimRef = useRef<string | null | undefined>(dimExcept);
  useEffect(() => {
    dimRef.current = dimExcept;
  }, [dimExcept]);

  // ---- geometry effect: measure paths → create dots (DOM-owned) ----------
  useEffect(() => {
    const measure = measureRef.current;
    const host = dotsHostRef.current;
    if (!measure || !host || streams.length === 0) {
      placedRef.current = [];
      return;
    }

    // 1. measure every path into a LUT (exact arc-length sampling — the
    //    hidden paths below carry the EXACT `d` the sheet drew)
    const luts = new Map<string, PathLUT>();
    const paths = measure.querySelectorAll<SVGPathElement>('path[data-flow-id]');
    for (const p of paths) {
      const id = p.getAttribute('data-flow-id') ?? '';
      let len = 0;
      try {
        len = p.getTotalLength();
      } catch {
        len = 0;
      }
      if (!(len > 0)) continue;
      const xs = new Float64Array(LUT_N);
      const ys = new Float64Array(LUT_N);
      for (let i = 0; i < LUT_N; i++) {
        const pt = p.getPointAtLength((i / (LUT_N - 1)) * len);
        xs[i] = pt.x;
        ys[i] = pt.y;
      }
      luts.set(id, { xs, ys, n: LUT_N, len });
    }

    // 2. scaling: normalize against the busiest stream on the sheet
    let max = 0;
    for (const s of streams) if (s.flow > max) max = s.flow;
    const counts = streams.map((s) => {
      const lut = luts.get(s.id);
      return lut ? dotCount(lut.len, s.flow, max) : 0;
    });
    const budgeted = applyBudget(counts);

    // 3. one circle per dot — ours alone, never React-rendered
    const placed: PlacedDot[] = [];
    streams.forEach((s, i) => {
      const lut = luts.get(s.id);
      if (!lut) return;
      const n = budgeted[i];
      for (let k = 0; k < n; k++) {
        const el = document.createElementNS(SVG_NS, 'circle');
        const r = radiusFor(s.flow, max);
        el.setAttribute('r', r.toFixed(2));
        el.setAttribute('stroke-width', '1.1');
        // var() colors resolve live — theme switches need no rebuild
        el.style.fill = s.color;
        el.style.stroke = 'var(--fs-paper)';
        el.style.opacity = '0';
        host.appendChild(el);
        placed.push({
          el,
          d: {
            streamId: s.id,
            lut,
            speed: speedFor(s.flow, max, s.liquid),
            offset: phaseFor(s.id, k, n),
            pillAt: s.pillAt,
          },
        });
      }
    });
    placedRef.current = placed;

    return () => {
      for (const c of placed) c.el.remove();
      placedRef.current = [];
    };
  }, [streams]);

  // ---- the single animation loop -----------------------------------------
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let t = 0; // seconds of animation time (speed-multiplied)

    const tick = (now: number) => {
      // clamp: after a background tab, dots may not move at all rather
      // than teleport
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt * speedRef.current;

      const dimId = dimRef.current;
      const placed = placedRef.current;
      for (let i = 0; i < placed.length; i++) {
        const { el, d } = placed[i];
        const f = (d.offset + (t * d.speed) / d.lut.len) % 1;
        const p = sampleLUT(d.lut, f);
        const o =
          dotOpacity(f, d.lut.len, d.pillAt) *
          (dimId != null && d.streamId !== dimId ? 0.24 : 1);
        el.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
        el.style.opacity = o.toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, streams]);

  if (streams.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 320ms ease' }}
    >
      <svg
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          {/* hidden measuring paths — the exact lines the sheet draws */}
          <g ref={measureRef}>
            {streams.map((s) => (
              <path key={s.id} data-flow-id={s.id} d={s.d} fill="none" stroke="none" />
            ))}
          </g>
        </defs>
        {/* dot host — populated imperatively by the geometry effect */}
        <g ref={dotsHostRef} style={{ pointerEvents: 'none' }} />
      </svg>
    </div>
  );
}
