'use client';

/**
 * BuildFab — the standing invitation.
 *
 * "Build a plant with AI" is one keystroke away on every page: a pill in
 * the corner that follows the user down every scroll. It steps aside
 * (ducks) while a narrated tour is speaking, disappears entirely on the
 * builder page — you're already there — and pulses exactly once per
 * browser, the first visit, then never bothers anyone again.
 *
 * Keyboard: B opens the builder (unless you're typing).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { C } from '@/lib/design/tokens';
import { onTourChange } from '@/lib/ui/tourBus';

const PULSED_KEY = 'fs.fab.pulsed';

export function BuildFab() {
  const pathname = usePathname();
  const [pulsed, setPulsed] = useState(true); // SSR-safe: assume yes
  const [ducked, setDucked] = useState(false);

  useEffect(() => {
    // one-time pulse flag — read/written off the render path (rAF)
    const id = requestAnimationFrame(() => {
      try {
        if (!window.localStorage.getItem(PULSED_KEY)) {
          setPulsed(false);
          window.localStorage.setItem(PULSED_KEY, '1');
        }
      } catch {
        /* storage disabled — never pulse, never crash */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    return onTourChange(setDucked);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'b' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      window.location.href = '/plant/builder';
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (pathname === '/plant/builder') return null;

  return (
    <Link
      href="/plant/builder"
      aria-label="Build a plant with AI (keyboard: B)"
      title="Build a plant with AI (B)"
      className={`fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full border px-4 text-[13px] font-bold tracking-tight transition-all duration-300 sm:bottom-6 sm:right-6 ${
        pulsed ? '' : 'fab-pulse'
      }`}
      style={{
        borderColor: C.ink,
        background: C.ink,
        color: C.canvas,
        opacity: ducked ? 0.55 : 1,
        transform: ducked ? 'translateY(10px) scale(0.92)' : 'none',
        pointerEvents: ducked ? 'none' : 'auto',
        boxShadow: '0 6px 24px rgb(0 0 0 / 18%)',
      }}
    >
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold"
        style={{ background: C.canvas, color: C.ink }}
        aria-hidden="true"
      >
        ✦
      </span>
      <span className="hidden sm:inline">Build with AI</span>
    </Link>
  );
}
