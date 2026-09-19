/**
 * camera.ts — the one camera choreography every canvas shares.
 *
 * A "view" is an SVG viewBox (x, y, w, h in world units). Flying is just
 * interpolating between two views with an ease-out curve — the same math
 * the reference canvas has used since the beginning, extracted so the
 * builder canvas (and the Learn-mode tour camera) speaks the identical
 * language. Pure functions below are directly unit-tested; `tweenView` is
 * the thin rAF wrapper.
 *
 * Cancellation contract: any user interaction (drag, wheel, pinch) calls
 * the returned cancel() so a flight never fights the user for the camera.
 */

/** an SVG viewBox — world rectangle the canvas shows */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** cubic ease-out: fast departure, soft landing — the "camera settles" feel */
export function easeOutCubic(p: number): number {
  const q = Math.max(0, Math.min(1, p));
  return 1 - Math.pow(1 - q, 3);
}

/** pure interpolation between two views (no clock, no DOM) */
export function lerpView(a: View, b: View, e: number): View {
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    w: a.w + (b.w - a.w) * e,
    h: a.h + (b.h - a.h) * e,
  };
}

/**
 * Fly from `from` to `to` over `ms` milliseconds, calling `onUpdate` each
 * frame. Returns a cancel function — call it on user interaction or when a
 * new flight supersedes this one. Reduced-motion users get the destination
 * immediately (the journey IS the destination for them).
 */
export function tweenView(
  from: View,
  to: View,
  opts: { ms?: number; onUpdate: (v: View) => void },
): () => void {
  const ms = opts.ms ?? 560;
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (ms <= 0 || reduced) {
    opts.onUpdate(to);
    return () => {};
  }
  let raf = 0;
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / ms);
    opts.onUpdate(lerpView(from, to, easeOutCubic(p)));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
