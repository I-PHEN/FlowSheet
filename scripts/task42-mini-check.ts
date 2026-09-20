/**
 * Task 42 sanity — run miniLayout (the thumbnail layout with real symbol
 * kinds) over every family reference graph and check the laws:
 *   1. every unit has a kind (real silhouette)
 *   2. every unit sits inside the canvas
 *   3. no two unit boxes overlap
 *   4. every stream endpoint lands inside the canvas
 *   5. labels (drawn below units at +12) stay inside the canvas height
 */
import { miniLayout } from '../src/components/home/MiniFlow';
import { AMMONIA } from '../src/lib/families/ammonia';
import { METHANOL } from '../src/lib/families/methanol';
import { HYDROGEN } from '../src/lib/families/hydrogen';
import { SULPHUR } from '../src/lib/families/sulphur';
import { GENERAL } from '../src/lib/families/general';
import { flashGraph, FLASH_BASE } from '../src/lib/plants/flash';
import { distillGraph, DISTILL_BASE } from '../src/lib/plants/distillation';

const families = [
  ['ammonia', AMMONIA],
  ['methanol', METHANOL],
  ['hydrogen', HYDROGEN],
  ['sulphur', SULPHUR],
  ['general', GENERAL],
  ['flash-teach', { referenceGraph: () => flashGraph(FLASH_BASE) }],
  ['distill-teach', { referenceGraph: () => distillGraph(DISTILL_BASE) }],
] as const;

let fails = 0;
const bad = (f: string, msg: string) => {
  fails++;
  console.error(`  ✗ [${f}] ${msg}`);
};

for (const [name, fam] of families) {
  const graph = fam.referenceGraph();
  const { canvas, units, streams } = miniLayout(graph);
  console.log(`${name}: ${units.length} units, ${streams.length} streams, canvas ${canvas.w}×${canvas.h}`);
  console.log(`  kinds: ${units.map((u) => `${u.id}:${u.kind ?? 'BOX!'}`).join(' ')}`);

  for (const u of units) {
    if (!u.kind) bad(name, `unit ${u.id} has no kind`);
    if (u.x < 0 || u.y < 0 || u.x + u.w > canvas.w || u.y + u.h > canvas.h)
      bad(name, `unit ${u.id} out of canvas (${u.x},${u.y},${u.w},${u.h})`);
    if (u.y + u.h + 12 > canvas.h) bad(name, `unit ${u.id} label below canvas bottom`);
  }
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      if (overlap) bad(name, `units ${a.id} and ${b.id} overlap`);
    }
  }
  for (const s of streams) {
    const m = s.d.match(/-?\d+(\.\d+)?/g);
    if (!m) continue;
    const nums = m.map(Number);
    for (let k = 0; k + 1 < nums.length; k += 2) {
      if (nums[k] < -30 || nums[k] > canvas.w + 30 || nums[k + 1] < -30 || nums[k + 1] > canvas.h + 30) {
        bad(name, `stream ${s.id} point (${nums[k]},${nums[k + 1]}) far outside canvas`);
        break;
      }
    }
  }
}

if (fails > 0) {
  console.error(`\n${fails} FAILURES`);
  process.exit(1);
}
console.log('\nAll families pass the miniLayout laws.');
