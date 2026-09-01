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
  useRef,
  useState,
} from 'react';
import { C } from '@/lib/design/tokens';
import { CANVAS } from '@/lib/flowsheet/layout';
import { bboxOf, boxToAspect, type Box } from '@/lib/flowsheet/geom';
import { SPECIES } from '@/lib/engine/species';
import type { PlantResult } from '@/lib/engine/types';
import { Diagram, type Focus } from './Diagram';

type View = { x: number; y: number; w: number; h: number };

export interface CanvasHandle {
  panTo: (box: Box, opts?: { immediate?: boolean }) => void;
  fit: () => void;
  zoomBy: (f: number) => void;
}

interface CanvasProps {
  result: PlantResult;
  selected: Focus | null;
  spotlight?: Focus | null;
  onSelect: (f: Focus | null) => void;
}

const FULL: View = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };
const MIN_W = 260;
const MAX_W = CANVAS.w * 1.35;
const ASPECT = CANVAS.w / CANVAS.h;

const fmt = (x: number, d = 0) =>
  x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

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

export const FlowsheetCanvas = forwardRef<CanvasHandle, CanvasProps>(function FlowsheetCanvas(
  { result, selected, spotlight, onSelect },
  ref,
) {
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

  const stopAnim = () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };

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
  }, []);

  const clampView = (v: View): View => {
    const w = Math.min(MAX_W, Math.max(MIN_W, v.w));
    const h = w / ASPECT;
    const x = Math.min(CANVAS.w - w * 0.25, Math.max(-w * 0.75, v.x));
    const y = Math.min(CANVAS.h - h * 0.25, Math.max(-h * 0.75, v.y));
    return { x, y, w, h };
  };

  const zoomAtWorld = useCallback((wx: number, wy: number, factor: number) => {
    stopAnim();
    setView((v) => {
      const k = 1 / factor;
      return clampView({ x: wx - (wx - v.x) * k, y: wy - (wy - v.y) * k, w: v.w * k, h: v.h * k });
    });
  }, []);

  const fit = useCallback(() => {
    stopAnim();
    setView(FULL);
  }, []);

  const panTo = useCallback((box: Box, opts?: { immediate?: boolean }) => {
    stopAnim();
    const target = clampView(
      boxToAspect(
        bboxOf([[box.x, box.y], [box.x + box.w, box.y + box.h]], 70),
        ASPECT,
      ),
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
  }, []);

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
          }),
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
      setView(clampView({ x: v.x + v.w * fx, y: v.y + v.h * fy, w: v.w, h: v.h }));
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
          <span
            className="w-5 border-t-2 border-dashed"
            style={{ borderColor: C.inkFaint }}
          />
          UTILITIES
        </span>
      </div>

      {/* zoom controls */}
      <div
        className="absolute bottom-3 right-3 z-10 flex overflow-hidden rounded-lg border"
        style={{ borderColor: C.bandLine, background: C.paper }}
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
