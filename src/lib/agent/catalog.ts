/**
 * Catalog digests — the registry rendered as compact text for LLM prompts.
 *
 * Everything here is DERIVED from engine/registry.ts at runtime: the agent
 * can never see a stale or hand-copied catalog. Two renders:
 *   catalogDigest()  — the full unit-type catalog (Architect + Engineer)
 *   graphDigest()    — the current build state (get_graph tool, Critic)
 */

import type { FlowGraph } from '../engine/graph';
import { getUnitType, resolveSpecs, UNIT_TYPES } from '../engine/registry';
import { SPECIES } from '../engine/species';

/** species table with indexes (controller num/den, read_stream output) */
export function speciesDigest(): string {
  return SPECIES.map((name, idx) => `${idx}: ${name}`).join(', ');
}

const specLine = (key: string, unit: string | undefined, min: number | undefined, max: number | undefined, def: number | boolean | number[], doc?: string) => {
  const range = min !== undefined && max !== undefined ? `${min}–${max}` : '';
  const d = Array.isArray(def) ? `[${def.join(', ')}]` : String(def);
  const bits = [key, unit, range && `range ${range}`, `default ${d}`].filter(Boolean).join(' · ');
  return doc ? `${bits} — ${doc}` : bits;
};

/** full unit catalog: type key, role, ports (with phases), spec fields */
export function catalogDigest(): string {
  const lines: string[] = [];
  for (const def of Object.values(UNIT_TYPES)) {
    const ins = def.ports.in.length > 0 ? def.ports.in.map((p) => `${p.key}:${p.kind}`).join(', ') : 'none (feed source)';
    const outs = def.ports.out.map((p) => `${p.key}:${p.kind}`).join(', ');
    const specs = def.specFields
      .map((f) => specLine(f.key, f.unit, f.min, f.max, f.default, f.doc))
      .join('; ');
    lines.push(`- ${def.type} — ${def.name}: ${def.model(resolveSpecs({ type: def.type, specs: {} }))}`);
    lines.push(`  in: ${ins} | out: ${outs}`);
    if (specs) lines.push(`  specs: ${specs}`);
  }
  return lines.join('\n');
}

/** current build state as compact text (get_graph / critic) */
export function graphDigest(graph: FlowGraph): string {
  if (graph.units.length === 0 && graph.streams.length === 0) return '(empty canvas — nothing built yet)';
  const lines: string[] = [];
  lines.push(`UNITS (${graph.units.length}):`);
  for (const u of graph.units) {
    const def = getUnitType(u.type);
    const specs = def ? resolveSpecs(u) : {};
    const changed = def
      ? def.specFields
          .filter((f) => JSON.stringify(specs[f.key]) !== JSON.stringify(f.default))
          .map((f) => `${f.key}=${Array.isArray(specs[f.key]) ? `[${(specs[f.key] as number[]).join(',')}]` : specs[f.key]}`)
      : [];
    lines.push(`- ${u.id} (${u.type})${changed.length > 0 ? ` — ${changed.join(', ')}` : ''}`);
  }
  lines.push(`STREAMS (${graph.streams.length}):`);
  for (const s of graph.streams) {
    const from = `${s.from.unit}.${s.from.port}`;
    const to = s.to ? `${s.to.unit}.${s.to.port}` : 'environment (sink)';
    lines.push(`- ${s.id} "${s.name}" [${s.cls}] ${from} → ${to}${s.implicit ? ' (implicit)' : ''}`);
  }
  if (graph.controllers.length > 0) {
    lines.push('CONTROLLERS:');
    for (const c of graph.controllers) {
      const num = SPECIES[c.num] ?? String(c.num);
      const den = SPECIES[c.den] ?? String(c.den);
      lines.push(`- ${c.id}: manipulates ${c.manipulate} flow to hold ${num}/${den} = ${c.set} in stream ${c.measure} (auto: ${c.auto})`);
    }
  } else {
    lines.push('CONTROLLERS: none');
  }
  return lines.join('\n');
}
