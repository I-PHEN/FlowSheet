'use client';

import { ThemeProvider } from 'next-themes';

/**
 * Class-based theming on <html>: "light" (soft gray studio, default) or
 * "dark" (dark studio textbook). All flowsheet tokens are CSS variables in
 * globals.css that flip with the class — see src/lib/design/tokens.ts.
 * First visit follows the system preference; the toggle persists a choice.
 */

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
