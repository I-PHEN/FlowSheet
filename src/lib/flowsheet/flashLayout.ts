/**
 * Flash-separation layout — the beginner plant, drawn on ONE sheet.
 *
 * Three pieces of equipment tell the whole story: a feed sphere at the
 * battery limit, a chiller that sets the temperature, and the flash drum
 * where one stream becomes two. Vapor leaves the top toward recycle; liquid
 * ammonia leaves the boot as product. Same drawing conventions as the
 * ammonia sheet (frame, title block, numbered pills, class colors) — a
 * student who can read this can read the big plant.
 */

import type { PlantLayout, StreamEdge, UnitNode } from './layout';

const UNITS: UnitNode[] = [
  // feed sphere — battery-limit source
  { id: 'FEED', tag: 'F-101', label: 'SYNGAS FEED', x: 96, y: 284, w: 56, h: 44, kind: 'source' },
  // chiller — refrigerated cooler, horizontal shell-and-tube
  { id: 'CHILL', tag: 'E-101', label: 'CHILLER', x: 340, y: 278, w: 64, h: 56, kind: 'hex' },
  // flash drum — vertical vessel with liquid boot
  { id: 'DRUM', tag: 'V-101', label: 'FLASH DRUM', x: 664, y: 200, w: 84, h: 132, kind: 'vdrum' },
];

const STREAMS: StreamEdge[] = [
  // F-101 → E-101 (battery-limit feed gas)
  { id: 'S01', pts: [[152, 306], [340, 306]], cls: 'syngas', labelAt: 0.5 },
  // E-101 → V-101 upper side nozzle (chilled gas)
  { id: 'S02', pts: [[404, 306], [548, 306], [548, 246], [664, 246]], cls: 'syngas', labelAt: 0.45 },
  // V-101 top → gas to recycle
  { id: 'S03', pts: [[706, 200], [706, 112], [1030, 112]], cls: 'loopgas', labelAt: 0.3 },
  // V-101 boot → liquid ammonia product
  { id: 'S04', pts: [[706, 332], [706, 448], [1030, 448]], cls: 'product', labelAt: 0.3 },
];

const ANNOTATIONS: PlantLayout['annotations'] = [
  { x: 1042, y: 100, text: 'GAS TO RECYCLE' },
  { x: 1042, y: 470, text: 'LIQUID AMMONIA' },
];

export const FLASH_LAYOUT: PlantLayout = {
  canvas: { w: 1200, h: 620 },
  sheet: { x: 10, y: 10, w: 1180, h: 600 },
  zones: [], // three units need no zones — the whole sheet is one idea
  zoneDividers: [],
  titleBlock: {
    x: 1010,
    y: 514,
    w: 180,
    h: 96,
    title: 'FLASH SEPARATION',
    subtitle: 'PROCESS FLOW DIAGRAM',
    foot: 'SHEET 1 OF 1 · REV A',
  },
  units: UNITS,
  streams: STREAMS,
  annotations: ANNOTATIONS,
};

export const FLASH_UNIT_MAP: Record<string, UnitNode> = Object.fromEntries(
  UNITS.map((u) => [u.id, u]),
);
export const FLASH_STREAM_MAP: Record<string, StreamEdge> = Object.fromEntries(
  STREAMS.map((s) => [s.id, s]),
);

export const FLASH_UNIT_STREAMS: Record<string, { in: string[]; out: string[] }> = {
  FEED: { in: [], out: ['S01'] },
  CHILL: { in: ['S01'], out: ['S02'] },
  DRUM: { in: ['S02'], out: ['S03', 'S04'] },
};
