'use client';

/**
 * Interactive flowsheet canvas — pan (drag), zoom (wheel / pinch / buttons /
 * keyboard), hover tooltips fed by the solved base case, click-to-inspect.
 * Chrome (legend, zoom controls, hint) lives in HTML overlays that do not
 * pan with the diagram.
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
import { C, STREAM_STYLE } from '@/lib/design/tokens';
import { REFERENCE_LAYOUT, type PlantLayout } from '@/lib/flowsheet/layout';
import { bboxOf, boxToAspect, type Box } from '@/lib/flowsheet/geom';
import { dotColor, type FlowSpec } from '@/lib/flowsheet/flowAnim';
import { SPECIES } from '@/lib/engine/species';
import type { PlantResult } from '@/lib/engine/types';
import { Diagram, type Focus } from './Diagram';
import { FlowLayer } from './FlowLayer';

type View = { x: number; y: number; w: number; h: number };

export interface CanvasHandle {
  panTo: (box: Box, opts?: { immediate?: boolean }) => void;
  fit: () => void;
  zoomBy: (f: number) => void;
}

interface CanvasProps {
  /** the plant to draw (defaults to the SMR reference sheet) */
  layout?: PlantLayout;
  result: PlantResult;
  selected: Focus | null;
  spotlight?: Focus | null;
  onSelect: (f: Focus | null) => void;
}

const fmt = (x: number, d = 0) =>
  x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/** friendly legend names for the stream classes a sheet may use */
const LEGEND_LABEL: Record<string, string> = {
  feed: 'FEED',
  syngas: 'PROCESS GAS',
  loopgas: 'LOOP GAS',
  product: 'PRODUCT',
  water: 'CONDENSATE',
  co2: 'CO2',
  purge: 'PURGE',
};

function streamTip(result: PlantResult, id: string) {
  const s = result.streams[id];
  if (!s) return null;
  const tot = s.n.reduce((a, b) => a + b, 0) || 1;
  const top = s.n
    .map((v, i) => ({ sp: SPECIES[i], x: v / tot }))
    .filter((e) => e.x > 0.005)
    .sort((a, b) => b.x - a.x)
    .slice(0, 4);
  return {
    title: `${id} · ${s.name}`,
    rows: [
      { k: 'T', v: `${fmt(s.T - 273.15)} °C` },
      { k: 'P', v: `${fmt(s.P / 1e5, 1)} bar` },
      { k: 'Flow', v: `${fmt(tot)} kmol/h` },
    ],
    foot: top.map((e) => `${e.sp} ${(e.x * 100).toFixed(1)}%`).join(' · '),
  };
}

function unitTip(result: PlantResult, id: string) {
  const u = result.units[id];
  if (!u) return null;
  return { title: u.name, rows: [] as Array<{ k: string; v: string }>, foot: u.model };
}

type TipData = ReturnType<typeof streamTip> | ReturnType<typeof unitTip>;

/** keep a view inside the sheet bounds (some overhang allowed) — pure */
function clampView(v: View, L: PlantLayout): View {
  const maxW = L.canvas.w * 1.35;
  const aspect = L.canvas.w / L.canvas.h;
  const w = Math.min(maxW, Math.max(260, v.w));
  const h = w / aspect;
  const x = Math.min(L.canvas.w - w * 0.25, Math.max(-w * 0.75, v.x));
  const y = Math.min(L.canvas.h - h * 0.25, Math.max(-h * 0.75, v.y));
  return { x, y, w, h };
}

export const FlowsheetCanvas = forwardRef<CanvasHandle, CanvasProps>(function FlowsheetCanvas(
  { layout, result, selected, spotlight, onSelect },
  ref,
) {
  const L = layout ?? REFERENCE_LAYOUT;
  const FULL: View = { x: 0, y: 0, w: L.canvas.w, h: L.canvas.h };
  const ASPECT = L.canvas.w / L.canvas.h;
  const legend = (() => {
    const seen: string[] = [];
    for (const s of L.streams) {
      const cls = STREAM_STYLE[s.cls] ? s.cls : 'syngas';
      if (!seen.includes(cls)) seen.push(cls);
    }
    return seen.slice(0, 4).map((cls) => ({
      label: LEGEND_LABEL[cls] ?? cls.toUpperCase(),
      color: (STREAM_STYLE[cls] ?? STREAM_STYLE.syngas).color,
      dash: Boolean(STREAM_STYLE[cls]?.dash),
    }));
  })();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(FULL);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const [hover, setHover] = useState<Focus | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const [hinted, setHinted] = useState(true);
  const movedRef = useRef(false);
  const animRef = useRef<number | null>(null);

  // material movement — dots on the solved streams (speed/count/size from
  // real molar flows, product tint from the declared product species).
  // Reduced-motion users start still; anyone can toggle ⌁.
  const [flowOn, setFlowOn] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const flowSpecs = useMemo<FlowSpec[]>(() => {
    let max = 0;
    const flows = new Map<string, number>();
    for (const s of L.streams) {
      const st = result.streams[s.id];
      if (!st) continue;
      let t = 0;
      for (let i = 0; i < st.n.length; i++) t += st.n[i];
      flows.set(s.id, t);
      if (t > max) max = t;
    }
    const productSpecies = result.kpis.productSpecies;
    const out: FlowSpec[] = [];
    for (const s of L.streams) {
      const flow = flows.get(s.id) ?? 0;
      if (flow <= 1e-6) continue;
      const st = result.streams[s.id];
      out.push({
        id: s.id,
        d: s.pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' '),
        flow,
        color: dotColor(s.cls, st?.n, productSpecies),
        liquid: s.cls === 'product' || s.cls === 'water',
        pillAt: s.labelAt ?? 0.5,
      });
    }
    return out;
  }, [L, result]);

  const stopAnim = useCallback(() => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  /** letterbox-aware client→world mapping (view keeps canvas aspect) */
  const worldFromClient = useCallback((cx: number, cy: number) => {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    let dw = r.width;
    let dh = r.height;
    if (r.width / r.height > ASPECT) dw = r.height * ASPECT;
    else dh = r.width / ASPECT;
    const ox = (r.width - dw) / 2;
    const oy = (r.height - dh) / 2;
    const v = viewRef.current;
    return {
      x: v.x + ((cx - r.left - ox) / dw) * v.w,
      y: v.y + ((cy - r.top - oy) / dh) * v.h,
      pxPerWorld: dw / v.w,
    };
  }, [ASPECT]);

  const zoomAtWorld = useCallback(
    (wx: number, wy: number, factor: number) => {
      stopAnim();
      setView((v) => {
        const k = 1 / factor;
        return clampView({ x: wx - (wx - v.x) * k, y: wy - (wy - v.y) * k, w: v.w * k, h: v.h * k }, L);
      });
    },
    [stopAnim, L],
  );

  const fit = useCallback(() => {
    stopAnim();
    // a flight, not a cut — the tour's breathing camera pulls back to the
    // whole sheet between stops, so fit eases like panTo does (reduced
    // motion lands instantly)
    const target: View = { x: 0, y: 0, w: L.canvas.w, h: L.canvas.h };
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setView(target);
      return;
    }
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 560);
      const e = 1 - Math.pow(1 - p, 3);
      setView({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      });
      if (p < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [stopAnim, L]);

  const panTo = useCallback(
    (box: Box, opts?: { immediate?: boolean }) => {
      stopAnim();
      const target = clampView(
        boxToAspect(
          bboxOf([[box.x, box.y], [box.x + box.w, box.y + box.h]], 70),
          ASPECT,
        ),
        L,
      );
      if (opts?.immediate) {
        setView(target);
        return;
      }
      const from = viewRef.current;
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 520);
        const e = 1 - Math.pow(1 - p, 3);
        setView({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e,
        });
        if (p < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    },
    [stopAnim, L, ASPECT],
  );

  useImperativeHandle(ref, () => ({
    panTo,
    fit,
    zoomBy: (f: number) => {
      const v = viewRef.current;
      zoomAtWorld(v.x + v.w / 2, v.y + v.h / 2, f);
    },
  }));

  // wheel zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setHinted(false);
      const w = worldFromClient(e.clientX, e.clientY);
      zoomAtWorld(w.x, w.y, e.deltaY < 0 ? 1.14 : 1 / 1.14);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAtWorld, worldFromClient]);

  // drag pan + pinch zoom + drag-vs-click suppression
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let lastDist = 0;

    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      movedRef.current = false;
      lastDist = 0;
      stopAnim();
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
        setView(
          clampView({
            x: v.x - ((e.clientX - prev.x) / px),
            y: v.y - ((e.clientY - prev.y) / px),
            w: v.w,
            h: v.h,
          }, L),
        );
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
  }, [zoomAtWorld, worldFromClient]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = viewRef.current;
    const pan = (fx: number, fy: number) =>
      setView(clampView({ x: v.x + v.w * fx, y: v.y + v.h * fy, w: v.w, h: v.h }, L));
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

  const tipData: TipData = hover
    ? hover.type === 'stream'
      ? streamTip(result, hover.id)
      : unitTip(result, hover.id)
    : null;

  const focus: Focus | null = selected ?? spotlight ?? null;
  // stream-dimming parity with Diagram: when one stream is focused or
  // hovered, every other stream's dots dim with its line
  const activeStreamId =
    (focus?.type === 'stream' ? focus.id : null) ??
    (hover?.type === 'stream' ? hover.id : null);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative h-full w-full overflow-hidden outline-none"
      style={{ background: C.canvas, touchAction: 'none', cursor: 'grab' }}
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
      <Diagram
        layout={L}
        view={view}
        focus={focus}
        hover={hover}
        onUnitEnter={(id) => setHover(id ? { type: 'unit', id } : null)}
        onStreamEnter={(id) => setHover(id ? { type: 'stream', id } : null)}
        onUnitClick={(id) => {
          if (!movedRef.current) onSelect({ type: 'unit', id });
        }}
        onStreamClick={(id) => {
          if (!movedRef.current) onSelect({ type: 'stream', id });
        }}
        onBackgroundClick={() => onSelect(null)}
      />

      {/* material movement — an overlay svg sharing the diagram's exact
          viewBox: pixel-locked to the lines, rides pan/zoom for free */}
      <FlowLayer view={view} streams={flowSpecs} active={flowOn} dimExcept={activeStreamId} />

      {/* hover tooltip */}
      {hover && tipData && (
        <div
          className="pointer-events-none absolute z-20 w-[240px] rounded-lg border px-3 py-2 text-[12px] leading-snug"
          style={{
            background: C.paper,
            borderColor: C.bandLine,
            color: C.ink,
            boxShadow: C.tipShadow,
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
            <div className="mt-1 border-t pt-1 font-mono text-[10.5px]" style={{ borderColor: C.bandLine }}>
              {tipData.foot}
            </div>
          )}
        </div>
      )}

      {/* first-visit hint */}
      {hinted && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border px-3.5 py-1.5 text-[11px] font-medium tracking-wide"
          style={{ background: C.paper, borderColor: C.bandLine, color: C.inkSoft }}
        >
          Drag to pan · scroll to zoom · click any unit or stream
        </div>
      )}

      {/* legend */}
      <div
        className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-1.5 text-[10.5px] font-semibold tracking-wide"
        style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
      >
        {legend.map((e) => (
          <span key={e.label} className="flex items-center gap-1.5">
            <span
              className={e.dash ? 'w-5 border-t-2 border-dashed' : 'h-[3px] w-5 rounded-full'}
              style={e.dash ? { borderColor: e.color } : { background: e.color }}
            />
            {e.label}
          </span>
        ))}
      </div>

      {/* zoom + flow controls */}
      <div
        className="absolute bottom-3 right-3 z-10 flex overflow-hidden rounded-lg border"
        style={{ borderColor: C.bandLine, background: C.paper }}
      >
        <button
          aria-label={flowOn ? 'Hide material flow animation' : 'Show material flow animation'}
          title={flowOn ? 'Hide material flow' : 'Show material flow (dot speed = real molar flow)'}
          onClick={() => setFlowOn((v) => !v)}
          className="hover-band h-8 w-10 text-[11px] font-bold tracking-wider"
          style={{ color: flowOn ? C.gas : C.inkFaint }}
        >
          ⌁
        </button>
        <button
          aria-label="Zoom out"
          className="hover-band h-8 w-8 border-l text-sm font-bold"
          style={{ color: C.ink, borderColor: C.bandLine }}
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
          style={{ color: C.ink, borderColor: C.bandLine }}
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
          style={{ color: C.ink, borderColor: C.bandLine }}
          onClick={fit}
        >
          FIT
        </button>
      </div>
    </div>
  );
});
