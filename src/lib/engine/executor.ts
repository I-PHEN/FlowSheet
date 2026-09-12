/**
 * Graph executor — sequential-modular solve over a FlowGraph.
 *
 * Pipeline: resolve specs → detect recycle loops (Tarjan SCC) → choose
 * tear edges (prefer spec-determined outlets) → run design controllers
 * (secant on a source flow) → topological walk → converge torn loops
 * (damped-DS + Broyden via converge.ts) → assemble PlantResult.
 *
 * v1 is the ammonia executor: the KPI block reads the reference stream
 * and unit ids (defensively, so agent-modified graphs still solve). When
 * species #2 arrives this splits into a generic walker + species KPI hook.
 *
 * The identity gate: executeGraph(buildGraph(spec)) must reproduce the
 * legacy run(spec) byte-for-byte (all streams, metrics, traces, warnings).
 */

import type { FlowGraph, StreamEdge, StreamState } from './graph';
import { getUnitType, resolveSpecs, tearInit, airControllerInit } from './registry';
import { makeResid, solveSecant, solveTearLoop } from './converge';
import type { UnitResult, PlantResult, Kpis, ElementBalance, Stream } from './types';
import { ATOMS, ATOM_MATRIX, LHV_CH4, N_SP, SP } from './species';
import type { Moles } from './species';
import { massFlow, total } from './thermo';
import { zeroN } from './units';

const C = (celsius: number) => celsius + 273.15;

// ---------------------------------------------------------------------------
// graph indexing
// ---------------------------------------------------------------------------

interface Index {
  byId: Map<string, StreamEdge>;
  outEdges: Map<string, StreamEdge[]>;
  inEdges: Map<string, StreamEdge[]>; // self-edges excluded
  order: string[]; // graph unit order for deterministic tie-breaks
}

function indexGraph(graph: FlowGraph): Index {
  const byId = new Map(graph.streams.map((s) => [s.id, s]));
  const outEdges = new Map<string, StreamEdge[]>();
  const inEdges = new Map<string, StreamEdge[]>();
  for (const u of graph.units) {
    outEdges.set(u.id, []);
    inEdges.set(u.id, []);
  }
  for (const s of graph.streams) {
    outEdges.get(s.from.unit)?.push(s);
    if (s.to && s.to.unit !== s.from.unit) inEdges.get(s.to.unit)?.push(s);
  }
  return { byId, outEdges, inEdges, order: graph.units.map((u) => u.id) };
}

/** Tarjan SCC over the unit digraph (self-loops excluded). */
function detectSccs(graph: FlowGraph, idx: Index): Array<Set<string>> {
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
  const strongconnect = (v: string) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
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
  for (const v of idx.order) if (!index.has(v)) strongconnect(v);
  return sccs.filter((s) => s.size > 1);
}

/** Choose the tear edge for one recycle cluster. */
function chooseTear(
  graph: FlowGraph,
  idx: Index,
  scc: Set<string>,
): StreamEdge | null {
  const internal = graph.streams.filter(
    (s) => s.to && scc.has(s.from.unit) && scc.has(s.to.unit) && s.from.unit !== s.to.unit,
  );
  if (internal.length === 0) return null;
  // 1. prefer edges leaving a unit whose outlet T/P are spec-determined
  const fixed = internal.filter((s) => getUnitType(graph.units.find((u) => u.id === s.from.unit)!.type)?.fixedOutlet);
  if (fixed.length > 0) return fixed[0];
  // 2. fall back to the outlet of a unit fed from outside the cluster
  const entry = internal.filter((s) => (idx.inEdges.get(s.from.unit) ?? []).some((e) => !scc.has(e.from.unit)));
  if (entry.length > 0) return entry[0];
  return null; // unsupported in v1 — the validator reports this before solve
}

/** Kahn topological order with the torn edges cut. */
function topoOrder(graph: FlowGraph, idx: Index, cutIds: Set<string>): string[] {
  const indeg = new Map<string, number>();
  for (const u of graph.units) indeg.set(u.id, 0);
  for (const s of graph.streams) {
    if (!s.to || s.to.unit === s.from.unit || cutIds.has(s.id)) continue;
    indeg.set(s.to.unit, (indeg.get(s.to.unit) ?? 0) + 1);
  }
  const ready = graph.units.filter((u) => (indeg.get(u.id) ?? 0) === 0).map((u) => u.id);
  const orderPos = new Map(idx.order.map((id, i) => [id, i]));
  const out: string[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => orderPos.get(a)! - orderPos.get(b)!);
    const u = ready.shift()!;
    out.push(u);
    for (const s of idx.outEdges.get(u) ?? []) {
      if (!s.to || s.to.unit === u || cutIds.has(s.id)) continue;
      const d = (indeg.get(s.to.unit) ?? 0) - 1;
      indeg.set(s.to.unit, d);
      if (d === 0) ready.push(s.to.unit);
    }
  }
  if (out.length !== graph.units.length) {
    throw new Error('graph is not executable: cycle remains after tear selection (no tearable edge found)');
  }
  return out;
}

// ---------------------------------------------------------------------------
// executor
// ---------------------------------------------------------------------------

export function executeGraph(graph: FlowGraph): PlantResult {
  const t0 = performance.now();
  const idx = indexGraph(graph);
  const typeOf = (id: string) => getUnitType(graph.units.find((u) => u.id === id)!.type)!;
  const isSource = (id: string) => typeOf(id).ports.in.length === 0;

  // resolved specs (mutable — the controller adjusts the source flow)
  const specs: Record<string, Record<string, number | boolean | number[]>> = {};
  for (const u of graph.units) specs[u.id] = resolveSpecs(u);

  // --- recycle detection & tear selection ---
  const sccs = detectSccs(graph, idx);
  if (sccs.length > 1) throw new Error('graphs with multiple independent recycle loops are not supported yet');
  const scc = sccs[0] ?? new Set<string>();
  const cut = scc.size > 0 ? chooseTear(graph, idx, scc) : null;
  if (scc.size > 0 && !cut) throw new Error('recycle loop has no tearable edge (add a spec-outlet unit into the loop)');
  const cutIds = new Set(cut ? [cut.id] : []);
  const order = topoOrder(graph, idx, cutIds);

  // mutable solve state
  let states: Record<string, StreamState> = {};
  const unitRecs: Record<string, UnitResult> = {};
  const lateWarns: string[] = [];
  const cutCtx: { edge: StreamEdge | null; computed: StreamState | null } = { edge: cut, computed: null };

  const runUnit = (unitId: string, st: Record<string, StreamState>, ur: Record<string, UnitResult>, ws: string[]) => {
    const unit = graph.units.find((u) => u.id === unitId)!;
    const def = typeOf(unitId);
    const selfIds = new Set(
      (idx.outEdges.get(unitId) ?? []).filter((s) => s.to && s.to.unit === unitId).map((s) => s.id),
    );
    const inlet = (port: string): StreamState => {
      const edge = (idx.inEdges.get(unitId) ?? []).find((s) => s.to!.port === port && !selfIds.has(s.id));
      if (!edge) throw new Error(`port ${unitId}.${port} has no incoming stream`);
      const s = st[edge.id];
      if (!s) throw new Error(`stream ${edge.id} feeding ${unitId}.${port} was not computed yet`);
      return s;
    };
    const out = def.solve({ specs: specs[unitId], inlet, warn: (m) => ws.push(m) });
    for (const [port, state] of Object.entries(out.outlets)) {
      const edge = (idx.outEdges.get(unitId) ?? []).find((s) => s.from.port === port);
      if (edge && cutCtx.edge && edge.id === cutCtx.edge.id) {
        cutCtx.computed = state; // torn edge: flows come from the tear value
        continue;
      }
      if (edge) st[edge.id] = state;
    }
    if (def.ports.in.length > 0) ur[unitId] = { id: unitId, ...out.result };
  };

  // --- phase 1: design controller(s) on the front section ---
  const ctrl = graph.controllers[0];
  let h2n2Err: number | null = null;
  let feWarns: string[] = [];
  let controlledAir: number | undefined;

  if (ctrl) {
    // scope = ancestors of the measured stream's producer + the manipulated source
    const measureEdge = idx.byId.get(ctrl.measure);
    if (!measureEdge || !measureEdge.to) throw new Error(`controller ${ctrl.id}: measure stream ${ctrl.measure} not found`);
    const scope = new Set<string>([ctrl.manipulate, measureEdge.from.unit]);
    const queue = [measureEdge.from.unit];
    while (queue.length > 0) {
      const u = queue.pop()!;
      for (const e of idx.inEdges.get(u) ?? []) {
        if (!scope.has(e.from.unit)) {
          scope.add(e.from.unit);
          queue.push(e.from.unit);
        }
      }
    }

    if (ctrl.auto) {
      const feedFlow = specs['SRC_NG']?.flow as number | undefined;
      const { x0, x1 } = airControllerInit(typeof feedFlow === 'number' ? feedFlow : 1000);
      const f = (air: number) => {
        const st: Record<string, StreamState> = {};
        const ur: Record<string, UnitResult> = {};
        const ws: string[] = [];
        specs[ctrl.manipulate] = { ...specs[ctrl.manipulate], flow: air };
        for (const u of order) if (scope.has(u)) runUnit(u, st, ur, ws);
        const m = st[ctrl.measure];
        if (!m) throw new Error(`controller ${ctrl.id}: measure stream ${ctrl.measure} not produced`);
        const val = m.n[ctrl.den] > 1e-9 ? m.n[ctrl.num] / m.n[ctrl.den] - ctrl.set : 0;
        return { val, state: { st, ur, ws } };
      };
      const best = solveSecant(x0, x1, f);
      states = { ...best.state.st };
      for (const [k, v] of Object.entries(best.state.ur)) unitRecs[k] = v;
      feWarns = [...best.state.ws];
      specs[ctrl.manipulate] = { ...specs[ctrl.manipulate], flow: best.x };
      controlledAir = best.x;
      h2n2Err = best.err;
    } else {
      for (const u of order) if (scope.has(u)) runUnit(u, states, unitRecs, feWarns);
      h2n2Err = null;
    }
  } else {
    // no controller: run everything up to the recycle cluster directly
    for (const u of order) if (!scc.has(u)) runUnit(u, states, unitRecs, feWarns);
  }

  // --- phase 2: units between controller scope and the recycle cluster ---
  if (ctrl) {
    const scopeDone = new Set(Object.keys(unitRecs));
    for (const u of order) {
      if (!scc.has(u) && !scopeDone.has(u)) runUnit(u, states, unitRecs, lateWarns);
    }
  }

  // --- phase 3: converge the recycle cluster on the torn stream ---
  let converged = true;
  let iterations = 0;
  let trace: PlantResult['solverTrace'] = [];

  if (cut && scc.size > 0) {
    const upstreamType = typeOf(cut.from.unit);
    if (!upstreamType.fixedOutlet) throw new Error('tear edge upstream has no fixedOutlet');
    const cutTP = upstreamType.fixedOutlet(specs[cut.from.unit]);

    const makeup = states['S16']?.n ?? states['S18']?.n ?? zeroN();
    const tear0 = tearInit(makeup);
    const resid = makeResid(makeup);

    let loopWarns: string[] = [];
    const gFn = (x: Moles): Moles => {
      states[cut.id] = { n: x, T: cutTP.T, P: cutTP.P };
      cutCtx.computed = null;
      const ws: string[] = [];
      for (const u of order) {
        if (scc.has(u)) runUnit(u, states, unitRecs, ws);
      }
      loopWarns = ws;
      const computed = cutCtx.computed as StreamState | null;
      if (!computed) throw new Error('torn edge upstream unit did not execute');
      return computed.n;
    };

    const res = solveTearLoop(gFn, tear0, resid);
    if (res.converged) gFn(res.x); // final pass at the converged point
    converged = res.converged;
    iterations = res.iterations;
    trace = res.trace;
    lateWarns.push(...loopWarns);
  }

  // --- assembly ---
  const streams: Record<string, Stream> = {};
  for (const s of graph.streams) {
    if (s.implicit) continue;
    const st = states[s.id];
    if (!st) throw new Error(`stream ${s.id} was never computed`);
    streams[s.id] = { id: s.id, name: s.name, T: st.T, P: st.P, n: st.n, cls: s.cls };
  }

  // element balance: source outlets in vs environment sinks out
  const inlets: Moles = zeroN();
  for (const s of graph.streams) {
    if (isSource(s.from.unit)) for (let i = 0; i < N_SP; i++) inlets[i] += states[s.id]?.n[i] ?? 0;
  }
  const outlets: Moles = zeroN();
  for (const s of graph.streams) {
    if (s.to === null) for (let i = 0; i < N_SP; i++) outlets[i] += states[s.id]?.n[i] ?? 0;
  }
  const balance: ElementBalance[] = ATOMS.map((el, e) => {
    let vIn = 0;
    let vOut = 0;
    for (let i = 0; i < N_SP; i++) {
      vIn += inlets[i] * ATOM_MATRIX[e][i];
      vOut += outlets[i] * ATOM_MATRIX[e][i];
    }
    return {
      element: el as string,
      in: vIn,
      out: vOut,
      relErr: vIn > 1e-9 ? Math.abs(vOut - vIn) / vIn : 0,
    };
  });

  const warnings: string[] = [];
  if (h2n2Err !== null && Math.abs(h2n2Err) > 0.01) {
    warnings.push(`H2/N2 controller did not fully converge (residual ${h2n2Err.toFixed(3)})`);
  }
  if (!converged) warnings.push('Synthesis loop did not converge — results are the last iteration');
  warnings.push(...feWarns, ...lateWarns);

  // --- KPIs (ammonia reference ids; defensive for modified graphs) ---
  const S = (id: string): StreamState | undefined => states[id];
  const U = (id: string): UnitResult | undefined => unitRecs[id];
  const nFeed = S('S20')?.n ?? zeroN();
  const nEff = S('S21')?.n ?? zeroN();
  const product = S('S24')?.n ?? zeroN();
  const purge = S('S26')?.n ?? zeroN();
  const recycle = S('S27')?.n ?? zeroN();
  const makeup = S('S16')?.n ?? zeroN();
  const makeupTot = total(makeup);
  const feedTot = total(nFeed);
  const ngFeed = (specs['SRC_NG']?.flow as number | undefined) ?? 0;
  const chillT = (specs['E2']?.chillT as number | undefined) ?? -20;

  const inerts = feedTot > 0 ? (nFeed[4] + nFeed[5]) / feedTot : 0;
  const h2n2 = nFeed[1] > 1e-9 ? nFeed[0] / nFeed[1] : 0;
  const perPass = nFeed[1] > 1e-9 ? 1 - nEff[1] / nFeed[1] : 0;
  const overall = makeup[1] > 1e-9 ? 1 - purge[1] / makeup[1] : 0;
  const prodKg = massFlow(product);
  const prodTpd = (prodKg * 24) / 1000;
  const prodNH3kg = product[6] * SP.NH3.mw;
  const reformerDuty = U('R1')?.metrics[0]?.raw ?? 0;
  const wcDuty = U('E2')?.metrics[0]?.raw ?? 0;
  const chDuty = U('E2')?.metrics[1]?.raw ?? 0;
  const powerKW = (U('C1')?.metrics[0]?.raw ?? 0) * 1000 + (U('C2')?.metrics[0]?.raw ?? 0) + (chDuty / 2.4) * 1000;
  const feedGJd = (ngFeed * LHV_CH4 * 24) / 1e6;
  const fuelGJd = (reformerDuty * 3.6e6 * 24) / 1e6 / 0.92;
  const powerGJd = (powerKW * 24 * 3.6) / 1000;
  const specEnergy = prodTpd > 1e-9 ? (feedGJd + fuelGJd + powerGJd) / prodTpd : 0;
  const oxidesPpm = (() => {
    const s = S('S15');
    if (!s) return 0;
    const dry = total(s.n) - s.n[7];
    return dry > 0 ? ((s.n[2] + s.n[3]) / dry) * 1e6 : 0;
  })();

  const kpis: Kpis = {
    productionTpd: prodTpd,
    productPurityMol: prodKg > 0 ? product[6] / total(product) : 0,
    productPurityWt: prodKg > 0 ? prodNH3kg / prodKg : 0,
    perPassConv: perPass,
    overallConv: overall,
    loopInerts: inerts,
    h2n2Ratio: h2n2,
    makeupFlow: makeupTot,
    recycleMultiple: makeupTot > 1e-9 ? total(recycle) / makeupTot : 0,
    purgeFrac: (specs['SP1']?.purgeFrac as number | undefined) ?? 0,
    reformerDutyMW: reformerDuty,
    refrigerationDutyMW: chDuty,
    syngasComprPowerMW: U('C1')?.metrics[0]?.raw ?? 0,
    circulatorPowerKW: U('C2')?.metrics[0]?.raw ?? 0,
    specificEnergyGJt: specEnergy,
    airFlow: controlledAir ?? ((specs['SRC_AIR']?.flow as number | undefined) ?? 0),
    secondaryExitC: (U('R2')?.metrics[1]?.raw ?? 0) - 273.15,
    coSlipLTS: (() => {
      const s = S('S10');
      if (!s) return 0;
      const dry = total(s.n) - s.n[7];
      return dry > 0 ? s.n[2] / dry : 0;
    })(),
    oxidesAfterMeth: oxidesPpm,
  };

  if (prodTpd > 1 && kpis.productPurityWt < 0.985) {
    warnings.push('Product purity below 98.5 wt % — dissolved gases high (check separator T/P)');
  }
  if (chDuty > 0 && C(chillT) > C(-5)) {
    warnings.push('Separator above −5 °C — substantial NH3 recycling through the loop');
  }

  return {
    ok: true,
    converged,
    iterations,
    solveMs: performance.now() - t0,
    streams,
    units: unitRecs,
    kpis,
    solverTrace: trace,
    balance,
    warnings: [...new Set(warnings)],
    h2n2Err,
  };
}

/** test/agent introspection: which recycle cluster and tear edge the executor would use */
export function planTear(graph: FlowGraph): { scc: Set<string>; cut: StreamEdge | null } {
  const idx = indexGraph(graph);
  const sccs = detectSccs(graph, idx);
  const scc = sccs[0] ?? new Set<string>();
  return { scc, cut: scc.size > 0 ? chooseTear(graph, idx, scc) : null };
}
