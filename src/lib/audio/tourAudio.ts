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

import { useCallback, useEffect, useRef, useState } from 'react';
import { narrator, type NarrationState } from './narration';
import { tourMusic } from './music';

const PREFS_KEY = 'pfd.audio.prefs';

/** the bed's default level — audible, clearly under the voice */
const DEFAULT_MUSIC = 0.5;

// dev-only probe: lets the browser test harness (and curious developers)
// inspect the narrator/music singletons from the console. Never in prod.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).__pfdAudio = { narrator, tourMusic };
}

export interface AudioPrefs {
  voice: boolean;
  /** the music bed's level, 0..1 — 0 IS music-off. Replaces the old
   *  boolean `music` pref (off migrates to 0, on to the stored level or
   *  the default) so the bed is a volume the listener owns, not a switch. */
  musicLevel: number;
}

function loadPrefs(): AudioPrefs {
  if (typeof window === 'undefined') return { voice: true, musicLevel: DEFAULT_MUSIC };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs> & { music?: unknown };
      let musicLevel = DEFAULT_MUSIC;
      if (typeof p.musicLevel === 'number' && Number.isFinite(p.musicLevel)) {
        musicLevel = Math.max(0, Math.min(1, p.musicLevel));
      } else if (p.music === false) {
        musicLevel = 0; // the old on/off pill: "off" was a level of zero
      }
      return { voice: p.voice !== false, musicLevel };
    }
  } catch {
    /* corrupted prefs → defaults */
  }
  return { voice: true, musicLevel: DEFAULT_MUSIC };
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
  const [prefs, setPrefs] = useState<AudioPrefs>(() => ({ voice: true, musicLevel: DEFAULT_MUSIC }));
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

  // music bed: runs while a tour is on stage and the level is above zero.
  // The on/off effect depends ONLY on the derived boolean — dragging the
  // level while the bed plays retargets the master gain (the level effect
  // below) instead of restarting the track, so a slider is a glide.
  // `musicOn` also gates the initial fade-in target through levelRef.
  const musicOn = prefs.musicLevel > 0;
  const levelRef = useRef(prefs.musicLevel);
  useEffect(() => {
    levelRef.current = prefs.musicLevel;
  }, [prefs.musicLevel]);
  useEffect(() => {
    if (active && musicOn) {
      tourMusic.setLevel(levelRef.current); // the fade-in's target, set before start
      void tourMusic.start();
    } else tourMusic.stop();
    return () => {
      tourMusic.stop();
    };
  }, [active, musicOn]);
  useEffect(() => {
    tourMusic.setLevel(prefs.musicLevel);
  }, [prefs.musicLevel]);

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

  const setMusicLevel = useCallback(
    (v: number) => {
      setPrefs((p) => {
        const next = { ...p, musicLevel: Math.max(0, Math.min(1, v)) };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const replay = useCallback(() => {
    if (!prefs.voice || !script) return;
    void narrator.replay(script);
  }, [prefs.voice, script]);

  return { prefs, narration, toggleVoice, setMusicLevel, replay };
}
