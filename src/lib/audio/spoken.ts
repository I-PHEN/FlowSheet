/**
 * Spoken-form converter — rewrites flowsheet prose into text a TTS voice can
 * pronounce naturally. Chemistry writing is full of tokens a speech engine
 * mangles: H2, CO2, −20 °C, ~65 MW, 28–30 GJ/t, 3:1, V-103, S/C, → …
 *
 * Pure function, no DOM/Node APIs — used server-side by /api/tts and by
 * tests. Order matters: normalize symbols first, then units, then chemical
 * formulas (which need the digits intact), then equipment tags and ratios.
 */

const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** digits inside equipment tags / formulas: 0 reads as "oh" (V one oh three) */
function digitsAsWords(digits: string, zeroAsOh: boolean): string {
  return digits
    .split('')
    .map((d) => {
      if (d === '0' && zeroAsOh) return 'oh';
      return DIGIT_WORDS[Number(d)] ?? d;
    })
    .join(' ');
}

/**
 * Split a chemical formula into element groups and spell it:
 * "H2O" → "H two O", "CO2" → "C O two", "NH3" → "N H three",
 * "H2" → "H two" (single element + digit is still a formula).
 */
export function spellFormula(token: string): string | null {
  // must look like a formula: element groups ([A-Z][a-z]?\d*), at least one digit
  const groups = token.match(/[A-Z][a-z]?\d*/g);
  if (!groups || groups.length < 1) return null;
  const hasDigit = /\d/.test(token);
  if (!hasDigit) return null;
  const spelled = groups
    .map((g) => {
      const m = g.match(/^([A-Z][a-z]?)(\d*)$/);
      if (!m) return null;
      const [, sym, count] = m;
      return count ? `${sym} ${digitsAsWords(count, false)}` : sym;
    })
    .filter(Boolean)
    .join(' ');
  return spelled || null;
}

export function toSpoken(input: string): string {
  let s = input;

  // 1. typographic normalization
  s = s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, ', ') // ellipsis → pause
    .replace(/\u00D7/g, ' times ')
    .replace(/\u2264/g, ' at most ')
    .replace(/\u2265/g, ' at least ')
    .replace(/\u00B7/g, ', ');

  // minus sign before a number → "minus"
  s = s.replace(/\u2212\s*(?=\d)/g, ' minus ');
  // en-dash between digits is a range → "to" (28–30); any other en dash → space
  s = s.replace(/(\d)\s*\u2013\s*(\d)/g, '$1 to $2').replace(/\u2013/g, ' ');
  // em dash → comma pause
  s = s.replace(/\u2014/g, ', ');
  // reaction arrow → "yields" (CO + H2O → CO2 + H2)
  s = s.replace(/\s*\u2192\s*/g, ' yields ');
  // approximations
  s = s.replace(/[~\u2248]\s*/g, 'about ');

  // 2. units (before the generic slash rule eats their "/")
  s = s
    .replace(/\bkmol\/h\b/gi, ' kilomoles per hour ')
    .replace(/\bkg\/h\b/gi, ' kilograms per hour ')
    .replace(/\bt\/d\b/g, ' tonnes per day ')
    .replace(/\bGJ\/t\b/g, ' gigajoules per tonne ')
    .replace(/\bMJ\/kg\b/g, ' megajoules per kilogram ')
    .replace(/%\s*\+/g, ' percent plus ')
    .replace(/%/g, ' percent ')
    .replace(/\u00B0\s*C\b/g, ' degrees Celsius ')
    .replace(/\u00B0\s*F\b/g, ' degrees Fahrenheit ')
    .replace(/\bMW\b/g, ' megawatts ')
    .replace(/\bGJ\b/g, ' gigajoules ')
    .replace(/\bS\/C\b/g, ' steam-to-carbon ');

  // 3. ratios written with a colon: 3:1 → "3 to 1"
  s = s.replace(/(\d)\s*:\s*(\d)/g, '$1 to $2');

  // 4. chemical formulas: H2O, CO2, NH3, CH4, C6H6 … (letters and digits in
  //    any order — but never pure numbers or digit-free words)
  s = s.replace(/\b[A-Za-z][A-Za-z0-9]*\b/g, (token) => {
    // leave pure numbers ("140", "3.5", "1,000") to the TTS engine
    if (!/\d/.test(token)) return token;
    const spelled = spellFormula(token.toUpperCase());
    return spelled ?? token;
  });
  // carbon monoxide / nitric oxide written without digits read as words otherwise
  s = s.replace(/\bCO\b/g, ' C O ').replace(/\bNO\b/g, ' N O ');

  // 5. slashed ratios between formulas: H2/N2 → "H two to N two"
  s = s.replace(/\//g, ' to ');

  // 6. equipment tags: V-103 → "V one oh three", E-101 → "E one oh one"
  s = s.replace(/\b([A-Z])\s?-\s?(\d{1,4})\b/g, (_m, letter: string, num: string) =>
    ` ${letter} ${digitsAsWords(num, true)} `,
  );

  // 7. tidy: collapse whitespace, keep sentence punctuation
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();
  // strip characters speech engines announce oddly when isolated
  s = s.replace(/\s*[\u2713\u2714\u2705\u2728]\s*/g, ' ');
  return s;
}
