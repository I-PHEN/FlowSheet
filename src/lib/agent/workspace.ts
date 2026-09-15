/**
 * AgentWorkspace — the deterministic tool layer of the builder agent.
 *
 * Everything the LLM proposes arrives here as a ToolCall; everything the
 * LLM learns back comes from here as a ToolResult. The workspace NEVER
 * throws on malformed input (LLMs produce junk; the runtime must be
 * bulletproof) — every failure is a plain-English ToolResult the agent
 * reads and self-corrects from.
 *
 * Mutation tools (add_unit / connect / set_spec / …) mutate the FlowGraph
 * directly; validate + solve are the cage: solve refuses to run while
 * validation issues remain, and catches every runtime error from the
 * executor as feedback instead of a crash.
 */

import type { FlowGraph, GraphIssue, StreamEdge, StreamState } from '../engine/graph';
import { getUnitType, resolveSpecs } from '../engine/registry';
import { validateGraph } from '../engine/validate';
import { executeGraph } from '../engine/executor';
import type { PlantResult, StreamClass } from '../engine/types';
import { SPECIES, SP } from '../engine/species';
import { total } from '../engine/thermo';
import type { ToolCall, ToolResult, SolveSummary } from './protocol';
import { graphDigest } from './catalog';

const STREAM_CLASSES: StreamClass[] = ['feed', 'syngas', 'loopgas', 'product', 'water', 'co2', 'purge'];
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;

const ok = (summary: string, data?: Record<string, unknown>): ToolResult => ({ ok: true, summary, data });
const fail = (summary: string, data?: Record<string, unknown>): ToolResult => ({ ok: false, summary, data });

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);
const numv = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** accept "M1.out" or {unit:'M1', port:'out'} */
function parseEndpoint(v: unknown): { unit: string; port: string } | null {
  if (typeof v === 'string') {
    const m = v.trim().match(/^([A-Za-z][A-Za-z0-9_-]{0,15})\.([A-Za-z][A-Za-z0-9_-]{0,15})$/);
    if (m) return { unit: m[1], port: m[2] };
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const unit = str(o.unit);
    const port = str(o.port);
    if (unit && port) return { unit, port };
  }
  return null;
}

export interface WorkspaceState {
  graph: FlowGraph;
  lastResult: PlantResult | null;
  actionCount: number;
  mutationCount: number;
}

export class AgentWorkspace {
  graph: FlowGraph = { units: [], streams: [], controllers: [] };
  lastResult: PlantResult | null = null;
  actionCount = 0;
  mutationCount = 0;

  constructor(initial?: FlowGraph) {
    if (initial) this.graph = structuredClone(initial);
  }

  /** did this tool mutate the graph? (orchestrator emits a snapshot after) */
  get mutated(): boolean {
    return this._mutated;
  }
  private _mutated = false;

  solveSummary(): SolveSummary | null {
    const r = this.lastResult;
    if (!r) return null;
    return {
      kpis: r.kpis,
      converged: r.converged,
      iterations: r.iterations,
      solveMs: r.solveMs,
      balanceWorstRelErr: r.balance.reduce((w, b) => Math.max(w, b.relErr), 0),
      warnings: r.warnings,
    };
  }

  execute(call: ToolCall): ToolResult {
    this.actionCount++;
    this._mutated = false;
    const a = call.args ?? {};
    switch (call.tool) {
      case 'add_unit':
        return this.addUnit(str(a.id), str(a.type));
      case 'remove_unit':
        return this.removeUnit(str(a.id));
      case 'connect':
        return this.connect(str(a.id), str(a.name), str(a.cls), a.from, a.to === null || a.to === undefined ? null : a.to, a.implicit === true);
      case 'disconnect':
        return this.disconnect(str(a.id));
      case 'set_spec':
        return this.setSpec(str(a.unit), str(a.key), a.value);
      case 'add_controller':
        return this.addController(a);
      case 'remove_controller':
        return this.removeController(str(a.id));
      case 'validate':
        return this.validate();
      case 'solve':
        return this.solve();
      case 'read_stream':
        return this.readStream(str(a.id));
      case 'get_graph':
        return ok(`current graph: ${this.graph.units.length} units, ${this.graph.streams.length} streams`, {
          digest: graphDigest(this.graph),
        });
      default:
        return fail(`unknown tool "${call.tool}" — available: add_unit, remove_unit, connect, disconnect, set_spec, add_controller, remove_controller, validate, solve, read_stream, get_graph`);
    }
  }

  // ------------------------------------------------------------- mutations

  private addUnit(id: string | null, type: string | null): ToolResult {
    if (!id) return fail('add_unit needs an "id" (e.g. "R1")');
    if (!ID_RE.test(id)) return fail(`unit id "${id}" is invalid — use 1–16 chars: letters, digits, _ or - (must start with a letter)`);
    if (!type) return fail('add_unit needs a "type" from the catalog');
    const def = getUnitType(type);
    if (!def) return fail(`unknown unit type "${type}" — pick one from the catalog`);
    if (this.graph.units.some((u) => u.id === id)) return fail(`unit id "${id}" already exists`);
    this.graph.units.push({ id, type, specs: {} });
    this.mutationCount++;
    this._mutated = true;
    return ok(`added ${id} — ${def.name} (specs at defaults)`, { unit: { id, type } });
  }

  private removeUnit(id: string | null): ToolResult {
    if (!id) return fail('remove_unit needs an "id"');
    const u = this.graph.units.find((x) => x.id === id);
    if (!u) return fail(`unit "${id}" does not exist`);
    this.graph.units = this.graph.units.filter((x) => x.id !== id);
    const droppedStreams = this.graph.streams.filter((s) => s.from.unit === id || s.to?.unit === id);
    const droppedIds = new Set(droppedStreams.map((s) => s.id));
    this.graph.streams = this.graph.streams.filter((s) => !droppedIds.has(s.id));
    this.graph.controllers = this.graph.controllers.filter((c) => c.manipulate !== id && !droppedIds.has(c.measure));
    this.mutationCount++;
    this._mutated = true;
    const extra = droppedStreams.length > 0 ? ` and removed ${droppedStreams.length} connected stream(s)` : '';
    return ok(`removed ${id}${extra}`);
  }

  private connect(id: string | null, name: string | null, cls: string | null, from: unknown, to: unknown, implicit: boolean): ToolResult {
    if (!id) return fail('connect needs a stream "id" (e.g. "S01")');
    if (!ID_RE.test(id)) return fail(`stream id "${id}" is invalid — use 1–16 chars: letters, digits, _ or - (must start with a letter)`);
    if (!name) return fail(`stream "${id}" needs a human-readable "name" (e.g. "Natural gas feed")`);
    if (!cls || !STREAM_CLASSES.includes(cls as StreamClass)) {
      return fail(`stream class "${cls}" is invalid — one of: ${STREAM_CLASSES.join(', ')}`);
    }
    const fromEp = parseEndpoint(from);
    if (!fromEp) return fail('"from" must be "UNIT.port" (e.g. "SRC_NG.out")');
    const src = this.graph.units.find((u) => u.id === fromEp.unit);
    if (!src) return fail(`"from" unit "${fromEp.unit}" does not exist`);
    const srcDef = getUnitType(src.type);
    if (!srcDef) return fail(`unit "${fromEp.unit}" has unknown type — remove and re-add it`);
    if (!srcDef.ports.out.some((p) => p.key === fromEp.port)) {
      return fail(`unit ${fromEp.unit} has no outlet port "${fromEp.port}" — outlets: ${srcDef.ports.out.map((p) => p.key).join(', ') || 'none'}`);
    }
    let toEp: { unit: string; port: string } | null = null;
    if (to !== null && to !== undefined) {
      const ep = parseEndpoint(to);
      if (!ep) return fail('"to" must be "UNIT.port" or null (null = stream leaves the plant)');
      toEp = ep;
      const dst = this.graph.units.find((u) => u.id === ep.unit);
      if (!dst) return fail(`"to" unit "${ep.unit}" does not exist`);
      const dstDef = getUnitType(dst.type);
      if (!dstDef) return fail(`unit "${ep.unit}" has unknown type`);
      if (!dstDef.ports.in.some((p) => p.key === ep.port)) {
        return fail(`unit ${ep.unit} has no inlet port "${ep.port}" — inlets: ${dstDef.ports.in.map((p) => p.key).join(', ') || 'none'}`);
      }
      const kindOut = srcDef.ports.out.find((p) => p.key === fromEp.port)?.kind;
      const kindIn = dstDef.ports.in.find((p) => p.key === ep.port)?.kind;
      if (kindOut && kindIn && kindOut !== 'any' && kindIn !== 'any' && kindOut !== kindIn) {
        return fail(`port phase mismatch: ${fromEp.unit}.${fromEp.port} is ${kindOut} but ${ep.unit}.${ep.port} expects ${kindIn}`);
      }
    }
    if (this.graph.streams.some((s) => s.id === id)) return fail(`stream id "${id}" already exists`);
    const edge: StreamEdge = {
      id,
      name,
      cls: cls as StreamClass,
      from: fromEp,
      to: toEp,
      implicit,
    };
    this.graph.streams.push(edge);
    this.mutationCount++;
    this._mutated = true;
    return ok(`connected ${id} "${name}" [${cls}]: ${fromEp.unit}.${fromEp.port} → ${toEp ? `${toEp.unit}.${toEp.port}` : 'environment'}`);
  }

  private disconnect(id: string | null): ToolResult {
    if (!id) return fail('disconnect needs a stream "id"');
    const s = this.graph.streams.find((x) => x.id === id);
    if (!s) return fail(`stream "${id}" does not exist`);
    this.graph.streams = this.graph.streams.filter((x) => x.id !== id);
    this.graph.controllers = this.graph.controllers.filter((c) => c.measure !== id);
    this.mutationCount++;
    this._mutated = true;
    return ok(`disconnected ${id}`);
  }

  private setSpec(unitId: string | null, key: string | null, value: unknown): ToolResult {
    if (!unitId) return fail('set_spec needs a "unit" id');
    if (!key) return fail('set_spec needs a "key" from the unit type spec list');
    const u = this.graph.units.find((x) => x.id === unitId);
    if (!u) return fail(`unit "${unitId}" does not exist`);
    const def = getUnitType(u.type);
    if (!def) return fail(`unit "${unitId}" has unknown type`);
    const f = def.specFields.find((x) => x.key === key);
    if (!f) return fail(`spec "${key}" is not a knob of ${u.type} — available: ${def.specFields.map((x) => x.key).join(', ')}`);
    if (f.kind === 'number') {
      const v = numv(value);
      if (v === null) return fail(`spec "${key}" of ${unitId} must be a number (got ${JSON.stringify(value)})`);
      let applied = v;
      let note = '';
      if (f.min !== undefined && v < f.min) {
        applied = f.min;
        note = ` — clamped up to physical min ${f.min}`;
      } else if (f.max !== undefined && v > f.max) {
        applied = f.max;
        note = ` — clamped down to physical max ${f.max}`;
      }
      u.specs[key] = applied;
      this.mutationCount++;
      this._mutated = true;
      return ok(`set ${unitId}.${key} = ${applied}${f.unit ? ` ${f.unit}` : ''}${note}`);
    }
    if (f.kind === 'boolean') {
      if (typeof value !== 'boolean') return fail(`spec "${key}" of ${unitId} must be true or false`);
      u.specs[key] = value;
      this.mutationCount++;
      this._mutated = true;
      return ok(`set ${unitId}.${key} = ${value}`);
    }
    // number[]
    if (!Array.isArray(value) || !value.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      return fail(`spec "${key}" of ${unitId} must be a list of numbers`);
    }
    let arr = [...(value as number[])];
    const defArr = Array.isArray(f.default) ? (f.default as number[]) : [];
    if (defArr.length > 0) {
      arr = arr.slice(0, defArr.length);
      while (arr.length < defArr.length) arr.push(defArr[arr.length]);
    }
    if (f.elemMin !== undefined) arr = arr.map((x) => Math.max(x, f.elemMin!));
    if (f.elemMax !== undefined) arr = arr.map((x) => Math.min(x, f.elemMax!));
    const note = arr.length !== (value as number[]).length ? ` (length adjusted to ${arr.length})` : '';
    u.specs[key] = arr;
    this.mutationCount++;
    this._mutated = true;
    return ok(`set ${unitId}.${key} = [${arr.join(', ')}]${note}`);
  }

  private addController(a: Record<string, unknown>): ToolResult {
    const id = str(a.id);
    if (!id) return fail('add_controller needs an "id" (e.g. "CTRL_AIR")');
    if (!ID_RE.test(id)) return fail(`controller id "${id}" is invalid`);
    if (this.graph.controllers.some((c) => c.id === id)) return fail(`controller "${id}" already exists`);
    const manipulate = str(a.manipulate);
    if (!manipulate) return fail('add_controller needs "manipulate" — the feed unit whose flow is adjusted');
    const src = this.graph.units.find((u) => u.id === manipulate);
    if (!src) return fail(`manipulate unit "${manipulate}" does not exist`);
    const srcDef = getUnitType(src.type);
    if (!srcDef || !srcDef.specFields.some((f) => f.key === 'flow')) {
      return fail(`"${manipulate}" has no "flow" spec — the controller must manipulate a feed source (ng-source / steam-source / air-source)`);
    }
    const measure = str(a.measure);
    if (!measure) return fail('add_controller needs "measure" — the stream id where the ratio is measured');
    if (!this.graph.streams.some((s) => s.id === measure)) return fail(`measure stream "${measure}" does not exist`);
    const numIdx = numv(a.num);
    const denIdx = numv(a.den);
    if (numIdx === null || denIdx === null || !Number.isInteger(numIdx) || !Number.isInteger(denIdx) || numIdx < 0 || numIdx >= SPECIES.length || denIdx < 0 || denIdx >= SPECIES.length) {
      return fail(`"num" and "den" must be species indexes 0–${SPECIES.length - 1} (${SPECIES.join(', ')})`);
    }
    const set = numv(a.set);
    if (set === null || set < 0.5 || set > 6) return fail('"set" (target ratio) must be between 0.5 and 6');
    const auto = a.auto !== false; // default true
    this.graph.controllers.push({ id, manipulate, measure, num: numIdx, den: denIdx, set, auto });
    this.mutationCount++;
    this._mutated = true;
    return ok(`added controller ${id}: ${manipulate}.flow holds ${SPECIES[numIdx]}/${SPECIES[denIdx]} = ${set} at stream ${measure}`);
  }

  private removeController(id: string | null): ToolResult {
    if (!id) return fail('remove_controller needs an "id"');
    const c = this.graph.controllers.find((x) => x.id === id);
    if (!c) return fail(`controller "${id}" does not exist`);
    this.graph.controllers = this.graph.controllers.filter((x) => x.id !== id);
    this.mutationCount++;
    this._mutated = true;
    return ok(`removed controller ${id}`);
  }

  // --------------------------------------------------------------- the cage

  validate(): ToolResult {
    const issues: GraphIssue[] = validateGraph(this.graph);
    if (issues.length === 0) {
      return ok(`validation clean — ${this.graph.units.length} units, ${this.graph.streams.length} streams, ${this.graph.controllers.length} controller(s)`, { issues: [] });
    }
    return fail(`validation found ${issues.length} issue(s):\n${issues.map((i, k) => `${k + 1}. ${i.message}`).join('\n')}`, { issues });
  }

  solve(): ToolResult {
    const issues: GraphIssue[] = validateGraph(this.graph);
    if (issues.length > 0) {
      return fail(`cannot solve — fix these validation issues first:\n${issues.map((i, k) => `${k + 1}. ${i.message}`).join('\n')}`, { issues });
    }
    try {
      const result = executeGraph(this.graph);
      this.lastResult = result;
      const summary = this.solveSummary()!;
      return ok(
        `solved: converged=${result.converged}, ${result.iterations} loop iterations, ${result.solveMs.toFixed(0)} ms — production ${result.kpis.productionTpd.toFixed(1)} t/d, purity ${(result.kpis.productPurityWt * 100).toFixed(1)} wt %, per-pass ${(result.kpis.perPassConv * 100).toFixed(1)} %`,
        { ...summary },
      );
    } catch (e) {
      return fail(`solver error: ${(e as Error).message}`);
    }
  }

  private readStream(id: string | null): ToolResult {
    if (!id) return fail('read_stream needs a stream "id"');
    const r = this.lastResult;
    if (!r) return fail('no solved result yet — call solve first');
    const s = r.streams[id];
    if (!s) return fail(`stream "${id}" is not in the solved result — existing: ${Object.keys(r.streams).join(', ')}`);
    const n: number[] = s.n;
    const tot = total(n);
    const wet = SPECIES.map((name, i) => (n[i] > 1e-6 ? `${name} ${((n[i] / tot) * 100).toFixed(2)}%` : null)).filter(Boolean);
    const dry = tot - n[7];
    const dryC = SPECIES.map((name, i) => (i !== 7 && n[i] > 1e-6 ? `${name} ${((n[i] / Math.max(dry, 1e-9)) * 100).toFixed(2)}%` : null)).filter(Boolean);
    const mw = tot > 0 ? n.reduce((acc, v, i) => acc + v * SP[SPECIES[i]].mw, 0) / tot : 0;
    return ok(`${id} "${s.name}": ${(s.T - 273.15).toFixed(1)} °C, ${(s.P / 1e5).toFixed(1)} bar, ${tot.toFixed(1)} kmol/h, MW ${mw.toFixed(2)} — wet: ${wet.join(', ')} · dry: ${dryC.join(', ')}`, {
      T_C: s.T - 273.15,
      P_bar: s.P / 1e5,
      total_kmolh: tot,
    });
  }

  /** structured clone of the current graph (event snapshots / tests) */
  snapshot(): FlowGraph {
    return structuredClone(this.graph);
  }
}
