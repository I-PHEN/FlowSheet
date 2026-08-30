/** Diagnose loop convergence — why does the Wegstein tail crawl? */
import { baseCase, run } from '../src/lib/engine';

const base = run(baseCase());
console.log('iter  err        method     qMin    qMax');
for (const row of base.solverTrace) {
  if (row.iter % 5 === 0 || row.iter < 12 || row.iter > 100) {
    console.log(
      String(row.iter).padStart(4),
      row.err.toExponential(2).padStart(10),
      row.method.padStart(10),
      row.qMin !== undefined ? row.qMin.toFixed(2).padStart(7) : ''.padStart(7),
      row.qMax !== undefined ? row.qMax.toFixed(2).padStart(7) : '',
    );
  }
}

// time breakdown: single loop pass vs front-end
import { frontEndPass, loopPass } from '../src/lib/engine';
const spec = baseCase();
const t0 = performance.now();
for (let k = 0; k < 20; k++) frontEndPass(spec, 1395);
const t1 = performance.now();
const fe = frontEndPass(spec, 1395);
const tear = base.streams.S20.n.slice();
for (let k = 0; k < 20; k++) loopPass(spec, fe.makeup, tear);
const t2 = performance.now();
console.log(`\nfront-end pass: ${((t1 - t0) / 20).toFixed(2)} ms`);
console.log(`loop pass: ${((t2 - t1) / 20).toFixed(2)} ms`);
