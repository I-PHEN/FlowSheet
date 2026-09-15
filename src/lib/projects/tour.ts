/**
 * Auto-tour generator — every saved plant ships with a narrated tour.
 *
 * The agents already narrate the build (architect plan, engineer notes,
 * critic verdict). This harvests the finished graph into a deterministic
 * guided tour: an intro, a walk down the process path (spotlighting each
 * unit), and an outro with the solve numbers. Same player, same voice,
 * same music bed as the hand-authored tours on the prebuilt plants.
 */

import type { FlowGraph } from '@/lib/engine/graph';
import type { Tour, TourStep } from '@/lib/content/units';
import { getUnitType } from '@/lib/engine/registry';
import type { PlantRecord } from './record';

/** friendly role prose for common registry types */
const ROLE: Record<string, string> = {
  'natural-gas-feed': 'sets the feed contract — composition, pressure and flow everything downstream inherits',
  'process-steam-feed': 'supplies the steam the chemistry will need later',
  'process-air-feed': 'brings in air from the battery limit',
  'feed-mixer': 'blends the incoming streams into one feed with a defined composition',
  'primary-reformer': 'cracks the hydrocarbon into syngas over catalyst at high temperature',
  'secondary-reformer': 'completes the reforming with injected air and leaves the gas hot enough to work with',
  'waste-heat-boiler': 'recovers heat from the hot gas and makes steam while cooling the stream',
  'heat-exchanger': 'trades heat between streams — energy is money on a flowsheet',
  'cooler': 'rejects heat so the gas reaches the temperature the next step wants',
  'hts-reactor': 'shifts carbon monoxide toward hydrogen over iron catalyst',
  'ltr-reactor': 'polishes the shift reaction at low temperature for maximum hydrogen yield',
  'co2-removal': 'scrubs the acid gas out of the process stream',
  'methanator': 'converts the last traces of carbon oxides back to methane',
  'compressor': 'raises the pressure — the loop only reacts when the gas is squeezed',
  'synthesis-converter': 'is where the real chemistry happens: the gas reacts over catalyst and product begins to form',
  'condenser': 'chills the gas until the product condenses out as liquid',
  'cold-condenser': 'deep-chills the gas to squeeze out the last of the product',
  'letdown-drum': 'flashes the liquid and lets vapor and liquid go their separate ways',
  'separator': 'splits the phases — light components overhead, product out the bottom',
  'recycle-splitter': 'sends the unreacted gas back around and keeps the loop balanced',
  'purge-splitter': 'controls what leaves the loop so inerts never accumulate',
  'product-flash': 'finishes the product stream at battery-limit conditions',
  'steam-drum': 'manages the water side of the heat recovery',
};

const FIRST_STEP = [
  'Everything starts here',
  'The plant takes a breath',
  'Feed first — always',
];

const OUTRO = [
  'The loop closes',
  'The balance closes',
  'One plant, one sheet',
];

/** deterministic pick — same plant, same tour, every time */
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function unitTitle(graph: FlowGraph, unitId: string): string {
  const u = graph.units.find((x) => x.id === unitId);
  if (!u) return unitId;
  return getUnitType(u.type)?.name ?? u.type;
}

function streamsOf(graph: FlowGraph, unitId: string) {
  const inS = graph.streams.filter((s) => s.to?.unit === unitId);
  const outS = graph.streams.filter((s) => s.from.unit === unitId);
  return { inS, outS };
}

/** pick at most `max` units: the head of the path, an even middle sample, the tail */
function sampleUnits(graph: FlowGraph, max: number): string[] {
  const ids = graph.units.map((u) => u.id);
  if (ids.length <= max) return ids;
  const head = ids.slice(0, Math.ceil(max / 3));
  const tail = ids.slice(-Math.ceil(max / 3));
  const midCount = max - head.length - tail.length;
  const mid: string[] = [];
  if (midCount > 0) {
    const lo = head.length;
    const hi = ids.length - tail.length - 1;
    for (let i = 0; i < midCount; i++) {
      const idx = Math.round(lo + ((hi - lo) * (i + 0.5)) / midCount);
      mid.push(ids[idx]);
    }
  }
  return [...head, ...mid, ...tail];
}

export function generateTour(rec: PlantRecord): Tour {
  const graph = rec.graph;
  const steps: TourStep[] = [];
  const unitCount = graph.units.length;
  const streamCount = graph.streams.filter((s) => !s.implicit).length;
  const firstUnit = graph.units[0];

  // ---- intro: the brief, in the user's own words ----
  const briefLine = rec.brief
    ? rec.brief.length > 220
      ? `${rec.brief.slice(0, 217).trimEnd()}…`
      : rec.brief
    : '';
  steps.push({
    ref: firstUnit ? { type: 'unit', id: firstUnit.id } : { type: 'unit', id: '' },
    title: `${rec.name}`,
    text: [
      `This is ${rec.name}, built by the AI agents from your brief.`,
      briefLine ? `You asked for: ${briefLine}` : '',
      `They placed ${unitCount} units and ${streamCount} streams, and the solver closed the mass and energy balance across every one of them.`,
      'Walk the process path with me — click any unit to inspect it yourself.',
    ]
      .filter(Boolean)
      .join(' '),
  });

  // ---- the walk ----
  for (const id of sampleUnits(graph, 8)) {
    const title = unitTitle(graph, id);
    const { inS, outS } = streamsOf(graph, id);
    const inNames = inS.map((s) => s.name).filter(Boolean);
    const outNames = outS.map((s) => s.name).filter(Boolean);
    const role = ROLE[graph.units.find((u) => u.id === id)?.type ?? ''] ?? 'holds its conditions and moves the process forward';
    const seed = id.length + id.charCodeAt(0) + id.charCodeAt(id.length - 1);

    const inLine = inNames.length
      ? `It receives ${inNames.slice(0, 2).join(' and ')},`
      : 'It is where the plant begins,';
    const outLine = outNames.length
      ? `and hands off to ${outNames.slice(0, 2).join(' and ')}.`
      : 'and the process leaves the sheet here.';

    steps.push({
      ref: { type: 'unit', id },
      title,
      text:
        seed % 3 === 0
          ? `${inLine} ${outLine} In operation it ${role}. Hover the connected streams to see live temperature, pressure and composition.`
          : seed % 3 === 1
            ? `This is the ${title.toLowerCase()} — it ${role}. ${inLine} ${outLine}`
            : `${inLine} ${outLine} On the flowsheet, the ${title.toLowerCase()} ${role}. Every number you can hover was solved, not drawn.`,
    });
  }

  // ---- outro: the numbers + the verdict ----
  const k = rec.kpis;
  const kpiLine = k
    ? `The solver converged with production at ${Math.round(k.productionTpd).toLocaleString()} tonnes per day and product purity around ${(k.productPurityWt * 100).toFixed(1)} percent by weight.`
    : '';
  const verdictLine = rec.verdict
    ? rec.verdict.verdict === 'pass'
      ? `The critic signed it off at ${rec.verdict.score} out of 100: ${rec.verdict.summary}`
      : `The critic scored it ${rec.verdict.score} out of 100 — ${rec.verdict.summary}`
    : '';
  steps.push({
    ref: graph.units[graph.units.length - 1]
      ? { type: 'unit', id: graph.units[graph.units.length - 1].id }
      : { type: 'unit', id: '' },
    title: pick(OUTRO, unitCount + streamCount),
    text: [
      'That is the whole plant on one sheet.',
      kpiLine,
      verdictLine,
      'Hover any stream, click any unit — the flowsheet stays live under your cursor.',
    ]
      .filter(Boolean)
      .join(' '),
  });

  return {
    id: `auto-${rec.id}`,
    chip: 'Walk my plant',
    title: `A guided walk through ${rec.name}`,
    steps,
  };
}
