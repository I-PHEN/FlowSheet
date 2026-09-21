'use client';

/**
 * MeetOrion — the guide gets a home on the landing page.
 *
 * His voice is marketed the only way this app knows how: by demonstration.
 * The card is a PLAYER, not a caption — a fixed-dark object (the charcoal
 * identity, the same in both themes, like an embedded player on a light
 * page):
 *
 *   row 1  the line's title + REAL VOICE mono tag
 *   row 2  ONE live status line with a block cursor — no caption
 *          streaming; the player itself is the demo
 *   row 3  THE WAVEFORM — a glowing ribbon driven by Orion's ACTUAL voice
 *          (narrator.amplitude(): an analyser on the narrator's own audio
 *          element; a gentle synthetic fallback when the graph cannot run)
 *   row 4  the transport — his avatar + ORION · YOUR GUIDE + NARRATED,
 *          and to the right: play/pause, replay, the voice's volume, and
 *          the · space hint
 *
 * Player semantics on ONE button: play → stop mid-line (back to the
 * resting invite) → replay from the top. Space toggles while the card is
 * hovered — the player convention. Leaving the page cuts his line; the
 * narrator's blob cache keeps his introduction forever after, so the
 * voice cost is once.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume1, Volume2, VolumeX } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { Belt } from '@/components/learn/OrionMark';
import { ModelCard } from '@/components/home/ModelCard';
import { narrator, type NarrationState } from '@/lib/audio/narration';
import { stepScript } from '@/lib/audio/tourAudio';

/** his introduction — written to the ORION_VOICE spec (plain words,
 *  operator senses, introduces himself by name once, no formulas) */
const INTRO = {
  title: 'Welcome to the plant',
  text: "Name's Orion. Thirty years on the catwalks — I've heard every pump about to give, and smelled every leak that mattered. Walk with me, and I'll show you what every unit does for your plant.",
};
const SCRIPT = stepScript(INTRO);

/** the player object is DARK in both themes — fixed tokens, never the
 *  page's palette. A player embedded on a light page stays a player. */
const P = {
  bg: '#0B0B0D', // near-black card body
  line: '#2C2C2F', // hairline (the charcoal band line)
  ink: '#ECECEE', // primary text / the waveform's white core
  inkSoft: '#A7A8AC', // the status line
  inkFaint: '#818287', // tags, hints
  action: '#28282C', // the action surface (charcoal identity)
  onAction: '#F2F2F4',
  actionLine: '#3E3E42',
  live: '#6FAE8C', // his speaking state — semantic green, the one allowed
};

// ---------------------------------------------------------------------------
// the waveform — a mirrored ribbon, glowing, driven by the real voice
// ---------------------------------------------------------------------------

/** fixed per-point texture: the ribbon has organic structure (like a real
 *  speech envelope), not a single bouncing sine */
const N = 64;
const TEX = Array.from({ length: N }, (_, i) => {
  const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  return 0.35 + 0.65 * h;
});

function VoiceRibbon({ speaking }: { speaking: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let env = 0; // the smoothed envelope: fast attack, slow release
    const t0 = performance.now();

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (w === 0 || h === 0) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // the target envelope: the voice's real loudness when the analyser
      // is wired; a gentle synthetic breath while it is not (loading, or
      // the graph could not run)
      let target = 0;
      if (speaking) {
        const a = narrator.amplitude();
        target =
          a != null
            ? a
            : 0.26 + 0.16 * Math.sin(t / 260) + 0.1 * Math.sin(t / 97);
      }
      env += (Math.max(0, Math.min(1, target)) - env) * (target > env ? 0.55 : 0.1);

      const mid = h / 2;
      const half = Math.max(1, (env * (h / 2 - 2)) | 0);

      if (env <= 0.02) {
        // resting: a faint hairline — the player is on, nobody is talking
        ctx.fillStyle = 'rgba(236,236,238,0.22)';
        ctx.fillRect(0, mid - 0.75, w, 1.5);
        return;
      }

      // the ribbon: top edge left→right, mirrored bottom edge right→left
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * w;
        const win = Math.sin((i / N) * Math.PI); // taper at both ends
        const amp = Math.max(1, half * TEX[i % N] * win);
        const y = mid - amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = N; i >= 0; i--) {
        const x = (i / N) * w;
        const win = Math.sin((i / N) * Math.PI);
        const amp = Math.max(1, half * TEX[i % N] * win);
        ctx.lineTo(x, mid + amp);
      }
      ctx.closePath();
      // white core + soft glow on near-black — the reference aesthetic
      ctx.save();
      ctx.shadowColor = 'rgba(236,236,238,0.55)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(236,236,238,0.92)';
      ctx.fill();
      ctx.restore();
    };

    if (reduced) {
      // no motion: one static, mid-level ribbon (still a waveform, never
      // animated) — redrawn only if the speaking flag flips
      env = speaking ? 0.4 : 0;
      draw(t0);
      return;
    }
    const tick = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  return <canvas ref={ref} className="h-16 w-full" style={{ display: 'block' }} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// the voice's volume — the same popover pattern as the tour bar's music
// ---------------------------------------------------------------------------

function VoiceVolume() {
  const [open, setOpen] = useState(false);
  const [vol, setVol] = useState(0.95);
  const popRef = useRef<HTMLDivElement>(null);

  // read the element's real level after mount (SSR-safe; same hydration
  // pattern as the audio prefs — never a synchronous setState in an effect)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVol(narrator.volume()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pct = Math.round(vol * 100);
  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        aria-label={vol === 0 ? 'Voice muted — open the level control' : `Voice level ${pct}%`}
        title="Voice volume"
        onClick={() => setOpen((o) => !o)}
        className="vc-btn flex h-[30px] w-[30px] items-center justify-center rounded-lg border"
        style={{ borderColor: P.line, color: vol > 0 ? P.inkSoft : P.inkFaint }}
      >
        {vol === 0 ? (
          <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
        ) : vol < 0.5 ? (
          <Volume1 className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div
          className="absolute bottom-full right-0 z-40 mb-2 w-40 rounded-lg border p-2.5 shadow-xl"
          style={{ background: '#141417', borderColor: P.line }}
          role="group"
          aria-label="Voice volume"
        >
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setVol(v);
              narrator.setVolume(v);
            }}
            className="vc-range vc-range--dark w-full"
            aria-label="Voice volume"
          />
          <div
            className="mt-1 flex items-center justify-between font-mono text-[9px] font-bold tracking-[0.1em]"
            style={{ color: P.inkFaint }}
          >
            <span>VOICE</span>
            <span>{vol === 0 ? 'MUTED' : `${pct}%`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// the card
// ---------------------------------------------------------------------------

export function MeetOrion() {
  const [nstate, setNstate] = useState<NarrationState>('idle');
  const [started, setStarted] = useState(false);
  const hoverRef = useRef(false);

  useEffect(() => narrator.subscribe(setNstate), []);

  // leaving the page cuts his line — the singleton must not outlive the card
  useEffect(
    () => () => {
      if (narrator.scriptOn() === SCRIPT) narrator.stop();
    },
    [],
  );

  const playing = nstate === 'loading' || nstate === 'speaking';
  // started && idle ⇒ the voice ran to its end (stopping resets `started`)
  const finished = started && nstate === 'idle';

  const onButton = useCallback(() => {
    if (playing) {
      narrator.stop(); // back to the resting invite — no half-frozen lines
      setStarted(false);
    } else {
      setStarted(true); // replay and first press both play from the top
      void narrator.replay(SCRIPT);
    }
  }, [playing]);

  // space toggles the player while the card is hovered — the player
  // convention, scoped so the page's scroll never fights it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || !hoverRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      e.preventDefault();
      onButton();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onButton]);

  // the one live line — the player's status, never a caption stream
  const status = !started
    ? 'press play — he introduces himself'
    : nstate === 'loading'
      ? 'warming the voice…'
      : nstate === 'speaking'
        ? 'speaking — in his own words'
        : nstate === 'error'
          ? 'voice unavailable right now'
          : nstate === 'blocked'
            ? 'press replay to let him speak'
            : finished
              ? 'that was Orion — replay any time'
              : 'press play — he introduces himself';
  const cursorOn = nstate === 'loading' || nstate === 'speaking';

  return (
    <section className="mt-10">
      {/* the identity — one line: kicker, the nameplate, the bio, the walk */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: C.inkSoft }}
        >
          Meet your guide
        </span>
        <span
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1"
          style={{ background: C.accent, borderColor: C.accentLine }}
          title="Orion — your guide. Thirty years on the catwalks; he has run every plant in this simulator."
        >
          <Belt color={C.onAccent} />
          <span
            className="font-mono text-[11px] font-extrabold tracking-[0.16em]"
            style={{ color: C.onAccent }}
          >
            ORION
          </span>
        </span>
        <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
          Thirty years on the catwalks — now he lives in your browser.
        </span>
      </div>

      {/* the two proofs — his voice, and the plant he walks you through */}
      <div className="mt-4 grid items-stretch gap-5 lg:grid-cols-2">
        {/* the voice card — a player object, dark in both themes */}
        <div
          className="flex flex-col rounded-2xl border p-5 shadow-2xl"
          style={{ borderColor: P.line, background: P.bg }}
          onPointerEnter={() => {
            hoverRef.current = true;
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
          }}
        >
          {/* row 1 — the line's title + the real-voice tag */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold leading-tight" style={{ color: P.ink }}>
              {INTRO.title}
            </span>
            <span
              className="shrink-0 font-mono text-[9.5px] font-bold tracking-[0.14em]"
              style={{ color: P.inkFaint }}
            >
              REAL VOICE
            </span>
          </div>

          {/* row 2 — one live line: the player's status, with a block
              cursor while he speaks (no caption streaming) */}
          <div className="mt-2 flex min-h-[18px] items-center gap-1.5">
            <span
              className="font-mono text-[11px] font-semibold tracking-[0.04em]"
              style={{ color: P.inkSoft }}
            >
              {status}
            </span>
            {cursorOn && (
              <span
                className="caret inline-block h-[12px] w-[6px]"
                style={{ background: P.ink }}
                aria-hidden="true"
              />
            )}
          </div>

          {/* row 3 — THE WAVEFORM: his actual voice, a glowing ribbon */}
          <div className="mt-3 flex min-h-[96px] flex-1 items-center py-2">
            <VoiceRibbon speaking={playing} />
          </div>

          {/* row 4 — the transport */}
          <div
            className="mt-auto flex items-center gap-2.5 border-t pt-3.5"
            style={{ borderColor: P.line }}
          >
            {/* his nameplate: avatar + name + state */}
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
              style={{ background: '#141417', borderColor: P.line }}
              title="Orion — your guide"
            >
              <Belt color={P.ink} size={14} />
            </span>
            <span className="font-mono text-[10px] font-extrabold tracking-[0.16em]" style={{ color: P.ink }}>
              ORION · YOUR GUIDE
            </span>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[8.5px] font-extrabold tracking-[0.12em]"
              style={{ borderColor: P.line, color: P.inkSoft }}
            >
              NARRATED
            </span>
            {nstate === 'speaking' && (
              <span
                className="bd-pulse h-1.5 w-1.5 rounded-full"
                style={{ background: P.live }}
                aria-hidden="true"
              />
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label={playing ? 'Stop' : started ? 'Replay' : 'Hear Orion'}
                title={playing ? 'Stop' : started ? 'Replay' : 'Hear Orion'}
                onClick={onButton}
                className="vc-btn vc-btn--primary flex h-[30px] w-[42px] items-center justify-center rounded-lg border"
              >
                {playing ? (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                aria-label="Replay from the top"
                title="Replay from the top"
                onClick={() => {
                  setStarted(true);
                  void narrator.replay(SCRIPT);
                }}
                className="vc-btn flex h-[30px] w-[30px] items-center justify-center rounded-lg border"
                style={{ borderColor: P.line, color: P.inkSoft }}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <VoiceVolume />
              <span
                className="ml-1 hidden select-none font-mono text-[9px] font-bold tracking-[0.1em] sm:inline"
                style={{ color: P.inkFaint }}
                aria-hidden="true"
              >
                · space
              </span>
            </div>
          </div>
        </div>

        {/* the plant card — the light 3D */}
        <ModelCard />
      </div>
    </section>
  );
}
