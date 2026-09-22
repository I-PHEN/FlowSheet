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
 *   row 3  THE WAVEFORM — a live signal: one new loudness sample per
 *          frame (his REAL voice via the analyser; a speech-cadence
 *          simulation before it wires), drawn as mirrored bars with the
 *          newest at the right — every bar moves with the syllables
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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

/** the player object keeps its OWN fixed tokens per skin — never the
 *  page's palette. Dark pages get the near-black player; light pages get
 *  the BONE player (a white object on a light page, like paper on a desk).
 *  A player embedded on a page stays a player — it just dresses for the
 *  room. */
const P_DARK = {
  bg: '#0B0B0D', // near-black card body
  line: '#2C2C2F', // hairline (the charcoal band line)
  ink: '#ECECEE', // primary text / the waveform's white core
  inkSoft: '#A7A8AC', // the status line
  inkFaint: '#818287', // tags, hints
  inkRGB: '236,236,238', // the waveform's bar color, as r,g,b
  glow: 9, // the waveform's soft glow (dark aesthetic)
  avatarBg: '#141417',
  popBg: '#141417', // the volume popover
  live: '#6FAE8C', // his speaking state — semantic green, the one allowed
};
const P_LIGHT = {
  bg: '#FCFCFA', // bone card body — a paper-white object
  line: '#D9DDD8', // warm hairline
  ink: '#1D242C', // ink text / the waveform's ink core
  inkSoft: '#414D59',
  inkFaint: '#5C6873',
  inkRGB: '29,36,44', // ink bars on bone
  glow: 0, // no glow on paper — clean ink, not bloom
  avatarBg: '#FFFFFF',
  popBg: '#FFFFFF',
  live: '#2A6347', // deep sage (the light theme's semantic green)
};
type PlayerSkin = typeof P_DARK;

/** which room is the player in? (dark pages / light pages). Reads the
 *  <html> class as an external store: the SERVER snapshot always says dark
 *  — the same value the server rendered — and React corrects it after
 *  mount, so hydration can never mismatch. */
function usePlayerSkin(): PlayerSkin {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const obs = new MutationObserver(onStoreChange);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  const getSnapshot = useCallback(
    () => document.documentElement.classList.contains('dark'),
    [],
  );
  const isDark = useSyncExternalStore(subscribe, getSnapshot, () => true);
  return isDark ? P_DARK : P_LIGHT;
}

// ---------------------------------------------------------------------------
// the waveform — a live signal, not a blob
// ---------------------------------------------------------------------------

/**
 * A rolling history of the voice's loudness, drawn as mirrored bars: every
 * frame takes ONE new sample — the narrator's REAL amplitude when the
 * analyser is live, a speech-cadence simulation while it is not — and the
 * bars carry the last ~44 samples left→right, newest at the right edge.
 *
 * That time dimension is the whole point: each bar moves independently with
 * the syllables actually being spoken (fast attack, slow release), so it
 * reads instantly as a real voice signal — the voice-memo grammar everyone
 * knows — instead of one uniformly breathing shape.
 */
const BARS = 44;

/** the resting waveform — a deterministic ghost of a spoken phrase, drawn
 *  at low opacity whenever nobody is talking (round 68): before the first
 *  press of play the card reads as a LOADED player — a track waiting —
 *  never an empty or broken one. Same mirrored-bar grammar as the live
 *  signal; quiet at both ends like a real breath group. */
const GHOST = (() => {
  const g = new Float32Array(BARS);
  for (let i = 0; i < BARS; i++) {
    const env = Math.sin(((i + 0.5) / BARS) * Math.PI); // quiet at both ends
    const syll = 0.3 + 0.34 * Math.abs(Math.sin(i * 1.35)) + 0.22 * Math.abs(Math.sin(i * 0.47 + 1.3));
    g[i] = Math.max(0.05, Math.min(1, env * syll * 0.9));
  }
  return g;
})();

function VoiceWave({ speaking, skin }: { speaking: boolean; skin: PlayerSkin }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const hist = new Float32Array(BARS); // raw amplitude history, newest last
    const bars = new Float32Array(BARS); // smoothed bars, what is drawn

    // the synthetic cadence (before the analyser can run): bursts, gaps and
    // phrase pauses at speech rates — believable rhythm, not a sine
    let mode: 'burst' | 'gap' | 'pause' = 'burst';
    let modeEnd = 0;
    let level = 0.4;
    let bursts = 0;
    const synth = (t: number): number => {
      if (t >= modeEnd) {
        if (mode === 'burst') {
          bursts++;
          if (bursts >= 3 + Math.floor(Math.random() * 5)) {
            mode = 'pause'; // a phrase boundary — he breathes
            bursts = 0;
            modeEnd = t + 280 + Math.random() * 420;
            level = 0.02 + Math.random() * 0.03;
          } else {
            mode = 'gap';
            modeEnd = t + 40 + Math.random() * 100;
            level = 0.05 + Math.random() * 0.1;
          }
        } else {
          mode = 'burst';
          modeEnd = t + 90 + Math.random() * 130;
          level = 0.22 + Math.random() * 0.58;
        }
      }
      return level;
    };

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

      // 1 — this frame's sample: his actual loudness, or the cadence
      let sample = 0;
      if (speaking) {
        const a = narrator.amplitude();
        sample = a != null ? a : synth(t);
      }
      hist.copyWithin(0, 1);
      hist[BARS - 1] = Math.max(0, Math.min(1, sample));

      // 2 — per-bar smoothing: fast attack, slow release — syllables punch,
      //     tails settle
      for (let i = 0; i < BARS; i++) {
        const target = hist[i];
        const k = target > bars[i] ? 0.55 : 0.16;
        bars[i] += (target - bars[i]) * k;
      }

      const mid = h / 2;
      const maxHalf = h / 2 - 3;
      let alive = false;
      for (let i = 0; i < BARS; i++) if (bars[i] > 0.015) { alive = true; break; }
      if (!alive) {
        const pad = 2;
        const step = (w - pad * 2) / BARS;
        const bw = Math.max(1.5, step * 0.52);
        const path = new Path2D();
        for (let i = 0; i < BARS; i++) {
          const bh = Math.max(1.4, GHOST[i] * maxHalf);
          const x = pad + i * step + (step - bw) / 2;
          if (typeof path.roundRect === 'function') path.roundRect(x, mid - bh, bw, bh * 2, bw / 2);
          else path.rect(x, mid - bh, bw, bh * 2);
        }
        if (speaking) {
          // a pause mid-line: the player is on, nobody is talking — the
          // ghost fades down to a hairline so the breath reads as his
          ctx.fillStyle = `rgba(${skin.inkRGB},0.22)`;
          ctx.fillRect(0, mid - 0.75, w, 1.5);
          return;
        }
        // at rest: the ghost waveform — his line, loaded and waiting
        ctx.fillStyle = `rgba(${skin.inkRGB},0.26)`;
        ctx.fill(path);
        return;
      }

      // 3 — the bars: ONE path, ONE glow fill; the linear gradient carries
      //     the live-signal feel (soft past → bright now, newest at right).
      //     Dark glows; bone is clean ink.
      const pad = 2;
      const step = (w - pad * 2) / BARS;
      const bw = Math.max(1.5, step * 0.52);
      const path = new Path2D();
      for (let i = 0; i < BARS; i++) {
        const bh = Math.max(1.4, bars[i] * maxHalf);
        const x = pad + i * step + (step - bw) / 2;
        if (typeof path.roundRect === 'function') path.roundRect(x, mid - bh, bw, bh * 2, bw / 2);
        else path.rect(x, mid - bh, bw, bh * 2);
      }
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${skin.inkRGB},0.38)`);
      grad.addColorStop(1, `rgba(${skin.inkRGB},0.96)`);
      ctx.save();
      if (skin.glow > 0) {
        ctx.shadowColor = `rgba(${skin.inkRGB},0.5)`;
        ctx.shadowBlur = skin.glow;
      }
      ctx.fillStyle = grad;
      ctx.fill(path);
      ctx.restore();
    };

    if (reduced) {
      // no motion: one static, mid-level waveform (still a waveform, never
      // animated) — redrawn only if the speaking flag flips
      bars.fill(speaking ? 0.4 : 0);
      draw(0);
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking, skin]);

  return <canvas ref={ref} className="h-[72px] w-full" style={{ display: 'block' }} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// the voice's volume — the same popover pattern as the tour bar's music
// ---------------------------------------------------------------------------

function VoiceVolume({ skin }: { skin: PlayerSkin }) {
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
        style={{ borderColor: skin.line, color: vol > 0 ? skin.inkSoft : skin.inkFaint }}
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
          style={{ background: skin.popBg, borderColor: skin.line }}
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
            className="vc-range w-full"
            style={{ accentColor: skin.ink }}
            aria-label="Voice volume"
          />
          <div
            className="mt-1 flex items-center justify-between font-mono text-[9px] font-bold tracking-[0.1em]"
            style={{ color: skin.inkFaint }}
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
  const skin = usePlayerSkin();

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
    <section className="mt-16 sm:mt-20">
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
        {/* the voice card — a player object: near-black on dark pages,
            bone on light pages (its own fixed skin either way) */}
        <div
          className={`vc-skin flex flex-col rounded-2xl border p-5 shadow-2xl ${skin === P_DARK ? 'vc-skin--dark' : 'vc-skin--light'}`}
          style={{ borderColor: skin.line, background: skin.bg }}
          onPointerEnter={() => {
            hoverRef.current = true;
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
          }}
        >
          {/* row 1 — the line's title + the real-voice tag */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold leading-tight" style={{ color: skin.ink }}>
              {INTRO.title}
            </span>
            <span
              className="shrink-0 font-mono text-[9.5px] font-bold tracking-[0.14em]"
              style={{ color: skin.inkFaint }}
            >
              REAL VOICE
            </span>
          </div>

          {/* row 2 — one live line: the player's status, with a block
              cursor while he speaks (no caption streaming) */}
          <div className="mt-2 flex min-h-[18px] items-center gap-1.5">
            <span
              className="font-mono text-[11px] font-semibold tracking-[0.04em]"
              style={{ color: skin.inkSoft }}
            >
              {status}
            </span>
            {cursorOn && (
              <span
                className="caret inline-block h-[12px] w-[6px]"
                style={{ background: skin.ink }}
                aria-hidden="true"
              />
            )}
          </div>

          {/* row 3 — THE WAVEFORM: his actual voice, bar by bar, newest
              at the right — a live signal, not a looping animation */}
          <div className="mt-3 flex min-h-[96px] flex-1 items-center py-2">
            <VoiceWave speaking={playing} skin={skin} />
          </div>

          {/* row 4 — the transport */}
          <div
            className="mt-auto flex items-center gap-2.5 border-t pt-3.5"
            style={{ borderColor: skin.line }}
          >
            {/* his nameplate: avatar + name + state */}
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
              style={{ background: skin.avatarBg, borderColor: skin.line }}
              title="Orion — your guide"
            >
              <Belt color={skin.ink} size={14} />
            </span>
            <span className="font-mono text-[10px] font-extrabold tracking-[0.16em]" style={{ color: skin.ink }}>
              ORION · YOUR GUIDE
            </span>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[8.5px] font-extrabold tracking-[0.12em]"
              style={{ borderColor: skin.line, color: skin.inkSoft }}
            >
              NARRATED
            </span>
            {nstate === 'speaking' && (
              <span
                className="bd-pulse h-1.5 w-1.5 rounded-full"
                style={{ background: skin.live }}
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
                style={{ borderColor: skin.line, color: skin.inkSoft }}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <VoiceVolume skin={skin} />
              <span
                className="ml-1 hidden select-none font-mono text-[9px] font-bold tracking-[0.1em] sm:inline"
                style={{ color: skin.inkFaint }}
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
