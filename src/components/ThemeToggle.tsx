'use client';

/**
 * Light/dark theme toggle — the only theme control in the app. The choice
 * is remembered (localStorage via next-themes); first visit follows the
 * system preference.
 *
 * The icon/label read the APPLIED theme straight from the <html> class
 * (MutationObserver), not from next-themes' context state — the same DOM
 * attribute the CSS keys off — so the button can never disagree with what
 * is actually rendered. Moon = "switch to dark", sun = "switch to light".
 */

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { C } from '@/lib/design/tokens';

/** observes <html> class changes (next-themes flips it) */
function subscribeDark(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}

function useIsDark() {
  return useSyncExternalStore(
    subscribeDark,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
}

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const dark = useIsDark();
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="hover-band flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: C.bandLine, color: C.ink }}
    >
      {dark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
    </button>
  );
}
