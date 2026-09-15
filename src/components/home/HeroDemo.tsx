'use client';

/**
 * HeroDemo — the sell, playing on a loop.
 *
 * Not a video, not a mockup: a scripted build rendered by the same mini
 * renderer the project grid uses, in the builder stage's visual
 * language — with real choreography:
 *
 *   the prompt types itself at a human cadence → the architect drafts →
 *   the engineer places equipment (each unit settles onto the sheet) →
 *   streams draw themselves in, arrowheads popping as they land → the
 *   solver iterates the recycle loop, counting passes → the balance
 *   converges and the numbers count up → the critic signs off.
 *
 * A slow camera drifts with the build (framing the placed units), then
 * pulls back to the whole sheet at convergence. Hover pauses the loop.
 * prefers-reduced-motion gets the finished plant, static. The demo plant
 * is a 500 t/d methanol loop — deliberately NOT ammonia: the product is
 * general.
 */

import { useEffect, useRef, useState } from 'react';
import { MiniFlow, type MiniStream, type MiniUnit } from './MiniFlow';
import { C } from '@/lib/design/tokens';
import { boxToAspect } from '@/lib/flowsheet/geom';

const PROMPT =
  'Build a 500 t/day methanol plant — natural gas feed, steam reforming, synthesis loop with recycle.';

const CANVAS = { w: 960, h: 380 };
const FULL = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };

const T = {
  typeStart: 600,
  typeMs: 24,
  agents: [
    { label: 'ARCHITECT', t0: 4400, t1: 5300, done: 'plan · 5 units · 7 streams' },
    { label: 'ENGINEER', t0: 5300, t1: 10400, done: 'mass + energy wired' },
    { label: 'CRITIC', t0: 12600, t1: 13800, done: '92 / 100 · PASS' },
  ],
  unitStart: 5600,
  unitStep: 560,
  streamStart: 8400,
  streamStep: 340,
  solving: 11200,
  converged: 12500,
  fade: 14900,
  loop: 15700,
};
const SOLVE_PASSES = 12;

/** per-character reveal times — a human cadence, not a metronome */
const CHAR_TIMES = (() => {
  const arr: number[] = [];
  let t = T.typeStart;
  for (const ch of PROMPT) {
    arr.push(t);
    t += T.typeMs + (ch === ' ' ? 58 : 0) + (ch === ',' || ch === '—' ? 90 : 0);
  }
  return arr;
})();
const PROMPT_END = CHAR_TIMES[CHAR_TIMES.length - 1] + 120;

const UNITS: MiniUnit[] = [
  { id: 'U1', label: 'DESULFURIZER', x: 40, y: 168, w: 118, h: 52 },
  { id: 'U2', label: 'STEAM REFORMER', x: 218, y: 148, w: 138, h: 86 },
  { id: 'U3', label: 'METHANOL REACTOR', x: 414, y: 158, w: 126, h: 74 },
  { id: 'U4', label: 'CONDENSER', x: 596, y: 168, w: 104, h: 52 },
  { id: 'U5', label: 'FLASH SEPARATOR', x: 756, y: 148, w: 96, h: 92 },
];

const STREAMS: MiniStream[] = [
  // natural gas in
  { id: 'S1', d: 'M 8 194 L 34 194', cls: 'feed', arrow: { x: 38, y: 194, angle: 0 } },
  // desulfurizer → reformer
  { id: 'S2', d: 'M 161 194 C 188 194, 188 191, 214 191', cls: 'feed', arrow: { x: 218, y: 191, angle: 0 } },
  // steam in (dashed utility)
  { id: 'S8', d: 'M 287 92 C 287 116, 287 116, 287 142', cls: 'water', arrow: { x: 287, y: 146, angle: Math.PI / 2 } },
  // reformer → reactor
  { id: 'S3', d: 'M 359 191 C 386 191, 386 195, 410 195', cls: 'syngas', arrow: { x: 414, y: 195, angle: 0 } },
  // reactor → condenser
  { id: 'S4', d: 'M 543 195 C 570 195, 570 194, 592 194', cls: 'syngas', arrow: { x: 596, y: 194, angle: 0 } },
  // condenser → separator
  { id: 'S5', d: 'M 703 194 C 728 194, 728 194, 752 194', cls: 'syngas', arrow: { x: 756, y: 194, angle: 0 } },
  // recycle: separator top → reactor top
  {
    id: 'S7',
    d: 'M 804 146 C 804 74, 477 74, 477 152',
    cls: 'loopgas',
    arrow: { x: 477, y: 156, angle: Math.PI / 2 },
  },
  // methanol product out the boot
  { id: 'S6', d: 'M 828 242 C 828 292, 828 292, 828 328', cls: 'product', arrow: { x: 828, y: 332, angle: Math.PI / 2 } },
];

const STREAM_NAMES: Record<string, string> = {
  S1: 'natural gas feed',
  S2: 'treated feed',
  S8: 'steam',
  S3: 'syngas',
  S4: 'reactor effluent',
  S5: 'condensate',
  S7: 'recycle loop',
  S6: 'methanol product',
};

const LABELS = [
  { x: 96, y: 186, text: 'natural gas', anchor: 'middle' as const },
  { x: 302, y: 112, text: 'steam', anchor: 'start' as const },
  { x: 852, y: 300, text: 'methanol', anchor: 'start' as const },
  { x: 640, y: 66, text: 'recycle', anchor: 'middle' as const },
];

/** where the camera looks while the build runs */
function targetView(tt: number, unitsShown: MiniUnit[]): typeof FULL {
  if (unitsShown.length === 0 || tt >= T.converged) return FULL;
  const x1 = Math.min(...unitsShown.map((u) => u.x)) - 70;
  const y1 = Math.min(...unitsShown.map((u) => u.y)) - 105;
  const x2 = Math.max(...unitsShown.map((u) => u.x + u.w)) + 80;
  const y2 = Math.max(...unitsShown.map((u) => u.y + u.h)) + 105;
  const b = boxToAspect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, CANVAS.w / CANVAS.h);
  return {
    x: Math.max(-24, Math.min(b.x, CANVAS.w - b.w + 24)),
    y: Math.max(-24, Math.min(b.y, CANVAS.h - b.h + 24)),
    w: b.w,
    h: b.h,
  };
}

const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function HeroDemo() {
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const camRef = useRef<typeof FULL>({ ...FULL });
  const [cam, setCam] = useState<typeof FULL>({ ...FULL });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // initial read off the render path; later changes ride the event
    const id = requestAnimationFrame(() => setReduced(mq.matches));
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener('change', on);
    };
  }, []);

  useEffect(() => {
    if (reduced) return; // static finished plant
    startRef.current = performance.now();
    let last = 0;
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (pausedRef.current) {
        startRef.current += now - last; // freeze the clock while paused
        last = now;
        return;
      }
      last = now;
      const tt = (now - startRef.current) % T.loop;
      setT(tt);
      // the camera drifts with the build, damped like a real operator
      const shown = UNITS.filter((_, i) => tt >= T.unitStart + i * T.unitStep);
      const tgt = targetView(tt, shown);
      if (tt < 200) {
        camRef.current = { ...FULL }; // loop restart — snap back under the fade
      } else {
        const k = 0.085;
        const c = camRef.current;
        camRef.current = {
          x: c.x + (tgt.x - c.x) * k,
          y: c.y + (tgt.y - c.y) * k,
          w: c.w + (tgt.w - c.w) * k,
          h: c.h + (tgt.h - c.h) * k,
        };
      }
      setCam(camRef.current);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced]);

  const tt = reduced ? T.loop : t; // reduced motion → the finished state
  const chars = CHAR_TIMES.filter((ct) => tt >= ct).length;
  const typed = PROMPT.slice(0, chars);
  const typing = !reduced && tt >= T.typeStart && tt < PROMPT_END;

  const unitsShown = UNITS.filter((_, i) => tt >= T.unitStart + i * T.unitStep);
  const streamsShown = STREAMS.filter((_, i) => tt >= T.streamStart + i * T.streamStep);
  const showLabels = tt >= T.streamStart + STREAMS.length * T.streamStep + 260;
  const solving = tt >= T.solving && tt < T.converged;
  const converged = tt >= T.converged;
  const faded = !reduced && tt >= T.fade;

  const solvePass = Math.min(SOLVE_PASSES, 1 + Math.floor(((tt - T.solving) / (T.converged - T.solving)) * SOLVE_PASSES));
  const production = Math.round(512 * easeOut((tt - T.converged) / 700));
  const criticScore = Math.round(92 * easeOut((tt - T.agents[2].t0 - 300) / 700));

  // the operator's console line — what the crew is doing right now
  const status = (() => {
    if (tt < T.typeStart) return '';
    if (tt < PROMPT_END) return '▸ reading the brief…';
    if (tt < T.unitStart) return '▸ drafting the flowsheet — 5 units · 7 streams';
    if (tt < T.streamStart) {
      const u = unitsShown[unitsShown.length - 1];
      return u ? `▸ placing ${u.label}…` : '';
    }
    if (tt < T.solving) {
      const idx = Math.min(streamsShown.length - 1, STREAMS.length - 1);
      return `▸ wiring ${STREAM_NAMES[STREAMS[idx]?.id ?? 'S1']}`;
    }
    if (tt < T.converged) return `▸ iterating recycle loop · pass ${solvePass}/${SOLVE_PASSES}`;
    if (tt < T.agents[2].t0) return '✓ converged · 12 passes · 0.38 s';
    return '✓ critic 92/100 · PASS — plant is sound';
  })();

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: C.bandLine, background: C.paper }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Looping demo: the AI builder assembling a methanol plant"
    >
      {/* window bar */}
      <div
        className="flex items-center gap-2 border-b px-3.5 py-2"
        style={{ borderColor: C.bandLine }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.bandLine }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.bandLine }} />
        <span
          className="ml-1 font-mono text-[10px] font-bold tracking-[0.14em]"
          style={{ color: C.inkSoft }}
        >
          AI PLANT BUILDER · LIVE LOOP
        </span>
        <span
          className="ml-auto font-mono text-[10px] font-bold tracking-wider"
          style={{ color: C.inkFaint }}
        >
          {paused && !reduced ? 'PAUSED — HOVER TO INSPECT' : `${(tt / 1000).toFixed(1)}s`}
        </span>
      </div>

      <div
        className="flex flex-col md:flex-row"
        style={{ opacity: faded ? 0 : 1, transition: 'opacity 480ms ease' }}
      >
        {/* the stage */}
        <div
          className="relative min-w-0 flex-1"
          style={{ background: C.canvas }}
        >
          <MiniFlow
            canvas={CANVAS}
            view={reduced ? FULL : cam}
            dots
            units={unitsShown}
            streams={streamsShown}
            labels={showLabels ? LABELS : []}
            className="block h-auto w-full"
          />
          {/* the operator's console line */}
          {status && (
            <div
              key={status}
              className="bd-msg-in pointer-events-none absolute bottom-2.5 left-3 font-mono text-[10px] font-semibold tracking-wide"
              style={{ color: C.inkSoft }}
            >
              {status}
            </div>
          )}
          {/* sheet corner stamp */}
          {converged && (
            <div
              className="mf-in absolute bottom-2.5 right-3 rounded-md border px-2 py-1 font-mono text-[9px] font-bold tracking-[0.1em]"
              style={{ borderColor: C.bandLine, background: C.paperA95, color: C.inkSoft }}
            >
              METHANOL SYNTHESIS · PFD · SHEET 1 OF 1
            </div>
          )}
        </div>

        {/* the session rail */}
        <div
          className="w-full shrink-0 border-t px-3.5 py-3 md:w-[248px] md:border-l md:border-t-0"
          style={{ borderColor: C.bandLine }}
        >
          <div
            className="font-mono text-[9.5px] font-bold tracking-[0.14em]"
            style={{ color: C.inkFaint }}
          >
            DESCRIBE YOUR PLANT
          </div>
          <div
            className="mt-1.5 min-h-[54px] rounded-lg border px-2.5 py-2 text-[12px] leading-relaxed"
            style={{ borderColor: C.bandLine, background: C.canvas, color: C.ink }}
          >
            {typed}
            {typing && (
              <span className="caret ml-0.5 inline-block h-[13px] w-[6px] align-[-2px]" style={{ background: C.ink }} />
            )}
          </div>

          {/* agent chips */}
          <div className="mt-3 flex flex-col gap-1.5">
            {T.agents.map((a) => {
              const done = tt >= a.t1;
              const active = !done && tt >= a.t0;
              return (
                <div
                  key={a.label}
                  className="rounded-lg border px-2.5 py-1.5 transition-opacity duration-300"
                  style={{
                    borderColor: done || active ? C.bandLine : 'transparent',
                    background: done || active ? C.canvas : 'transparent',
                    opacity: tt >= a.t0 ? 1 : 0.28,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bd-pulse' : ''}`}
                      style={{ background: done ? C.nh3 : active ? C.warn : C.inkFaint }}
                    />
                    <span
                      className="font-mono text-[10px] font-bold tracking-[0.12em]"
                      style={{ color: C.ink }}
                    >
                      {a.label}
                    </span>
                    {done && (
                      <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: C.nh3 }}>
                        ✓
                      </span>
                    )}
                  </div>
                  {done && (
                    <div
                      className="bd-msg-in mt-0.5 pl-3.5 font-mono text-[9px] tracking-wide"
                      style={{ color: C.inkFaint }}
                    >
                      {a.done}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* solver + verdict */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {solving && (
              <span
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                style={{ borderColor: C.bandLine, color: C.inkSoft }}
              >
                <span className="bd-pulse h-1.5 w-1.5 rounded-full" style={{ background: C.warn }} />
                SOLVING MASS + ENERGY
                <span
                  className="ml-0.5 inline-block h-[3px] w-9 overflow-hidden rounded-full"
                  style={{ background: C.bandLine }}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.min(100, ((tt - T.solving) / (T.converged - T.solving)) * 100)}%`,
                      background: C.warn,
                      transition: 'width 120ms linear',
                    }}
                  />
                </span>
              </span>
            )}
            {converged && (
              <>
                <span
                  className="mf-in rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                  style={{ borderColor: C.nh3, color: C.nh3 }}
                >
                  ✓ BALANCE CONVERGED
                </span>
                <span
                  className="mf-in rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                  style={{ borderColor: C.bandLine, color: C.ink }}
                >
                  {production} t/d MeOH
                </span>
                <span
                  className="mf-in rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                  style={{ borderColor: C.bandLine, color: C.inkSoft }}
                >
                  5 UNITS · 7 STREAMS
                </span>
                {tt >= T.agents[2].t0 && (
                  <span
                    className="mf-in rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                    style={{ borderColor: C.nh3, color: C.nh3 }}
                  >
                    CRITIC {criticScore}/100 · PASS
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
