import { distillationColumn } from '../src/lib/engine/units';
import { I } from '../src/lib/engine/species';
const feed = new Array(11).fill(0);
feed[I.C6H6] = 225; feed[I.C7H8] = 275;
for (const nf of [6, 7, 8, 9, 10]) {
  const c = distillationColumn(feed, 376.15, 1.3e5, 1.45e5, I.C6H6, I.C7H8, 0.97, 2.5, 14, nf);
  console.log(`nf=${nf}: xB=${(c.xB * 100).toFixed(4)}%  feasible=${!c.pinched}`);
}
