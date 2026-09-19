/**
 * Generic Operate — any saved plant becomes a live control room.
 *
 * The user's law: everything the app does for a plant must be DERIVED from
 * data, so the agent's builds get the identical experience the prebuilts
 * have, with zero per-plant code. Here that means:
 *
 *   levers   — derived from the graph + the registry's spec-field metadata
 *              (min/max/unit/doc are declared per unit TYPE, never per
 *              plant): source units contribute their flow (the plant's
 *              throttle(s), unless a live controller owns that flow);
 *              process units contribute at most one operating lever —
 *              outlet temperature first, then any temperature field, then
 *              a pressure field.
 *   answers  — derived from the family KPIs the solver already computes
 *              for every plant (familyKpis when present, generic
 *              production/purity/conversion otherwise), with live deltas
 *              against the saved design point.
 *
 * The same law runs for every plant the agent will ever build; new
 * families get a control room for free.
 */

import type { FlowGraph, GraphUnit, SpecField } from '@/lib/engine/graph';
import type { Kpis } from '@/lib/engine/types';
import { getUnitType, resolveSpecs } from '@/lib/engine/registry';

/** one operable knob on one unit — everything a slider needs, from data */
export interface OperateLever {
  /** stable identity: `${unitId}::${specKey}` */
  key: string;
  unitId: string;
  specKey: string;
  /** display name of the unit type (registry) */
  label: string;
  /** the unit's id on the sheet — disambiguates twins */
  ref: string;
  /** one-line operating hint (registry doc, or the unit's model line) */
  hint: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

/** max levers shown — the panel stays a control room, not a spec sheet */
export const LEVER_CAP = 7;
/** max feed throttles — a plant with 6 feeds still reads clearly */
export const THROTTLE_CAP = 3;

/** a number field worth a slider right now (temperature by intent) */
function isTempField(f: SpecField): boolean {
  return f.kind === 'number' && f.unit === '°C';
}

/** a number field worth a slider right now (pressure by intent) */
function isPressureField(f: SpecField): boolean {
  return f.kind === 'number' && f.unit === 'bar' && /P$|^P/.test(f.key);
}
/** the named pressure levers — a compressor's discharge or an outlet set-P */
function isNamedPressureField(f: SpecField): boolean {
  return f.kind === 'number' && (f.key === 'dischargeP' || f.key === 'outletP');
}

/**
 * The operating field a process unit contributes, in teaching priority:
 * outletT (the hot section) → dischargeP/outletP (the loop/section pressure
 * — the classic compressor lever) → any temperature field → any pressure
 * field. This is the triad the reference plant teaches — feed, run hotter,
 * squeeze harder — derived for every plant from the registry alone.
 */
function operatingField(def: ReturnType<typeof getUnitType>): SpecField | null {
  if (!def) return null;
  const numeric = def.specFields.filter((f): f is SpecField & { kind: 'number' } => f.kind === 'number');
  const by = (pred: (f: SpecField) => boolean) => numeric.find(pred) ?? null;
  return (
    by((f) => f.key === 'outletT') ??
    by(isNamedPressureField) ??
    by(isTempField) ??
    by(isPressureField)
  );
}

/** a slider step that gives ~40-60 detents across the range */
function niceStep(min: number, max: number): number {
  const raw = (max - min) / 60;
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) {
    const s = m * pow;
    if (s >= raw) return s;
  }
  return 10 * pow;
}

interface LeverSpec {
  unit: GraphUnit;
  field: SpecField;
  priority: number;
}

/**
 * Derive the levers for ANY graph. Sources' flow fields come first (largest
 * feed by default value — the plant's main throttle), then one operating
 * lever per process unit in sheet order. Fields owned by a live auto
 * controller are skipped honestly (dragging against a controller would look
 * broken; it isn't — the controller wins).
 */
export function deriveLevers(graph: FlowGraph): OperateLever[] {
  const controlled = new Set(
    graph.controllers.filter((c) => c.auto).map((c) => c.manipulate),
  );

  const throttles: LeverSpec[] = [];
  const operating: LeverSpec[] = [];

  for (const u of graph.units) {
    const def = getUnitType(u.type);
    if (!def) continue; // unknown type — never a lever
    const resolved = resolveSpecs(u);

    if (def.ports.in.length === 0) {
      // a feed: its flow is the throttle, unless a controller owns it
      if (controlled.has(u.id)) continue;
      const flow = def.specFields.find((f) => f.kind === 'number' && f.key === 'flow');
      if (!flow) continue;
      throttles.push({ unit: u, field: flow, priority: Number(resolved[flow.key]) || 0 });
    } else {
      const field = operatingField(def);
      if (!field) continue;
      operating.push({ unit: u, field, priority: 0 });
    }
  }

  // biggest feed first — the lever a student reaches for is the plant's
  // main throttle, and on every family plant that's the largest flow
  throttles.sort((a, b) => b.priority - a.priority);

  const picked = [
    ...throttles.slice(0, THROTTLE_CAP),
    ...operating,
  ].slice(0, LEVER_CAP);

  return picked.map(({ unit, field }) => {
    const def = getUnitType(unit.type)!;
    const resolved = resolveSpecs(unit);
    const value = Number(resolved[field.key]);
    const min = field.min ?? Math.min(value, 0);
    const max = field.max ?? (value * 2 || value + 1);
    return {
      key: `${unit.id}::${field.key}`,
      unitId: unit.id,
      specKey: field.key,
      label: def.name,
      ref: unit.id,
      hint: field.doc ?? def.model(resolved),
      unit: field.unit ?? '',
      min,
      max,
      step: niceStep(min, max),
      value: Number.isFinite(value) ? value : min,
    };
  });
}

/**
 * Immutable spec patch — returns a NEW graph (fresh identity, so canvases
 * and solve caches re-derive) with one unit's one spec replaced. The input
 * graph is never mutated: the design point stays pristine for reset.
 */
export function patchSpec(
  graph: FlowGraph,
  unitId: string,
  specKey: string,
  value: number,
): FlowGraph {
  return {
    ...graph,
    units: graph.units.map((u) =>
      u.id === unitId ? { ...u, specs: { ...u.specs, [specKey]: value } } : u,
    ),
  };
}

/** a headline number for the pinned answer bar (structurally AnswerStrip's cell) */
export interface AnswerCellLike {
  label: string;
  value: string;
  delta?: number;
  deltaUnit?: string;
}

const fmt1 = (v: number) =>
  v.toLocaleString('en-US', { maximumFractionDigits: 1 });

/**
 * The plant's answer, derived from the KPIs the solver already computed —
 * family headlines when the family provides them (production, purity,
 * recovery…), the generic production/purity/conversion triple otherwise.
 * Deltas are against the saved design point; rows without numbers (labels
 * like "Declared product") are dropped — the pinned bar is for numbers.
 */
export function answerCells(kpis: Kpis | null, base: Kpis | null | undefined): AnswerCellLike[] {
  if (!kpis) return [];

  const family = (kpis.familyKpis ?? []).filter((f) => typeof f.raw === 'number');
  if (family.length > 0) {
    const baseByLabel = new Map(
      (base?.familyKpis ?? []).map((f) => [f.label, f.raw] as const),
    );
    return family.slice(0, 4).map((f) => {
      const b = baseByLabel.get(f.label);
      return {
        label: f.label,
        value: f.value,
        ...(typeof b === 'number' && Number.isFinite(b)
          ? { delta: (f.raw as number) - b, deltaUnit: '' }
          : {}),
      };
    });
  }

  const dTpd = base ? kpis.productionTpd - base.productionTpd : undefined;
  const dPurity = base ? (kpis.productPurityMol - base.productPurityMol) * 100 : undefined;
  const dConv = base ? (kpis.perPassConv - base.perPassConv) * 100 : undefined;
  return [
    {
      label: 'Production',
      value: `${fmt1(kpis.productionTpd)} t/d`,
      ...(dTpd !== undefined ? { delta: dTpd, deltaUnit: 't/d' } : {}),
    },
    {
      label: 'Product purity',
      value: `${(kpis.productPurityMol * 100).toFixed(2)} % mol`,
      ...(dPurity !== undefined ? { delta: dPurity, deltaUnit: 'pt' } : {}),
    },
    {
      label: 'Per-pass conv.',
      value: `${(kpis.perPassConv * 100).toFixed(1)} %`,
      ...(dConv !== undefined ? { delta: dConv, deltaUnit: 'pt' } : {}),
    },
  ];
}
