/**
 * useTourAudio — the coordination layer that turns a guided tour into a
 * narrated, scored experience (for every plant — flash, ammonia, and the
 * distillation column to come).
 *
 * While a tour runs:
 *   - the music bed starts (gentle fade-in) and stops when the tour ends
 *   - each step's title + text are spoken by the narrator (TTS)
 *   - the music ducks under the voice and recovers between steps
 *   - the next step's audio is prefetched so transitions feel instant
 *   - voice and music can be toggled independently; the choice persists
 *
 * Browsers only allow audio after a user gesture, so tour entry points call
 * unlockAudio() synchronously inside their click handlers.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Tour } from '@/lib/content/units';
import { narrator, type NarrationState } from './narration';
import { tourMusic } from './music';

const PREFS_KEY = 'pfd.audio.prefs';

// dev-only probe: lets the browser test harness (and curious developers)
// inspect the narrator/music singletons from the console. Never in prod.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).__pfdAudio = { narrator, tourMusic };
}

export interface AudioPrefs {
  voice: boolean;
  music: boolean;
}

function loadPrefs(): AudioPrefs {
  if (typeof window === 'undefined') return { voice: true, music: true };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return { voice: p.voice !== false, music: p.music !== false };
    }
  } catch {
    /* corrupted prefs → defaults */
  }
  return { voice: true, music: true };
}

/** call synchronously from a click handler that is about to start audio */
export function unlockAudio(): void {
  void tourMusic.unlock();
}

/** the narration script for a tour step: "Step title. Step text." */
export function stepScript(step: { title: string; text: string }): string {
  return `${step.title}. ${step.text}`;
}

export function useTourAudio(tour: Tour, idx: number) {
  const [prefs, setPrefs] = useState<AudioPrefs>(() => ({ voice: true, music: true }));
  const [narration, setNarration] = useState<NarrationState>('idle');
  // prefs are read from localStorage after mount (SSR-safe), then applied;
  // `hydrated` is state (not a ref) so the narration effect below re-runs
  // once real prefs arrive — otherwise the first step would never speak
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPrefs(loadPrefs());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const savePrefs = useCallback((p: AudioPrefs) => {
    setPrefs(p);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      /* storage disabled — session-only */
    }
  }, []);

  // narrator state → React + music ducking (subscribe: the panel can be
  // mounted twice — desktop aside + mobile sheet — and both stay in sync)
  useEffect(() => {
    const unsubscribe = narrator.subscribe((s) => {
      setNarration(s);
      tourMusic.setDuck(s === 'speaking');
    });
    return unsubscribe;
  }, []);

  // music bed: runs while the tour runs (and the pref is on)
  useEffect(() => {
    if (prefs.music) void tourMusic.start();
    else tourMusic.stop();
    return () => {
      tourMusic.stop();
    };
  }, [prefs.music]);

  // narration: (re)speaks whenever the step changes or voice turns on
  const step = tour.steps[idx];
  const script = step ? stepScript(step) : '';
  useEffect(() => {
    if (!hydrated) return; // wait for real prefs
    if (!prefs.voice) {
      narrator.stop();
      return;
    }
    void narrator.speak(script);
    // warm the next step while this one plays
    const next = tour.steps[idx + 1];
    if (next) narrator.prefetch(stepScript(next));
    return () => {
      narrator.stop();
    };
  }, [script, prefs.voice, idx, tour.steps, hydrated]);

  // leaving the tour entirely → silence everything
  useEffect(() => {
    return () => {
      narrator.stop();
      tourMusic.stop();
    };
  }, []);

  const toggleVoice = useCallback(() => {
    savePrefs({ ...prefs, voice: !prefs.voice });
    if (prefs.voice) narrator.stop(); // turning OFF → cut current speech now
  }, [prefs, savePrefs]);

  const toggleMusic = useCallback(() => {
    savePrefs({ ...prefs, music: !prefs.music });
  }, [prefs, savePrefs]);

  const replay = useCallback(() => {
    if (!prefs.voice || !script) return;
    void narrator.replay(script);
  }, [prefs.voice, script]);

  return { prefs, narration, toggleVoice, toggleMusic, replay };
}
