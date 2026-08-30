/**
 * Flowsheet design tokens — "soft gray studio".
 *
 * One canvas, one ink, four muted service hues. Ink is the darkest element
 * on screen at all times (contrast vs canvas ≈ 12.9:1). No gradients,
 * no glows, no shadows on the diagram itself.
 */

export const C = {
  /** canvas background — warm light gray */
  canvas: '#F1F0ED',
  /** section band fill (one step darker than canvas) */
  band: '#E9E7E1',
  /** section band hairline border */
  bandLine: '#DBD8D0',
  /** equipment fill — brightest surface, lifts symbols off the canvas */
  paper: '#FCFBF9',
  /** primary linework, tags, labels */
  ink: '#26282B',
  /** secondary labels (unit names, annotations) */
  inkSoft: '#5A5D62',
  /** tertiary (dashed utility streams — intentionally subordinate) */
  inkFaint: '#8B8E93',
  /** emphasis halo behind a selected unit */
  halo: '#D9D5CB',

  // ---- service hues (4, muted, textbook-ish) ----
  /** feeds: natural gas, steam, air */
  feed: '#7A5E33',
  /** process gas: syngas + loop gas (same family — both are H2/N2 gas) */
  gas: '#3A5268',
  /** liquid ammonia product */
  nh3: '#3F6B4F',
  /** utilities & offgas: water, CO2, purge (dashed) */
  utility: '#8B8E93',
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
