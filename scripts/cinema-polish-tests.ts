/**
 * CINEMA POLISH GATE — the three laws behind the finished theatre.
 *
 * Run: bun scripts/cinema-polish-tests.ts
 *
 * Task 33 tuned the Learn cinema from "functional" to "watchable", and these
 * tests pin the tuning so no refactor silently changes the experience:
 *
 *   A. streaming law — captions ARRIVE word by word at the narrator's pace,
 *      never dumped at once (streamFor exactness + relationships)
 *   B. chrome law    — the transport row vanishes on idle and wakes on any
 *      activity, exactly like a video player (source-pinned: listeners,
 *      collapse animation, guards for hover/focus/paused)
 *   C. panel law     — starting a tour collapses the side panel on every
 *      surface; the user's toggle still works mid-tour; an untouched panel
 *      returns when the tour ends
 *   D. wiring        — all four tour surfaces carry the cinema system, and
 *      the caption actually renders the STREAM (not the whole stop text)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { dwellFor, streamFor } from '../src/lib/ui/tourDirector';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name}  ${detail}`);
  }
}

const src = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8');

// ---------------------------------------------------------------------------
console.log('\nA. STREAMING LAW (captions arrive, they are not printed)');
// ---------------------------------------------------------------------------
{
  const w = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  check('voice on: ~340 ms per word (20 words → 6800 ms)', streamFor(w(20), { voice: true }) === 6800);
  check('voice on: short captions get a floor (2 words → 1600 ms)', streamFor(w(2), { voice: true }) === 1600);
  check('voice on: long captions get a ceiling (60 words → 14000 ms)', streamFor(w(60), { voice: true }) === 14000);
  check('voice on: single word is a beat, not a flash (→ 600 ms)', streamFor('one', { voice: true }) === 600);

  // the voice pace must track the narrator: 340 ms/word ≈ 176 wpm
  check('voice pace is 340 ms/word exactly at mid-scale', streamFor(w(30), { voice: true }) === 10200);

  // voice off: the reveal is 60% of the reading dwell — readable as it grows,
  // with the remaining 40% to finish reading before auto-advance
  const law = (n: number) => Math.min(9000, Math.max(1200, dwellFor(w(n)) * 0.6));
  check('voice off: 10 words → 60% of dwell (3180 ms)', streamFor(w(10), { voice: false }) === 3180 && law(10) === 3180);
  check('voice off: 2 words → 60% of the dwell floor (1884 ms)', streamFor(w(2), { voice: false }) === law(2) && law(2) === 1884);
  check('voice off: 50 words → 60% of the clamped dwell (8400 ms)', streamFor(w(50), { voice: false }) === law(50) && law(50) === 8400);

  // relationships: voice captions stream slower than silent reading pace,
  // and both finish before their respective auto-advance paths fire
  const t = w(24);
  const sv = streamFor(t, { voice: true });
  const sr = streamFor(t, { voice: false });
  check('voice pace is gentler than reading pace (24 words)', sv > sr);
  check(
    'silent reveal finishes with reading time to spare (≤ 60% of dwell)',
    sr <= dwellFor(t) * 0.6 + 1e-9,
  );

  // streaming text never prints the whole paragraph in one go (≥ 2 beats)
  const beats = (ms: number) => ms / 340 >= 2;
  check('a 10-word voice caption is at least 2 reveal beats (never instant)', beats(streamFor(w(10), { voice: true })));
}

// ---------------------------------------------------------------------------
console.log('\nB. CHROME LAW (the YouTube rule: idle hides, activity wakes)');
// ---------------------------------------------------------------------------
{
  const cinema = src('components', 'learn', 'CinemaBar.tsx');

  check('idle beat is 2.8 s (CHROME_HIDE_MS = 2800)', /CHROME_HIDE_MS = 2800/.test(cinema));
  check('activity anywhere wakes the chrome (window listeners)', /window\.addEventListener\(e, wake/.test(cinema));

  // every input channel a viewer has must count as activity
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    check(`wakes on ${ev}`, new RegExp(`'${ev}'`).test(cinema));
  }

  check('transport row collapses, not just fades (grid-template-rows 0fr)', /gridTemplateRows: chromeHidden \? '0fr' : '1fr'/.test(cinema));
  check('hidden chrome cannot intercept clicks (pointer-events: none)', /pointerEvents: chromeHidden \? 'none' : 'auto'/.test(cinema));
  check('hovering the bar keeps the chrome up', /!hovering/.test(cinema));
  check('keyboard focus inside the bar keeps the chrome up', /!focusWithin/.test(cinema));
  check('only GUIDED playback hides chrome (paused/roam always shows)', /guided && idle/.test(cinema));
  check('the fade respects reduced motion', /motion-reduce:transition-none/.test(cinema));

  // what stays on screen when the chrome rests
  check('the caption stays when chrome hides (rendered outside the collapsible row)', /bd-msg-in/.test(cinema));
  check('progress dots stay (the scrubber is always reachable)', /Go to stop \$\{i \+ 1\}/.test(cinema));
  check('voice status stays visible in the dots row (warming the voice…)', /warming the voice/.test(cinema));
}

// ---------------------------------------------------------------------------
console.log('\nC. PANEL LAW (tours take the width; the user keeps the toggle)');
// ---------------------------------------------------------------------------
{
  const hook = src('lib', 'ui', 'useCinemaPanel.ts');
  const flash = src('components', 'flash', 'FlashWorkspace.tsx');
  const dist = src('components', 'distillation', 'DistillationWorkspace.tsx');
  const ref = src('components', 'workspace', 'Workspace.tsx');
  const plant = src('app', 'plant', 'p', '[id]', 'page.tsx');

  check('the law is derived state (showPanel = touring ? pinned : panelOpen)', /touring \? pinned : panelOpen/.test(hook));
  check('a fresh tour starts collapsed (pin resets on tour start)', /if \(touring\) setPinned\(false\)/.test(hook));
  check('the toggle works mid-tour (flips the pin)', /if \(touring\) setPinned\(\(p\) => !p\)/.test(hook));

  for (const [name, s] of [
    ['reference', ref],
    ['flash', flash],
    ['distillation', dist],
    ['saved plant', plant],
  ] as const) {
    check(`${name}: mounts the cinema panel law`, /useCinemaPanel\(/.test(s));
    check(`${name}: tours never force the panel open`, !/setPanelOpen\(true\)/.test(s) && !/openPanel\(true\);\s*\n\s*director\.start/.test(s));
    check(`${name}: the panel toggle still exists`, /togglePanel/.test(s));
  }

  // the saved plant page never had a toggle — it does now
  check('saved plant: the panel is conditional on showPanel', /\{showPanel && \(/.test(plant));
  check('saved plant: header carries the PanelRight toggle', /<PanelRight size=\{15\} \/>/.test(plant));
}

// ---------------------------------------------------------------------------
console.log('\nD. WIRING (the caption streams on every surface)');
// ---------------------------------------------------------------------------
{
  const cinema = src('components', 'learn', 'CinemaBar.tsx');
  const stream = src('lib', 'ui', 'useStreamedText.ts');

  check('CinemaBar renders the STREAMED text, not the stop text', /\{shown\}/.test(cinema) && !/\{stop\.text\}/.test(cinema));
  check('the caret rides the tail while streaming', /streaming &&/.test(cinema) && /caret/.test(cinema));
  check('the stream pace follows the law (streamFor wired)', /streamFor\(stop\.text/.test(cinema));
  check('long captions follow the newest words (auto-scroll)', /el\.scrollTop = el\.scrollHeight/.test(cinema));
  check('reduced motion shows the whole caption at once', /prefers-reduced-motion/.test(stream));
  check('the pace is snapshotted per caption (no mid-stop rewinds)', /durRef/.test(stream));
  check('rAF-driven reveal (word counts derived from elapsed time)', /requestAnimationFrame/.test(stream));

  // globals: the caret blink joins the reduced-motion opt-outs
  const css = src('app', 'globals.css');
  const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.bd-unit-in[^}]*\}/);
  check('the caret blink is disabled under reduced motion', !!reducedBlock && /\.caret/.test(reducedBlock[0]));
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
