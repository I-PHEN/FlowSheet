'use client';

/**
 * HeroDemo — the sell, playing on a loop in a FIXED WINDOW.
 *
 * Not a video, not a mockup: a scripted build rendered by the same mini
 * renderer the project grid uses, in the builder stage's visual language:
 *
 *   the prompt types itself at a human cadence → the router picks the
 *   family → the architect drafts → the engineer places equipment — the
 *   REAL silhouettes from the flowsheet symbol library, no stand-in boxes:
 *   a bed reactor (D-101), a firebox reformer with stack and burner
 *   flames (R-102), a three-bed quench converter (R-103), a shell-and-
 *   tube condenser (E-201), a flashed separator with boot (V-201), each
 *   settling onto the sheet with its tag called out beneath it — and
 *   wires every stream → the solver grinds the recycle loop down pass
 *   by pass (the residual SHRINKS, like the real console) → the critic
 *   scores it → the docent writes the tour in Orion's voice.
 *
 * THE FIXED-WINDOW LAW: nothing in this demo may ever change the height
 * of anything. The session rail reserves the exact height of every zone
 * that fills in during the loop — the prompt box, the role chips, the
 * three-line session feed, the verdict chips — so the page below never
 * shifts by a pixel while the loop runs. (This replaced the old rail,
 * whose done-lines sprouted and whose verdict row wrapped from zero to
 * three rows, pushing the whole page downward mid-loop.)
 *
 * Hover pauses the loop. prefers-reduced-motion gets the finished plant,
 * static. The demo plant is a 500 t/d methanol loop — deliberately NOT
 * ammonia: the product is general.
 */

import { useEffect, useRef, useState } from 'react';
import { MiniFlow, type MiniStream, type MiniUnit } from './MiniFlow';
import { C } from '@/lib/design/tokens';
import { boxToAspect } from '@/lib/flowsheet/geom';

const PROMPT =
  'Build a 500 t/day methanol plant — natural gas feed, steam reforming, synthesis loop with recycle.';

const CANVAS = { w: 960, h: 400 };
const FULL = { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };

const T = {
  typeStart: 600,
  typeMs: 24,
  unitStart: 5600,
  unitStep: 560,
  streamStart: 8400,
  streamStep: 340,
  solving: 11200,
  converged: 12500,
  fade: 16000,
  loop: 16800,
};
const SOLVE_PASSES = 12;

/** real equipment tags — the feed speaks the way the builder actually does */
const UNIT_TAGS = ['D-101', 'R-102', 'R-103', 'E-201', 'V-201'];

const ROLES = [
  { label: 'ARCHITECT', t0: 4400, t1: 5300 },
  { label: 'ENGINEER', t0: 5300, t1: 12500 },
  { label: 'CRITIC', t0: 12600, t1: 13800 },
  { label: 'DOCENT', t0: 13900, t1: 14900 },
];

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

/** the demo plant — a 500 t/d methanol loop drawn in the app's real
 *  symbol grammar: every silhouette is the genuine UnitSymbol the
 *  flowsheet sheet draws, at sheet-like proportions, tags underneath */
const UNITS: MiniUnit[] = [
  { id: 'U1', tag: 'D-101', label: 'DESULFURIZER', kind: 'reactor', x: 44, y: 146, w: 60, h: 86 },
  { id: 'U2', tag: 'R-102', label: 'STEAM REFORMER', kind: 'furnace', x: 170, y: 118, w: 146, h: 116 },
  { id: 'U3', tag: 'R-103', label: 'MeOH CONVERTER', kind: 'converter', x: 396, y: 84, w: 90, h: 176 },
  { id: 'U4', tag: 'E-201', label: 'CONDENSER', kind: 'hex', x: 566, y: 152, w: 72, h: 60 },
  { id: 'U5', tag: 'V-201', label: 'FLASH SEPARATOR', kind: 'vdrum', x: 722, y: 120, w: 76, h: 124 },
];

const STREAMS: MiniStream[] = [
  // natural gas in → desulfurizer body's left face (feed muted to slate —
  // the hero holds TWO chromatic accents only: steel-blue gas, sage product)
  { id: 'S1', d: 'M 8 189 L 42 189', cls: 'feed', color: C.utility, arrow: { x: 49, y: 189, angle: 0 } },
  // desulfurizer → reformer firebox
  { id: 'S2', d: 'M 99 189 C 124 189, 148 186, 170 186', cls: 'feed', color: C.utility, arrow: { x: 173, y: 186, angle: 0 } },
  // steam in (dashed utility) — down onto the reformer roof
  { id: 'S8', d: 'M 300 78 C 300 90, 300 100, 300 110', cls: 'water', arrow: { x: 300, y: 116, angle: Math.PI / 2 } },
  // reformer → converter (into the left face, clear of the quench stubs)
  { id: 'S3', d: 'M 313 176 C 344 176, 372 172, 399 172', cls: 'syngas', arrow: { x: 402, y: 172, angle: 0 } },
  // converter → condenser
  { id: 'S4', d: 'M 480 172 C 512 172, 534 182, 564 182', cls: 'syngas', arrow: { x: 567, y: 182, angle: 0 } },
  // condenser → separator
  { id: 'S5', d: 'M 637 182 C 664 182, 698 182, 720 182', cls: 'syngas', arrow: { x: 723, y: 182, angle: 0 } },
  // recycle: separator top → over the roof → converter top
  {
    id: 'S7',
    d: 'M 760 120 C 760 58, 441 58, 441 82',
    cls: 'loopgas',
    arrow: { x: 441, y: 84, angle: Math.PI / 2 },
  },
  // methanol product out the boot
  { id: 'S6', d: 'M 760 246 C 760 280, 760 292, 760 316', cls: 'product', arrow: { x: 760, y: 320, angle: Math.PI / 2 } },
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
  { x: 8, y: 177, text: 'natural gas', anchor: 'start' as const },
  { x: 308, y: 98, text: 'steam', anchor: 'start' as const },
  { x: 770, y: 296, text: 'methanol', anchor: 'start' as const },
  { x: 600, y: 50, text: 'recycle', anchor: 'middle' as const },
];

/** the solver's residual, shrinking logarithmically pass by pass — the way
 *  a damped-DS + Broyden loop actually converges */
const resid = (p: number) => {
  const l0 = Math.log10(2.4e-1);
  const l1 = Math.log10(8.6e-7);
  return Math.pow(10, l0 + ((p - 1) / (SOLVE_PASSES - 1)) * (l1 - l0)).toExponential(1);
};

/** the session feed — the crew's event log, the way the real session panel
 *  reads. Rendered as the last three lines; the zone's height is fixed. */
const FEED: { t: number; text: string }[] = [
  { t: 4000, text: 'router · methanol family' },
  { t: 4700, text: 'architect · 5 units · 7 streams' },
  ...UNITS.map((u, i) => ({ t: T.unitStart + i * T.unitStep + 240, text: `engineer · place ${UNIT_TAGS[i]}` })),
  ...STREAMS.map((s, i) => ({ t: T.streamStart + i * T.streamStep + 160, text: `engineer · wire ${STREAM_NAMES[s.id]}` })),
  { t: T.solving + 100, text: `solver · pass 1 · Δ ${resid(1)}` },
  { t: T.solving + 700, text: `solver · pass 6 · Δ ${resid(6)}` },
  { t: T.converged - 100, text: `solver · pass ${SOLVE_PASSES} · Δ ${resid(SOLVE_PASSES)}` },
  { t: T.converged + 150, text: 'solver · converged · 0.38 s' },
  { t: ROLES[2].t0 + 420, text: 'critic · 92/100 · PASS' },
  { t: ROLES[3].t0 + 420, text: 'docent · tour in Orion’s voice' },
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

/** the ONE live status line — what the crew is doing right now, in plain
 *  words. The text itself stays SOLID and readable (the pulse dot + the
 *  3-dot loader carry the "working" motion — a fading skeleton text reads
 *  broken, not busy); the verbose log lives behind “See how it works”. */
function statusAt(tt: number, reducedMotion: boolean): { text: string; done: boolean } {
  if (reducedMotion || tt >= ROLES[3].t1)
    return { text: 'Converged in 0.38 s · critic 92/100 · Orion’s tour ready', done: true };
  if (tt < 4000) return { text: 'Reading the brief', done: false };
  if (tt < 5300) return { text: 'Architect — drafting the flowsheet', done: false };
  if (tt < T.streamStart) {
    const i = UNITS.filter((_, k) => tt >= T.unitStart + k * T.unitStep).length - 1;
    return { text: i >= 0 ? `Engineer — placing ${UNIT_TAGS[i]}` : 'Engineer — placing equipment', done: false };
  }
  if (tt < T.solving) {
    const j = STREAMS.filter((_, k) => tt >= T.streamStart + k * T.streamStep).length - 1;
    return {
      text: j >= 0 ? `Engineer — wiring ${STREAM_NAMES[STREAMS[j].id]}` : 'Engineer — wiring streams',
      done: false,
    };
  }
  if (tt < T.converged) return { text: 'Solver — converging mass + energy', done: false };
  if (tt < ROLES[2].t1) return { text: 'Critic — scoring the design', done: false };
  return { text: 'Docent — writing the tour', done: false };
}

export function HeroDemo() {
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [open, setOpen] = useState(false);
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

  const production = Math.round(512 * easeOut((tt - T.converged) / 700));

  // the one status line + the full log (behind the toggle)
  const status = statusAt(tt, reduced);
  const feed = FEED.filter((e) => tt >= e.t);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: C.bandLine, background: C.paper, boxShadow: 'var(--fs-card-shadow)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Looping demo: the AI builder assembling a methanol plant"
    >
      {/* window bar — slim: it frames the stage, it isn't the show */}
      <div
        className="flex items-center gap-2 border-b px-3.5 py-1.5"
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

      <div style={{ opacity: faded ? 0 : 1, transition: 'opacity 480ms ease' }}>
        {/* THE STAGE — the whole card IS the diagram. White sheet, dot grid,
            the plant building itself unit by unit; the only overlays are the
            two result chips, because the diagram is the show. */}
        <div className="relative" style={{ background: C.sheet }}>
          <MiniFlow
            canvas={CANVAS}
            view={reduced ? FULL : cam}
            dots
            units={unitsShown}
            streams={streamsShown}
            labels={showLabels ? LABELS : []}
            className="block h-auto w-full"
          />

          {/* the result chips — overlaid top-right, quiet */}
          <div className="pointer-events-none absolute right-3 top-2.5 flex flex-col items-end gap-1.5">
            {solving && (
              <span
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                style={{ borderColor: C.bandLine, background: C.paperA95, color: C.inkSoft }}
              >
                <span className="bd-pulse h-1.5 w-1.5 rounded-full" style={{ background: C.warn }} />
                SOLVING MASS + ENERGY
                {/* a real fixed-width progress bar, filling left to right
                    with the solve — never a dot trail into nothing */}
                <span
                  className="ml-0.5 inline-block h-1 w-12 shrink-0 overflow-hidden rounded-full"
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
                  style={{ borderColor: C.nh3, color: C.nh3, background: C.paperA95 }}
                >
                  ✓ {production} t/d MeOH
                </span>
                <span
                  className="mf-in rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-wider"
                  style={{ borderColor: C.bandLine, color: C.inkSoft, background: C.paperA95 }}
                >
                  99.2% PURITY
                </span>
              </>
            )}
          </div>

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

        {/* THE PROMPT BAR — the input that drives it all, minimized to one
            slim composer under the stage (reviewer: “text/input controls
            minimized underneath”). Fixed two-line height from frame one —
            the fixed-window law. */}
        <div className="flex items-start gap-2.5 border-t px-3.5 py-2.5" style={{ borderColor: C.bandLine }}>
          <span
            className="mt-[1px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border text-[11px]"
            style={{ borderColor: C.bandLine, background: C.canvas, color: C.ink }}
            aria-hidden="true"
          >
            ✦
          </span>
          <div className="min-h-[30px] min-w-0 flex-1 pt-[5px] text-[12px] font-medium leading-[1.25]" style={{ color: C.ink }}>
            {tt < T.typeStart && !reduced ? (
              <span style={{ color: C.inkFaint }}>describe a plant — any route, any capacity…</span>
            ) : (
              typed
            )}
            {typing && (
              <span className="caret ml-0.5 inline-block h-[13px] w-[6px] align-[-2px]" style={{ background: C.ink }} />
            )}
          </div>
          <span
            className="mt-[2px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
            style={{ background: C.ink, color: C.paper }}
            aria-hidden="true"
          >
            →
          </span>
        </div>

        {/* THE STATUS LINE — one quiet line of what's happening now: solid,
            always-readable text + a clean 3-dot loader while the crew works
            (consistent size and spacing — nothing trails off into nothing).
            The verbose agent log lives behind the toggle; the toggle
            shortens its label on phones so the status never truncates
            mid-word. */}
        <div className="flex h-9 items-center gap-2 border-t px-3.5" style={{ borderColor: C.bandLine }}>
          {status.done ? (
            <span className="shrink-0 font-mono text-[11px] font-bold" style={{ color: C.nh3 }}>
              ✓
            </span>
          ) : (
            <span className="bd-pulse h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.warn }} />
          )}
          <span
            className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-semibold tracking-wide"
            style={{ color: C.inkSoft }}
          >
            {status.text}
            {!status.done && (
              <span className="hd-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide transition-colors"
            style={{ color: C.inkSoft }}
            aria-expanded={open}
          >
            <span className="hidden sm:inline">See how it works</span>
            <span className="sm:hidden">How</span> {open ? '▴' : '▾'}
          </button>
        </div>

        {/* THE HOW-IT-WORKS PANEL — the crew and their full event log, the
            old default view. Opens only on the user's click, so the loop
            can never stretch the page on its own. */}
        {open && (
          <div className="border-t px-3.5 py-3" style={{ borderColor: C.bandLine, background: C.canvas }}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {ROLES.map((a) => {
                const done = tt >= a.t1;
                const active = !done && tt >= a.t0;
                return (
                  <div
                    key={a.label}
                    className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold tracking-[0.1em]"
                    style={{ color: done ? C.ink : active ? C.inkSoft : C.inkFaint, opacity: tt >= a.t0 ? 1 : 0.55 }}
                  >
                    <span
                      className={`h-1 w-1 shrink-0 rounded-full ${active ? 'bd-pulse' : ''}`}
                      style={{ background: done ? C.nh3 : active ? C.warn : C.bandLine }}
                    />
                    {a.label}
                    {done && ' ✓'}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 max-h-[168px] overflow-y-auto pr-1">
              {feed.map((e) => (
                <div
                  key={`${e.t}-${e.text}`}
                  className="py-[2px] font-mono text-[9.5px] tracking-wide"
                  style={{ color: C.inkFaint }}
                >
                  {e.text}
                </div>
              ))}
              {feed.length === 0 && (
                <div className="py-[2px] font-mono text-[9.5px] tracking-wide" style={{ color: C.inkFaint }}>
                  waiting for the first event…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
