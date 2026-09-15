/**
 * Reference plant as a FlowGraph — the same SMR topology the legacy
 * plant.ts wires by hand, expressed as data: 22 units (3 feed sources +
 * 19 process units), 27 recorded streams + 1 implicit letdown-vapor line,
 * and the H2/N2 air controller.
 *
 * Unit ids match the legacy engine ids (M1, R1, …, C2) and therefore the
 * UI layout/content maps. Stream ids, names, and service classes match the
 * legacy stream records exactly — the identity gate depends on it.
 *
 * applyPlantSpec() maps the flat PlantSpec (the UI/test knob surface) onto
 * graph specs. This table is the ONLY place that knows which unit a plant
 * knob belongs to.
 */

import type { FlowGraph, StreamEdge } from './graph';
import type { PlantSpec } from './plant';

const e = (
  id: string,
  name: string,
  cls: StreamEdge['cls'],
  from: { unit: string; port: string },
  to: { unit: string; port: string } | null,
  implicit = false,
): StreamEdge => ({ id, name, cls, from, to, implicit });

export function referenceGraph(): FlowGraph {
  return {
    units: [
      { id: 'SRC_NG', type: 'ng-source', specs: {} },
      { id: 'SRC_ST', type: 'steam-source', specs: {} },
      { id: 'SRC_AIR', type: 'air-source', specs: {} },
      { id: 'M1', type: 'feed-mixer', specs: {} },
      { id: 'R1', type: 'primary-reformer', specs: {} },
      { id: 'R2', type: 'secondary-reformer', specs: {} },
      { id: 'E1', type: 'whb-cooler', specs: {} },
      { id: 'R3', type: 'wgs-hts', specs: {} },
      { id: 'E4', type: 'intercooler', specs: {} },
      { id: 'R4', type: 'wgs-lts', specs: {} },
      { id: 'V1', type: 'ko-drum-shift', specs: {} },
      { id: 'A1', type: 'co2-removal', specs: {} },
      { id: 'R5', type: 'methanator', specs: {} },
      { id: 'V2', type: 'ko-drum-meth', specs: {} },
      { id: 'C1', type: 'syngas-compressor', specs: {} },
      { id: 'M2', type: 'loop-mixer', specs: {} },
      { id: 'E3', type: 'feed-preheater', specs: {} },
      { id: 'R6', type: 'converter', specs: {} },
      { id: 'E2', type: 'condensation-train', specs: {} },
      { id: 'V3', type: 'nh3-separator', specs: {} },
      { id: 'SP1', type: 'purge-split', specs: {} },
      { id: 'C2', type: 'loop-circulator', specs: {} },
    ],
    // order matters: sink/source iteration order reproduces the legacy
    // element-balance summation exactly
    streams: [
      e('S01', 'Natural gas feed', 'feed', { unit: 'SRC_NG', port: 'out' }, { unit: 'M1', port: 'ng' }),
      e('S02', 'Process steam', 'feed', { unit: 'SRC_ST', port: 'out' }, { unit: 'M1', port: 'steam' }),
      e('S03', 'Mixed feed', 'syngas', { unit: 'M1', port: 'out' }, { unit: 'R1', port: 'in' }),
      e('S04', 'Primary effluent', 'syngas', { unit: 'R1', port: 'out' }, { unit: 'R2', port: 'gas' }),
      e('S05', 'Process air', 'feed', { unit: 'SRC_AIR', port: 'out' }, { unit: 'R2', port: 'air' }),
      e('S06', 'Secondary effluent', 'syngas', { unit: 'R2', port: 'out' }, { unit: 'E1', port: 'in' }),
      e('S07', 'HTS feed', 'syngas', { unit: 'E1', port: 'out' }, { unit: 'R3', port: 'in' }),
      e('S08', 'HTS effluent', 'syngas', { unit: 'R3', port: 'out' }, { unit: 'E4', port: 'in' }),
      e('S09', 'LTS feed', 'syngas', { unit: 'E4', port: 'out' }, { unit: 'R4', port: 'in' }),
      e('S10', 'LTS effluent', 'syngas', { unit: 'R4', port: 'out' }, { unit: 'V1', port: 'in' }),
      e('S11', 'Treated gas (KO1 vapor)', 'syngas', { unit: 'V1', port: 'vapor' }, { unit: 'A1', port: 'in' }),
      e('S12', 'Condensate to BFW', 'water', { unit: 'V1', port: 'liquid' }, null),
      e('S13', 'CO2-lean gas', 'syngas', { unit: 'A1', port: 'gas' }, { unit: 'R5', port: 'in' }),
      e('S14', 'CO2 to storage', 'co2', { unit: 'A1', port: 'offgas' }, null),
      e('S15', 'Methanator effluent', 'syngas', { unit: 'R5', port: 'out' }, { unit: 'V2', port: 'in' }),
      e('S16', 'Make-up syngas', 'syngas', { unit: 'V2', port: 'vapor' }, { unit: 'C1', port: 'in' }),
      e('S17', 'Condensate to BFW', 'water', { unit: 'V2', port: 'liquid' }, null),
      e('S18', 'HP make-up syngas', 'syngas', { unit: 'C1', port: 'out' }, { unit: 'M2', port: 'makeup' }),
      e('S19', 'Loop mix', 'loopgas', { unit: 'M2', port: 'out' }, { unit: 'E3', port: 'in' }),
      e('S20', 'Converter feed', 'loopgas', { unit: 'E3', port: 'out' }, { unit: 'R6', port: 'in' }),
      e('S21', 'Converter effluent', 'loopgas', { unit: 'R6', port: 'out' }, { unit: 'E2', port: 'in' }),
      e('S22', 'Chilled loop gas', 'loopgas', { unit: 'E2', port: 'out' }, { unit: 'V3', port: 'chilled' }),
      e('S24S', 'Separator liquid', 'product', { unit: 'V3', port: 'sepLiquid' }, { unit: 'V3', port: 'letdownIn' }),
      e('S24', 'Liquid ammonia product', 'product', { unit: 'V3', port: 'product' }, null),
      e('S25', 'Separator gas', 'loopgas', { unit: 'V3', port: 'gas' }, { unit: 'SP1', port: 'gas' }),
      e('IF1', 'Letdown flash vapor', 'purge', { unit: 'V3', port: 'flash' }, { unit: 'SP1', port: 'flash' }, true),
      e('S26', 'Purge to fuel', 'purge', { unit: 'SP1', port: 'purge' }, null),
      e('S27', 'Recycle gas', 'loopgas', { unit: 'SP1', port: 'recycle' }, { unit: 'C2', port: 'in' }),
      e('S23', 'Circulator discharge', 'loopgas', { unit: 'C2', port: 'out' }, { unit: 'M2', port: 'recycle' }),
    ],
    controllers: [
      {
        id: 'CTRL_AIR',
        manipulate: 'SRC_AIR',
        measure: 'S16',
        num: 0, // H2
        den: 1, // N2
        set: 3.0,
        auto: true,
      },
    ],
  };
}

const set = (g: FlowGraph, unitId: string, patch: Record<string, number | boolean | number[]>) => {
  const u = g.units.find((x) => x.id === unitId);
  if (u) u.specs = { ...u.specs, ...patch };
};

/** map the flat PlantSpec onto graph specs (defaults = baseCase values) */
export function applyPlantSpec(g: FlowGraph, spec: PlantSpec): FlowGraph {
  set(g, 'SRC_NG', { flow: spec.ngFeed, P: spec.frontEndP + 2 });
  set(g, 'SRC_ST', { flow: spec.ngFeed * spec.steamCarbon, P: spec.frontEndP + 2 });
  set(g, 'SRC_AIR', { P: spec.frontEndP + 0.5, flow: spec.airFlow });
  set(g, 'M1', { steamCarbon: spec.steamCarbon });
  set(g, 'R1', { outletT: spec.primaryT, ate: spec.primaryATE });
  set(g, 'R2', { ate: spec.secondaryATE });
  set(g, 'E1', { outletT: spec.htsInletT });
  set(g, 'R3', { ate: spec.htsATE });
  set(g, 'E4', { outletT: spec.ltsInletT });
  set(g, 'R4', { ate: spec.ltsATE });
  set(g, 'A1', { residualPpm: spec.co2Residual, h2Slip: spec.co2h2Slip });
  set(g, 'R5', { inletT: spec.methInletT });
  set(g, 'C1', { stages: spec.comprStages, eta: spec.etaP, dischargeP: spec.loopP });
  set(g, 'M2', { outletP: spec.loopP });
  set(g, 'E3', { outletT: spec.bed1T, outletP: spec.loopP });
  set(g, 'R6', { bedTs: [spec.bed1T, spec.bed2T, spec.bed3T], approach: spec.bedApproach, dp: spec.dpConverter });
  set(g, 'E2', { chillT: spec.chillT, dp: spec.dpCondenser });
  set(g, 'SP1', { purgeFrac: spec.purgeFrac });
  set(g, 'C2', { eta: spec.etaP, dischargeP: spec.loopP });
  const ctrl = g.controllers.find((c) => c.id === 'CTRL_AIR');
  if (ctrl) {
    ctrl.set = spec.h2n2Set;
    ctrl.auto = spec.airAuto;
  }
  return g;
}

/** reference graph with the PlantSpec applied — the graph the executor runs */
export function buildGraph(spec: PlantSpec): FlowGraph {
  return applyPlantSpec(referenceGraph(), spec);
}
