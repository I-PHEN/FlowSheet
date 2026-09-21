/**
 * Engine-kind → equipment-glyph map.
 *
 * The reference workspace's Diagram draws every unit as a real PFD symbol
 * (Symbols.tsx — one grammar, distinct silhouettes); the builder canvas used
 * to draw generic rectangles, so a plant "changed shape" the moment it
 * entered the builder or a remix. This map lets ANY canvas render engine
 * units with the same symbol vocabulary: one line per registry type, and a
 * sensible vessel default for types added later.
 */

import type { UnitKind, UnitNode } from './layout';

const KIND_TO_GLYPH: Record<string, UnitKind> = {
  // feeds
  'ng-source': 'source',
  'steam-source': 'source',
  'air-source': 'source',
  'acid-gas-source': 'source',
  'syngas-feed': 'source',
  'column-feed': 'source',
  // mixing / splitting
  'feed-mixer': 'mixer',
  'loop-mixer': 'mixer',
  'purge-split': 'splitter',
  // fired / reaction equipment
  'primary-reformer': 'furnace',
  'secondary-reformer': 'secondary',
  'claus-burner': 'furnace',
  'wgs-hts': 'reactor',
  'wgs-lts': 'reactor',
  methanator: 'reactor',
  converter: 'converter',
  'meoh-converter': 'converter',
  'claus-converter': 'reactor',
  psa: 'reactor', // adsorber beds — vessel with a bed, reads right
  // heat exchange
  'whb-cooler': 'hex',
  intercooler: 'hex',
  'feed-preheater': 'hex',
  chiller: 'hex',
  'feed-heater': 'hex',
  'condensation-train': 'hex',
  'sulphur-condenser': 'hex',
  // vessels
  'ko-drum-shift': 'drum',
  'ko-drum-meth': 'drum',
  'nh3-separator': 'drum',
  'meoh-separator': 'drum',
  'flash-drum': 'drum',
  // columns
  'co2-removal': 'column',
  'distillation-column': 'dcolumn',
  // rotating
  'syngas-compressor': 'compressor',
  'loop-circulator': 'compressor',
};

/** the glyph kind an engine unit type draws as (vessel default). */
export function glyphFor(type: string): UnitKind {
  return KIND_TO_GLYPH[type] ?? 'reactor';
}

/** how far each symbol's INK sits inside its 96×52 glyph box, per side —
 *  [leftInset, rightInset] in glyph-box units. Streams terminate at the
 *  INK edge, not the box edge, so lines visibly touch the equipment: a
 *  mixer's triangle tip ends at 58% of the box, a source's circle at ~74%,
 *  while a furnace fills the box almost edge to edge. Derived from the
 *  symbol geometry in Symbols.tsx — keep the two in sync. */
export const INK_INSET: Record<string, [number, number]> = {
  mixer: [3, 40], // triangle points right; tip at 0.58w
  splitter: [40, 3], // mirror of the mixer
  furnace: [4, 4],
  secondary: [25, 25], // shell spans 0.26w..0.74w
  hex: [2, 4],
  reactor: [10, 10], // vessel spans 0.1w..0.9w
  column: [4, 4],
  drum: [2, 4],
  vdrum: [2, 4],
  compressor: [3, 3],
  converter: [8, 8], // vessel spans 0.08w..0.92w
  source: [25, 25], // sphere r=23 centered in the 96-wide box
  dcolumn: [5, 10],
};

/** insets for an engine unit TYPE (vessel default). */
export function inkInsetsFor(type: string): [number, number] {
  return INK_INSET[glyphFor(type)] ?? [2, 2];
}

/** a UnitNode-shaped prop for <UnitSymbol/> — geometry only, no layout role. */
export function glyphNode(id: string, type: string, w: number, h: number): UnitNode {
  return { id, tag: id, label: '', x: 0, y: 0, w, h, kind: glyphFor(type) };
}
