/**
 * Graph validator — the structural cage. Runs BEFORE the executor; every
 * issue is a plain, human-readable message (these strings are what the D2
 * builder agent reads to self-correct, and what the UI can show a user
 * whose draft plant is not yet solvable).
 *
 * Checks: known types, unique ids, port wiring (every inlet fed, every
 * outlet connected), port phase compatibility, spec ranges, controller
 * references, executability (sources present, all units reachable), and
 * single recycle cluster with a tearable edge.
 */

import type { FlowGraph, GraphIssue, PortDef, StreamEdge } from './graph';
import { getUnitType, resolveSpecs } from './registry';

export function validateGraph(graph: FlowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const push = (code: string, message: string, unitId?: string, streamId?: string) =>
    issues.push({ code, message, unitId, streamId });

  // --- units ---
  const ids = new Set<string>();
  for (const u of graph.units) {
    if (ids.has(u.id)) push('duplicate-unit-id', `unit id "${u.id}" is used more than once`, u.id);
    ids.add(u.id);
    const def = getUnitType(u.type);
    if (!def) {
      push('unknown-unit-type', `unit "${u.id}" has unknown type "${u.type}"`, u.id);
      continue;
    }
    // spec values within declared ranges
    const specs = resolveSpecs(u);
    for (const f of def.specFields) {
      const v = specs[f.key];
      if (f.kind === 'number') {
        if (typeof v !== 'number' || Number.isNaN(v)) {
          push('spec-not-number', `unit "${u.id}" spec "${f.key}" must be a number`, u.id);
        } else if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
          push(
            'spec-out-of-range',
            `unit "${u.id}" spec "${f.key}" = ${v} is outside its physical range [${f.min}, ${f.max}]${f.unit ? ` ${f.unit}` : ''}`,
            u.id,
          );
        }
      } else if (f.kind === 'number[]') {
        const a = v as number[];
        if (!Array.isArray(a)) {
          push('spec-not-array', `unit "${u.id}" spec "${f.key}" must be a list of numbers`, u.id);
        } else {
          a.forEach((x, i) => {
            if ((f.elemMin !== undefined && x < f.elemMin) || (f.elemMax !== undefined && x > f.elemMax)) {
              push(
                'spec-out-of-range',
                `unit "${u.id}" spec "${f.key}"[${i}] = ${x} is outside [${f.elemMin}, ${f.elemMax}]`,
                u.id,
              );
            }
          });
        }
      } else if (f.kind === 'boolean' && typeof v !== 'boolean') {
        push('spec-not-boolean', `unit "${u.id}" spec "${f.key}" must be true/false`, u.id);
      }
    }
  }

  const unit = (id: string) => graph.units.find((u) => u.id === id);
  const typeOf = (id: string) => {
    const u = unit(id);
    return u ? getUnitType(u.type) : undefined;
  };

  // --- streams ---
  const sids = new Set<string>();
  for (const s of graph.streams) {
    if (sids.has(s.id)) push('duplicate-stream-id', `stream id "${s.id}" is used more than once`, undefined, s.id);
    sids.add(s.id);
    const src = typeOf(s.from.unit);
    if (!src) {
      push('unknown-unit', `stream "${s.id}" starts at unknown unit "${s.from.unit}"`, s.from.unit, s.id);
      continue;
    }
    const outPort = src.ports.out.find((p) => p.key === s.from.port);
    if (!outPort) push('unknown-port', `stream "${s.id}" leaves "${s.from.unit}" at unknown outlet port "${s.from.port}"`, s.from.unit, s.id);
    if (s.to) {
      const dst = typeOf(s.to.unit);
      if (!dst) {
        push('unknown-unit', `stream "${s.id}" enters unknown unit "${s.to.unit}"`, s.to.unit, s.id);
        continue;
      }
      const inPort = dst.ports.in.find((p: PortDef) => p.key === s.to!.port);
      if (!inPort) {
        push('unknown-port', `stream "${s.id}" enters "${s.to.unit}" at unknown inlet port "${s.to.port}"`, s.to.unit, s.id);
      } else if (outPort && inPort.kind !== 'any' && outPort.kind !== 'any' && outPort.kind !== inPort.kind) {
        push(
          'port-kind-mismatch',
          `stream "${s.id}" connects a ${outPort.kind} outlet (${s.from.unit}.${s.from.port}) into a ${inPort.kind} inlet (${s.to.unit}.${s.to.port})`,
          s.to.unit,
          s.id,
        );
      }
    }
  }

  // --- every inlet fed exactly once; every outlet connected ---
  for (const u of graph.units) {
    const def = getUnitType(u.type);
    if (!def) continue;
    for (const p of def.ports.in) {
      const feeders = graph.streams.filter((s) => s.to && s.to.unit === u.id && s.to.port === p.key);
      if (feeders.length === 0) {
        push('unfed-inlet', `inlet "${u.id}.${p.key}" has no stream connected to it`, u.id);
      } else if (feeders.length > 1) {
        push('double-fed-inlet', `inlet "${u.id}.${p.key}" is fed by ${feeders.length} streams (${feeders.map((s) => s.id).join(', ')}) — exactly one is allowed`, u.id);
      }
    }
    for (const p of def.ports.out) {
      const outStreams = graph.streams.filter((s) => s.from.unit === u.id && s.from.port === p.key);
      if (outStreams.length > 1) {
        push(
          'duplicate-outlet-stream',
          `outlet "${u.id}.${p.key}" feeds ${outStreams.length} streams (${outStreams.map((s) => s.id).join(', ')}) — exactly one is allowed; use a splitter unit for branches`,
          u.id,
        );
      } else if (outStreams.length === 0) {
        push('dangling-outlet', `outlet "${u.id}.${p.key}" is not connected — its material has nowhere to go`, u.id);
      }
    }
    if (def.ports.in.length === 0) {
      const badIn = graph.streams.find((s) => s.to && s.to.unit === u.id);
      if (badIn) push('source-has-inlet', `feed unit "${u.id}" cannot receive stream "${badIn.id}"`, u.id, badIn.id);
    }
  }

  // --- controllers ---
  for (const c of graph.controllers) {
    const src = unit(c.manipulate);
    const srcDef = src ? getUnitType(src.type) : undefined;
    if (!src || !srcDef) {
      push('bad-controller', `controller "${c.id}" manipulates unknown unit "${c.manipulate}"`);
    } else if (srcDef.ports.in.length !== 0 || !(c.manipulate in resolveSpecs({ type: src.type, specs: src.specs }) && 'flow' in (src.specs ?? {}))) {
      // manipulated unit must be a flow-carrying source
      const hasFlow = srcDef.specFields.some((f) => f.key === 'flow');
      if (!hasFlow) push('bad-controller', `controller "${c.id}" must manipulate a feed source with a "flow" spec (got "${c.manipulate}")`);
    }
    const measure = graph.streams.find((s) => s.id === c.measure);
    if (!measure) push('bad-controller', `controller "${c.id}" measures unknown stream "${c.measure}"`);
  }

  // --- executability ---
  const sources = graph.units.filter((u) => getUnitType(u.type)?.ports.in.length === 0);
  if (sources.length === 0) push('no-sources', 'the plant has no feed units — nothing can flow');

  // reachability from sources (unit digraph)
  const adj = new Map<string, Set<string>>();
  for (const u of graph.units) adj.set(u.id, new Set());
  for (const s of graph.streams) {
    if (s.to) adj.get(s.from.unit)?.add(s.to.unit);
  }
  const seen = new Set<string>();
  const queue = sources.map((u) => u.id);
  while (queue.length > 0) {
    const u = queue.pop()!;
    if (seen.has(u)) continue;
    seen.add(u);
    for (const v of adj.get(u) ?? []) if (!seen.has(v)) queue.push(v);
  }
  for (const u of graph.units) {
    if (!seen.has(u.id)) push('unreachable-unit', `unit "${u.id}" is not reachable from any feed — it will never run`, u.id);
  }

  // sinks must carry material somewhere (recorded sinks are fine; a graph
  // with no sink at all produces nothing)
  const sinks = graph.streams.filter((s) => s.to === null);
  if (sinks.length === 0) push('no-sinks', 'no stream leaves the plant — nothing is produced or wasted');

  // --- recycle structure (mirror of executor v1 limits) ---
  const sccs = sccList(graph);
  if (sccs.length > 1) {
    push(
      'multi-loop-unsupported',
      `the flowsheet has ${sccs.length} independent recycle loops; only one is supported in this version`,
    );
  } else if (sccs.length === 1) {
    const scc = sccs[0];
    const internal = graph.streams.filter(
      (s) => s.to && scc.has(s.from.unit) && scc.has(s.to.unit) && s.from.unit !== s.to.unit,
    );
    const tearable = internal.some((s) => {
      const def = typeOf(s.from.unit);
      return def?.fixedOutlet !== undefined;
    });
    if (!tearable) {
      push(
        'no-tearable-edge',
        `the recycle loop (${[...scc].join(' → ')} …) has no unit with a fixed spec outlet — add or keep a spec-outlet unit (e.g. the loop feed preheater) inside the loop so it can be torn`,
      );
    }
  }

  return issues;
}

/** unit-level SCCs (same algorithm the executor uses), exported for tests */
export function sccList(graph: FlowGraph): Array<Set<string>> {
  const adj = new Map<string, string[]>();
  for (const u of graph.units) adj.set(u.id, []);
  for (const s of graph.streams) {
    if (s.to && s.to.unit !== s.from.unit) adj.get(s.from.unit)?.push(s.to.unit);
  }
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: Array<Set<string>> = [];
  let counter = 0;
  const strong = (v: string) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp = new Set<string>();
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.add(w);
      } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const u of graph.units) if (!index.has(u.id)) strong(u.id);
  return sccs.filter((s) => s.size > 1);
}

export type { StreamEdge };
