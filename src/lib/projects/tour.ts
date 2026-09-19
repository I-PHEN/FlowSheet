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
import { getUnitType, resolveSpecs } from '@/lib/engine/registry';
import type { PlantRecord } from './record';

/** friendly role prose, keyed by REAL registry type (gated by tests — the
 *  keys drifted once and every tour silently fell back to generic prose) */
const ROLE: Record<string, string> = {
  // feeds
  'ng-source': 'sets the feed contract — composition, pressure and flow everything downstream inherits',
  'steam-source': 'supplies the steam the chemistry will need later',
  'air-source': 'brings in air from the battery limit — and the nitrogen and argon riding with it',
  'acid-gas-source': 'brings the acid gas feed in from the battery limit',
  'syngas-feed': 'delivers the feed mixture this separation study starts from',
  'column-feed': 'feeds the column at the right tray and condition',
  // front end
  'feed-mixer': 'blends the incoming streams into one feed with a defined composition',
  'primary-reformer': 'cracks the hydrocarbon into syngas over catalyst at high temperature',
  'secondary-reformer': 'completes the reforming with injected air and leaves the gas hot enough to work with',
  'whb-cooler': 'recovers heat from the hot gas and makes steam while cooling the stream',
  'wgs-hts': 'shifts carbon monoxide toward hydrogen over iron catalyst',
  'intercooler': 'chills the gas between the shift beds, moving the reaction equilibrium in the favorable direction',
  'wgs-lts': 'polishes the shift reaction at low temperature for maximum hydrogen yield',
  'ko-drum-shift': 'drains condensed water out of the gas before the next step',
  'co2-removal': 'scrubs the acid gas out of the process stream',
  methanator: 'converts the last traces of carbon oxides back to methane',
  'ko-drum-meth': 'removes the water methanation produced before the gas is compressed',
  // loop
  'syngas-compressor': 'raises the pressure — the loop only reacts when the gas is squeezed',
  'loop-mixer': 'is where fresh make-up syngas meets the returning recycle',
  'feed-preheater': 'preheats the feed with the converter’s own effluent — the loop heats itself',
  converter: 'is where the real chemistry happens: the gas reacts over catalyst beds and product begins to form',
  'condensation-train': 'chills the gas until the product condenses out as liquid',
  'nh3-separator': 'splits the phases — light components overhead, product out the bottom',
  'purge-split': 'controls what leaves the loop so inerts never accumulate',
  'loop-circulator': 'boosts the separated gas back to loop pressure and keeps the loop moving',
  // teaching templates
  chiller: 'cools the gas until the valuable component is ready to condense',
  'flash-drum': 'lets vapor and liquid go their separate ways — nothing added, nothing reacting',
  'feed-heater': 'brings the feed to its bubble point before the column',
  'distillation-column': 'separates by volatility, stage by stage — a tower of many small flashes',
  // families (species #3 + #4)
  'meoh-converter': 'is where methanol forms over catalyst — carbon oxides reacting with hydrogen',
  'meoh-separator': 'condenses the crude methanol out and returns unreacted gas to the loop',
  psa: 'adsorbs impurities at pressure and releases them at low pressure — hydrogen comes out clean',
  'claus-burner': 'burns a third of the acid gas to SO2, creating the oxygen the Claus chemistry needs',
  'claus-converter': 'reacts hydrogen sulphide with SO2 over catalyst to make elemental sulphur',
  'sulphur-condenser': 'condenses sulphur vapor into liquid and lets it drain out of the train',
};

export { ROLE };

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

/** sanitize an unknown JSON blob into a playable Tour (refs must exist,
 *  texts sane) — agent-authored tours pass through, hand-edited junk -> null */
export function safeTour(t: unknown): Tour | null {
  if (!t || typeof t !== 'object') return null;
  const o = t as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.title !== 'string' || !Array.isArray(o.steps)) return null;
  const steps: TourStep[] = [];
  for (const raw of o.steps) {
    if (!raw || typeof raw !== 'object') continue;
    const st = raw as Record<string, unknown>;
    const ref = st.ref as { type?: unknown; id?: unknown } | undefined;
    const title = typeof st.title === 'string' ? st.title : '';
    const text = typeof st.text === 'string' ? st.text : '';
    if (!ref || typeof ref.id !== 'string' || !title || !text) continue;
    if (text.length < 20 || text.length > 900) continue;
    steps.push({ ref: { type: 'unit', id: ref.id }, title: title.slice(0, 80), text });
  }
  if (steps.length < 3) return null;
  return {
    id: o.id.slice(0, 64),
    chip: typeof o.chip === 'string' ? o.chip.slice(0, 32) : 'Guided tour',
    title: o.title.slice(0, 120),
    steps,
  };
}

/**
 * Caption for a unit the user clicked while FREE ROAMING an AI-built plant
 * (no authored stop for it). Registry facts + role prose — the same honest
 * material the inspector shows, phrased as a caption. Deterministic.
 */
export function roamStep(graph: FlowGraph, unitId: string): { title: string; text: string } {
  const u = graph.units.find((x) => x.id === unitId);
  if (!u) return { title: unitId, text: 'This unit is no longer on the sheet.' };
  const def = getUnitType(u.type);
  const name = def?.name ?? u.type;
  const role = ROLE[u.type] ?? 'holds its conditions and moves the process forward';
  const { inS, outS } = streamsOf(graph, unitId);
  const inNames = inS.map((s) => s.name || s.id);
  const outNames = outS.map((s) => s.name || s.id);
  const inLine = inNames.length
    ? `It receives ${inNames.slice(0, 2).join(' and ')},`
    : 'It is where the plant begins,';
  const outLine = outNames.length
    ? `and hands off to ${outNames.slice(0, 2).join(' and ')}.`
    : 'and the process leaves the sheet here.';
  const model = def ? def.model(resolveSpecs(u)) : '';
  return {
    title: name,
    text: [
      `This is ${u.id}, the ${name.toLowerCase()}.`,
      `${inLine} ${outLine}`,
      `In operation it ${role}.`,
      model ? `Datasheet: ${model}.` : '',
      'Hover its streams for live values — every number was solved, not drawn.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
