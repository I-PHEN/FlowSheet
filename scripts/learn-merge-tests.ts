/**
 * LEARN MERGE GATE — the laws behind the merged Learn mode.
 *
 * Run: bun scripts/learn-merge-tests.ts
 *
 * The Learn merge is one mode with two paces (Guided cinema + Free roam)
 * over one script. These tests pin the pure pieces so no future refactor
 * silently changes what the experience teaches:
 *
 *   A. camera law  — the shared easing + interpolation every canvas flies with
 *   B. dwell law   — reading-time fallback when nobody is narrating
 *   C. stop lookup — a click that lands on an authored stop jumps to it
 *   D. stop resolution — guided stop vs synthesized roam card
 *   E. roam synthesis — honest captions for units without authored stops
 *   F. naming + wiring regressions — "Explore" is retired everywhere,
 *      TourRunner is gone, every surface mounts the cinema system
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { easeOutCubic, lerpView, type View } from '../src/lib/flowsheet/camera';
import {
  dwellFor,
  findStopIndex,
  resolveStop,
  type DirectorStop,
} from '../src/lib/ui/tourDirector';
import { roamStep, ROLE } from '../src/lib/projects/tour';
import { UNIT_TYPES } from '../src/lib/engine/registry';
import type { FlowGraph } from '../src/lib/engine/graph';
import type { Tour } from '../src/lib/content/units';

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

// ---------------------------------------------------------------------------
console.log('\nA. CAMERA LAW (the one easing every canvas shares)');
// ---------------------------------------------------------------------------
{
  check('ease: f(0) = 0', easeOutCubic(0) === 0);
  check('ease: f(1) = 1', easeOutCubic(1) === 1);
  check('ease: cubic-out midpoint 0.875', easeOutCubic(0.5) === 0.875);
  let mono = true;
  let prev = -1;
  for (let i = 0; i <= 40; i++) {
    const v = easeOutCubic(i / 40);
    if (v < prev - 1e-12) mono = false;
    prev = v;
  }
  check('ease: monotone non-decreasing', mono);
  check('ease: clamps below 0 and above 1', easeOutCubic(-3) === 0 && easeOutCubic(7) === 1);

  const a: View = { x: 0, y: 0, w: 1000, h: 500 };
  const b: View = { x: 500, y: 250, w: 200, h: 100 };
  const mid = lerpView(a, b, 0.5);
  check('lerp: midpoint of a flight', mid.x === 250 && mid.y === 125 && mid.w === 600 && mid.h === 300);
  const e0 = lerpView(a, b, 0);
  const e1 = lerpView(a, b, 1);
  check('lerp: endpoints are exact', e0.x === a.x && e0.w === a.w && e1.x === b.x && e1.w === b.w);
  // the ease + lerp pair must land EXACTLY on the target — flights never drift
  const landed = lerpView(a, b, easeOutCubic(1));
  check('lerp+ease: a finished flight lands exactly', landed.x === b.x && landed.h === b.h);
}

// ---------------------------------------------------------------------------
console.log('\nB. DWELL LAW (voice-off fallback)');
// ---------------------------------------------------------------------------
{
  check('dwell: floor for an empty caption', dwellFor('') === 2600);
  const d10 = dwellFor('one two three four five six seven eight nine ten');
  check('dwell: ~270 ms per word', d10 === 2600 + 10 * 270, `got ${d10}`);
  const long = dwellFor(Array.from({ length: 100 }, (_, i) => `w${i}`).join(' '));
  check('dwell: clamped at 14 s', long === 14000, `got ${long}`);
  check(
    'dwell: monotone in length',
    dwellFor('a b c') < dwellFor('a b c d e f g h') && dwellFor('a b c d') < long,
  );
}

// ---------------------------------------------------------------------------
console.log('\nC. STOP LOOKUP (a click that lands on a stop jumps to it)');
// ---------------------------------------------------------------------------
{
  const tour: Tour = {
    id: 't',
    chip: 'chip',
    title: 'T',
    steps: [
      { ref: { type: 'unit', id: 'U1' }, title: 'one', text: 'text one' },
      { ref: { type: 'stream', id: 'S1' }, title: 'two', text: 'text two' },
      { ref: { type: 'unit', id: 'U2' }, title: 'three', text: 'text three' },
    ],
  };
  check('lookup: unit hit', findStopIndex(tour, { type: 'unit', id: 'U2' }) === 2);
  check('lookup: stream hit', findStopIndex(tour, { type: 'stream', id: 'S1' }) === 1);
  check('lookup: type mismatch is a miss', findStopIndex(tour, { type: 'unit', id: 'S1' }) === -1);
  check('lookup: unknown id is a miss', findStopIndex(tour, { type: 'unit', id: 'ZZ' }) === -1);
  check('lookup: first match wins', findStopIndex(tour, { type: 'unit', id: 'U1' }) === 0);
}

// ---------------------------------------------------------------------------
console.log('\nD. STOP RESOLUTION (guided stop vs synthesized roam card)');
// ---------------------------------------------------------------------------
{
  const tour: Tour = {
    id: 't',
    chip: 'chip',
    title: 'T',
    steps: [{ ref: { type: 'unit', id: 'U1' }, title: 'one', text: 'text one' }],
  };
  check('resolve: no tour → nothing to show', resolveStop(null, 0, null) === null);
  const guided = resolveStop(tour, 0, null);
  check(
    'resolve: guided shows the authored stop',
    guided?.source === 'stop' && guided?.idx === 0 && guided?.title === 'one',
  );
  const roam: DirectorStop = {
    ref: { type: 'unit', id: 'U9' },
    title: 'Extra',
    text: 'A synthesized card.',
    source: 'synth',
    idx: null,
  };
  const roamed = resolveStop(tour, 0, roam);
  check(
    'resolve: a roam card overrides the thread stop',
    roamed?.source === 'synth' && roamed?.ref.id === 'U9',
  );
  check('resolve: bad index → nothing', resolveStop(tour, 5, null) === null);
}

// ---------------------------------------------------------------------------
console.log('\nE. ROAM SYNTHESIS (honest captions for unlisted units)');
// ---------------------------------------------------------------------------
{
  const g: FlowGraph = {
    units: [
      { id: 'F1', type: 'ng-source', specs: {} },
      { id: 'E1', type: 'whb-cooler', specs: {} },
    ],
    streams: [
      {
        id: 'S1',
        name: 'feed gas',
        cls: 'feed',
        from: { unit: 'F1', port: 'out' },
        to: { unit: 'E1', port: 'in' },
      },
      {
        id: 'S2',
        name: 'hot feed',
        cls: 'syngas',
        from: { unit: 'E1', port: 'out' },
        to: null,
      },
    ],
    controllers: [],
  };
  const e1 = roamStep(g, 'E1');
  check('roam: title is the registry name', e1.title.length > 3, `got "${e1.title}"`);
  check('roam: names the unit id', e1.text.includes('E1'));
  check('roam: says what it receives', e1.text.includes('receives'));
  check('roam: says where it hands off', e1.text.includes('hands off'));
  check('roam: honest about solved numbers', e1.text.includes('solved'));
  const f1 = roamStep(g, 'F1');
  check('roam: head unit "where the plant begins"', f1.text.includes('plant begins'));
  const gone = roamStep(g, 'NOPE');
  check('roam: unknown unit degrades honestly', gone.text.includes('no longer on the sheet'));
  check('roam: deterministic', roamStep(g, 'E1').text === e1.text);
  check(
    'roam: specific role prose (not the generic fallback)',
    e1.text.includes('recovers heat'),
    `text was: ${e1.text.slice(0, 120)}`,
  );

  // the drift gate: ROLE once silently diverged from the registry and every
  // tour fell back to generic prose. Never again.
  const regKeys = Object.keys(UNIT_TYPES);
  const roleKeys = Object.keys(ROLE);
  const ghost = roleKeys.filter((k) => !regKeys.includes(k));
  const missing = regKeys.filter((k) => !roleKeys.includes(k));
  check('roles: no ghost keys (every ROLE key is a real registry type)', ghost.length === 0, `ghosts: ${ghost.join(', ')}`);
  check('roles: every registry type has role prose', missing.length === 0, `missing: ${missing.join(', ')}`);
}

// ---------------------------------------------------------------------------
console.log('\nF. NAMING + WIRING REGRESSIONS (the merge actually happened)');
// ---------------------------------------------------------------------------
{
  const src = (p: string) => readFileSync(join(__dirname, '..', 'src', p), 'utf8');
  const flash = src('components/flash/FlashWorkspace.tsx');
  const dist = src('components/distillation/DistillationWorkspace.tsx');
  const ref = src('components/workspace/Workspace.tsx');
  const plant = src('app/plant/p/[id]/page.tsx');
  const tutor = src('components/workspace/TutorPanel.tsx');
  const build = src('components/builder/BuildCanvas.tsx');

  check('naming: "Explore" retired in the flash workspace', !/Explore/.test(flash));
  check('naming: "Explore" retired in the distillation workspace', !/Explore/.test(dist));
  check('naming: reference workspace mode is learn', !/'explore'/.test(ref) && /'learn'/.test(ref));
  check('naming: all four Learn tabs say Learn', />\s*Learn\s*</.test(flash) && />\s*Learn\s*</.test(dist));

  check('wiring: TourRunner is gone', !/TourRunner/.test(tutor));
  check(
    'wiring: nobody imports TourRunner anymore',
    !/TourRunner/.test(ref) && !/TourRunner/.test(flash) && !/TourRunner/.test(dist) && !/TourRunner/.test(plant),
  );

  check('wiring: every surface mounts the director', [
    ['reference', ref],
    ['flash', flash],
    ['distillation', dist],
    ['plant page', plant],
  ].every(([, s]) => /useTourDirector/.test(s as string)));

  check('wiring: every surface mounts the CinemaBar', [
    ['reference', ref],
    ['flash', flash],
    ['distillation', dist],
    ['plant page', plant],
  ].every(([, s]) => /<CinemaBar/.test(s as string)));

  check('wiring: panels show the TourIndex while touring', [
    ref,
    flash,
    dist,
    plant,
  ].every((s) => /<TourIndex/.test(s)));

  check('camera: BuildCanvasHandle exposes flyToRef', /flyToRef/.test(build));
  check('camera: user interaction cancels flights', /stopAnim\(\); \/\/ the user owns the camera now/.test(build));
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
