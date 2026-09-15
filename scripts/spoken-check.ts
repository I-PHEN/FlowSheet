/**
 * Spoken-form converter test — runs EVERY tour step of every plant through
 * toSpoken() and prints the narration script, flagging anything suspicious
 * (residual chemistry tokens, >1024 chars, leftover symbols).
 */
import { toSpoken } from '../src/lib/audio/spoken';
import { TOURS } from '../src/lib/content/units';
import { FLASH_TOURS } from '../src/lib/content/flash';
import { DISTILL_TOURS } from '../src/lib/content/distillation';

const plants: [string, typeof TOURS][] = [
  ['SMR ammonia plant', TOURS],
  ['Flash separation', FLASH_TOURS],
  ['Distillation', DISTILL_TOURS],
];

let issues = 0;
for (const [plant, tours] of plants) {
  for (const tour of tours) {
    for (let i = 0; i < tour.steps.length; i++) {
      const step = tour.steps[i];
      const raw = `${step.title}. ${step.text}`;
      const spoken = toSpoken(raw);
      const bad: string[] = [];
      // things that should have been converted
      if (/\bH2\b|\bN2\b|\bCO2\b|\bNH3\b|\bCH4\b/.test(spoken)) bad.push('raw chemical formula');
      if (/[−–—→~°%×]/.test(spoken)) bad.push('residual symbol');
      if (/kmol\/h|t\/d|GJ\/t|S\/C/.test(spoken)) bad.push('residual unit token');
      if (spoken.length > 1024) bad.push(`too long (${spoken.length})`);
      if (bad.length) {
        issues++;
        console.log(`✗ [${plant}] ${tour.id} step ${i + 1}: ${bad.join(', ')}`);
        console.log(`  "${spoken}"`);
      }
    }
  }
}

// spot-check the tricky conversions
const checks: [string, RegExp][] = [
  ['hydrogen and nitrogen at 3:1', /3 to 1/],
  ['carrying about 12% ammonia', /12 percent/],
  ['cools the gas from 30 °C to −20 °C', /minus 20 degrees Celsius/],
  ['This drum is V-103 of the big plant', /V one oh three/],
  ['soaking up ~65 MW of heat', /about 65 megawatts/],
  ['28–30 GJ/t energy figures', /28 to 30 gigajoules per tonne/],
  ['CO + H2O → CO2 + H2', /C O \+ H two O yields C O two \+ H two/],
  ['nearly pure H2 and N2', /H two and N two/],
  ['the S/C slider in Operate mode', /steam-to-carbon/],
  ['Peng–Robinson equation of state', /Peng Robinson/],
  ['an NH3 molecule, hot and still gaseous at 150 bar', /N H three molecule/],
  ['99%+ pure', /99 percent plus/],
  ['1,000 °C', /1,000 degrees Celsius/],
  ['H2/N2 mixture', /H two to N two/],
  ['benzene (C6H6) and toluene (C7H8)', /C six H six.*C seven H eight/],
  ['the 14-stage column', /14-stage column|14 stage column/],
];
for (const [needle, expect] of checks) {
  const out = toSpoken(needle);
  const ok = expect.test(out);
  if (!ok) {
    issues++;
    console.log(`✗ conversion: "${needle}" → "${out}" (wanted ${expect})`);
  } else {
    console.log(`✓ ${needle}  →  ${out}`);
  }
}

const total = plants.reduce((n, [, t]) => n + t.reduce((m, x) => m + x.steps.length, 0), 0);
console.log(`\n${total} tour steps checked · ${issues} issue(s)`);
if (issues > 0) process.exit(1);
