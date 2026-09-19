'use client';

/**
 * useTourDirector — the one brain behind the Learn mode.
 *
 * The Learn merge in one line: the tour script already IS the content
 * model — every TourStep is simultaneously a caption, a narration script,
 * and a camera target. The director plays that script in two paces:
 *
 *   GUIDED (cinema)  — camera flies stop → stop, captions stream in the
 *                      bottom bar, the narrator speaks each stop, and the
 *                      tour advances itself when the voice finishes (with
 *                      a reading-time dwell when voice is off).
 *   ROAM  (paused)   — the user clicked something. The camera flies to
 *                      what they clicked; a caption card appears (the
 *                      authored stop if the click matches one, otherwise a
 *                      synthesized caption); narration is optional (🔊).
 *                      Resume returns to the guided thread where it left.
 *
 * Architecture rules that make this durable:
 *   - The director is mounted ONCE PER PAGE, never inside a collapsible
 *     panel — so closing a panel can no longer kill narration.
 *   - Camera intent is DATA ({ kind: 'fly' | 'fit', seq }): each surface
 *     maps it to its own canvas (reference panTo / builder flyToRef), so
 *     the director never knows which canvas it is driving.
 *   - Everything depends on the graph + script, never on a solve —
 *     conceptual plants (no engine) will get Learn on day one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ref, Tour } from '@/lib/content/units';
import { narrator } from '@/lib/audio/narration';
import { stepScript, useTourAudio, unlockAudio } from '@/lib/audio/tourAudio';
import { setTourActive } from '@/lib/ui/tourBus';

export type Pace = 'guided' | 'roam';

/** what the caption bar shows right now */
export interface DirectorStop {
  ref: Ref;
  title: string;
  text: string;
  /** authored tour stop vs synthesized roam caption */
  source: 'stop' | 'synth';
  /** position in the tour when source === 'stop' */
  idx: number | null;
}

/** data-only camera command — surfaces map this to their own canvas */
export type CamIntent =
  | { kind: 'fly'; ref: Ref; seq: number }
  | { kind: 'fit'; seq: number };

/** a synthesized roam caption (page-provided: unit stories, registry facts) */
export interface RoamCaption {
  title: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/** the stop index for a ref, or −1 — a click that lands on a stop jumps to it */
export function findStopIndex(tour: Tour, ref: Ref): number {
  for (let i = 0; i < tour.steps.length; i++) {
    if (tour.steps[i].ref.type === ref.type && tour.steps[i].ref.id === ref.id) return i;
  }
  return -1;
}

/** dwell time when nobody is reading aloud: ~270 ms per word, gently clamped */
export function dwellFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(14000, 2600 + words * 270);
}

/** the stop to show, given the tour state (pure) */
export function resolveStop(
  tour: Tour | null,
  idx: number,
  roamStop: DirectorStop | null,
): DirectorStop | null {
  if (!tour) return null;
  if (roamStop) return roamStop;
  const step = tour.steps[idx];
  if (!step) return null;
  return { ref: step.ref, title: step.title, text: step.text, source: 'stop', idx };
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export function useTourDirector(synthesize?: (ref: Ref) => RoamCaption | null) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [idx, setIdx] = useState(0);
  const [pace, setPace] = useState<Pace>('guided');
  const [playing, setPlaying] = useState(true);
  const [roamStop, setRoamStop] = useState<DirectorStop | null>(null);
  const [cam, setCam] = useState<CamIntent | null>(null);
  const seqRef = useRef(0);

  const fly = useCallback((ref: Ref) => {
    setCam({ kind: 'fly', ref, seq: ++seqRef.current });
  }, []);
  const fit = useCallback(() => {
    setCam({ kind: 'fit', seq: ++seqRef.current });
  }, []);

  // ---- thread control -----------------------------------------------------

  const start = useCallback(
    (t: Tour, at = 0) => {
      unlockAudio(); // audio needs a user gesture — the click that got us here
      const i = Math.max(0, Math.min(t.steps.length - 1, at));
      setTour(t);
      setIdx(i);
      setPace('guided');
      setPlaying(true);
      setRoamStop(null);
      const step = t.steps[i];
      if (step) fly(step.ref);
    },
    [fly],
  );

  const end = useCallback(() => {
    if (!tour) return; // nothing to end — don't yank the camera either
    setTour(null);
    setRoamStop(null);
    fit();
  }, [tour, fit]);

  const jump = useCallback(
    (i: number) => {
      if (!tour) return;
      const c = Math.max(0, Math.min(tour.steps.length - 1, i));
      setIdx(c);
      setPace('guided'); // jumping is a thread action — playback continues
      setPlaying(true);
      setRoamStop(null);
      const step = tour.steps[c];
      if (step) fly(step.ref);
    },
    [tour, fly],
  );

  const next = useCallback(() => {
    if (!tour) return;
    if (idx >= tour.steps.length - 1) end();
    else jump(idx + 1);
  }, [tour, idx, jump, end]);

  const prev = useCallback(() => {
    if (!tour) return;
    jump(Math.max(0, idx - 1));
  }, [tour, idx, jump]);

  const pause = useCallback(() => {
    setPace('roam');
    setPlaying(false); // pause = silence, like any video
  }, []);

  const resume = useCallback(() => {
    setPace('guided');
    setPlaying(true);
    setRoamStop(null);
    if (tour) {
      const step = tour.steps[idx];
      if (step) fly(step.ref);
    }
  }, [tour, idx, fly]);

  /** free roam: the user clicked something on the sheet */
  const roamTo = useCallback(
    (ref: Ref) => {
      if (!tour) return;
      setPace('roam');
      setPlaying(false);
      const hit = findStopIndex(tour, ref);
      if (hit >= 0) {
        // the click landed on an authored stop — show it, thread stays there
        setIdx(hit);
        setRoamStop(null);
      } else {
        const made = synthesize?.(ref) ?? null;
        setRoamStop(
          made
            ? { ref, title: made.title, text: made.text, source: 'synth', idx: null }
            : {
                ref,
                title: ref.id,
                text: `No written stop for this one yet — the tour continues from “${tour.steps[idx]?.title ?? 'the start'}”. Resume whenever you are ready.`,
                source: 'synth',
                idx: null,
              },
        );
      }
      fly(ref);
    },
    [tour, idx, synthesize],
  );

  /** roam: narrate the card on the screen (optional by design) */
  const speakCurrent = useCallback(() => {
    const stop = resolveStop(tour, idx, roamStop);
    if (stop) void narrator.replay(stepScript(stop));
  }, [tour, idx, roamStop]);

  // ---- derived state -------------------------------------------------------

  const stop = useMemo(() => resolveStop(tour, idx, roamStop), [tour, idx, roamStop]);
  const script = tour && playing && pace === 'guided' && tour.steps[idx]
    ? stepScript(tour.steps[idx])
    : null;

  // audio is owned HERE, at page level — panels may come and go
  const audio = useTourAudio(script, tour !== null);

  // publish tour state for the floating Build button (ducks while narrating)
  useEffect(() => {
    setTourActive(tour !== null);
    return () => setTourActive(false);
  }, [tour]);

  // ---- auto-advance (the guided thread) -------------------------------------

  const advanceRef = useRef({ idx, pace, playing, tourLen: tour?.steps.length ?? 0 });
  useEffect(() => {
    advanceRef.current = { idx, pace, playing, tourLen: tour?.steps.length ?? 0 };
  }, [idx, pace, playing, tour]);
  const timerRef = useRef<number | null>(null);
  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const advance = useCallback(() => {
    const s = advanceRef.current;
    if (s.pace !== 'guided' || !s.playing) return; // the user took over
    if (s.idx >= s.tourLen - 1) end();
    else jump(s.idx + 1);
  }, [jump, end]);

  // voice path: advance ~0.7 s after the narrator finishes a line
  const prevNarr = useRef<string>('idle');
  useEffect(() => {
    const unsub = narrator.subscribe((s) => {
      const from = prevNarr.current;
      prevNarr.current = s;
      if (s === 'idle' && from === 'speaking') {
        clearTimer();
        timerRef.current = window.setTimeout(advance, 700);
      }
    });
    return unsub;
  }, [advance]);
  useEffect(() => () => clearTimer(), []);

  // dwell path: voice off (or TTS failed/blocked) → reading-time dwell
  useEffect(() => {
    if (!tour || pace !== 'guided' || !playing) return;
    const step = tour.steps[idx];
    if (!step) return;
    const voiceOff =
      !audio.prefs.voice || audio.narration === 'error' || audio.narration === 'blocked';
    if (!voiceOff) return; // the voice path owns advancement
    clearTimer();
    timerRef.current = window.setTimeout(advance, dwellFor(stepScript(step)));
    return clearTimer;
  }, [tour, idx, pace, playing, audio.prefs.voice, audio.narration, advance]);

  // ---- keyboard (capture phase — the canvas never sees these) --------------

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') {
        next();
      } else if (e.key === 'ArrowLeft') {
        prev();
      } else if (e.key === ' ') {
        if (t && t.tagName === 'BUTTON') return; // space clicks the focused button
        e.preventDefault();
        if (pace === 'guided' && playing) pause();
        else resume();
      } else if (e.key === 'Escape') {
        end();
      } else {
        return;
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour, pace, playing, next, prev, pause, resume, end]);

  return {
    // state
    tour,
    idx,
    pace,
    playing,
    stop,
    cam,
    audio,
    // thread control
    start,
    end,
    jump,
    next,
    prev,
    pause,
    resume,
    roamTo,
    speakCurrent,
  };
}

export type TourDirector = ReturnType<typeof useTourDirector>;
