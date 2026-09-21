/**
 * Educational content — dual-layer per unit (plain language → technical),
 * plus deterministic guided tours (no LLM required).
 *
 * Prose uses industrial ranges (EFMA Booklet No.1 / Flórez-Orrego 2017 /
 * Rice CENG403 — see research/2c_ammonia_eng.md); exact live numbers come
 * from the solved engine and are rendered by the detail panel.
 */

export type Ref = { type: 'unit' | 'stream'; id: string };

export interface UnitContent {
  /** what it does — plain language, no jargon assumed */
  plain: string;
  /** how it works — the technical layer for ChE students */
  how: string;
  /** why it matters — the operating insight */
  why: string;
}

export const UNIT_CONTENT: Record<string, UnitContent> = {
  M1: {
    plain:
      'Every ammonia plant starts with two ingredients: natural gas and steam. This unit measures and blends them into a single feed stream. Getting the recipe right — about three molecules of steam for every carbon atom — is one of the most important knobs in the whole plant, because it protects the furnace catalyst downstream and sets how much hydrogen the front end can make.',
    how:
      'The feed mixer combines methane-rich natural gas with superheated process steam at roughly 25–35 bar. The steam-to-carbon ratio (S/C) is held near 3.0 mol/mol — the industrial window is about 2.5–3.5. Below ~2.5, carbon deposits (coking) begin to form on the reformer catalyst and inside its tubes; above ~3.5, you are superheating steam you do not need, paying for it in furnace fuel and larger equipment.',
    why:
      'Watch the S/C slider in Operate mode: pushing it down raises efficiency but marches toward coking risk; pushing it up is safe but expensive. Everything downstream — hydrogen yield, furnace duty, steam balance — shifts from this one ratio.',
  },
  R1: {
    plain:
      'This is the heart of the front end: a giant gas-fired furnace full of vertical steel tubes packed with catalyst. Natural gas and steam flow through the hot tubes and split apart — methane breaks into hydrogen and carbon monoxide. The reaction soaks up heat, so the furnace must burn fuel continuously to keep it going. It is the single largest energy consumer in the plant.',
    how:
      'Steam-methane reforming (SMR) runs over nickel catalyst at 750–850 °C and 25–35 bar: CH4 + H2O ⇌ CO + 3H2, strongly endothermic (ΔH° ≈ +206 kJ/mol). Only part of the methane converts here — the gas leaves with meaningful CH4 slip because equilibrium at these conditions is unfavorable — so the engine models the outlet with an explicit approach-to-equilibrium temperature offset. Fired duty for a 1,000 t/d train is on the order of 60–70 MW.',
    why:
      'Hotter outlet → less CH4 slip → more hydrogen, but tube metallurgy caps you near 850–900 °C. This trade-off between yield and equipment life is a classic design compromise you can explore by moving the reformer temperature slider.',
  },
  R2: {
    plain:
      'The gas leaving the primary reformer is not finished: it still holds methane, and — crucially — contains no nitrogen yet. This vessel fixes both problems at once. Compressed air is blown in at the top and burned, generating intense heat that finishes the reforming over a catalyst bed. The air brings the nitrogen the ammonia reaction will need later.',
    how:
      'A dual-zone model: (1) an adiabatic combustion zone where process air (79% N2, 21% O2, 0.93% Ar) partially burns H2, raising the gas past 1,000 °C; (2) a catalytic equilibrium zone completing the reforming to ~950–1,000 °C. Air flow is the design degree of freedom that trims make-up H2/N2 to exactly 3.0 — the engine solves for it with a secant controller.',
    why:
      'Two details students often miss: nitrogen enters the plant only here, and argon rides in with the air. Argon is inert — it does nothing but accumulate in the synthesis loop, which is why the plant needs a purge. Trace it through the flowsheet and you will understand the purge stream.',
  },
  E1: {
    plain:
      'Gas leaving the secondary reformer is nearly 1,000 °C — far too hot for the next catalyst, and far too valuable to waste. This boiler cools the gas while turning boiler feedwater into high-pressure steam. That steam drives turbines and comes back as process steam at the feed mixer, closing a big energy loop.',
    how:
      'A waste-heat boiler recovers the sensible heat of the secondary effluent, generating HP steam (typically 40–100+ bar depending on the design) and cooling the process gas to ~350–400 °C — the inlet window for the high-temperature shift catalyst. In a well-designed plant this recovered heat covers a large share of total steam demand; the reformer flue gas is separately recovered for feed preheat and steam superheat.',
    why:
      'Ammonia plants live and die by heat integration. The specific energy benchmark of 28–30 GJ per tonne of NH3 for best-available technology is only reachable because units like this harvest every Joule. The base case here shows the front end as a net steam producer, not a consumer.',
  },
  R3: {
    plain:
      'The gas now holds a lot of carbon monoxide — useless for ammonia and poisonous to the synthesis catalyst later. This reactor reacts CO with steam, converting it into CO2 and — as a bonus — producing another hydrogen molecule each time. It is the first of two shift reactors.',
    how:
      'High-temperature water-gas shift over iron-chromium catalyst at 300–450 °C: CO + H2O ⇌ CO2 + H2, exothermic (ΔH° ≈ −41 kJ/mol). The HTS does the bulk of the conversion fast; kinetics are quick at these temperatures but equilibrium limits how far CO can fall — hotter gas holds more CO at equilibrium.',
    why:
      'This is a textbook Le Chatelier machine: the reaction is exothermic, so conversion improves as temperature drops. That sets up the plant\'s two-stage trick — convert hot and fast here, then cool and convert again in the LTS.',
  },
  E4: {
    plain:
      'A simple cooler between the two shift reactors — but it is doing strategic work. By chilling the gas to around 200 °C, it moves the shift reaction\'s equilibrium in the favorable direction before the second, colder catalyst bed.',
    how:
      'Cools the HTS effluent to the LTS inlet window (180–240 °C). Because WGS is exothermic, every 50 °C of cooling multiplies the equilibrium constant in your favor — K_WGS roughly doubles from 400 °C to 220 °C. The intercooler is what makes the second shift stage worth building.',
    why:
      'Compare the CO leaving each shift reactor in the stream table: the LTS cuts it roughly an order of magnitude further. Without this cooler in between, both beds would sit at the same unfavorable equilibrium and the LTS would achieve almost nothing.',
  },
  R4: {
    plain:
      'The second shift reactor runs on a different, more delicate catalyst that works at much lower temperature. Colder shifts the chemistry further, scrubbing carbon monoxide down to a few tenths of a percent. That matters because even traces of CO will later poison the catalyst that makes ammonia.',
    how:
      'Low-temperature shift over copper-zinc-alumina catalyst at 180–250 °C, taking CO down to ~0.1–0.3% dry. Copper catalyst is extremely active but thermally fragile and sensitive to sulfur/chloride — which is why it sits downstream of desulfurized feed and behind the HTS rather than replacing it.',
    why:
      'Why not run everything cold? Kinetics: at 200 °C the reaction is slow, so the bed would need to be enormous to convert the full CO load. Hot-then-cold staging gets bulk conversion fast, then polishing at favorable equilibrium — an elegant compromise seen across the process industries.',
  },
  V1: {
    plain:
      'By now the gas has cooled enough that some of its steam has condensed into liquid water. This drum simply drains that water out of the gas before the next step. Liquid water in the wrong place dilutes solvents and damages downstream equipment.',
    how:
      'A horizontal knockout drum with a boot: gravity separates condensed water from the gas. Condensate leaves the bottom (here, back to boiler feedwater); the gas continues to CO2 removal. Water removal matters because the amine unit that follows would otherwise be diluted and its absorption chemistry upset.',
    why:
      'Small vessels like this rarely make headlines, but they protect everything downstream. In the flowsheet, follow stream 12 — every kilogram of condensate here is water the plant does not have to purify again.',
  },
  A1: {
    plain:
      'After the shift reactors, the gas is roughly 15–20% CO2 — dead weight for ammonia synthesis. This absorption column scrubs it out using a circulating liquid solvent. The captured CO2 leaves as its own stream, clean enough to sell (it is the raw material for urea fertilizer).',
    how:
      'Activated MDEA (aMDEA) absorption: an aqueous amine solvent chemically binds CO2 in the lower column, releasing it in a companion regenerator when reboiled. The column is modeled with a residual-CO2 specification down to the ppmv–hundreds level, plus a small hydrogen co-absorption slip — real plants lose a little H2 with the CO2.',
    why:
      'Two honest engineering truths live here: the solvent regeneration eats steam (it is one of the plant\'s notable energy loads), and the H2 slip means every separation has a cost. CO2 removal sits between two worlds — it purifies the hydrogen stream and it manufactures a saleable co-product.',
  },
  R5: {
    plain:
      'Almost clean now — but "almost" is not good enough. Traces of carbon monoxide and CO2, even at parts-per-million levels, permanently poison the iron catalyst in the ammonia reactor. This little reactor converts those last traces into harmless methane and water.',
    how:
      'Methanation over nickel catalyst at 250–350 °C: CO + 3H2 → CH4 + H2O and CO2 + 4H2 → CH4 + 2H2O. The engine solves the combined equilibrium to a total carbon-oxides level of a few ppmv. Note the cost: each converted CO2 molecule consumes four valuable H2 molecules.',
    why:
      'This is the purification endgame — the last guard before the synthesis loop. The methane it creates is inert in the loop, so it drifts to the purge. There is a beautiful chain here: CO left over from reforming becomes CH4 becomes purge fuel.',
  },
  V2: {
    plain:
      'The methanator just made water as a byproduct, and liquid water must not enter a high-pressure compressor. This knockout drum — the last piece of the front end — drains it away before the gas is squeezed into the synthesis loop.',
    how:
      'Identical physics to the first knockout: cool the gas, let gravity do the work, drain the boot. After this drum the gas is called make-up syngas — stoichiometric H2/N2, nearly free of poisons, and ready for compression from ~30 bar to loop pressure.',
    why:
      'Compressors and liquid droplets are a bad combination — droplets erode blades at 10,000 rpm. Knockout drums are cheap insurance protecting the most expensive rotating machinery in the plant.',
  },
  C1: {
    plain:
      'Ammonia synthesis only works at high pressure — Le Chatelier again: fewer product molecules than reactants means pressure pushes the reaction forward. This multi-stage machine compresses the clean syngas from ~30 bar to the 150–200 bar of the synthesis loop.',
    how:
      'A multi-stage centrifugal compressor train with interstage cooling, modeled with polytropic compression (efficiency ~70–80%). Shaft power for this plant scale is on the order of several MW — typically driven by a steam turbine fed from the waste-heat boiler, tying the machinery to the plant\'s steam balance. Make-up joins the loop after condensation (EFMA BAT arrangement).',
    why:
      'Watch the trade in Operate mode: higher loop pressure raises per-pass conversion but the compressor pays for every bar. The specific-energy readout moves as you drag loop pressure — the plant-level cost of a chemistry favor.',
  },
  M2: {
    plain:
      'Here the fresh compressed syngas meets the gas returning from the loop — a blend of unreacted hydrogen and nitrogen coming back for another pass. Everything the loop will ever see gets its composition set at this junction.',
    how:
      'The loop mixer combines make-up (H2/N2 ≈ 3, plus inerts) with the recycle stream, which is depleted in reactants and enriched in inerts (CH4, Ar) and carries a little NH3 vapor. In this plant the recycle-to-make-up ratio is roughly 4–5, so the mixed gas entering the converter is dominated by recycle.',
    why:
      'This is the hinge between the front end and the loop: upstream is once-through chemistry, downstream is a circular economy of unreacted gas. The mixer composition is also where the inerts problem becomes visible — every pass adds inerts, only the purge removes them.',
  },
  E3: {
    plain:
      'The converter makes heat; the gas entering it needs heat. This exchanger arranges for the hot product to warm up the cold feed on its way in — the plant literally uses its own reaction heat to start the reaction.',
    how:
      'A classic feed/effluent exchanger: converter effluent (≈ 400–450 °C, near the adiabatic exit) preheats the mixed loop gas to catalyst ignition temperature (~380–420 °C) before the first bed. The closer the approach, the less trimming duty is needed, but exchanger area (money) buys temperature approach.',
    why:
      'Feed/effluent exchange is the signature heat-integration move of exothermic loop processes. It is why the converter can be nearly self-sustaining thermally: light it once, and the reaction\'s own heat keeps the next batch of gas ready to react.',
  },
  R6: {
    plain:
      'This is the vessel the plant exists for — where hydrogen and nitrogen finally become ammonia. It is a tall pressure vessel holding three stacked beds of iron catalyst, with cold gas injected between the beds to control temperature. Only about 15% of the gas converts on each pass; the loop exists to bring the rest back.',
    how:
      'N2 + 3H2 ⇌ 2NH3, exothermic (ΔH° ≈ −92 kJ/mol), over promoted-iron catalyst at 150–200 bar. Gas heats as it converts through each bed; quench gas between beds cools it, because equilibrium NH3 falls sharply with temperature. Each bed approaches 90–95% of its equilibrium (modern fractional approach — the old 60–70% figures underpredict outlet NH3). Outlet is ~14–18% NH3.',
    why:
      'The temperature ladder across the three beds is the whole design story: kinetics want it hot, equilibrium wants it cold, and the quench system is the negotiation. Click each bed\'s inlet temperature in Operate mode and watch per-pass conversion move — this is the single most instructive knob in the plant.',
  },
  E2: {
    plain:
      'The gas leaving the converter is mostly still hydrogen and nitrogen, carrying its newly-made ammonia as vapor. To separate the ammonia you must chill the gas until the ammonia condenses into liquid — the same way a cold glass pulls water out of humid air.',
    how:
      'The condensation train cools the converter effluent to roughly −20 to −30 °C (here modeled with a Peng–Robinson flash — mixture VLE that simple tools cannot do). At 150–200 bar, most NH3 condenses while H2/N2 stay gaseous. Refrigeration duty is MW-scale; colder recovery buys purity and yield but spends compressor power.',
    why:
      'Notice the deep interlock with the loop: condenser temperature decides how much NH3 survives to the product versus recirculates as vapor. Pull the condensation temperature slider up and down in Operate mode — production and recycle composition swing together.',
  },
  V3: {
    plain:
      'A tall drum that lets gravity finish the job: liquid ammonia settles to the bottom and leaves as the product stream; the lighter gas — unreacted hydrogen, nitrogen, inerts — rises off the top and heads back toward the loop mixer.',
    how:
      'Vertical two-phase separator with a boot. Liquid product is 99%+ NH3 (the balance mostly dissolved gases). Vapor off the top carries the unconverted reactants plus inerts and a small NH3 vapor fraction set by the VLE — the engine flashes this exactly, which is why argon balances matter.',
    why:
      'This is the boundary between product and recycle — the single point where the loop "exits" to the customer. Everything that rises instead of settling is a hydrogen molecule the plant gets to use again.',
  },
  SP1: {
    plain:
      'Argon and methane never react and never leave — unless you open a valve. A small slice of the loop gas is deliberately purged to the fuel system, and that is the only exit for inerts. Bleed too little and inerts choke the loop; too much and you throw away valuable hydrogen.',
    how:
      'A flow split: a few percent of separator gas is purged (EFMA designs run inerts at 10–15% of loop gas; this base case sits near 7%). Purged gas has fuel value — it is burned in the primary reformer furnace, so the H2 is not entirely wasted. The purge fraction is a direct economic dial: H2 lost vs. per-pass conversion maintained.',
    why:
      'Try the purge-fraction slider in Operate mode: production, inerts level and specific energy all respond. There is an optimum — this is one of the plant\'s cleanest examples of a real optimization trade-off.',
  },
  C2: {
    plain:
      'The loop\'s heart. A circulator — a small, high-volume compressor — keeps the gas moving around the synthesis loop, making up the pressure the converter, exchangers and piping take away. It runs quietly all day, pushing the same molecules around thousands of times.',
    how:
      'A single-stage centrifugal loop circulator: high volumetric flow, small pressure rise (a few bar), modest power relative to the make-up machine. The recycle multiple — here roughly 4–5× the make-up flow — is what turns a 15% per-pass converter into a plant with better than 95% overall conversion of make-up nitrogen.',
    why:
      'Follow stream 23 around the bottom of the flowsheet: circulator → the long return line → loop mixer. That one line closing the circuit is the difference between a demo and a plant. Circulators also define loop dynamics — in dynamic simulators, surge and trip studies start here.',
  },
};

// ---------------------------------------------------------------------------
// Guided tours — deterministic, authored, no LLM required.
// ---------------------------------------------------------------------------

export interface TourStep {
  ref: Ref;
  title: string;
  text: string;
  /** camera framing while this stop speaks. 'unit' (the default) dives to
   *  the step's ref; 'fit' holds the WHOLE sheet — the overview that opens
   *  a tour and the outro that lands it, so the narrator can point at the
   *  entire plant before (and after) walking through it. */
  framing?: 'unit' | 'fit';
}

export interface Tour {
  id: string;
  chip: string;
  title: string;
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: 'walkthrough',
    chip: 'Walk me through the plant',
    title: 'The plant, end to end',
    steps: [
      {
        ref: { type: 'unit', id: 'M1' },
        framing: 'fit',
        title: 'The plant at a glance',
        text: 'Here is the whole plant on one sheet. Natural gas enters on the left; by the right edge it has become liquid ammonia, and the long return line at the bottom carries the unreacted gas around for another pass. Every unit, front to back — walk them with me.',
      },
      {
        ref: { type: 'unit', id: 'M1' },
        title: 'Two ingredients',
        text: 'Natural gas and steam — measured and blended at a steam-to-carbon ratio near 3. From here to the converter, everything that happens is a chain of chemistry that turns this mixture into pure hydrogen and nitrogen.',
      },
      {
        ref: { type: 'unit', id: 'R1' },
        title: 'Splitting methane',
        text: 'The primary reformer is a fired furnace full of catalyst tubes. Inside, methane reacts with steam to make hydrogen and carbon monoxide, soaking up ~65 MW of heat. It is the plant\'s biggest single energy consumer.',
      },
      {
        ref: { type: 'unit', id: 'R2' },
        title: 'Air, fire, and nitrogen',
        text: 'Air is blown into the secondary reformer and partially burned, finishing the reforming with the heat released. The air\'s nitrogen — 79% of it — is the nitrogen that will become ammonia. Its argon is why the plant needs a purge later.',
      },
      {
        ref: { type: 'unit', id: 'E1' },
        title: 'Nothing is wasted',
        text: 'Gas leaves the secondary reformer near 1,000 °C. The waste-heat boiler harvests that into high-pressure steam, cooling the gas to shift-catalyst temperature. Best-practice plants owe their 28–30 GJ/t energy figures to heat recovery like this.',
      },
      {
        ref: { type: 'unit', id: 'R3' },
        title: 'Shift, stage one',
        text: 'Carbon monoxide is useless for ammonia — but reacted with steam it becomes CO2 plus one more hydrogen. The high-temperature shift reactor converts most of it, fast and hot.',
      },
      {
        ref: { type: 'unit', id: 'R4' },
        title: 'Shift, stage two — colder',
        text: 'The reaction\'s equilibrium favors low temperature, so the gas is cooled and sent through a second, colder catalyst bed. Carbon monoxide falls from percent levels to a few tenths of a percent.',
      },
      {
        ref: { type: 'unit', id: 'A1' },
        title: 'Scrubbing the carbon dioxide',
        text: 'The shift reactors made H2 — and CO2. This amine column absorbs the CO2 into a circulating solvent and releases it as a pure byproduct stream (the raw material for urea). The gas leaving is nearly pure H2 and N2.',
      },
      {
        ref: { type: 'unit', id: 'R5' },
        title: 'The last guard',
        text: 'Parts-per-million traces of CO and CO2 would permanently poison the ammonia catalyst. The methanator converts them into inert methane and water. After this, the gas is clean enough to compress.',
      },
      {
        ref: { type: 'unit', id: 'C1' },
        title: 'Squeezing to 150 bar',
        text: 'Ammonia synthesis needs high pressure — the product side has fewer gas molecules, so pressure pushes the reaction forward. The syngas compressor is a multi-stage machine of several MW, typically steam-turbine driven from the plant\'s own waste heat.',
      },
      {
        ref: { type: 'unit', id: 'R6' },
        title: 'The reaction itself',
        text: 'Three catalyst beds with cold-gas quenching between them. Hydrogen and nitrogen combine to ammonia — exothermic, so each bed heats up and must be cooled before the next. About 15% of the gas converts per pass; that is normal.',
      },
      {
        ref: { type: 'unit', id: 'E2' },
        title: 'Chill until it rains ammonia',
        text: 'The converter effluent is chilled to around −20 °C so the ammonia condenses into liquid — a vapor–liquid equilibrium the simulator computes with the Peng–Robinson equation of state.',
      },
      {
        ref: { type: 'unit', id: 'V3' },
        title: 'Product off the bottom',
        text: 'The separator drains 99%+ pure liquid ammonia as the product stream. The gas above it — unreacted H2, N2, inerts — stays in the game.',
      },
      {
        ref: { type: 'unit', id: 'SP1' },
        framing: 'fit',
        title: 'Purge, then go around again',
        text: 'A few percent of loop gas is purged to the fuel system — the only exit for argon and methane. Everything else is pushed by the circulator along the long return line at the bottom of the diagram, back to the loop mixer. That returning line is why this is a loop.',
      },
    ],
  },
  {
    id: 'molecule',
    chip: 'Follow one hydrogen atom',
    title: 'A hydrogen atom\'s journey',
    steps: [
      {
        ref: { type: 'stream', id: 'S01' },
        framing: 'fit',
        title: 'You arrive in a methane molecule',
        text: 'You are bonded to a carbon atom in natural gas entering at ~30 bar. Four hydrogen atoms share your molecule. For now, you are a fuel — but this plant has other plans for you.',
      },
      {
        ref: { type: 'stream', id: 'S04' },
        title: 'The furnace sets you free',
        text: 'Through the reformer tubes at ~800 °C, steam has stripped your carbon away and you are now free H2 — one of three hydrogen atoms made from each methane (plus more from the steam itself). But the gas is still full of CO and unreformed methane.',
      },
      {
        ref: { type: 'stream', id: 'S08' },
        title: 'The shift gives you company',
        text: 'In the shift reactors, CO reacts with steam: CO + H2O → CO2 + H2. Each carbon monoxide liberates a brand-new hydrogen — many of your neighbors joined the party this way.',
      },
      {
        ref: { type: 'stream', id: 'S15' },
        title: 'Scrubbed clean',
        text: 'The amine column removed the CO2, the methanator destroyed the last traces of carbon oxides. You now travel in an almost pure H2/N2 mixture — poisoned catalyst can no longer ruin your future.',
      },
      {
        ref: { type: 'stream', id: 'S18' },
        title: 'Squeezed to loop pressure',
        text: 'The syngas compressor took you from ~30 bar to ~150 bar. You join the recycle — at this junction, you are outnumbered by veterans, gas that has been around the loop many times.',
      },
      {
        ref: { type: 'stream', id: 'S20' },
        title: 'Into the converter',
        text: 'Preheated by the effluent of the previous pass, you enter the first catalyst bed. Here you meet nitrogen — and on an iron catalyst surface, three of you bind to one N atom.',
      },
      {
        ref: { type: 'stream', id: 'S21' },
        title: 'You are ammonia now',
        text: 'Roughly 15% of the gas converts on this pass. You made it — you leave the converter as part of an NH3 molecule, hot and still gaseous at 150 bar.',
      },
      {
        ref: { type: 'stream', id: 'S24' },
        title: 'The end of the line',
        text: 'Chilled to −20 °C, you condensed, settled in the separator, and drained off the bottom boot as liquid product — 99%+ pure ammonia, destined for fertilizer that grows food. Journey complete.',
      },
      {
        ref: { type: 'stream', id: 'S23' },
        framing: 'fit',
        title: '…and the 85% who went around again',
        text: 'Not every atom converts on the first pass. The unreacted gas follows this long return line — cooled, separated, recompressed, and sent back through the converter. After several laps, overall conversion exceeds 95%. The loop is patience made visible.',
      },
    ],
  },
  {
    id: 'loop',
    chip: 'Why does the plant need a loop?',
    title: 'Why a loop?',
    steps: [
      {
        ref: { type: 'unit', id: 'R6' },
        framing: 'fit',
        title: 'The uncomfortable truth',
        text: 'Ammonia synthesis is equilibrium-limited. Even at 150–200 bar, only ~15% of the gas converts per pass through the converter. A once-through plant would throw away 85% of its hydrogen — economically absurd.',
      },
      {
        ref: { type: 'unit', id: 'E2' },
        title: 'Take the product out',
        text: 'The first half of the fix: chill the effluent and condense the ammonia out. Now the remaining gas is mostly unreacted H2 and N2 — too valuable to burn.',
      },
      {
        ref: { type: 'unit', id: 'SP1' },
        title: 'Let the troublemakers leave',
        text: 'Argon (from air) and methane (from methanation) are inert — they just accumulate. The purge valve bleeds a few percent of the loop to fuel, keeping inerts near 10%. It is the loop\'s only leak, and it exists on purpose.',
      },
      {
        ref: { type: 'unit', id: 'C2' },
        title: 'Push it back around',
        text: 'The circulator boosts the separated gas back to loop pressure and sends it along the return line — the long path along the bottom of the flowsheet. High flow, small pressure rise, running forever.',
      },
      {
        ref: { type: 'unit', id: 'M2' },
        title: 'Fresh blood meets veterans',
        text: 'At the loop mixer, fresh make-up syngas (about 1 part) joins returning recycle (about 4–5 parts). The converter sees mostly second-, third-, tenth-pass gas.',
      },
      {
        ref: { type: 'stream', id: 'S23' },
        framing: 'fit',
        title: 'The payoff',
        text: 'Follow this line with your eyes: circulator → return line → mixer → converter → condenser → separator → back again. Each lap converts another slice of gas. A 15%-per-pass reactor becomes a plant with better than 95% overall conversion. That closed circuit is the single most important idea in the flowsheet.',
      },
    ],
  },
];

/** static answer card for the legend chip */
export const COLOR_ANSWER = {
  title: 'Reading the diagram',
  text: [
    'Lines are material streams, color-coded by what they carry. Ochre = fresh feeds (natural gas, steam, air). Steel blue = process gas — hydrogen and nitrogen on their way to becoming ammonia, including the recycle. Green = liquid ammonia product. Dashed gray = utilities and byproducts (condensate, CO2, purge).',
    'Every piece of equipment carries a tag (R-102 is the primary reformer; the letter tells the class — R reactor, E exchanger, V vessel, C column, K compressor, M mixer, SP splitter) and every stream carries a circled number. Hover any stream for its live temperature, pressure and composition; click any unit for the full story.',
  ],
};
