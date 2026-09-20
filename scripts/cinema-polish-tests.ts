/**
 * CINEMA POLISH GATE — the laws behind the finished theatre.
 *
 * Run: bun scripts/cinema-polish-tests.ts
 *
 * The user's three notes on the finished player, pinned as laws:
 *
 *   A. STREAM LAW  — the estimate fallback is CALIBRATED to the real voice
 *      (jam at speed 1.15 ≈ 100 wpm = 600 ms/word; the old 340 ms/word
 *      streamed captions twice as fast as Orion could speak)
 *   B. SYNC LAW    — the narrator is the clock: word k appears when the
 *      audio element reaches it (real currentTime/duration), pauses freeze
 *      the caption, resumed lines re-stream, a finished voice completes it
 *   C. DOCK LAW    — the bar is flush with the bottom edge of the stage
 *      (caption → scrubber → transport), so it never hovers over the
 *      plant and the pause button is at the very bottom of the screen
 *   D. CHROME LAW  — the transport row vanishes on idle and wakes on any
 *      activity, exactly like a video player
 *   E. PANEL LAW   — starting a tour collapses the side panel on every
 *      surface; the user's toggle still works mid-tour
 *   F. GUIDE LAW   — Orion's identity is a system, not a label: the Belt
 *      (three stars) nameplate rides every caption, widens to YOUR GUIDE
 *      on his introduction stop, and his name recurs at every launch point
 *   G. WIRING      — all four tour surfaces carry the cinema system, and
 *      the caption renders the SYNCED stream (not the whole stop text)
 */

import { existsSync, readFileSync } from 'fs';
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
console.log('\nA. STREAM LAW (the estimate is calibrated to the real voice)');
// ---------------------------------------------------------------------------
{
  const w = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  check('voice estimate: ~600 ms per word (20 words → 12000 ms)', streamFor(w(20), { voice: true }) === 12000);
  check('voice estimate: short captions get a floor (2 words → 1600 ms)', streamFor(w(2), { voice: true }) === 1600);
  check('voice estimate: long captions get a ceiling (60 words → 20000 ms)', streamFor(w(60), { voice: true }) === 20000);
  check('voice estimate: single word is a beat, not a flash (→ 600 ms)', streamFor('one', { voice: true }) === 600);

  // the estimate must match the MEASURED voice: the TTS route runs jam at
  // speed 1.15, measured ≈87 wpm at 1.0 → ≈100 wpm → 600 ms per word
  const tts = src('app', 'api', 'tts', 'route.ts');
  check('the voice is the calm British narrator (jam)', /VOICE = 'jam'/.test(tts));
  check('the voice runs at speed 1.15 (a relaxed teaching pace)', /SPEED = 1\.15/.test(tts));
  check('87 wpm at 1.0 is the measured basis of the calibration', /87 wpm/.test(tts));
  const msPerWord = 60000 / (87 * 1.15); // the measured voice, at its set speed
  check('600 ms/word matches the measured voice (87 wpm × 1.15 ≈ 100 wpm)', Math.abs(msPerWord - 600) < 2);
  check('the estimate is the fallback, not the law (sync law owns the reveal)', /progress is[\s\S]*?unreadable/.test(src('lib', 'ui', 'tourDirector.ts')));

  // voice off: the reveal is 60% of the reading dwell — readable as it grows,
  // with the remaining 40% to finish reading before auto-advance
  const law = (n: number) => Math.min(9000, Math.max(1200, dwellFor(w(n)) * 0.6));
  check('voice off: 10 words → 60% of dwell (3180 ms)', streamFor(w(10), { voice: false }) === 3180 && law(10) === 3180);
  check('voice off: 2 words → 60% of the dwell floor (1884 ms)', streamFor(w(2), { voice: false }) === law(2) && law(2) === 1884);
  check('voice off: 50 words → 60% of the clamped dwell (8400 ms)', streamFor(w(50), { voice: false }) === law(50) && law(50) === 8400);

  // relationships: the spoken estimate is gentler than silent reading pace
  const t = w(24);
  const sv = streamFor(t, { voice: true });
  const sr = streamFor(t, { voice: false });
  check('voice pace is gentler than reading pace (24 words)', sv > sr);
  check('silent reveal finishes with reading time to spare (≤ 60% of dwell)', sr <= dwellFor(t) * 0.6 + 1e-9);

  // streaming text never prints the whole paragraph in one go (≥ 2 beats)
  const beats = (ms: number) => ms / 600 >= 2;
  check('a 10-word voice caption is at least 2 reveal beats (never instant)', beats(streamFor(w(10), { voice: true })));
}

// ---------------------------------------------------------------------------
console.log('\nB. SYNC LAW (the narrator is the clock)');
// ---------------------------------------------------------------------------
{
  const narr = src('lib', 'audio', 'narration.ts');
  const sync = src('lib', 'ui', 'useSyncedCaption.ts');
  const dir = src('lib', 'ui', 'tourDirector.ts');

  // the narrator exposes REAL playback, not just state
  check('narrator exposes the script it is on (scriptOn)', /scriptOn\(\)/.test(narr));
  check('scriptOn covers loading AND speaking (caption waits for the voice)', /'loading' \|\| this\.state === 'speaking'/.test(narr));
  check('narrator exposes real playback progress', /progress\(\)/.test(narr));
  check('progress is currentTime / duration, guarded', /el\.currentTime \/ d/.test(narr) && /!Number\.isFinite\(d\) \|\| d <= 0/.test(narr));
  check('progress only exists while speaking', /this\.state !== 'speaking'\) return null/.test(narr));

  // the caption maps word k onto the audio clock
  check('the caption is driven by the narrator singleton', /narrator\.scriptOn\(\)/.test(sync) && /narrator\.progress\(\)/.test(sync));
  check('word k appears when the voice reaches it (cumulative spoken starts)', /const v = p \* spokenTotal/.test(sync) && /if \(v < start\) break/.test(sync));
  check('the title’s spoken share offsets the body reveal', /stepScript\(\{ title, text \}\)/.test(sync));
  check('spoken alignment: caption words are weighted by toSpoken (V-103 → V one oh three)', /toSpoken/.test(sync) && /spokenWeight/.test(sync));
  check('voice warming holds the caption (loading never races ahead)', /NO_PROGRESS_GRACE_MS/.test(sync) && /narrator\.state === 'speaking'/.test(sync));

  // the honest paused-video semantics
  check('paused mid-line FREEZES the caption where the voice cut', /mode = 'frozen'/.test(sync));
  check('a voice that read ≥ 97% of the line completes the caption', /ENDED_AT = 0\.97/.test(sync) && /voiceP >= ENDED_AT/.test(sync));
  check('a voice that dies mid-caption hands over to reading pace', /mode = 'timed'/.test(sync) && /perTimed/.test(sync));
  check('guided playback WAITS for the voice instead of racing it', /mode === 'wait' && !expect/.test(sync));
  check('a speaking voice with no readable duration falls to the estimate', /perVoice/.test(sync));

  // toggles never rewind a caption that is already on screen
  check('voice flags ride a ref (toggles never re-arm the loop)', /liveRef/.test(sync));
  check('the reveal loop does not depend on the live flags', !/\[title, text, words\.length, reduced, voiceLive/.test(sync) && /\[title, text, words\.length, reduced\]/.test(sync));
  check('rAF-driven reveal (word counts derived per frame)', /requestAnimationFrame\(tick\)/.test(sync));
  check('reduced motion shows the whole caption at once', /prefers-reduced-motion/.test(sync));

  // the auto-advance gives the viewer a breath now that the caption
  // completes WITH the voice (not seconds before it)
  check('auto-advance breathes 0.9 s after the voice finishes', /setTimeout\(advance, 900\)/.test(dir));

  // the old fixed-pace hook is gone — no parallel caption laws
  check('the old fixed-pace hook is retired', !existsSync(join(__dirname, '..', 'src', 'lib', 'ui', 'useStreamedText.ts')));
}

// ---------------------------------------------------------------------------
console.log('\nC. DOCK LAW (flush bottom — never hovering over the plant)');
// ---------------------------------------------------------------------------
{
  const cinema = src('components', 'learn', 'CinemaBar.tsx');

  check('the bar docks at the bottom edge (absolute inset-x-0 bottom-0)', /absolute inset-x-0 bottom-0/.test(cinema));
  check('the dock is flush — no float above the legend (pb-14 is gone)', !/pb-14/.test(cinema));
  check('full-width player chrome, not a floating card', /w-full border-t/.test(cinema) && !/max-w-\[720px\] rounded-2xl/.test(cinema));
  check('caption text keeps a readable measure inside the full-width bar', /max-h-\[104px\] max-w-\[720px\]/.test(cinema));

  // the row order is the player order: caption, scrubber, transport LAST
  const captionAt = cinema.indexOf('bd-msg-in');
  const dotsAt = cinema.indexOf('Go to stop ${i + 1}');
  const transportAt = cinema.indexOf('gridTemplateRows: chromeHidden');
  const pauseAt = cinema.indexOf('Pause — explore freely');
  check('the caption leads the bar (row 1)', captionAt !== -1 && captionAt < dotsAt && captionAt < transportAt);
  check('the scrubber rides under the caption (row 2)', dotsAt !== -1 && dotsAt < transportAt);
  check('the transport row is the LAST row of the bar (row 3)', transportAt !== -1 && transportAt > dotsAt);
  check('the pause button lives at the very bottom of the screen', pauseAt !== -1 && pauseAt > dotsAt && pauseAt > transportAt);
}

// ---------------------------------------------------------------------------
console.log('\nD. CHROME LAW (the YouTube rule: idle hides, activity wakes)');
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
console.log('\nE. PANEL LAW (tours take the width; the user keeps the toggle)');
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
console.log('\nF. GUIDE LAW (Orion sticks — a mark, not a label)');
// ---------------------------------------------------------------------------
{
  const mark = src('components', 'learn', 'OrionMark.tsx');
  const cinema = src('components', 'learn', 'CinemaBar.tsx');
  const index = src('components', 'learn', 'TourIndex.tsx');

  // the Belt — three stars, one mark, zero animation
  check('the Belt is three stars (Alnitak, Alnilam, Mintaka)', (mark.match(/star\(/g) ?? []).length >= 3);
  check('the nameplate is a neutral action surface (white-in-light / charcoal-in-dark — no brand color)', /background: C\.accent, borderColor: C\.accentLine/.test(mark));
  check('the name reads on the plate (onAccent ink on the action surface)', /ORION\{guide \? ' · YOUR GUIDE' : ''\}/.test(mark));

  // the plate rides every caption, and widens on his introduction stop
  check('the bar mounts the nameplate', /<OrionPlate guide=\{firstStop\} \/>/.test(cinema));
  check('the introduction stop is stop 1 (where the voice says his name)', /stop\.source === 'stop' && stop\.idx === 0/.test(cinema));

  // the identity travels: the panel header carries the Belt
  check('the tour index header reads ORION ON TOUR', /ORION ON TOUR/.test(index));
  check('the tour index carries the Belt mark (neutral ink — no green in chrome)', /<Belt color=\{C\.inkSoft\}/.test(index));

  // and every launch point says his name
  const tutor = src('components', 'workspace', 'TutorPanel.tsx');
  const flash = src('components', 'flash', 'FlashWorkspace.tsx');
  const dist = src('components', 'distillation', 'DistillationWorkspace.tsx');
  const plant = src('app', 'plant', 'p', '[id]', 'page.tsx');
  check('reference launch copy names Orion (narrated by Orion)', /narrated by Orion/.test(tutor));
  check('flash launch copy names Orion (walkthrough with Orion)', /walkthrough with Orion/.test(flash));
  check('distillation launch copy names Orion', /walkthrough with Orion/.test(dist));
  check('saved-plant launch copy names Orion (Orion flies the camera)', /Orion flies the camera/.test(plant));
}

// ---------------------------------------------------------------------------
console.log('\nG. WIRING (the synced caption streams on every surface)');
// ---------------------------------------------------------------------------
{
  const cinema = src('components', 'learn', 'CinemaBar.tsx');

  check('CinemaBar renders the SYNCED text, not the stop text', /\{shown\}/.test(cinema) && !/\{stop\.text\}/.test(cinema));
  check('the caret rides the tail while streaming', /streaming &&/.test(cinema) && /caret/.test(cinema));
  check('the caption is voice-synced (useSyncedCaption wired)', /useSyncedCaption\(stop, voiceLive, guided && voiceLive\)/.test(cinema));
  check('long captions follow the newest words (auto-scroll)', /el\.scrollTop = el\.scrollHeight/.test(cinema));

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
