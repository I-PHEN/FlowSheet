/**
 * useTourAudio — the audio engine behind a running tour.
 *
 * Refactored for the Learn merge: the hook no longer knows what a "tour"
 * or a "step index" is. It takes a SCRIPT (the exact text to narrate, or
 * null for silence) and an ACTIVE flag (is a tour on stage at all), and
 * does the rest:
 *
 *   - active + music pref  → the music bed runs (gentle fade-in/out)
 *   - script + voice pref  → the narrator speaks it; script changes cut
 *                            the old line and speak the new one; null
 *                            stops the voice
 *   - the music ducks under the voice and recovers between lines
 *   - voice and music toggle independently; the choice persists
 *
 * It is mounted ONCE per page by the tour director — never inside a
 * collapsible panel — so closing a panel can no longer silence a tour.
 * Browsers only allow audio after a user gesture, so tour entry points
 * still call unlockAudio() synchronously inside their click handlers.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
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

/** the narration script for a tour stop: "Stop title. Stop text." */
export function stepScript(step: { title: string; text: string }): string {
  return `${step.title}. ${step.text}`;
}

/**
 * @param script exact text to narrate, or null for silence
 * @param active whether a tour is on stage (drives the music bed)
 */
export function useTourAudio(script: string | null, active: boolean) {
  const [prefs, setPrefs] = useState<AudioPrefs>(() => ({ voice: true, music: true }));
  const [narration, setNarration] = useState<NarrationState>('idle');
  // prefs are read from localStorage after mount (SSR-safe), then applied;
  // `hydrated` is state (not a ref) so the narration effect below re-runs
  // once real prefs arrive — otherwise the first line would never speak
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPrefs(loadPrefs());
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const persist = useCallback((p: AudioPrefs) => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      /* storage disabled — session-only */
    }
  }, []);

  // narrator state → React + music ducking
  useEffect(() => {
    const unsubscribe = narrator.subscribe((s) => {
      setNarration(s);
      tourMusic.setDuck(s === 'speaking');
    });
    return unsubscribe;
  }, []);

  // music bed: runs while a tour is on stage (and the pref is on)
  useEffect(() => {
    if (active && prefs.music) void tourMusic.start();
    else tourMusic.stop();
    return () => {
      tourMusic.stop();
    };
  }, [active, prefs.music]);

  // narration: (re)speaks whenever the script changes or voice turns on
  useEffect(() => {
    if (!hydrated) return; // wait for real prefs
    if (!script || !prefs.voice) {
      narrator.stop();
      return;
    }
    void narrator.speak(script);
    return () => {
      narrator.stop();
    };
  }, [script, prefs.voice, hydrated]);

  // leaving the page entirely → silence everything
  useEffect(() => {
    return () => {
      narrator.stop();
      tourMusic.stop();
    };
  }, []);

  const toggleVoice = useCallback(() => {
    setPrefs((p) => {
      const next = { ...p, voice: !p.voice };
      if (p.voice) narrator.stop(); // turning OFF → cut current speech now
      persist(next);
      return next;
    });
  }, [persist]);

  const toggleMusic = useCallback(() => {
    setPrefs((p) => {
      const next = { ...p, music: !p.music };
      persist(next);
      return next;
    });
  }, [persist]);

  const replay = useCallback(() => {
    if (!prefs.voice || !script) return;
    void narrator.replay(script);
  }, [prefs.voice, script]);

  return { prefs, narration, toggleVoice, toggleMusic, replay };
}
