'use client';

/**
 * useSyncedCaption — the caption law: the words ARRIVE with the voice.
 *
 * The narrator is the clock. While the voice speaks this caption's script,
 * the reveal is a pure function of REAL playback progress
 * (narrator.progress() = currentTime / duration): word k appears as the
 * voice reaches it, so captions can never outpace or trail the voice —
 * any voice, any speed, forever. The title's spoken share is the offset,
 * because the voice reads "Title. Text" but the bar shows the title as a
 * heading — the body starts revealing exactly when the voice starts
 * reading the body.
 *
 * Everything else is the honest behavior a paused video owes its viewer:
 *
 *   - voice warming (loading)  → the caption holds; it will not race ahead
 *   - paused mid-line          → the caption FREEZES where the voice cut
 *   - resumed / replayed       → the voice re-reads the line from the top,
 *                                the caption re-streams with it
 *   - voice off / failed       → the reveal completes at reading pace
 *   - voice finished the line  → the caption completes (a word spoken is a
 *                                word shown)
 *   - prefers-reduced-motion   → the whole caption, immediately
 *
 * The old fixed-pace law (~340 ms/word) streamed at 176 wpm while the
 * real voice speaks at ~100 wpm — captions finished twice as fast as
 * Orion could say them. This hook is the fix: the estimate is gone; the
 * audio element itself drives the reveal.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { narrator } from '@/lib/audio/narration';
import { toSpoken } from '@/lib/audio/spoken';
import { stepScript } from '@/lib/audio/tourAudio';
import { streamFor } from '@/lib/ui/tourDirector';

export interface SyncedCaption {
  /** the words visible so far */
  shown: string;
  /** true while the reveal is still running (drives the caret) */
  streaming: boolean;
}

/** how long a speaking voice with no readable duration may run before the
 *  timed estimate takes over (blob WAVs always expose duration — this is
 *  the belt-and-braces path) */
const NO_PROGRESS_GRACE_MS = 1500;

/** a caption's voice is considered finished when it read this much of it */
const ENDED_AT = 0.97;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function useSyncedCaption(
  stop: { title: string; text: string } | null,
  /** may the voice drive this caption (pref on, not failed/blocked)? */
  voiceLive: boolean,
  /** is a voice EXPECTED to start (guided pace)? then the caption waits for it */
  expectVoice: boolean,
): SyncedCaption {
  const title = stop?.title ?? '';
  const text = stop?.text ?? '';
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const [n, setN] = useState(0);
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // live flags without re-arming the loop: toggling voice or pausing
  // mid-caption must never rewind a caption that is already on screen.
  // (updated in an effect after every render — never during render)
  const liveRef = useRef({ voiceLive, expectVoice });
  useEffect(() => {
    liveRef.current = { voiceLive, expectVoice };
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced || !words.length) return; // full text is DERIVED below
    let raf = 0;

    // the exact script the narrator would speak for this caption
    const script = stepScript({ title, text });
    const perTimed = Math.max(16, streamFor(text, { voice: false }) / words.length);
    const perVoice = Math.max(16, streamFor(text, { voice: true }) / words.length);

    // SPOKEN ALIGNMENT — the voice reads the EXPANDED text (toSpoken):
    // "V-103" is one caption word but three spoken words of audio time,
    // "°C" is two. Weight every caption word by its spoken share so the
    // reveal tracks what the voice is actually saying, not just the raw
    // word count — chemistry-heavy lines would otherwise run ahead.
    const spokenWeight = (s: string) => Math.max(1, wordCount(toSpoken(s)));
    const titleSpoken = spokenWeight(title);
    const wordSpoken = words.map(spokenWeight);
    const spokenTotal = titleSpoken + wordSpoken.reduce((a, b) => a + b, 0);
    /** word k appears the moment the voice reaches it (spoken-weighted) */
    const fromProgress = (p: number) => {
      const v = p * spokenTotal; // where the voice is, in spoken words
      let shown = 0;
      let start = titleSpoken; // spoken position where caption word 0 begins
      for (let i = 0; i < words.length; i++) {
        if (v < start) break; // the voice has not reached this word yet
        shown = i + 1; // it has started (or finished) word i
        start += wordSpoken[i];
      }
      return shown;
    };

    // ---- per-caption driver state (all mutation lives inside rAF) ----
    let mode: 'wait' | 'voice' | 'frozen' | 'timed' | 'done' = 'wait';
    let count = 0; // the last count sent to React
    let voiceP: number | null = null; // last real progress while attached
    let attached = false; // was the voice on THIS script last tick?
    let noProgressT0: number | null = null; // speaking-but-no-duration since
    let timedT0 = 0; // when the timed law took over
    let timedBase = 0; // the count it took over from

    const tick = (t: number) => {
      const { voiceLive: live, expectVoice: expect } = liveRef.current;
      const on = narrator.scriptOn();
      const isAttached = live && on === script;
      let target = count;

      if (isAttached) {
        if (mode === 'wait' || mode === 'frozen' || mode === 'timed' || mode === 'done') {
          // fresh attachment — the voice (re)starts this line from the top
          attached = true;
          voiceP = null;
          noProgressT0 = null;
        }
        mode = 'voice';
        const p = narrator.progress();
        if (p != null) {
          noProgressT0 = null;
          voiceP = p;
          target = fromProgress(p);
        } else if (narrator.state === 'speaking') {
          // speaking but duration unreadable — give it a grace, then estimate
          if (noProgressT0 == null) noProgressT0 = t;
          if (t - noProgressT0 > NO_PROGRESS_GRACE_MS) {
            target = Math.min(words.length, Math.floor((t - noProgressT0) / perVoice) + 1);
          }
        }
        // loading → hold exactly where we are; the voice is coming
      } else {
        if (attached) {
          // the voice just left this caption
          attached = false;
          if (voiceP != null && voiceP >= ENDED_AT) {
            mode = 'done'; // it read the line out — every word is said
            target = words.length;
          } else if (!live || count === 0) {
            mode = 'timed'; // voice gone/blocked, or nothing to freeze
            timedT0 = t;
            timedBase = count;
          } else {
            mode = 'frozen'; // paused mid-line — freeze like a paused video
          }
        }
        if (mode === 'wait' && !expect) {
          // no voice is coming for this caption (roam / voice off) — read it
          mode = 'timed';
          timedT0 = t;
          timedBase = 0;
        }
        if (mode === 'frozen' && !live) {
          // voice died mid-caption (toggled off / failed) — finish revealing
          mode = 'timed';
          timedT0 = t;
          timedBase = count;
        }
      }

      if (mode === 'timed') {
        target = Math.min(words.length, timedBase + Math.floor((t - timedT0) / perTimed) + 1);
        if (target >= words.length) mode = 'done';
      }
      if (mode === 'done') target = words.length;

      if (target !== count) {
        count = target;
        setN(count); // inside the rAF callback — never during the effect
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [title, text, words.length, reduced]);

  const k = reduced || !words.length ? words.length : n;
  return {
    shown: words.slice(0, k).join(' '),
    streaming: k > 0 && k < words.length,
  };
}
