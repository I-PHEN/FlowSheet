/**
 * AGENT RUNTIME GATE (D2) — deterministic, no network.
 *
 * Run: bun scripts/agent-tests.ts
 *
 * Sections:
 *   A. Workspace cage       — every malformed proposal fails with a
 *                             plain-English message; clamps hold.
 *   B. IDENTITY             — a scripted engineer rebuilds the reference
 *                             plant purely through the tool interface; the
 *                             result graph must deep-equal buildGraph(base)
 *                             and the solve must match run(base) numbers.
 *   C. SELF-CORRECTION      — a broken mini-plant → validator issues fed
 *                             back → engineer fixes → validates clean.
 *   D. JSON extraction      — fence/prose/nested-brace robustness.
 */

import { AgentWorkspace } from '../src/lib/agent/workspace';
import { runAgentBuild } from '../src/lib/agent/orchestrator';
import { extractJson } from '../src/lib/agent/llm';
import type { Llm, LlmMessage } from '../src/lib/agent/llm';
import type { BuildEvent, EngineerStep, ToolCall } from '../src/lib/agent/protocol';
import { baseCase, run } from '../src/lib/engine';
import { applyPlantSpec, referenceGraph, buildGraph } from '../src/lib/engine/reference';
import type { FlowGraph } from '../src/lib/engine/graph';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
console.log('A. WORKSPACE CAGE');
// ---------------------------------------------------------------------------

{
  const ws = new AgentWorkspace();
  check('unknown tool rejected', !ws.execute({ tool: 'explode', args: {} }).ok);
  check('add_unit rejects unknown type', !ws.execute({ tool: 'add_unit', args: { id: 'X1', type: 'flux-capacitor' } }).ok);
  check('add_unit rejects bad id', !ws.execute({ tool: 'add_unit', args: { id: '9bad', type: 'ng-source' } }).ok);
  check('add_unit ok', ws.execute({ tool: 'add_unit', args: { id: 'SRC_NG', type: 'ng-source' } }).ok);
  check('add_unit rejects duplicate id', !ws.execute({ tool: 'add_unit', args: { id: 'SRC_NG', type: 'ng-source' } }).ok);
  check('connect rejects unknown port with hints', (() => {
    const r = ws.execute({ tool: 'connect', args: { id: 'S01', name: 'x', cls: 'feed', from: 'SRC_NG.outlet', to: null } });
    return !r.ok && r.summary.includes('out');
  })());
  check('connect rejects bad stream class', !ws.execute({ tool: 'connect', args: { id: 'S01', name: 'x', cls: 'plasma', from: 'SRC_NG.out', to: null } }).ok);
  check('set_spec clamps out-of-range value', (() => {
    const r = ws.execute({ tool: 'set_spec', args: { unit: 'SRC_NG', key: 'flow', value: 99999 } });
    const u = ws.graph.units.find((x) => x.id === 'SRC_NG')!;
    return r.ok && u.specs.flow === 3000 && r.summary.includes('clamped');
  })());
  check('set_spec rejects unknown key with the knob list', (() => {
    const r = ws.execute({ tool: 'set_spec', args: { unit: 'SRC_NG', key: 'vibes', value: 1 } });
    return !r.ok && r.summary.includes('flow');
  })());
  check('read_stream refuses before solve', !ws.execute({ tool: 'read_stream', args: { id: 'S01' } }).ok);
  check('solve refuses while validation fails (plain-English issues)', (() => {
    const r = ws.execute({ tool: 'solve', args: {} });
    return !r.ok && r.summary.includes('validation');
  })());
  check('remove_unit cascades streams', (() => {
    ws.execute({ tool: 'add_unit', args: { id: 'M1', type: 'feed-mixer' } });
    ws.execute({ tool: 'add_unit', args: { id: 'SRC_ST', type: 'steam-source' } });
    ws.execute({ tool: 'connect', args: { id: 'S01', name: 'ng', cls: 'feed', from: 'SRC_NG.out', to: 'M1.ng' } });
    ws.execute({ tool: 'connect', args: { id: 'S02', name: 'st', cls: 'feed', from: 'SRC_ST.out', to: 'M1.steam' } });
    ws.execute({ tool: 'connect', args: { id: 'S03', name: 'mix', cls: 'syngas', from: 'M1.out', to: null } });
    const r = ws.execute({ tool: 'remove_unit', args: { id: 'M1' } });
    return r.ok && !ws.graph.streams.some((s) => s.id === 'S01' || s.id === 'S03');
  })());
  check('connect catches port phase mismatch', (() => {
    const ws2 = new AgentWorkspace();
    ws2.execute({ tool: 'add_unit', args: { id: 'V1', type: 'ko-drum-shift' } });
    ws2.execute({ tool: 'add_unit', args: { id: 'A1', type: 'co2-removal' } });
    const r = ws2.execute({ tool: 'connect', args: { id: 'S11', name: 'x', cls: 'water', from: 'V1.liquid', to: 'A1.in' } });
    return !r.ok && r.summary.includes('phase');
  })());
  check('validator + workspace reject duplicate outlet streams', (() => {
    const ws2 = new AgentWorkspace();
    ws2.execute({ tool: 'add_unit', args: { id: 'SRC_NG', type: 'ng-source' } });
    ws2.execute({ tool: 'add_unit', args: { id: 'M1', type: 'feed-mixer' } });
    ws2.execute({ tool: 'add_unit', args: { id: 'SRC_ST', type: 'steam-source' } });
    ws2.execute({ tool: 'connect', args: { id: 'S01', name: 'a', cls: 'feed', from: 'SRC_NG.out', to: 'M1.ng' } });
    ws2.execute({ tool: 'connect', args: { id: 'S02', name: 'b', cls: 'feed', from: 'SRC_NG.out', to: 'M1.steam' } });
    const r = ws2.execute({ tool: 'validate', args: {} });
    return !r.ok && r.summary.includes('feeds 2 streams');
  })());
  check('number[] spec: element clamp + length enforcement', (() => {
    const ws2 = new AgentWorkspace();
    ws2.execute({ tool: 'add_unit', args: { id: 'R6', type: 'converter' } });
    const r = ws2.execute({ tool: 'set_spec', args: { unit: 'R6', key: 'bedTs', value: [500, 460, 2, 99] } });
    const u = ws2.graph.units.find((x) => x.id === 'R6')!;
    return r.ok && JSON.stringify(u.specs.bedTs) === JSON.stringify([470, 460, 350]);
  })());
  check('add_controller rejects non-source manipulate', (() => {
    const ws2 = new AgentWorkspace();
    ws2.execute({ tool: 'add_unit', args: { id: 'R1', type: 'primary-reformer' } });
    return !ws2.execute({ tool: 'add_controller', args: { id: 'C', manipulate: 'R1', measure: 'S01', num: 0, den: 1, set: 3 } }).ok;
  })());
}

// ---------------------------------------------------------------------------
console.log('\nB. IDENTITY — reference plant rebuilt through the tool interface');
// ---------------------------------------------------------------------------

/** scripted LLM: architect plan → engineer steps → critic verdict */
class ScriptedLlm implements Llm {
  constructor(
    private plan: Record<string, unknown>,
    private steps: EngineerStep[],
    private critic: Record<string, unknown>,
  ) {}
  async chat(_messages: LlmMessage[], label = 'llm'): Promise<string> {
    if (label === 'architect') return JSON.stringify(this.plan);
    if (label.startsWith('engineer:final')) return JSON.stringify({ thinking: '', actions: [], done: true, doneReason: 'script complete' });
    if (label.startsWith('engineer:')) {
      const n = parseInt(label.slice('engineer:'.length), 10);
      const step = this.steps[n - 1] ?? { thinking: 'script exhausted', actions: [], done: true, doneReason: 'script exhausted' };
      return JSON.stringify(step);
    }
    if (label === 'critic') return JSON.stringify(this.critic);
    throw new Error(`scripted llm: unexpected label "${label}"`);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function referenceScript(): { plan: Record<string, unknown>; steps: EngineerStep[]; graph: FlowGraph } {
  const base = baseCase();
  const g0 = referenceGraph();
  const gRef = applyPlantSpec(referenceGraph(), base);

  const addUnits: ToolCall[] = gRef.units.map((u) => ({ tool: 'add_unit', args: { id: u.id, type: u.type } }));
  const connects: ToolCall[] = gRef.streams.map((s) => ({
    tool: 'connect',
    args: {
      id: s.id,
      name: s.name,
      cls: s.cls,
      from: `${s.from.unit}.${s.from.port}`,
      to: s.to ? `${s.to.unit}.${s.to.port}` : null,
      ...(s.implicit ? { implicit: true } : {}),
    },
  }));
  const specs: ToolCall[] = [];
  for (const u2 of gRef.units) {
    const u0 = g0.units.find((x) => x.id === u2.id)!;
    for (const [k, v] of Object.entries(u2.specs)) {
      if (JSON.stringify(u0.specs[k]) !== JSON.stringify(v)) specs.push({ tool: 'set_spec', args: { unit: u2.id, key: k, value: v } });
    }
  }
  const ctrl = gRef.controllers[0];
  const addCtrl: ToolCall[] = ctrl
    ? [{ tool: 'add_controller', args: { id: ctrl.id, manipulate: ctrl.manipulate, measure: ctrl.measure, num: ctrl.num, den: ctrl.den, set: ctrl.set, auto: ctrl.auto } }]
    : [];

  const buildActions = [...addUnits, ...connects, ...specs, ...addCtrl];
  const steps: EngineerStep[] = [];
  for (const batch of chunk(buildActions, 10)) {
    steps.push({ thinking: `placing ${batch.length} items (${batch[0].tool}…${batch[batch.length - 1].tool})`, actions: batch });
  }
  steps.push({ thinking: 'structure complete — validating', actions: [{ tool: 'validate', args: {} }] });
  steps.push({ thinking: 'validation clean — solving the plant', actions: [{ tool: 'solve', args: {} }] });
  steps.push({
    thinking: 'solved — checking the product against the brief',
    actions: [
      { tool: 'read_stream', args: { id: 'S24' } },
      { tool: 'read_stream', args: { id: 'S20' } },
    ],
  });
  steps.push({ thinking: 'product and loop look right', actions: [], done: true, doneReason: 'reference plant rebuilt and verified' });

  const plan = {
    approach: 'Rebuild the canonical SMR ammonia plant.',
    units: gRef.units.map((u) => ({ id: u.id, type: u.type, role: '' })),
    streams: gRef.streams.map((s) => ({ id: s.id, name: s.name, cls: s.cls, from: `${s.from.unit}.${s.from.port}`, to: s.to ? `${s.to.unit}.${s.to.port}` : null })),
    specs: specs.map((s) => ({ unit: s.args.unit, key: s.args.key, value: s.args.value })),
    controller: ctrl ?? null,
    notes: [],
  };
  return { plan, steps, graph: gRef };
}

{
  const { plan, steps, graph: gRef } = referenceScript();
  const llm = new ScriptedLlm(plan, steps, { verdict: 'pass', score: 95, summary: 'Canonical route, converged, on target.', strengths: ['complete front end', 'healthy loop'], issues: [], suggestions: [] });
  const events: BuildEvent[] = [];
  await runAgentBuild('Build the standard SMR ammonia plant, about 800 t/d.', { llm, emit: (e) => events.push(e) });

  const done = events.find((e) => e.type === 'done') as Extract<BuildEvent, { type: 'done' }> | undefined;
  check('build completes', done !== undefined);
  check('build succeeds', done?.success === true, events.filter((e) => e.type === 'error').map((e) => (e as { message: string }).message).join('; '));
  check('no error events', !events.some((e) => e.type === 'error'));
  check('final graph deep-equals the reference graph', done != null && JSON.stringify(done.graph) === JSON.stringify(gRef), 'graph mismatch');

  const solveEvents = events.filter((e) => e.type === 'solve') as Extract<BuildEvent, { type: 'solve' }>[];
  check('solve event emitted', solveEvents.length > 0);
  const expected = run(baseCase());
  check('identity: production matches run(baseCase) to 1e-9', Math.abs((solveEvents.at(-1)?.solve.kpis.productionTpd ?? -1) - expected.kpis.productionTpd) < 1e-9, `${solveEvents.at(-1)?.solve.kpis.productionTpd} vs ${expected.kpis.productionTpd}`);
  check('identity: converged flag matches', solveEvents.at(-1)?.solve.converged === expected.converged);
  check('identity: per-pass conversion matches', Math.abs((solveEvents.at(-1)?.solve.kpis.perPassConv ?? -1) - expected.kpis.perPassConv) < 1e-12);

  // event stream shape
  const phases = events.filter((e) => e.type === 'phase').map((e) => (e as { phase: string }).phase);
  check('phases run architect → engineer → solver → critic → done', JSON.stringify(phases) === JSON.stringify(['architect', 'engineer', 'solver', 'critic']), JSON.stringify(phases));
  check('architect message emitted', events.some((e) => e.type === 'message' && e.role === 'architect'));
  check('engineer thinking messages emitted', events.filter((e) => e.type === 'message' && e.role === 'engineer').length >= 5);
  check('verdict emitted', events.some((e) => e.type === 'verdict'));

  // graph snapshots after mutations, monotone growth during engineer phase
  let lastCount = -1;
  let monotone = true;
  let snapshotAfterMutation = true;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'tool' && e.ok && ['add_unit', 'connect', 'set_spec', 'add_controller', 'remove_unit', 'disconnect', 'remove_controller'].includes(e.name)) {
      const next = events[i + 1];
      if (!next || next.type !== 'graph') snapshotAfterMutation = false;
    }
    if (e.type === 'graph' && e.graph.units.length < lastCount) monotone = false;
    if (e.type === 'graph') lastCount = e.graph.units.length;
  }
  check('graph snapshot follows every successful mutation', snapshotAfterMutation);
  check('graph snapshots grow monotonically (no removals in happy path)', monotone);
  check('tool events carry seq numbers', events.filter((e) => e.type === 'tool').every((e, _, arr) => (e as { seq: number }).seq > 0 && arr.length > 0));
  check('final unit count = 22', done?.unitCount === 22, String(done?.unitCount));
  check('final stream count = 29 (28 recorded + implicit IF1)', done?.streamCount === 29, String(done?.streamCount));
}

// ---------------------------------------------------------------------------
console.log('\nC. SELF-CORRECTION — validator feedback loop');
// ---------------------------------------------------------------------------

{
  const steps: EngineerStep[] = [
    {
      thinking: 'placing the front end and wiring it',
      actions: [
        { tool: 'add_unit', args: { id: 'SRC_NG', type: 'ng-source' } },
        { tool: 'add_unit', args: { id: 'M1', type: 'feed-mixer' } },
        { tool: 'add_unit', args: { id: 'R1', type: 'primary-reformer' } },
        { tool: 'connect', args: { id: 'S01', name: 'Natural gas', cls: 'feed', from: 'SRC_NG.out', to: 'M1.ng' } },
        // mistake: second stream off the same outlet
        { tool: 'connect', args: { id: 'S02', name: 'Steam', cls: 'feed', from: 'SRC_NG.out', to: 'M1.steam' } },
        { tool: 'connect', args: { id: 'S03', name: 'Mixed feed', cls: 'syngas', from: 'M1.out', to: 'R1.in' } },
        { tool: 'validate', args: {} },
      ],
    },
    {
      thinking: 'the validator says the steam inlet is double-fed from one outlet — fixing',
      actions: [
        { tool: 'disconnect', args: { id: 'S02' } },
        { tool: 'add_unit', args: { id: 'SRC_ST', type: 'steam-source' } },
        { tool: 'connect', args: { id: 'S02', name: 'Process steam', cls: 'feed', from: 'SRC_ST.out', to: 'M1.steam' } },
        { tool: 'connect', args: { id: 'S04', name: 'Reformer effluent', cls: 'syngas', from: 'R1.out', to: null } },
        { tool: 'validate', args: {} },
      ],
    },
    {
      thinking: 'validation clean — solving and reading the effluent',
      actions: [{ tool: 'solve', args: {} }, { tool: 'read_stream', args: { id: 'S04' } }],
    },
    { thinking: 'mini front end works', actions: [], done: true, doneReason: 'front end mini-plant solved' },
  ];
  const plan = {
    approach: 'A minimal front-end slice for testing.',
    units: [
      { id: 'SRC_NG', type: 'ng-source', role: 'feed' },
      { id: 'SRC_ST', type: 'steam-source', role: 'feed' },
      { id: 'M1', type: 'feed-mixer', role: 'mix' },
      { id: 'R1', type: 'primary-reformer', role: 'reform' },
    ],
    streams: [],
    specs: [],
    controller: null,
    notes: [],
  };
  const llm = new ScriptedLlm(plan, steps, { verdict: 'revise', score: 60, summary: 'Solves but not the full plant.', strengths: [], issues: ['incomplete'], suggestions: [] });
  const events: BuildEvent[] = [];
  await runAgentBuild('Build a tiny reformer front end.', { llm, emit: (e) => events.push(e) });

  const toolEvents = events.filter((e) => e.type === 'tool') as Extract<BuildEvent, { type: 'tool' }>[];
  const validates = toolEvents.filter((t) => t.name === 'validate');
  check('first validate fails with issues', validates.length > 0 && !validates[0].ok, validates[0]?.summary);
  check('a later validate passes', validates.some((v) => v.ok));
  const solves = toolEvents.filter((t) => t.name === 'solve');
  check('solve succeeds after correction', solves.some((s) => s.ok));
  check('correction actually reconnected the steam inlet', (() => {
    const done = events.find((e) => e.type === 'done') as Extract<BuildEvent, { type: 'done' }>;
    const g = done?.graph;
    return !!g && g.units.length === 4 && g.streams.some((s) => s.id === 'S02' && s.from.unit === 'SRC_ST');
  })());
  const readOk = toolEvents.find((t) => t.name === 'read_stream');
  check('read_stream returns composition after solve', readOk != null && readOk.ok && readOk.summary.includes('°C'));
  // done.success false here: critic says revise → success flag false (solvedOk && validate && verdict!=='fail') — actually revise → success true
  const done = events.find((e) => e.type === 'done') as Extract<BuildEvent, { type: 'done' }>;
  check('revise verdict still counts as built (success true, verdict revise)', done?.success === true);
  const verdict = events.find((e) => e.type === 'verdict') as Extract<BuildEvent, { type: 'verdict' }>;
  check('critic verdict preserved', verdict?.verdict.verdict === 'revise');
}

// ---------------------------------------------------------------------------
console.log('\nD. JSON EXTRACTION');
// ---------------------------------------------------------------------------

check('plain object', extractJson('{"a":1}')?.a === 1);
check('fenced object', extractJson('```json\n{"a":[1,2]}\n```')?.a?.[1] === 2);
check('prose-wrapped with braces inside strings', (extractJson('here you go: {"a": "}}{" , "b": {"c": "x{y}z"}} thanks') as { b?: { c?: string } } | null)?.b?.c === 'x{y}z');
check('no json → null', extractJson('I cannot do that.') === null);
check('trailing prose after object', extractJson('{"a": true} — hope this helps')?.a === true);
check('truncated object (mid-array) is repaired', extractJson('{"thinking": "placing", "actions": [{"tool": "add_unit", "args": {"id": "R1", "type": "primary-ref') != null);
check('truncated object parses with salvageable actions', (() => {
  const p = extractJson('{"thinking": "t", "actions": [{"tool": "add_unit", "args": {"id": "R1", "type": "primary-reformer"}}, {"tool": "connect", "args": {"id": "S01"');
  return Array.isArray(p?.actions) && p?.actions?.length === 2;
})());
check('truncated mid-string is repaired', extractJson('{"thinking": "wiring the synthesis lo') != null);

// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFAILURES:');
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
