/**
 * Distillation educational content — dual-layer per unit plus the guided
 * tour (narrated automatically by the audio layer, like every plant's).
 * Same structure as the ammonia and flash content so one code path renders
 * all three plants.
 */

import type { UnitContent, Tour } from './units';

export const DISTILL_UNIT_CONTENT: Record<string, UnitContent> = {
  FEED: {
    plain:
      'This feed is two liquids mixed together: benzene and toluene, the classic textbook pair. Benzene boils at 80 °C, toluene at 111 °C — close, but not identical. That 31-degree gap is the entire reason this plant exists. The mission: split the mixture into a 97%-pure benzene stream off the top and a toluene stream off the bottom.',
    how:
      'Benzene (C6H6) and toluene (C7H8) are near-ideal liquids, so their volatility difference stays gentle and predictable — an almost constant relative volatility of about 2.3, computed here from the same Peng-Robinson equation of state the flash drum used. Benzene is the light key (more volatile, wants to be vapor), toluene the heavy key. A single flash on this feed would barely dent it: the phases would come out something like 60/40 and 35/65. Separation needs repetition.',
    why:
      'Feed composition sets the difficulty of everything downstream. A leaner feed means less distillate to draw and, counterintuitively, a higher minimum reflux — the physics shifts under your feet. Slide the benzene fraction in Operate mode and watch the whole column renegotiate its deal.',
  },
  HEATER: {
    plain:
      'Before the mixture enters the column, this preheater decides its mood. A cold liquid feed arrives shy: it must be warmed up to its bubble point before it can even participate. A feed already partly vaporized arrives loud: it brings its own vapor to the party. The same column behaves differently with each.',
    how:
      'The heater sets the outlet temperature, and the column translates that into the feed condition q — the fraction of the feed that arrives as liquid. q = 1 means saturated liquid; q above 1 is subcooled; below 1, partially vaporized; below zero, superheated vapor. The preheater duty is computed from the same enthalpy model the rest of the plant uses.',
    why:
      'Feed condition is a hidden design lever. Cold feed quietly condenses rising vapor inside the column — the reboiler pays the bill. Hot, flashing feed unburdens the reboiler but forces more work onto the condenser and raises the minimum reflux. There is no free lunch, only a choice of which kitchen pays.',
  },
  COLUMN: {
    plain:
      'This tower is the flash drum from Level 1, repeated fourteen times and stacked. Each tray holds a little pool of liquid; vapor bubbles up through it, and the two exchange molecules — benzene prefers the vapor, toluene the liquid. One exchange barely separates anything. Fourteen exchanges in a row, each starting where the last finished, multiply the effect into 97% purity.',
    how:
      'A binary McCabe–Thiele stage model. Every tray is one equilibrium flash: vapor and liquid leaving a tray satisfy the constant-α equilibrium relation, with α from the PR EOS at the feed bubble point. Above the feed tray, the rectifying section enriches benzene to the 97% spec; below it, the stripping section washes benzene out of the toluene. The solve finds the bottoms composition that makes exactly 14 stages land on the reboiler, and the reboiler itself counts as the final stage.',
    why:
      'This is the unit operation half of a chemical engineering education lives inside. Once you see a column as a stack of miniature flash drums, every absorber, stripper, and fractionator in any plant reads the same way — including the CO2 removal column in the big ammonia plant, which is this same idea wearing different chemistry.',
  },
  COND: {
    plain:
      'The vapor that reaches the top of the tower is rich in benzene but useless as a cloud. This condenser turns it all into liquid — completely, with no vapor left — so it can be collected, measured, and split. Condensing is the quiet half of the distillation trick: without it, the tower would just be a machine for making expensive weather.',
    how:
      'A total condenser: the overhead vapor is cooled to its bubble point at the column pressure, condensing every molecule. The duty reported here is real physics — the latent heat comes from the PR-EOS enthalpy model, the same one that sizes the condensation train in the ammonia plant. At the base case it removes about 6.5 MW.',
    why:
      'Condenser duty is the price of reflux. Every megawatt here must be removed by cooling water or refrigeration, and it scales directly with the reflux ratio you choose. When you push reflux upward in Operate mode, watch this number climb — that is the bill arriving.',
  },
  RDRUM: {
    plain:
      'A quiet drum with one decision to make. All the condensate arrives here; some leaves as the benzene product, and the rest is poured back onto the top tray as reflux. That return trip is the whole secret of distillation: the column is not just separating, it is separating against a counterflow of its own liquid.',
    how:
      'The drum splits the condensate into distillate D and reflux L, with the ratio R = L/D set by the column spec. Reflux ratio is the master operating variable of any column: at the minimum reflux Rmin the column needs infinite stages; at total reflux it makes no product at all. Real columns live between, typically around 1.2 to 1.5 times Rmin.',
    why:
      'R is where economics lives. Higher reflux buys purity and recovery but inflates both the condenser and reboiler duties — energy per tonne of product. Lower reflux saves energy until the column pinches and separation collapses. Finding the honest minimum is the operator\u2019s craft, and Operate mode lets you feel it.',
  },
  REB: {
    plain:
      'The engine room. This kettle reboiler boils part of the bottoms liquid and sends the vapor back up through every tray in the tower. That rising vapor is what carries benzene upward all night and day — the column is a conveyor belt made of boilup, and this is where the belt is powered.',
    how:
      'The reboiler vaporizes the boilup V-bar from the bottoms liquid; the boilup ratio V-bar/B tells you how hard the stripping section is working. Its duty comes from an overall energy balance around the whole column, so it honestly feels the feed condition: heat the feed less, and the reboiler bill rises to cover the difference.',
    why:
      'Distillation is thermodynamically expensive — you boil a liquid only to condense it again, paying both ways. Roughly speaking, the reboiler duty is the single largest operating cost of any distillation plant. This is why engineers obsess over feed preheating, heat integration, and reflux ratios before they ever draw the tower.',
  },
};

export const DISTILL_TOURS: Tour[] = [
  {
    id: 'distillation-walkthrough',
    chip: 'Walk me through it',
    title: 'The tower that repeats the flash',
    steps: [
      {
        ref: { type: 'unit', id: 'FEED' },
        title: 'A harder problem',
        text: 'Benzene and toluene arrive mixed, 45 percent benzene by mole. In Level 1, one flash drum split a gas because ammonia condensed and hydrogen did not. Here the two components are both liquids with boiling points only 31 degrees apart — a single flash would barely separate them. The mission needs something better.',
      },
      {
        ref: { type: 'stream', id: 'S01' },
        title: 'Reading the feed',
        text: 'Hover the stream: 500 kmol/h, 45 percent benzene, 25 °C, 1.4 bar. Note what is missing — no vapor, no gas, just a cold liquid. The two components differ only in volatility, so the entire separation will be built from volatility alone.',
      },
      {
        ref: { type: 'unit', id: 'HEATER' },
        title: 'Setting the mood of the feed',
        text: 'The preheater warms the feed to about 103 °C — essentially its bubble point. The column cares about one number this sets: the feed condition q. Cold feed arrives as subcooled liquid and makes the reboiler pay; partly vaporized feed unburdens the reboiler but demands more reflux. Same column, different personality.',
      },
      {
        ref: { type: 'unit', id: 'COLUMN' },
        title: 'A stack of miniature flash drums',
        text: 'Here is the whole idea. Each of the 14 trays holds liquid, and vapor bubbles through it. On every tray the mixture flashes to equilibrium: benzene leans into the vapor, toluene stays in the liquid. One tray separates a little; fourteen trays in a row separate completely. Above the feed, the rectifying section enriches benzene to 97 percent. Below it, the stripping section washes the last benzene out of the toluene.',
      },
      {
        ref: { type: 'stream', id: 'S06' },
        title: 'The secret ingredient',
        text: 'This line is reflux — condensed liquid poured back onto the top tray. Without it, rising vapor would meet only its own composition and nothing would improve. The reflux ratio R, the flow of this line over the distillate product, is the master lever of every column ever built.',
      },
      {
        ref: { type: 'unit', id: 'COND' },
        title: 'The top of the tower',
        text: 'The condenser liquefies everything that reaches the top — a total condenser, about 6.5 MW at the design point. The drum beside it then makes the one decision that matters: some condensate leaves as benzene product, the rest returns as reflux. Product out, patience back in.',
      },
      {
        ref: { type: 'unit', id: 'REB' },
        title: 'The engine room',
        text: 'At the bottom, the reboiler boils part of the toluene-rich liquid and returns it as vapor, which climbs back up through every tray. This boilup is the conveyor belt of the whole process — the column separates only as long as vapor rises and liquid falls. Both duties, top and bottom, are the energy bill of purity.',
      },
      {
        ref: { type: 'stream', id: 'S03' },
        title: 'Two products, one bill',
        text: 'The top product is 97 percent benzene; the bottom product is toluene with about 3 percent benzene left behind. Now switch to Operate and find the edge: slide the reflux ratio slowly down and watch the column pinch when R crosses its minimum, then fix the feed tray and watch the wasted stages come back to life.',
      },
    ],
  },
];
