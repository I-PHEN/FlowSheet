'use client';

/**
 * TopBar — the landing page's one bar of chrome.
 *
 * Glass, not paper (reviewer round 68): sticky at the top, frosted over
 * the blueprint desk — the blur catches the dot grid scrolling beneath it
 * — and hairlined at low opacity. A shadow appears ONLY once content has
 * passed under the bar (a scroll listener toggles `topbar--scrolled`),
 * so it reads as floating glass at rest and as a raised surface in motion.
 *
 * The rest of the bar is unchanged law: Flowsheet wordmark + the identity
 * line, and the theme toggle. SSR renders the unscrolled state; the class
 * is added post-mount only, so hydration can never mismatch.
 */

import { useEffect, useState } from 'react';
import { C } from '@/lib/design/tokens';
import { ThemeToggle } from '@/components/ThemeToggle';

export function TopBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll(); // a refresh mid-page must start raised, not flat
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`topbar sticky top-0 z-50 flex h-[58px] shrink-0 items-center justify-between px-5 ${
        scrolled ? 'topbar--scrolled' : ''
      }`}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="text-[15px] font-extrabold tracking-tight" style={{ color: C.ink }}>
          Flowsheet
        </span>
        <span className="hidden text-[11.5px] font-semibold tracking-wide sm:inline" style={{ color: C.inkFaint }}>
          AI-NATIVE PROCESS SIMULATOR
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
}
