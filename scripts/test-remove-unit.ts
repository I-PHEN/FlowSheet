/**
 * Reproduce the remix remove_unit failure on the reference graph:
 * seed a workspace with the ammonia reference graph and try to remove the
 * purge splitter exactly as the engineer would (id from the digest).
 */
import { AgentWorkspace } from '../src/lib/agent/workspace';
import { getFamily } from '../src/lib/families';
import { graphDigest } from '../src/lib/agent/catalog';

const g = getFamily('ammonia').referenceGraph();
console.log('units:', g.units.length, 'streams:', g.streams.length);
console.log('splitter-ish units:', g.units.filter((u) => u.type.includes('split') || u.type.includes('purge')).map((u) => `${u.id}:${u.type}`).join(', '));

// what the digest says about the purge
const digest = graphDigest(g);
const purgeLine = digest.split('\n').filter((l) => /purge|split/i.test(l)).slice(0, 6);
console.log('digest purge lines:\n' + purgeLine.join('\n'));

const ws = new AgentWorkspace(g);
const solve1 = ws.execute({ tool: 'solve', args: {} });
console.log('\nbaseline solve ok:', solve1.ok);

// try removing SP1 as the engineer did
const r = ws.execute({ tool: 'remove_unit', args: { id: 'SP1' } });
console.log('remove_unit SP1:', r.ok, '—', r.summary);

// check the graph state after
console.log('units after:', ws.graph.units.length);
const r2 = ws.execute({ tool: 'validate', args: {} });
console.log('validate:', r2.ok, '—', r2.summary.slice(0, 300));
const r3 = ws.execute({ tool: 'solve', args: {} });
console.log('solve after removal:', r3.ok, '—', r3.summary.slice(0, 200));

// alias tolerance — the exact failure the live engineer hit
const ws2 = new AgentWorkspace(getFamily('ammonia').referenceGraph());
const alias = ws2.execute({ tool: 'remove_unit', args: { unit: 'SP1' } });
console.log('\nalias remove_unit {unit:SP1}:', alias.ok, '—', alias.summary);
const alias2 = ws2.execute({ tool: 'remove_unit', args: { unitId: 'C2' } });
console.log('alias remove_unit {unitId:C2}:', alias2.ok, '—', alias2.summary);
