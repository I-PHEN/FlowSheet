/**
 * task43-contrast-audit — WCAG proof for the "Control Room" identity.
 *
 * Computes real contrast ratios (WCAG 2.1 relative luminance) for every
 * token pair the UI actually paints, in BOTH themes, and fails (exit 1)
 * if any threshold is violated. Thresholds are the identity's law:
 *
 *   ink      on canvas/paper/band  ≥ 12   (the brightest thing on screen)
 *   inkSoft  on canvas/paper/band  ≥ 7    (secondary labels)
 *   inkFaint on canvas/paper/band  ≥ 4.5  (tertiary / footnotes)
 *   onAccent on accent             ≥ 4.5  (action buttons — WHITE with
 *                                      dark text in light, DARK CHARCOAL
 *                                      with light text in dark; never
 *                                      green, never inverted)
 *   paper    on nh3                ≥ 4.5  (PASS badge)
 *   every service hue on canvas/paper ≥ 4.5 (they appear as text:
 *             verdict chips, role labels, KPI values, legends)
 *
 * Informational only (not a gate): bandLine vs canvas — hairline
 * separators intentionally sit below WCAG 1.4.11's 3:1 (the same
 * discipline as every pro dark UI; borders are never the sole cue).
 *
 * Run: bun scripts/task43-contrast-audit.ts
 */

// ── the palettes (must match globals.css exactly) ───────────────────────────

const LIGHT = {
  canvas: '#FAFBFC', band: '#F2F4F7', bandLine: '#E2E7EC', sheet: '#FFFFFF',
  paper: '#FFFFFF', halo: '#F0F3F5',
  ink: '#1D242C', inkSoft: '#414D59', inkFaint: '#5C6873',
  accent: '#FFFFFF', onAccent: '#1D242C', accentLine: '#C6CDD4',
  feed: '#8F5A12', gas: '#33639C', nh3: '#1B7246', sulfur: '#82630D',
  utility: '#56656F', warn: '#8F5410', fail: '#B03E20',
} as const;

const DARK = {
  canvas: '#000000', band: '#131315', bandLine: '#2C2C2F', sheet: '#141417',
  paper: '#1A1A1D', halo: '#232326',
  ink: '#ECECEE', inkSoft: '#A7A8AC', inkFaint: '#818287',
  accent: '#28282C', onAccent: '#F2F2F4', accentLine: '#3E3E42',
  feed: '#C9A05C', gas: '#7FA3C2', nh3: '#6FAE8C', sulfur: '#D4B05A',
  utility: '#8A8991', warn: '#D89B5C', fail: '#E0785F',
} as const;

// ── WCAG 2.1 math ───────────────────────────────────────────────────────────

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ── the gates ───────────────────────────────────────────────────────────────

type Palette = Record<keyof typeof LIGHT, string>;
type Check = { fg: string; bg: string; min: number };

function checks(p: Palette): Check[] {
  const surfaces = ['canvas', 'paper', 'band'] as const;
  const out: Check[] = [];
  // the ink ramp — the app's core text law
  for (const s of surfaces) {
    out.push({ fg: p.ink, bg: p[s], min: 12 });
    out.push({ fg: p.inkSoft, bg: p[s], min: 7 });
    out.push({ fg: p.inkFaint, bg: p[s], min: 4.5 });
  }
  out.push({ fg: p.ink, bg: p.halo, min: 7 }); // selected-unit halo
  // service hues appear as text (verdicts, roles, legends, KPI values)
  for (const hue of ['nh3', 'gas', 'feed', 'sulfur', 'utility', 'warn', 'fail'] as const) {
    out.push({ fg: p[hue], bg: p.canvas, min: 4.5 });
    out.push({ fg: p[hue], bg: p.paper, min: 4.5 });
  }
  // solid fills with text on them
  out.push({ fg: p.onAccent, bg: p.accent, min: 4.5 }); // action buttons (white-in-light / charcoal-in-dark)
  out.push({ fg: p.paper, bg: p.nh3, min: 4.5 }); // PASS badge
  return out;
}

let failures = 0;
let worst = { pair: '', r: Infinity };

function run(name: string, p: Palette) {
  console.log(`\n── ${name} ─────────────────────────────────────────`);
  const rows: [string, string, number][] = [];
  for (const c of checks(p)) {
    const r = ratio(c.fg, c.bg);
    const label = `${c.fg} on ${c.bg}`;
    const pass = r >= c.min;
    if (!pass) failures++;
    if (r < worst.r) worst = { pair: `${name}: ${label}`, r };
    rows.push([label, `${r.toFixed(2)}:1`, c.min]);
  }
  // de-dup printout
  const seen = new Set<string>();
  for (const [label, r, min] of rows) {
    if (seen.has(label)) continue;
    seen.add(label);
    const pass = parseFloat(r) >= min;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(26)} ${r.padStart(8)}  (min ${min}:1)`);
  }
  // informational: hairline separators
  console.log(`  info  bandLine on canvas        ${ratio(p.bandLine, p.canvas).toFixed(2)}:1  (hairline, intentionally subtle)`);
  console.log(`  info  accentLine on accent      ${ratio(p.accentLine, p.accent).toFixed(2)}:1  (action hairline, decorative)`);
}

run('LIGHT · "Cool Gray Studio"', LIGHT);
run('DARK · "Charcoal"', DARK);

console.log(`\nworst text pair overall: ${worst.pair} = ${worst.r.toFixed(2)}:1`);
if (failures > 0) {
  console.error(`\n✗ ${failures} contrast violation(s) — fix the palette, not the thresholds.`);
  process.exit(1);
}
console.log('\n✓ every text/token pair passes its gate in both themes.');
