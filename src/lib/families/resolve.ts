/**
 * Structural stream resolution — family KPIs that survive id drift.
 *
 * The conventions ask the engineer to use canonical stream ids (S10 =
 * converter feed, …), and it usually does. But when a duplicate-stream
 * cleanup renames or drops a convention id, id-only KPI reads silently
 * return zeros — and the critic then reads "0 % conversion" as a broken
 * plant. Resolving BY UNIT TYPE (the stream entering the meoh-converter,
 * the stream leaving the psa product port, …) is drift-proof: the agent
 * can name streams anything as long as the right equipment is wired.
 *
 * Families use the S-id as the fast path and the structural lookup as the
 * fallback — on the reference graphs both resolve to the same stream, so
 * the ammonia identity gate is untouched.
 */

import type { FlowGraph, StreamState } from '@/lib/engine/graph';

export interface GraphStreams {
  /** the state of the stream entering unitId.port (first match) */
  into(unitId: string, port?: string): StreamState | undefined;
  /** the state of the stream leaving unitId.port (first match) */
  outOf(unitId: string, port?: string): StreamState | undefined;
  /** the state entering the FIRST unit of a registry type */
  intoType(type: string, port?: string): StreamState | undefined;
  /** the state leaving the FIRST unit of a registry type, at its port */
  outOfType(type: string, port: string): StreamState | undefined;
  /** the first unit id of a registry type (for spec reads) */
  unitIdOfType(type: string): string | undefined;
}

export function graphStreams(graph: FlowGraph, states: Record<string, StreamState>): GraphStreams {
  const into = (unitId: string, port = 'in'): StreamState | undefined => {
    const edge = graph.streams.find((s) => s.to?.unit === unitId && s.to.port === port);
    return edge ? states[edge.id] : undefined;
  };
  const outOf = (unitId: string, port: string): StreamState | undefined => {
    const edge = graph.streams.find((s) => s.from.unit === unitId && s.from.port === port);
    return edge ? states[edge.id] : undefined;
  };
  const unitIdOfType = (type: string): string | undefined => graph.units.find((u) => u.type === type)?.id;
  return {
    into,
    outOf,
    unitIdOfType,
    intoType: (type: string, port = 'in'): StreamState | undefined => {
      const uid = unitIdOfType(type);
      return uid ? into(uid, port) : undefined;
    },
    outOfType: (type: string, port: string): StreamState | undefined => {
      const uid = unitIdOfType(type);
      return uid ? outOf(uid, port) : undefined;
    },
  };
}
