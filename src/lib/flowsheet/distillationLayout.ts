/**
 * Distillation layout — rung 2, drawn on ONE sheet.
 *
 * The tall column is the hero: feed enters the side nozzle at the feed
 * stage, overhead vapor leaves the top for the condenser and reflux drum,
 * bottoms liquid drops to the reboiler, and the two internal loops (reflux
 * back to the top, boilup back to the bottom) close the story. Streams
 * S05–S09 are the column's internal flows — drawn, hoverable, and fed by
 * the same deterministic stage solve that produced S03/S04.
 *
 * Benzene–toluene at ~1.3 bar: top ≈ 89 °C, bottom ≈ 122 °C — a gentle,
 * honest column, the way the textbook draws it.
 */

import type { PlantLayout, StreamEdge, UnitNode } from './layout';

const UNITS: UnitNode[] = [
  // feed sphere — battery-limit source (45 mol % benzene in toluene)
  { id: 'FEED', tag: 'F-101', label: 'BENZENE–TOLUENE FEED', x: 60, y: 300, w: 56, h: 44, kind: 'source' },
  // feed preheater — sets the feed thermal condition q
  { id: 'HEATER', tag: 'E-101', label: 'FEED PREHEATER', x: 220, y: 296, w: 64, h: 56, kind: 'hex' },
  // the tower — 14 trays, feed on tray 8, PR-EOS volatility
  { id: 'COLUMN', tag: 'T-101', label: 'DISTILLATION COLUMN', x: 470, y: 130, w: 96, h: 420, kind: 'dcolumn' },
  // total condenser
  { id: 'COND', tag: 'E-102', label: 'CONDENSER', x: 700, y: 118, w: 64, h: 56, kind: 'hex' },
  // reflux drum — splits condensate into product + reflux
  { id: 'RDRUM', tag: 'V-101', label: 'REFLUX DRUM', x: 850, y: 120, w: 84, h: 52, kind: 'drum' },
  // kettle reboiler
  { id: 'REB', tag: 'E-103', label: 'REBOILER', x: 700, y: 530, w: 64, h: 56, kind: 'hex' },
];

const STREAMS: StreamEdge[] = [
  // F-101 → E-101 (battery-limit liquid feed)
  { id: 'S01', pts: [[116, 324], [220, 324]], cls: 'feed', labelAt: 0.5 },
  // E-101 → T-101 side nozzle at the feed stage
  { id: 'S02', pts: [[284, 324], [396, 324], [396, 360], [470, 360]], cls: 'syngas', labelAt: 0.4 },
  // T-101 top → E-102 (overhead vapor, V = (R+1)·D)
  { id: 'S05', pts: [[518, 130], [518, 78], [648, 78], [648, 146], [700, 146]], cls: 'syngas', labelAt: 0.45 },
  // E-102 → V-101 (condensate)
  { id: 'S07', pts: [[764, 146], [850, 146]], cls: 'loopgas', labelAt: 0.5 },
  // V-101 → T-101 upper side (reflux, L = R·D)
  { id: 'S06', pts: [[892, 172], [892, 246], [610, 246], [610, 216], [566, 216]], cls: 'loopgas', labelAt: 0.35 },
  // V-101 → battery limit (distillate product)
  { id: 'S03', pts: [[934, 146], [1030, 146]], cls: 'product', labelAt: 0.55 },
  // T-101 bottom → E-103 (bottoms draw)
  { id: 'S08', pts: [[518, 550], [518, 604], [648, 604], [648, 558], [700, 558]], cls: 'syngas', labelAt: 0.5 },
  // E-103 → T-101 lower side (boilup vapor returns)
  { id: 'S09', pts: [[764, 558], [806, 558], [806, 512], [566, 512]], cls: 'loopgas', labelAt: 0.45 },
  // E-103 → battery limit (bottoms product)
  { id: 'S04', pts: [[732, 586], [732, 668], [1030, 668]], cls: 'product', labelAt: 0.55 },
];

const ANNOTATIONS: PlantLayout['annotations'] = [
  { x: 1042, y: 136, text: 'BENZENE PRODUCT' },
  { x: 1042, y: 690, text: 'TOLUENE PRODUCT' },
];

export const DISTILLATION_LAYOUT: PlantLayout = {
  canvas: { w: 1200, h: 760 },
  sheet: { x: 10, y: 10, w: 1180, h: 740 },
  zones: [], // one idea per rung — no walls
  zoneDividers: [],
  titleBlock: {
    x: 990,
    y: 24,
    w: 180,
    h: 96,
    title: 'BENZENE–TOLUENE',
    subtitle: 'DISTILLATION · PFD',
    foot: 'SHEET 1 OF 1 · REV A',
  },
  units: UNITS,
  streams: STREAMS,
  annotations: ANNOTATIONS,
};

export const DISTILL_UNIT_MAP: Record<string, UnitNode> = Object.fromEntries(
  UNITS.map((u) => [u.id, u]),
);
export const DISTILL_STREAM_MAP: Record<string, StreamEdge> = Object.fromEntries(
  STREAMS.map((s) => [s.id, s]),
);

/** presentation-level wiring — matches the drawing (engine graph stays 3 units) */
export const DISTILL_UNIT_STREAMS: Record<string, { in: string[]; out: string[] }> = {
  FEED: { in: [], out: ['S01'] },
  HEATER: { in: ['S01'], out: ['S02'] },
  COLUMN: { in: ['S02', 'S06', 'S09'], out: ['S05', 'S08'] },
  COND: { in: ['S05'], out: ['S07'] },
  RDRUM: { in: ['S07'], out: ['S03', 'S06'] },
  REB: { in: ['S08'], out: ['S04', 'S09'] },
};
