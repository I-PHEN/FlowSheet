'use client';

/**
 * MeetOrion — the guide gets a home on the landing page.
 *
 * The app's most human asset was invisible until you opened a plant. This
 * section markets him the only way this app knows how: by demonstration.
 * One button plays his introduction through the REAL voice pipeline — the
 * narrator singleton, /api/tts, and the sync law (useSyncedCaption) — so
 * the words on screen arrive exactly as he says them. Marketing by proof,
 * not by adjectives. No avatar, no waveform, no animation: his nameplate,
 * his voice, his synced words.
 *
 * Player semantics on ONE button: Hear Orion → Stop → Replay. Before the
 * first press the caption slot carries a one-line invite; Stop returns to
 * it (a half-frozen line would look broken in a card, and the invite is
 * the honest resting state). The voice cost is once — the narrator's blob
 * cache keeps his introduction forever after.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/lib/design/tokens';
import { Belt } from '@/components/learn/OrionMark';
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
    <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center">
      {/* the identity — the nameplate, the bio, the law of his tours */}
      <div>
        <div
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: C.inkSoft }}
        >
          Meet your guide
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span
            className="flex items-center gap-2 rounded-md px-3 py-1.5"
            style={{ background: C.nh3 }}
            title="Orion — your guide. Thirty years on the catwalks; he has run every plant in this simulator."
          >
            <Belt color={C.paper} size={16} />
            <span
              className="font-mono text-[13px] font-extrabold tracking-[0.18em]"
              style={{ color: C.paper }}
            >
              ORION
            </span>
          </span>
        </div>
        <p className="mt-3 text-[15px] font-bold leading-snug" style={{ color: C.ink }}>
          Thirty years on the catwalks. Now he lives in your browser.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-left text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
          <li>Every tour is his — one mechanism per stop, plain words, numbers only from the solve.</li>
          <li>Captions arrive as he speaks them; the voice is the clock.</li>
          <li>The same guide for every plant — prebuilt, AI-built, or yours.</li>
        </ul>
        <Link
          href="/plant/reference"
          className="group mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold"
          style={{ color: C.ink }}
        >
          Walk the reference plant with him
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      {/* the proof — his actual voice, synced by the real law */}
      <div
        className="rounded-2xl border p-5"
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
            ~25 SEC · REAL VOICE
          </span>
        </div>

        <div className="mt-3 min-h-[96px]">
          {!started ? (
            <p className="text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
              The same voice that walks you through every plant. Press play — the
              words arrive exactly as he says them.
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

        <div className="mt-3 flex min-h-10 items-center gap-3">
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
    </section>
  );
}
