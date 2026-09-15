/**
 * Flash-separation educational content — dual-layer per unit plus one
 * authored guided tour. Same structure as the ammonia content so the panels
 * render both plants with one code path.
 */

import type { UnitContent, Tour } from './units';

export const FLASH_UNIT_CONTENT: Record<string, UnitContent> = {
  FEED: {
    plain:
      'Every process begins at the battery limit — the fence around the plant where raw materials arrive. Here, a synthesis gas arrives: mostly hydrogen and nitrogen at a 3-to-1 ratio, carrying about 12% ammonia vapor and a few percent of inerts (methane and argon). Think of it as a delivery truck of mixed goods: the job of this little plant is to unload the valuable part — the ammonia — and send the truck onward.',
    how:
      'The feed is defined by four numbers: total flow (kmol/h), ammonia content, inerts content, and its temperature and pressure. The H2/N2 ratio is fixed at 3:1, the stoichiometric recipe for ammonia synthesis — exactly the mixture the big plant\'s loop circulates. At 140 bar and 30 °C, the gas is single-phase: all of its ammonia is dissolved in the gas, above no liquid at all.',
    why:
      'Feed conditions are the problem statement of every separation. Before touching any equipment, ask two questions about the feed: how much of the valuable component does it carry, and how far is it from condensing? Both answers come from temperature and pressure alone — and both are levers you can pull in Operate mode.',
  },
  CHILL: {
    plain:
      'To pull ammonia out of a gas, make the gas cold. This chiller does exactly that — it is a refrigerator wrapped around a pipe. As the gas cools from 30 °C down to −20 °C, it reaches the point where ammonia can no longer stay vaporized: the gas becomes "saturated" and is ready to rain. Colder means more rain.',
    how:
      'A refrigerated shell-and-tube cooler: process gas on one side, boiling refrigerant on the other. The duty printed on hover is the heat the refrigeration system must remove — real plants pay real money for every megawatt of chilling, which is why the temperature is chosen carefully rather than "as cold as possible." The chiller also drops the pressure slightly (friction in real equipment always does).',
    why:
      'Temperature is the single most powerful knob in vapor-liquid separation. Slide it in Operate mode and watch the drum\'s vapor fraction respond — warmer leaves more ammonia in the gas (lost product), colder recovers more but costs refrigeration. Every condenser in every plant, from here to the ammonia synthesis loop, balances exactly this trade-off.',
  },
  DRUM: {
    plain:
      'This quiet vessel is where the lesson happens. The cold gas enters, slows down, and splits into two exits: vapor out the top, liquid out the bottom boot. Nothing is added, nothing reacts — the mixture simply sorts itself by how volatile each component is. Hydrogen and nitrogen are light and restless; they stay gas. Ammonia, the heavy, "sticky" molecule, condenses into liquid. One stream in, two streams out — the atom of every separation process.',
    how:
      'An adiabatic vapor-liquid flash at the inlet temperature and drum pressure. The split is computed by vapor-liquid equilibrium with the Peng-Robinson equation of state: each species divides between the phases according to its K-value (volatility), and the mixture must satisfy both the equilibrium relations and the material balance simultaneously. The vertical dashed line inside the symbol marks the liquid level; the boot collects liquid so it can drain steadily.',
    why:
      'Master this vessel and you can read half of the ammonia plant: the knockout drums, the CO2 removal feed, and — most importantly — V-103, the NH3 separator in the synthesis loop, which is this exact drum doing this exact job at industrial scale. Even a distillation column is nothing but dozens of these flashes stacked in a tower.',
  },
};

export const FLASH_TOURS: Tour[] = [
  {
    id: 'flash-walkthrough',
    chip: 'Walk me through it',
    title: 'One stream becomes two',
    steps: [
      {
        ref: { type: 'unit', id: 'FEED' },
        title: 'The delivery arrives',
        text: 'Synthesis gas enters at the battery limit: hydrogen and nitrogen at 3:1, carrying about 12% ammonia vapor plus some inert methane and argon. At 30 °C and 140 bar it is all gas — no liquid anywhere. The mission: recover the ammonia as a pure liquid.',
      },
      {
        ref: { type: 'stream', id: 'S01' },
        title: 'Learning to read a stream',
        text: 'This is a process stream — the numbered pill is its name. Hover it: temperature, pressure, flow, and composition appear. Every stream on every flowsheet in this app answers the same four questions. Get in the habit of checking them.',
      },
      {
        ref: { type: 'unit', id: 'CHILL' },
        title: 'Cold enough to rain',
        text: 'The chiller cools the gas from 30 °C to −20 °C. Cold gas holds less vapor — somewhere along the way the ammonia reaches its limit and is ready to condense. The duty you see on hover is the refrigeration bill: recovering product always costs energy.',
      },
      {
        ref: { type: 'unit', id: 'DRUM' },
        title: 'The split',
        text: 'Inside the drum, the mixture finds its equilibrium: light H2 and N2 stay vapor and leave the top; ammonia — the heavy, condensable molecule — rains out and drains from the boot. Nothing reacts, nothing is added. The phases sort themselves by volatility.',
      },
      {
        ref: { type: 'stream', id: 'S04' },
        title: 'The product',
        text: 'The bottom stream is liquid ammonia — hover it and read the composition. The recovery (how much of the feed\'s ammonia ended up here) and purity (how much of this liquid is ammonia) are the two numbers every separation is judged by.',
      },
      {
        ref: { type: 'stream', id: 'S03' },
        title: 'And the rest goes on',
        text: 'The top stream is the leftover gas: unreacted H2 and N2 with the inerts. In a real plant this would return to the reactor and try again — a recycle. Notice what stayed behind with the gas: the inerts. Volatility decides everything here.',
      },
      {
        ref: { type: 'unit', id: 'DRUM' },
        title: 'You have seen this before',
        text: 'This drum is V-103 of the big ammonia plant in miniature — same physics, same Peng-Robinson flash, same job. When you open the reference plant later, find the NH3 separator in the synthesis loop and recognize it. Then try Operate mode here: warm the chiller and watch the liquid disappear.',
      },
    ],
  },
];
