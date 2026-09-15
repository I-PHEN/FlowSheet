/**
 * 3D model registry — which flowsheet units have a real 3D model, and where
 * it lives.
 *
 * One model ships today: the shell-and-tube heat exchanger, converted from a
 * GrabCAD SolidWorks assembly and optimized (weld → simplify → meshopt) to
 * 885 KB. It stands in for every `hex` unit on every prebuilt plant — the
 * viewer says so honestly rather than pretending each tag has its own scan.
 *
 * Adding a model later = one entry here plus a kind mapping. Nothing else in
 * the app hardcodes model paths.
 */

import type { UnitKind, UnitNode } from '@/lib/flowsheet/layout';
import { UNIT_MAP } from '@/lib/flowsheet/layout';
import { FLASH_UNIT_MAP } from '@/lib/flowsheet/flashLayout';
import { DISTILL_UNIT_MAP } from '@/lib/flowsheet/distillationLayout';

export interface ModelEntry {
  /** stable id, used in URLs and logs */
  id: string;
  /** public path to the GLB */
  src: string;
  /** display name */
  title: string;
  /** one-paragraph plain-language description shown in the viewer */
  blurb: string;
  /** where the geometry came from (attribution) */
  credit: string;
  /** overall bounding size in metres, [x, y, z] */
  dims: [number, number, number];
}

export const SHELL_AND_TUBE: ModelEntry = {
  id: 'shell-and-tube',
  src: '/models/shell-and-tube-exchanger.glb',
  title: 'Shell-and-tube heat exchanger',
  blurb:
    'The workhorse of every chemical plant. One fluid flows through a bundle of parallel tubes ' +
    'sealed inside a cylindrical shell; another flows across the outside of those tubes. The two ' +
    'streams never mix — heat simply moves through the tube walls. Front and rear channel heads ' +
    'let the tube side be opened and cleaned, and the flanged joints let the whole bundle be ' +
    'pulled for maintenance.',
  credit: 'GrabCAD community model (SolidWorks assembly), converted to glTF and simplified',
  dims: [2.65, 0.77, 3.39],
};

/** which unit kinds each model stands in for */
const MODEL_BY_KIND: Partial<Record<UnitKind, ModelEntry>> = {
  hex: SHELL_AND_TUBE,
};

export function modelForKind(kind: UnitKind): ModelEntry | null {
  return MODEL_BY_KIND[kind] ?? null;
}

/** does this unit have a 3D model? (one map lookup — used by detail panels) */
export function hasModel(kind: UnitKind | undefined): boolean {
  return !!kind && kind in MODEL_BY_KIND;
}

/** the prebuilt plants that the 3D routes know about */
export interface PlantMeta {
  /** URL segment: /plant/<id>/3d/<unit> */
  id: string;
  /** human title for the header */
  title: string;
  /** where the Back link goes */
  home: string;
  unitMap: Record<string, UnitNode>;
}

export const PLANTS: Record<string, PlantMeta> = {
  reference: {
    id: 'reference',
    title: 'Steam-Methane Reforming Plant',
    home: '/plant/reference',
    unitMap: UNIT_MAP,
  },
  flash: {
    id: 'flash',
    title: 'Flash Drum Plant',
    home: '/plant/flash',
    unitMap: FLASH_UNIT_MAP,
  },
  distillation: {
    id: 'distillation',
    title: 'Distillation Column Plant',
    home: '/plant/distillation',
    unitMap: DISTILL_UNIT_MAP,
  },
};

export function resolveUnit(
  plantId: string,
  unitId: string,
): { plant: PlantMeta; node: UnitNode } | null {
  const plant = PLANTS[plantId];
  if (!plant) return null;
  const node = plant.unitMap[unitId];
  if (!node) return null;
  return { plant, node };
}
