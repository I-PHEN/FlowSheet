/**
 * Flash-separation plant — the beginner template.
 *
 * One source, one chiller, one drum: the smallest flowsheet that still
 * teaches the core idea of the whole subject (one stream enters, two phases
 * leave). Runs through the SAME generic graph executor as the ammonia
 * plant; the ammonia KPI block is id-driven and simply reports zeros for
 * this graph, so the teaching KPIs (vapor fraction, NH3 recovery, liquid
 * purity) are derived here from the solved streams.
 *
 * The feed deliberately mimics ammonia-loop gas arriving at the condensation
 * train — when the student later opens the reference plant, V-103 will look
 * familiar.
 */

import { executeGraph } from '@/lib/engine/executor';
import type { FlowGraph, StreamEdge } from '@/lib/engine/graph';
import type { PlantResult } from '@/lib/engine/types';
import { SPECIES, SP } from '@/lib/engine/species';

export interface FlashSpec {
  /** total feed gas flow, kmol/h */
  feedFlow: number;
  /** ammonia content of the feed gas, mol fraction */
  feedNH3: number;
  /** CH4 + Ar inerts content, mol fraction (split 50/50) */
  feedInerts: number;
  /** feed temperature, °C */
  feedT: number;
  /** feed pressure, bar */
  feedP: number;
  /** chiller outlet temperature, °C — the drum flashes at this temperature */
  chillT: number;
}

export const FLASH_BASE: FlashSpec = {
  feedFlow: 2000,
  feedNH3: 0.12,
  feedInerts: 0.06,
  feedT: 30,
  feedP: 140,
  chillT: -20,
};

const e = (
  id: string,
  name: string,
  cls: StreamEdge['cls'],
  from: { unit: string; port: string },
  to: { unit: string; port: string } | null,
): StreamEdge => ({ id, name, cls, from, to, implicit: false });

export function flashGraph(spec: FlashSpec): FlowGraph {
  return {
    units: [
      {
        id: 'FEED',
        type: 'syngas-feed',
        specs: {
          flow: spec.feedFlow,
          yNH3: spec.feedNH3,
          yInerts: spec.feedInerts,
          T: spec.feedT,
          P: spec.feedP,
        },
      },
      { id: 'CHILL', type: 'chiller', specs: { outletT: spec.chillT, dp: 2 } },
      { id: 'DRUM', type: 'flash-drum', specs: { dp: 1 } },
    ],
    streams: [
      e('S01', 'Feed gas', 'syngas', { unit: 'FEED', port: 'out' }, { unit: 'CHILL', port: 'in' }),
      e('S02', 'Chilled gas', 'syngas', { unit: 'CHILL', port: 'out' }, { unit: 'DRUM', port: 'in' }),
      e('S03', 'Gas to recycle', 'loopgas', { unit: 'DRUM', port: 'vapor' }, null),
      e('S04', 'Liquid ammonia product', 'product', { unit: 'DRUM', port: 'liquid' }, null),
    ],
    controllers: [],
  };
}

/** Solve the flash plant (sequential — no recycle, no controller). */
export function solveFlash(spec: FlashSpec): PlantResult {
  return executeGraph(flashGraph(spec));
}

const total = (n: number[]) => n.reduce((a, b) => a + b, 0);
const mass = (n: number[]) =>
  n.reduce((a, v, i) => a + v * (SP[SPECIES[i]]?.mw ?? 0), 0);

/** Teaching KPIs derived from the solved streams (the beginner's scorecard). */
export interface FlashKpis {
  /** molar vapor fraction of the drum: V / F */
  vaporFraction: number;
  /** fraction of feed NH3 recovered as liquid */
  nh3Recovery: number;
  /** NH3 mole fraction in the liquid product */
  liquidPurity: number;
  /** liquid product rate, tonnes/day */
  liquidTpd: number;
  /** vapor leaving the drum, kmol/h */
  vaporFlow: number;
  /** liquid leaving the drum, kmol/h */
  liquidFlow: number;
  /** chiller heat removal, MW (negative = refrigeration required) */
  chillerDutyMW: number;
}

export function flashKpis(r: PlantResult): FlashKpis {
  const feed = r.streams.S01?.n ?? [];
  const vap = r.streams.S03?.n ?? [];
  const liq = r.streams.S04?.n ?? [];
  const feedTot = total(feed) || 1;
  const liqTot = total(liq);
  const dutyMW = r.units.CHILL?.metrics[0]?.raw ?? 0;
  return {
    vaporFraction: total(vap) / feedTot,
    nh3Recovery: feed[6] > 1e-9 ? liq[6] / feed[6] : 0,
    liquidPurity: liqTot > 1e-9 ? liq[6] / liqTot : 0,
    liquidTpd: (mass(liq) * 24) / 1000,
    vaporFlow: total(vap),
    liquidFlow: liqTot,
    chillerDutyMW: dutyMW,
  };
}
