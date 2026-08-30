/**
 * Flowsheet layout — hand-authored coordinates for a textbook-grade PFD.
 *
 * Narrative: the front end runs left→right along the top in two phase bands
 * ("make the hydrogen" → "clean it up"); the synthesis loop is one large
 * bottom band drawn as a literal closed circuit — gas exits the circulator
 * on the left, returns along the base of the canvas, and re-enters the loop
 * mixer on the right.
 *
 * Topology mirrors the engine stream/unit ids exactly (no invented units).
 */

export type UnitKind =
  | 'mixer'
  | 'furnace'
  | 'secondary'
  | 'hex'
  | 'reactor'
  | 'column'
  | 'drum'
  | 'vdrum'
  | 'compressor'
  | 'splitter'
  | 'converter';

export interface UnitNode {
  id: string;
  /** equipment tag shown on canvas, e.g. "R-102" */
  tag: string;
  /** short uppercase name shown under the tag */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: UnitKind;
}

export interface Band {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StreamEdge {
  id: string;
  pts: Array<[number, number]>;
  cls: string;
  /** fractional position along the polyline for the number pill */
  labelAt?: number;
}

export const CANVAS = { w: 1800, h: 880 };

export const BANDS: Band[] = [
  { id: 'B1', label: '1 · FEED & REFORMING', x: 20, y: 56, w: 660, h: 314 },
  { id: 'B2', label: '2 · SHIFT & PURIFICATION', x: 700, y: 56, w: 860, h: 314 },
  { id: 'B3', label: '3 · SYNTHESIS LOOP & COMPRESSION', x: 20, y: 410, w: 1760, h: 440 },
];

export const UNITS: UnitNode[] = [
  // ---- band 1: feed & reforming ----
  { id: 'M1', tag: 'M-101', label: 'FEED MIX', x: 80, y: 190, w: 64, h: 48, kind: 'mixer' },
  { id: 'R1', tag: 'R-102', label: 'PRIMARY REFORMER', x: 200, y: 150, w: 150, h: 120, kind: 'furnace' },
  { id: 'R2', tag: 'R-103', label: 'SECONDARY REFORMER', x: 430, y: 150, w: 96, h: 120, kind: 'secondary' },
  { id: 'E1', tag: 'E-101', label: 'WASTE HEAT BOILER', x: 585, y: 196, w: 64, h: 56, kind: 'hex' },
  // ---- band 2: shift & purification ----
  { id: 'R3', tag: 'R-104', label: 'HIGH-TEMP SHIFT', x: 740, y: 176, w: 60, h: 80, kind: 'reactor' },
  { id: 'E4', tag: 'E-102', label: 'INTERCOOLER', x: 860, y: 196, w: 64, h: 56, kind: 'hex' },
  { id: 'R4', tag: 'R-105', label: 'LOW-TEMP SHIFT', x: 990, y: 176, w: 60, h: 80, kind: 'reactor' },
  { id: 'V1', tag: 'V-101', label: 'KNOCKOUT DRUM', x: 1110, y: 198, w: 72, h: 52, kind: 'drum' },
  { id: 'A1', tag: 'C-101', label: 'CO2 REMOVAL', x: 1230, y: 116, w: 72, h: 160, kind: 'column' },
  { id: 'R5', tag: 'R-106', label: 'METHANATOR', x: 1360, y: 176, w: 60, h: 80, kind: 'reactor' },
  { id: 'V2', tag: 'V-102', label: 'KNOCKOUT DRUM', x: 1480, y: 198, w: 72, h: 52, kind: 'drum' },
  // ---- band 3: synthesis loop & compression ----
  { id: 'C1', tag: 'K-101', label: 'SYNGAS COMPRESSOR', x: 1520, y: 470, w: 76, h: 64, kind: 'compressor' },
  { id: 'M2', tag: 'M-102', label: 'LOOP MIXER', x: 1350, y: 560, w: 64, h: 48, kind: 'mixer' },
  { id: 'E3', tag: 'E-103', label: 'FEED PREHEATER', x: 1190, y: 600, w: 64, h: 56, kind: 'hex' },
  { id: 'R6', tag: 'R-107', label: 'SYNTHESIS CONVERTER', x: 990, y: 470, w: 100, h: 190, kind: 'converter' },
  { id: 'E2', tag: 'E-104', label: 'CONDENSATION TRAIN', x: 810, y: 600, w: 70, h: 56, kind: 'hex' },
  { id: 'V3', tag: 'V-103', label: 'NH3 SEPARATOR', x: 620, y: 500, w: 84, h: 130, kind: 'vdrum' },
  { id: 'SP1', tag: 'SP-101', label: 'PURGE SPLIT', x: 450, y: 590, w: 56, h: 48, kind: 'splitter' },
  { id: 'C2', tag: 'K-102', label: 'CIRCULATOR', x: 250, y: 620, w: 60, h: 56, kind: 'compressor' },
];

export const STREAMS: StreamEdge[] = [
  // feeds
  { id: 'S01', pts: [[24, 176], [52, 176], [52, 202], [80, 202]], cls: 'feed', labelAt: 0.06 },
  { id: 'S02', pts: [[24, 248], [52, 248], [52, 226], [80, 226]], cls: 'feed', labelAt: 0.06 },
  // front end
  { id: 'S03', pts: [[144, 214], [200, 214]], cls: 'syngas', labelAt: 0.5 },
  { id: 'S04', pts: [[350, 214], [430, 214]], cls: 'syngas', labelAt: 0.5 },
  { id: 'S05', pts: [[478, 36], [478, 150]], cls: 'feed', labelAt: 0.12 },
  { id: 'S06', pts: [[526, 214], [556, 214], [556, 224], [585, 224]], cls: 'syngas' },
  { id: 'S07', pts: [[649, 224], [694, 224], [694, 216], [740, 216]], cls: 'syngas' },
  { id: 'S08', pts: [[800, 216], [830, 216], [830, 224], [860, 224]], cls: 'syngas' },
  { id: 'S09', pts: [[924, 224], [958, 224], [958, 216], [990, 216]], cls: 'syngas' },
  { id: 'S10', pts: [[1050, 216], [1080, 216], [1080, 224], [1110, 224]], cls: 'syngas' },
  { id: 'S11', pts: [[1182, 224], [1206, 224], [1206, 250], [1230, 250]], cls: 'syngas' },
  { id: 'S12', pts: [[1146, 250], [1146, 330]], cls: 'water', labelAt: 0.6 },
  { id: 'S13', pts: [[1302, 150], [1330, 150], [1330, 216], [1360, 216]], cls: 'syngas' },
  { id: 'S14', pts: [[1266, 276], [1266, 340]], cls: 'co2', labelAt: 0.55 },
  { id: 'S15', pts: [[1420, 216], [1450, 216], [1450, 224], [1480, 224]], cls: 'syngas' },
  { id: 'S16', pts: [[1552, 236], [1558, 236], [1558, 470]], cls: 'syngas', labelAt: 0.5 },
  { id: 'S17', pts: [[1516, 250], [1516, 330]], cls: 'water', labelAt: 0.6 },
  // synthesis loop
  { id: 'S18', pts: [[1520, 502], [1470, 502], [1470, 584], [1414, 584]], cls: 'syngas', labelAt: 0.35 },
  { id: 'S19', pts: [[1350, 584], [1300, 584], [1300, 628], [1254, 628]], cls: 'loopgas' },
  { id: 'S20', pts: [[1190, 628], [1140, 628], [1140, 565], [1090, 565]], cls: 'loopgas' },
  { id: 'S21', pts: [[1040, 660], [1040, 706], [920, 706], [920, 628], [880, 628]], cls: 'loopgas', labelAt: 0.28 },
  { id: 'S22', pts: [[810, 628], [760, 628], [760, 565], [704, 565]], cls: 'loopgas' },
  { id: 'S24', pts: [[662, 666], [662, 780]], cls: 'product', labelAt: 0.5 },
  { id: 'S25', pts: [[620, 565], [560, 565], [560, 614], [506, 614]], cls: 'loopgas' },
  { id: 'S26', pts: [[478, 638], [478, 730]], cls: 'purge', labelAt: 0.55 },
  { id: 'S27', pts: [[450, 614], [380, 614], [380, 648], [310, 648]], cls: 'loopgas' },
  { id: 'S23', pts: [[250, 648], [60, 648], [60, 800], [1550, 800], [1550, 654], [1382, 654], [1382, 608]], cls: 'loopgas', labelAt: 0.42 },
];

/** feed / product annotations drawn at the canvas margin */
export const ANNOTATIONS: Array<{ x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }> = [
  { x: 24, y: 162, text: 'NATURAL GAS' },
  { x: 24, y: 266, text: 'STEAM' },
  { x: 492, y: 28, text: 'PROCESS AIR' },
  { x: 1114, y: 348, text: 'CONDENSATE' },
  { x: 1280, y: 356, text: 'CO2 TO STORAGE' },
  { x: 1484, y: 348, text: 'CONDENSATE' },
  { x: 676, y: 796, text: 'NH3 PRODUCT', anchor: 'start' },
  { x: 490, y: 748, text: 'PURGE TO FUEL', anchor: 'start' },
  { x: 790, y: 790, text: 'RECYCLE' },
  { x: 1462, y: 540, text: 'MAKE-UP' },
];

export const UNIT_MAP: Record<string, UnitNode> = Object.fromEntries(
  UNITS.map((u) => [u.id, u]),
);
export const STREAM_MAP: Record<string, StreamEdge> = Object.fromEntries(
  STREAMS.map((s) => [s.id, s]),
);

/** stream ids entering / leaving each unit (for panel stream lists) */
export const UNIT_STREAMS: Record<string, { in: string[]; out: string[] }> = {
  M1: { in: ['S01', 'S02'], out: ['S03'] },
  R1: { in: ['S03'], out: ['S04'] },
  R2: { in: ['S04', 'S05'], out: ['S06'] },
  E1: { in: ['S06'], out: ['S07'] },
  R3: { in: ['S07'], out: ['S08'] },
  E4: { in: ['S08'], out: ['S09'] },
  R4: { in: ['S09'], out: ['S10'] },
  V1: { in: ['S10'], out: ['S11', 'S12'] },
  A1: { in: ['S11'], out: ['S13', 'S14'] },
  R5: { in: ['S13'], out: ['S15'] },
  V2: { in: ['S15'], out: ['S16', 'S17'] },
  C1: { in: ['S16'], out: ['S18'] },
  M2: { in: ['S18', 'S23'], out: ['S19'] },
  E3: { in: ['S19'], out: ['S20'] },
  R6: { in: ['S20'], out: ['S21'] },
  E2: { in: ['S21'], out: ['S22'] },
  V3: { in: ['S22'], out: ['S24', 'S25'] },
  SP1: { in: ['S25'], out: ['S26', 'S27'] },
  C2: { in: ['S27'], out: ['S23'] },
};
