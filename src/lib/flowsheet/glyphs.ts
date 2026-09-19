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

/** a UnitNode-shaped prop for <UnitSymbol/> — geometry only, no layout role. */
export function glyphNode(id: string, type: string, w: number, h: number): UnitNode {
  return { id, tag: id, label: '', x: 0, y: 0, w, h, kind: glyphFor(type) };
}
