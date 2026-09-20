'use client';

import { ThemeProvider } from 'next-themes';

/**
 * Class-based theming on <html>: "dark" (control room — the default; the
 * plant at 3am) or "light" (cool gray studio). All flowsheet tokens are
 * CSS variables in globals.css that flip with the class — see
 * src/lib/design/tokens.ts. Dark is the brand on first visit; the toggle
 * persists a choice.
 */

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
