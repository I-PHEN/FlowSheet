'use client';

/**
 * useStreamedText — reveal a caption word-by-word over `durationMs`.
 *
 * The caption law behind the CinemaBar: Orion's captions ARRIVE as he speaks
 * them, like a live transcript — never printed onto the screen all at once.
 *
 *   - resets when the text changes (each tour stop remounts the caption);
 *   - rAF-driven, so the reveal is smooth and pauses with hidden tabs;
 *   - the duration is snapshotted at mount: toggling voice mid-stop must
 *     never restart or rewind a caption that is already on screen;
 *   - prefers-reduced-motion → the full text, immediately (no theatre).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface StreamedText {
  /** the words visible so far */
  shown: string;
  /** true while the reveal is still running (drives the caret) */
  streaming: boolean;
}

export function useStreamedText(text: string, durationMs: number): StreamedText {
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const [n, setN] = useState(0);
  // matched lazily on first client render; the listener keeps it live
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // snapshot PER CAPTION — the pace a caption starts at is the pace it keeps
  // (voice toggles / narration state changes mid-caption must never rewind
  // it). The hook lives in the bar, which does NOT remount per stop, so the
  // snapshot is refreshed exactly when the text changes.
  const durRef = useRef(durationMs);
  const lastTextRef = useRef(text);
  if (lastTextRef.current !== text) {
    lastTextRef.current = text;
    durRef.current = durationMs;
  }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced || !words.length) return; // full text is DERIVED below
    let raf = 0;
    const per = Math.max(16, durRef.current / words.length);
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(words.length, Math.floor((t - t0) / per) + 1);
      setN(k); // inside the rAF callback — never during the effect itself
      if (k < words.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, words.length, reduced]);

  // reduced motion / empty text → the whole caption, no theatre
  const k = reduced || !words.length ? words.length : n;
  return {
    shown: words.slice(0, k).join(' '),
    streaming: k > 0 && k < words.length,
  };
}
