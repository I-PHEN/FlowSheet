/**
 * Measure the token weight of every role prompt — where does a build spend?
 * Run: bun scripts/measure-prompts.ts
 */
import {
  architectSystem,
  criticSystem,
  docentSystem,
  engineerSystem,
  remixSystem,
  remixCriticSystem,
  routerSystem,
} from '../src/lib/agent/prompts';
import { catalogDigest, speciesDigest } from '../src/lib/agent/catalog';
import { FAMILIES } from '../src/lib/families';

/** rough token estimate: ~3.6 chars/token for English prose + JSON */
const tok = (s: string) => Math.round(s.length / 3.6);

const cat = catalogDigest();
const sp = speciesDigest();
console.log('DIGESTS (in every system prompt):');
console.log(`  catalogDigest : ${cat.length.toString().padStart(6)} chars ≈ ${tok(cat)} tok  (${Object.keys(cat).length ? '' : ''}${cat.split('\n').length} lines)`);
console.log(`  speciesDigest : ${sp.length.toString().padStart(6)} chars ≈ ${tok(sp)} tok`);
console.log('');

console.log('ROLE PROMPTS per family (chars ≈ tokens):');
console.log(
  'family'.padEnd(10),
  'architect'.padStart(10),
  'engineer'.padStart(10),
  'critic'.padStart(10),
  'docent'.padStart(10),
  'remix'.padStart(10),
  'remixCrit'.padStart(10),
);
for (const f of FAMILIES) {
  const F = f as unknown as {
    name: string;
    primer: string;
    conventions: (a: string, b: string) => string;
    id: string;
  };
  console.log(
    F.id.padEnd(10),
    tok(architectSystem(f as never)).toString().padStart(10),
    tok(engineerSystem(f as never)).toString().padStart(10),
    tok(criticSystem(f as never)).toString().padStart(10),
    tok(docentSystem(f as never)).toString().padStart(10),
    tok(remixSystem(f as never)).toString().padStart(10),
    tok(remixCriticSystem(f as never)).toString().padStart(10),
  );
}

console.log('');
console.log('SYSTEM-PROMPT RESEND COST (engineer loop):');
for (const f of FAMILIES) {
  const F = f as unknown as { id: string; name: string };
  const sys = engineerSystem(f as never);
  const perTurn = tok(sys);
  // trimmedConvo keeps: system + first user + last 12 msgs (6 turns of history)
  const firstUser = tok(
    `DESIGN BRIEF:\n${'x'.repeat(400)}\n\nARCHITECT'S PLAN (guidance — you execute it with tools):\n${'x'.repeat(3000)}\n\nBegin building. First turn: place the units.`,
  );
  const historyPerTurn = 6 * (1000 + 500); // assistant echo ≤4000 chars→~1000 tok + results ~500 tok
  const reqTokens = perTurn + firstUser + historyPerTurn;
  const turns = F.id === 'general' ? 12 : 8; // typical happy path
  console.log(
    `  ${F.id.padEnd(10)} system ≈ ${perTurn} tok/turn · typical request ≈ ${reqTokens} tok · ${turns} turns ≈ ${((reqTokens * turns) / 1000).toFixed(1)}k prompt tokens (engineer alone)`,
  );
}
