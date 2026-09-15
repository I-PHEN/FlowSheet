/**
 * Flowsheet design tokens — "soft gray studio" in light, "dark studio
 * textbook" in dark.
 *
 * One canvas, one ink, four muted service hues. Ink is the highest-contrast
 * element on screen in BOTH themes (light: ~12.9:1, dark: ~14:1). No
 * gradients, no glows, no shadows on the diagram itself.
 *
 * Every value is a CSS custom property reference resolved in globals.css
 * (`:root` = light palette, `.dark` = dark palette). SVG presentation
 * ATTRIBUTES (fill=, stroke=) cannot resolve var(), so all color usage must
 * go through inline `style` props — see Diagram.tsx / Symbols.tsx.
 *
 * Light values are kept below as documentation; globals.css is the source
 * of truth for what actually renders.
 */

export const C = {
  /** canvas background — light: #F1F0ED warm gray · dark: #1F1E1C warm charcoal */
  canvas: 'var(--fs-canvas)',
  /** the drawing sheet — the ONE box the whole flowsheet lies on — light: #E9E7E1 · dark: #2C2B27 */
  sheet: 'var(--fs-sheet)',
  /** section band fill (one step off canvas) — light: #E9E7E1 · dark: #262523 */
  band: 'var(--fs-band)',
  /** section band hairline border — light: #DBD8D0 · dark: #3B3A36 */
  bandLine: 'var(--fs-band-line)',
  /** equipment fill / panel surface — light: #FCFBF9 · dark: #2A2926 */
  paper: 'var(--fs-paper)',
  /** translucent paper (legend chip) — light: rgba(252,251,249,.95) · dark: rgba(42,41,38,.95) */
  paperA95: 'var(--fs-paper-a95)',
  /** primary linework, tags, labels — light: #26282B · dark: #EDEBE6 */
  ink: 'var(--fs-ink)',
  /** secondary labels (unit names, annotations) — light: #5A5D62 · dark: #A9A79F */
  inkSoft: 'var(--fs-ink-soft)',
  /** tertiary (dashed utilities, footnotes) — light: #8B8E93 · dark: #807E77 */
  inkFaint: 'var(--fs-ink-faint)',
  /** emphasis halo behind a selected unit — light: #D9D5CB · dark: #37352E */
  halo: 'var(--fs-halo)',
  /** hover tooltip shadow (theme-tinted) */
  tipShadow: 'var(--fs-tip-shadow)',

  // ---- service hues (4, muted, textbook-ish; brightened for dark) ----
  /** feeds: natural gas, steam, air — light: #7A5E33 ochre · dark: #C9A66B amber */
  feed: 'var(--fs-feed)',
  /** process gas: syngas + loop gas — light: #3A5268 steel · dark: #8FB2CF */
  gas: 'var(--fs-gas)',
  /** liquid ammonia product — light: #3F6B4F green · dark: #85BD9A sage */
  nh3: 'var(--fs-nh3)',
  /** utilities & offgas: water, CO2, purge (dashed) — light: #8B8E93 · dark: #96999E */
  utility: 'var(--fs-utility)',
  /** advisory notes in panels — light: #8A5A2B · dark: #E0AC5E */
  warn: 'var(--fs-warn)',
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
