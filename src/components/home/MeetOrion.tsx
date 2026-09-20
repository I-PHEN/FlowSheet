'use client';

/**
 * MeetOrion — the guide gets a home on the landing page.
 *
 * The app's most human asset was invisible until you opened a plant. This
 * section markets him the only way this app knows how: by demonstration —
 * and with almost no words. One line of identity (his nameplate and the
 * bio), then two PROOF cards side by side:
 *
 *   his voice   — press play, his introduction plays through the real
 *                 pipeline (narrator singleton → /api/tts → the sync law),
 *                 the words arriving exactly as he says them
 *   the plant   — the light 3D card: the real viewer, drag to orbit,
 *                 cut the exchanger open
 *
 * Player semantics on ONE button: Hear Orion → Stop → Replay. Before the
 * first press the caption slot carries a one-line invite; Stop returns to
 * it. The voice cost is once — the narrator's blob cache keeps his
 * introduction forever after.
 */

import { useEffect, useState } from 'react';
import { C } from '@/lib/design/tokens';
import { Belt } from '@/components/learn/OrionMark';
import { ModelCard } from '@/components/home/ModelCard';
import { narrator, type NarrationState } from '@/lib/audio/narration';
import { useSyncedCaption } from '@/lib/ui/useSyncedCaption';
import { stepScript } from '@/lib/audio/tourAudio';

/** his introduction — written to the ORION_VOICE spec (plain words,
 *  operator senses, introduces himself by name once, no formulas) */
const INTRO = {
  title: 'Welcome to the plant',
  text: "Name's Orion. Thirty years on the catwalks — I've heard every pump about to give, and smelled every leak that mattered. Walk with me, and I'll show you what every unit does for your plant.",
};
const SCRIPT = stepScript(INTRO);

export function MeetOrion() {
  const [nstate, setNstate] = useState<NarrationState>('idle');
  const [started, setStarted] = useState(false);

  useEffect(() => narrator.subscribe(setNstate), []);

  // leaving the page cuts his line — the singleton must not outlive the card
  useEffect(
    () => () => {
      if (narrator.scriptOn() === SCRIPT) narrator.stop();
    },
    [],
  );

  // the sync law: the voice is the clock (the caption only exists once
  // started — before that there is nothing to reveal)
  const voiceLive = started && (nstate === 'loading' || nstate === 'speaking');
  const { shown, streaming } = useSyncedCaption(
    started ? INTRO : null,
    voiceLive,
    voiceLive,
  );

  const playing = nstate === 'loading' || nstate === 'speaking';
  // started && idle ⇒ the voice ran to its end (manual stop resets `started`)
  const finished = started && nstate === 'idle';

  const label = !started || finished ? (started ? '↺ Replay' : '▶ Hear Orion') : '■ Stop';
  const hint = playing
    ? nstate === 'loading'
      ? 'warming the voice…'
      : ''
    : nstate === 'error'
      ? 'voice unavailable — reading it instead'
      : nstate === 'blocked'
        ? 'tap replay to let him speak'
        : '';

  const onButton = () => {
    if (playing) {
      narrator.stop(); // back to the resting invite — no half-frozen lines
      setStarted(false);
    } else {
      setStarted(true); // replay and first press both re-stream from word 1
      void narrator.replay(SCRIPT);
    }
  };

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
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1"
          style={{ background: C.nh3 }}
          title="Orion — your guide. Thirty years on the catwalks; he has run every plant in this simulator."
        >
          <Belt color={C.paper} />
          <span
            className="font-mono text-[11px] font-extrabold tracking-[0.16em]"
            style={{ color: C.paper }}
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
        {/* the voice card */}
        <div
          className="flex flex-col rounded-2xl border p-5"
          style={{ borderColor: C.bandLine, background: C.paper }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-mono text-[9.5px] font-bold tracking-[0.14em]"
              style={{ color: C.inkSoft }}
            >
              ORION&rsquo;S INTRODUCTION
            </span>
            <span
              className="font-mono text-[9.5px] font-bold tracking-[0.14em]"
              style={{ color: C.inkFaint }}
            >
              REAL VOICE
            </span>
          </div>

          <div className="mt-3 min-h-[96px]">
            {!started ? (
              <p className="text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
                Press play — the words arrive as he speaks.
              </p>
            ) : (
              <>
                <div className="text-[13px] font-bold leading-tight" style={{ color: C.ink }}>
                  {INTRO.title}
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: C.ink }}>
                  {shown}
                  {streaming && <span className="caret" />}
                </p>
              </>
            )}
          </div>

          <div className="mt-auto flex min-h-10 items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onButton}
              className="flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-[13px] font-bold"
              style={{ background: C.ink, color: C.canvas }}
            >
              {label}
            </button>
            <span className="text-[11px] leading-tight" style={{ color: C.inkFaint }}>
              {hint}
            </span>
          </div>
        </div>

        {/* the plant card — the light 3D */}
        <ModelCard />
      </div>
    </section>
  );
}
