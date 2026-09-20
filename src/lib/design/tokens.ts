/**
 * Flowsheet design tokens — light "cool gray studio", dark "charcoal".
 *
 * NO BRAND COLOR IN THE CHROME. Action buttons are a neutral surface:
 * WHITE with dark text in light, DARK CHARCOAL with light text in dark
 * (C.accent + C.onAccent + C.accentLine — never inverted, never green).
 * Green (nh3) appears ONLY as chemistry & state on the flowsheet canvas:
 * product streams, PASS verdicts, good deltas. Dark surfaces are neutral
 * charcoal grays (no blue tint) floating on a true-black canvas. No
 * gradients, no glows, no shadows on the diagram itself — the one
 * exception: flow-dot halos in the dark theme (see FlowLayer's
 * `.flow-halo`).
 *
 * Every value is a CSS custom property reference resolved in globals.css
 * (`:root` = light palette, `.dark` = dark palette). SVG presentation
 * ATTRIBUTES (fill=, stroke=) cannot resolve var(), so all color usage must
 * go through inline `style` props — see Diagram.tsx / Symbols.tsx.
 *
 * Both palettes are WCAG-proven by scripts/task43-contrast-audit.ts;
 * values below are kept as documentation; globals.css is the source of
 * truth for what actually renders.
 */

export const C = {
  /** canvas background — light: #EEF1F4 cool gray · dark: #000000 true black (the void) */
  canvas: 'var(--fs-canvas)',
  /** the drawing sheet — the ONE box the whole flowsheet lies on — light: #E9EDF1 · dark: #141417 */
  sheet: 'var(--fs-sheet)',
  /** section band fill (one step off canvas) — light: #E5EAEE · dark: #131315 */
  band: 'var(--fs-band)',
  /** section band hairline border — light: #D2DAE1 · dark: #2C2C2F (clear, neutral) */
  bandLine: 'var(--fs-band-line)',
  /** equipment fill / panel surface — light: #FAFBFC · dark: #1A1A1D */
  paper: 'var(--fs-paper)',
  /** translucent paper (legend chip) — light: rgba(250,251,252,.95) · dark: rgba(26,26,29,.95) */
  paperA95: 'var(--fs-paper-a95)',
  /** primary linework, tags, labels — light: #1D242C · dark: #ECECEE */
  ink: 'var(--fs-ink)',
  /** secondary labels (unit names, annotations) — light: #414D59 · dark: #A7A8AC */
  inkSoft: 'var(--fs-ink-soft)',
  /** tertiary (dashed utilities, footnotes) — light: #5C6873 · dark: #818287 */
  inkFaint: 'var(--fs-ink-faint)',
  /** emphasis halo behind a selected unit — light: #DCE4EA · dark: #232326 */
  halo: 'var(--fs-halo)',
  /** hover tooltip shadow (theme-tinted) */
  tipShadow: 'var(--fs-tip-shadow)',

  // ---- the action surface (neutral — there is no brand color in the chrome) ----
  /** action buttons, active toggles, nameplates — light: #FFFFFF white · dark: #28282C charcoal */
  accent: 'var(--fs-accent)',
  /** text/ink on the action surface — light: #1D242C dark · dark: #F2F2F4 light.
   *  Every action button pairs accent bg + onAccent text + accentLine
   *  border, so buttons read white-in-light / dark-in-dark — never
   *  inverted, never green (the owner's law). */
  onAccent: 'var(--fs-on-accent)',
  /** hairline border for the action surface — light: #C6CDD4 · dark: #3E3E42 */
  accentLine: 'var(--fs-accent-line)',

  // ---- service hues (muted, textbook-ish; brightened for dark) ----
  /** feeds: natural gas, steam, air — light: #82653A ochre · dark: #C9A05C amber */
  feed: 'var(--fs-feed)',
  /** process gas: syngas + loop gas — light: #3D5A76 steel · dark: #7FA3C2 steel-blue */
  gas: 'var(--fs-gas)',
  /** liquid ammonia product (SEMANTIC, not brand — verdicts & product streams) — light: #377454 · dark: #6FAE8C sage */
  nh3: 'var(--fs-nh3)',
  /** sulphur-bearing product streams (Claus family dot tint) — light: #7E6326 gold · dark: #D4B05A */
  sulfur: 'var(--fs-sulfur)',
  /** utilities & offgas: water, CO2, purge (dashed) — light: #5C6873 · dark: #8A939C */
  utility: 'var(--fs-utility)',
  /** advisory notes in panels — light: #8F5B2B · dark: #D89B5C */
  warn: 'var(--fs-warn)',
  /** failed verdicts (critic FAIL) — light: #B3452F rust · dark: #E0785F coral */
  fail: 'var(--fs-fail)',
} as const;

/** stream class → service color + dash pattern */
export const STREAM_STYLE: Record<string, { color: string; dash?: string }> = {
  feed: { color: C.feed },
  syngas: { color: C.gas },
  loopgas: { color: C.gas },
  product: { color: C.nh3 },
  water: { color: C.utility, dash: '7 5' },
  co2: { color: C.utility, dash: '7 5' },
  purge: { color: C.utility, dash: '7 5' },
};

export const FONT = {
  /** SVG text sizes in world units (canvas is 1800×880) */
  tag: 13,
  name: 9.5,
  annotation: 11,
  bandLabel: 13,
  pill: 11,
} as const;

export const DIAGRAM_STROKE = 2.4;
export const STREAM_W = 2.6;
export const STREAM_W_HI = 4.4;
