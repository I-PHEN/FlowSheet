import type { PlantSpec } from '@/lib/engine/plant';

/**
 * PFD layout — hand-placed coordinates for a classic single-train SMR
 * ammonia flowsheet: front end left→right along the top, synthesis loop
 * right→left along the bottom, recycle return line along the base.
 * Topology mirrors the engine stream/unit ids exactly.
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

export type Section =
  | 'FEED'
  | 'REFORMING'
  | 'SHIFT'
  | 'PURIFICATION'
  | 'COMPRESSION'
  | 'LOOP';

export interface UnitNode {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: UnitKind;
  section: Section;
}

export const UNITS: UnitNode[] = [
  { id: 'M1', label: 'FEED MIX', x: 70, y: 185, w: 56, h: 44, kind: 'mixer', section: 'FEED' },
  { id: 'R1', label: 'PRIMARY REFORMER', x: 210, y: 163, w: 116, h: 88, kind: 'furnace', section: 'REFORMING' },
  { id: 'R2', label: 'SECONDARY REFORMER', x: 400, y: 163, w: 92, h: 88, kind: 'secondary', section: 'REFORMING' },
  { id: 'E1', label: 'WASTE HEAT BOILER', x: 552, y: 192, w: 52, h: 48, kind: 'hex', section: 'REFORMING' },
  { id: 'R3', label: 'HIGH-TEMP SHIFT', x: 664, y: 176, w: 56, h: 68, kind: 'reactor', section: 'SHIFT' },
  { id: 'E4', label: 'INTERCOOLER', x: 778, y: 192, w: 52, h: 48, kind: 'hex', section: 'SHIFT' },
  { id: 'R4', label: 'LOW-TEMP SHIFT', x: 890, y: 176, w: 56, h: 68, kind: 'reactor', section: 'SHIFT' },
  { id: 'V1', label: 'KNOCKOUT 1', x: 1002, y: 192, w: 56, h: 52, kind: 'drum', section: 'PURIFICATION' },
  { id: 'A1', label: 'CO2 REMOVAL', x: 1124, y: 128, w: 66, h: 122, kind: 'column', section: 'PURIFICATION' },
  { id: 'R5', label: 'METHANATOR', x: 1252, y: 176, w: 56, h: 68, kind: 'reactor', section: 'PURIFICATION' },
  { id: 'V2', label: 'KNOCKOUT 2', x: 1364, y: 192, w: 56, h: 52, kind: 'drum', section: 'PURIFICATION' },
  { id: 'C1', label: 'SYNGAS COMPRESSOR', x: 1484, y: 188, w: 68, h: 60, kind: 'compressor', section: 'COMPRESSION' },
  { id: 'M2', label: 'LOOP MIXER', x: 1500, y: 420, w: 56, h: 44, kind: 'mixer', section: 'LOOP' },
  { id: 'E3', label: 'FEED PREHEATER', x: 1360, y: 466, w: 52, h: 48, kind: 'hex', section: 'LOOP' },
  { id: 'R6', label: 'SYNTHESIS CONVERTER', x: 1140, y: 388, w: 88, h: 162, kind: 'converter', section: 'LOOP' },
  { id: 'E2', label: 'CONDENSATION TRAIN', x: 950, y: 466, w: 62, h: 52, kind: 'hex', section: 'LOOP' },
  { id: 'V3', label: 'NH3 SEPARATOR', x: 780, y: 396, w: 80, h: 116, kind: 'vdrum', section: 'LOOP' },
  { id: 'SP1', label: 'PURGE SPLIT', x: 612, y: 470, w: 52, h: 44, kind: 'splitter', section: 'LOOP' },
  { id: 'C2', label: 'CIRCULATOR', x: 452, y: 536, w: 56, h: 52, kind: 'compressor', section: 'LOOP' },
];

export interface StreamEdge {
  id: string;
  pts: Array<[number, number]>;
  cls: string;
  /** label at fractional distance along the polyline */
  labelAt?: number;
}

export const STREAMS: StreamEdge[] = [
  { id: 'S01', pts: [[26, 150], [46, 150], [46, 204], [70, 204]], cls: 'feed', labelAt: 0.05 },
  { id: 'S02', pts: [[26, 262], [46, 262], [46, 218], [70, 218]], cls: 'feed', labelAt: 0.05 },
  { id: 'S03', pts: [[126, 211], [210, 211]], cls: 'syngas' },
  { id: 'S04', pts: [[326, 211], [400, 211]], cls: 'syngas' },
  { id: 'S05', pts: [[446, 48], [446, 163]], cls: 'feed', labelAt: 0.08 },
  { id: 'S06', pts: [[492, 207], [522, 207], [522, 216], [552, 216]], cls: 'syngas' },
  { id: 'S07', pts: [[604, 216], [634, 216], [634, 210], [664, 210]], cls: 'syngas' },
  { id: 'S08', pts: [[720, 210], [749, 210], [749, 216], [778, 216]], cls: 'syngas' },
  { id: 'S09', pts: [[830, 216], [860, 216], [860, 210], [890, 210]], cls: 'syngas' },
  { id: 'S10', pts: [[946, 210], [974, 210], [974, 218], [1002, 218]], cls: 'syngas' },
  { id: 'S11', pts: [[1058, 218], [1091, 218], [1091, 189], [1124, 189]], cls: 'syngas' },
  { id: 'S12', pts: [[1030, 244], [1030, 300]], cls: 'water', labelAt: 0.6 },
  { id: 'S13', pts: [[1190, 189], [1221, 189], [1221, 210], [1252, 210]], cls: 'syngas' },
  { id: 'S14', pts: [[1157, 250], [1157, 318]], cls: 'co2', labelAt: 0.55 },
  { id: 'S15', pts: [[1308, 210], [1336, 210], [1336, 218], [1364, 218]], cls: 'syngas' },
  { id: 'S16', pts: [[1420, 218], [1484, 218]], cls: 'syngas' },
  { id: 'S17', pts: [[1392, 244], [1392, 300]], cls: 'water', labelAt: 0.6 },
  { id: 'S18', pts: [[1518, 248], [1518, 442], [1556, 442]], cls: 'syngas', labelAt: 0.45 },
  { id: 'S19', pts: [[1500, 442], [1450, 442], [1450, 490], [1412, 490]], cls: 'loopgas' },
  { id: 'S20', pts: [[1360, 490], [1292, 490], [1292, 469], [1228, 469]], cls: 'loopgas' },
  { id: 'S21', pts: [[1184, 550], [1184, 598], [1012, 598], [1012, 492]], cls: 'loopgas', labelAt: 0.25 },
  { id: 'S22', pts: [[950, 492], [896, 492], [896, 454], [860, 454]], cls: 'loopgas' },
  { id: 'S24', pts: [[820, 512], [820, 640]], cls: 'product', labelAt: 0.5 },
  { id: 'S25', pts: [[780, 454], [708, 454], [708, 492], [664, 492]], cls: 'loopgas' },
  { id: 'S26', pts: [[612, 492], [548, 492], [548, 654]], cls: 'purge', labelAt: 0.55 },
  { id: 'S27', pts: [[638, 514], [638, 562], [508, 562]], cls: 'loopgas' },
  { id: 'S23', pts: [[452, 562], [250, 562], [250, 700], [1528, 700], [1528, 464]], cls: 'loopgas', labelAt: 0.55 },
];

export const CANVAS = { w: 1620, h: 740 };

/** feed/product annotations drawn on the canvas margin */
export const ANNOTATIONS: Array<{ x: number; y: number; text: string }> = [
  { x: 26, y: 138, text: 'NATURAL GAS' },
  { x: 26, y: 280, text: 'PROCESS STEAM' },
  { x: 458, y: 38, text: 'PROCESS AIR' },
  { x: 1038, y: 316, text: 'TO BFW' },
  { x: 1172, y: 334, text: 'CO2 TO STORAGE' },
  { x: 1400, y: 316, text: 'TO BFW' },
  { x: 838, y: 656, text: 'NH3 PRODUCT' },
  { x: 560, y: 670, text: 'PURGE TO FUEL' },
  { x: 300, y: 688, text: 'RECYCLE' },
];

// ---------------------------------------------------------------------------
// Spec field descriptors — drive the inspector sliders and number inputs
// ---------------------------------------------------------------------------

export interface SpecField {
  key: keyof PlantSpec;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  digits?: number;
  /** display scale (e.g. fraction → %) */
  scale?: number;
  group: string;
  /** unit card(s) that expose this field */
  unitIds?: string[];
}

export const SPEC_FIELDS: SpecField[] = [
  { key: 'ngFeed', label: 'Natural gas feed', unit: 'kmol/h', min: 100, max: 3000, step: 10, digits: 0, group: 'Feed & reforming', unitIds: ['M1'] },
  { key: 'steamCarbon', label: 'Steam / carbon', unit: 'mol/mol', min: 2.0, max: 5.0, step: 0.05, digits: 2, group: 'Feed & reforming', unitIds: ['M1'] },
  { key: 'frontEndP', label: 'Front-end pressure', unit: 'bar', min: 20, max: 45, step: 0.5, digits: 1, group: 'Feed & reforming', unitIds: ['R1'] },
  { key: 'primaryT', label: 'Reformer outlet T', unit: '°C', min: 700, max: 900, step: 5, digits: 0, group: 'Feed & reforming', unitIds: ['R1'] },
  { key: 'primaryATE', label: 'CH4 equilibrium approach', unit: 'K', min: 0, max: 40, step: 1, digits: 0, group: 'Feed & reforming', unitIds: ['R1'] },
  { key: 'secondaryATE', label: 'CH4 equilibrium approach', unit: 'K', min: 0, max: 80, step: 1, digits: 0, group: 'Secondary reformer', unitIds: ['R2'] },
  { key: 'h2n2Set', label: 'Make-up H2/N2 setpoint', unit: 'mol/mol', min: 2.5, max: 3.3, step: 0.01, digits: 2, group: 'Secondary reformer', unitIds: ['R2'] },
  { key: 'airFlow', label: 'Process air (manual)', unit: 'kmol/h', min: 100, max: 6000, step: 10, digits: 0, group: 'Secondary reformer', unitIds: ['R2'] },
  { key: 'htsInletT', label: 'HTS inlet T', unit: '°C', min: 300, max: 400, step: 5, digits: 0, group: 'Shift', unitIds: ['E1', 'R3'] },
  { key: 'htsATE', label: 'WGS approach', unit: 'K', min: 0, max: 50, step: 1, digits: 0, group: 'Shift', unitIds: ['R3'] },
  { key: 'ltsInletT', label: 'LTS inlet T', unit: '°C', min: 180, max: 240, step: 5, digits: 0, group: 'Shift', unitIds: ['E4', 'R4'] },
  { key: 'ltsATE', label: 'WGS approach', unit: 'K', min: 0, max: 60, step: 1, digits: 0, group: 'Shift', unitIds: ['R4'] },
  { key: 'co2Residual', label: 'Residual CO2', unit: 'ppmvd', min: 20, max: 2000, step: 10, digits: 0, group: 'Purification', unitIds: ['A1'] },
  { key: 'co2h2Slip', label: 'H2 co-absorption', unit: 'frac', min: 0, max: 0.01, step: 0.0005, digits: 4, group: 'Purification', unitIds: ['A1'] },
  { key: 'methInletT', label: 'Methanator inlet T', unit: '°C', min: 250, max: 360, step: 5, digits: 0, group: 'Purification', unitIds: ['R5'] },
  { key: 'loopP', label: 'Loop pressure', unit: 'bar', min: 80, max: 250, step: 1, digits: 0, group: 'Synthesis loop', unitIds: ['C1', 'R6'] },
  { key: 'bed1T', label: 'Bed 1 inlet T', unit: '°C', min: 350, max: 450, step: 5, digits: 0, group: 'Synthesis loop', unitIds: ['R6'] },
  { key: 'bed2T', label: 'Bed 2 inlet T', unit: '°C', min: 380, max: 470, step: 5, digits: 0, group: 'Synthesis loop', unitIds: ['R6'] },
  { key: 'bed3T', label: 'Bed 3 inlet T', unit: '°C', min: 380, max: 460, step: 5, digits: 0, group: 'Synthesis loop', unitIds: ['R6'] },
  { key: 'dpConverter', label: 'Converter ΔP', unit: 'bar', min: 1, max: 8, step: 0.5, digits: 1, group: 'Synthesis loop', unitIds: ['R6'] },
  { key: 'chillT', label: 'Condensation T', unit: '°C', min: -40, max: 30, step: 1, digits: 0, group: 'Synthesis loop', unitIds: ['E2', 'V3'] },
  { key: 'dpCondenser', label: 'Condensation ΔP', unit: 'bar', min: 1, max: 6, step: 0.5, digits: 1, group: 'Synthesis loop', unitIds: ['E2'] },
  { key: 'purgeFrac', label: 'Purge fraction', unit: '%', min: 1, max: 25, step: 0.5, digits: 1, scale: 100, group: 'Synthesis loop', unitIds: ['SP1'] },
  { key: 'comprStages', label: 'Compressor stages', unit: '—', min: 1, max: 5, step: 1, digits: 0, group: 'Machinery', unitIds: ['C1'] },
  { key: 'etaP', label: 'Polytropic efficiency', unit: '—', min: 0.6, max: 0.85, step: 0.01, digits: 2, group: 'Machinery', unitIds: ['C1', 'C2'] },
];

/** which metric lines to show under each unit symbol (indices into UnitResult.metrics) */
export const UNIT_VALUE_LINES: Record<string, number[]> = {
  R1: [0, 2],
  R2: [1, 2],
  E1: [0],
  R3: [1],
  E4: [0],
  R4: [1],
  V1: [0],
  A1: [0],
  R5: [1],
  C1: [0],
  M2: [1],
  E3: [0],
  R6: [6, 7],
  E2: [1],
  V3: [0, 1],
  SP1: [0],
  C2: [0],
};

export const SECTION_ORDER: Section[] = ['FEED', 'REFORMING', 'SHIFT', 'PURIFICATION', 'COMPRESSION', 'LOOP'];
