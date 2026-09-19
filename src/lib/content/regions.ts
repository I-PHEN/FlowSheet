/**
 * "What's made near me?" — a curated map from world regions to the process
 * plants that actually run there, for the student who doesn't know what to
 * build yet. Every region maps to buildable families (with a why-here story)
 * and to real plants we cannot build yet — honesty about the horizon is part
 * of the teaching.
 *
 * Facts are simplified to one honest sentence each; capacities are typical
 * world-scale ranges, not specific plants.
 */

export type FamilyId = 'ammonia' | 'methanol' | 'hydrogen' | 'sulphur';

export interface HerePlant {
  family: FamilyId;
  /** why this plant lives in this region — the intuition we want to spark */
  why: string;
  /** a region-flavoured brief the student can build in one click */
  brief: string;
}

export interface RegionEntry {
  id: string;
  name: string;
  scope: string;
  industries: string;
  here: HerePlant[];
  /** real plants in this region that the builder cannot make (yet) */
  coming: string[];
}

export const REGIONS: RegionEntry[] = [
  {
    id: 'trinidad',
    name: 'Trinidad & Tobago',
    scope: 'Point Lisas',
    industries: 'The Caribbean\u2019s petrochemical powerhouse — gas in, fertiliser and methanol out.',
    here: [
      {
        family: 'ammonia',
        why: 'Twelve ammonia trains on one industrial estate — Trinidad literally fertilises half the Caribbean.',
        brief: 'A Point Lisas-style ammonia plant — 1,200 t/d, natural gas at battery limit, export-oriented.',
      },
      {
        family: 'methanol',
        why: 'Trinidad is one of the world\u2019s largest methanol exporters — the same gas, one step further down the chain.',
        brief: 'A Trinidad methanol mega-train — 5,000 t/d, Atlas-scale, gas from the Columbus basin.',
      },
    ],
    coming: ['LNG train', 'urea granulation'],
  },
  {
    id: 'nigeria',
    name: 'Nigeria',
    scope: 'Niger Delta',
    industries: 'Big gas reserves, growing downstream — LNG exports meeting a fertiliser boom.',
    here: [
      {
        family: 'ammonia',
        why: 'Africa\u2019s largest refinery sits beside a brand-new ammonia-urea complex — gas that used to be flared now feeds farms.',
        brief: 'A Nigerian-style ammonia plant — 1,500 t/d, associated gas feed, sized for domestic fertiliser.',
      },
      {
        family: 'hydrogen',
        why: 'Refineries devour hydrogen to scrub sulphur out of diesel — every refinery is a hydrogen customer.',
        brief: 'A refinery-scale hydrogen plant — 80 t/d, SMR with PSA, feeding a hydrotreater.',
      },
      {
        family: 'sulphur',
        why: 'Sour associated gas means H2S — and every tonne of it must become sulphur, not flared SO2.',
        brief: 'A Niger Delta Claus unit — acid gas from the amine unit, 300 t/d of liquid sulphur.',
      },
    ],
    coming: ['LNG train', 'petroleum refinery'],
  },
  {
    id: 'qatar',
    name: 'Qatar',
    scope: 'Persian Gulf',
    industries: 'The LNG superpower, now building blue ammonia for the hydrogen economy.',
    here: [
      {
        family: 'ammonia',
        why: 'The North Field feeds one of the world\u2019s biggest ammonia-urea complexes — energy diplomacy in fertiliser form.',
        brief: 'A Qatari ammonia plant — 2,300 t/d, North Field gas, aiming at blue-ammonia exports.',
      },
      {
        family: 'methanol',
        why: 'Qatar turns stranded gas into methanol for Asia\u2019s chemical markets — value before distance.',
        brief: 'A Gulf methanol plant — 5,000 t/d, one train, tanker-ready.',
      },
    ],
    coming: ['LNG train', 'gas-to-liquids (Fischer-Tropsch)'],
  },
  {
    id: 'gulf-coast',
    name: 'US Gulf Coast',
    scope: 'Texas & Louisiana',
    industries: 'The densest chemical corridor on Earth — everything from ethylene to ammonia in one strip.',
    here: [
      {
        family: 'ammonia',
        why: 'Shale gas made the Gulf the world\u2019s cheapest place to make ammonia — export terminals queue out of the yard.',
        brief: 'A Texas ammonia plant — 1,000 t/d, shale gas, feeding the export terminal.',
      },
      {
        family: 'methanol',
        why: 'Half of North American methanol capacity lines one waterway — gas in, tankers out.',
        brief: 'A Gulf Coast methanol plant — 5,000 t/d, mega-train scale.',
      },
      {
        family: 'hydrogen',
        why: 'The world\u2019s largest hydrogen pipeline network already runs through Texas — over a billion cubic feet a day.',
        brief: 'A Gulf Coast merchant hydrogen plant — 150 t/d, pipeline hydrogen for refineries and steel.',
      },
      {
        family: 'sulphur',
        why: 'Gulf Coast sour gas fields built the American sulphur industry — the Frasch era never really ended here.',
        brief: 'A Texas sour-gas Claus plant — rich acid gas, 400 t/d of sulphur to the rail cars.',
      },
    ],
    coming: ['ethylene cracker', 'LNG train'],
  },
  {
    id: 'saudi',
    name: 'Saudi Arabia',
    scope: 'Jubail & Yanbu',
    industries: 'Two purpose-built industrial cities turning one gas field into every molecule that sells.',
    here: [
      {
        family: 'ammonia',
        why: 'Jubail\u2019s ammonia-urea complexes feed half a billion people — fertiliser as state strategy.',
        brief: 'A Jubail-scale ammonia plant — 2,000 t/d, integrated with export terminals.',
      },
      {
        family: 'methanol',
        why: 'Associated gas from oil fields that once flared now feeds world-scale methanol trains.',
        brief: 'A Saudi methanol plant — 5,000 t/d, associated-gas feed.',
      },
      {
        family: 'hydrogen',
        why: 'The kingdom is investing billions in blue hydrogen for export — reformers with CO2 capture at gigawatt scale.',
        brief: 'An export-scale blue hydrogen plant — 200 t/d with CO2 removal.',
      },
      {
        family: 'sulphur',
        why: 'Jubail sweats sulphur from every sour molecule — the by-product ships in solid blocks to India\u2019s phosphate plants.',
        brief: 'A Jubail Claus train — 500 t/d sulphur, formed and exported as prills.',
      },
    ],
    coming: ['gas-to-liquids', 'ethylene cracker'],
  },
  {
    id: 'india',
    name: 'India',
    scope: 'Gujarat coast',
    industries: 'Fertiliser security as national policy — feed a fifth of humanity from one coastline.',
    here: [
      {
        family: 'ammonia',
        why: 'India\u2019s fertiliser plants run flat-out every kharif season — ammonia is food security.',
        brief: 'A Gujarat ammonia-urea complex — 1,800 t/d ammonia, LNG or domestic gas.',
      },
      {
        family: 'methanol',
        why: 'India is piloting coal-to-methanol — the molecule that could cut fuel imports.',
        brief: 'An Indian methanol plant — 1,000 t/d sized for blending into fuel.',
      },
    ],
    coming: ['urea plant', 'petroleum refinery'],
  },
  {
    id: 'germany',
    name: 'Germany',
    scope: 'Rhine basin',
    industries: 'The old chemical heartland, rebuilding itself around imported hydrogen.',
    here: [
      {
        family: 'hydrogen',
        why: 'Ludwigshafen alone burns through terajoules of hydrogen — and the green stuff is coming by ship.',
        brief: 'A Rhine-delta hydrogen plant — 100 t/d, feedstock for the chemical parks.',
      },
      {
        family: 'methanol',
        why: 'German e-methanol projects pair green hydrogen with captured CO2 — the circular molecule.',
        brief: 'A German methanol plant — 1,500 t/d, CO2-rich syngas for e-methanol studies.',
      },
    ],
    coming: ['green ammonia (electrolysis route)', 'ethylene cracker'],
  },
  {
    id: 'china',
    name: 'China',
    scope: 'Ningxia & Inner Mongolia',
    industries: 'Coal chemistry at planetary scale — the modern equivalent of inventing an industry.',
    here: [
      {
        family: 'methanol',
        why: 'Half the world\u2019s methanol is Chinese — much of it from coal, one train at a time.',
        brief: 'A Ningxia coal-chemistry methanol plant — 6,000 t/d, the biggest class there is.',
      },
      {
        family: 'ammonia',
        why: 'China runs both the world\u2019s largest ammonia fleet and its greenest pilots — scale either way.',
        brief: 'A Chinese ammonia plant — 1,500 t/d, modern energy-efficient loop.',
      },
    ],
    coming: ['coal-to-olefins', 'ethylene cracker'],
  },
  {
    id: 'canada',
    name: 'Canada',
    scope: 'Alberta',
    industries: 'Sour gas, oil sands, and now blue hydrogen — energy with an engineering problem attached.',
    here: [
      {
        family: 'ammonia',
        why: 'Cold-weather ammonia trains export through Vancouver — fertiliser for Pacific farms.',
        brief: 'An Alberta ammonia plant — 1,000 t/d, winterised for −40°C operation.',
      },
      {
        family: 'sulphur',
        why: 'Alberta is the world\u2019s sulphur headquarters — sour gas + oil sands = mountains of the yellow stuff.',
        brief: 'An Alberta Claus unit — sour-gas acid feed, 700 t/d sulphur, the world\u2019s biggest stockpiles.',
      },
    ],
    coming: ['oil sands upgrader', 'LNG train'],
  },
  {
    id: 'australia',
    name: 'Australia',
    scope: 'Pilbara',
    industries: 'Ore exports pivoting to hydrogen — the sunniest chemistry homework on Earth.',
    here: [
      {
        family: 'hydrogen',
        why: 'Pilbara solar farms are sizing electrolysers in gigawatts — green hydrogen for Japan and Korea.',
        brief: 'A Pilbara hydrogen plant — 200 t/d for ammonia export studies.',
      },
      {
        family: 'ammonia',
        why: 'Every green-hydrogen project lands as ammonia — the only hydrogen ship that sails today.',
        brief: 'A Pilbara green-ammonia train — 1,000 t/d, hydrogen from electrolysis.',
      },
    ],
    coming: ['LNG train', 'green steel direct reduction'],
  },
  {
    id: 'norway',
    name: 'Norway',
    scope: 'Herøya & Porsgrunn',
    industries: 'Clean-power chemistry since 1929 — hydroelectric hydrogen before it was cool.',
    here: [
      {
        family: 'hydrogen',
        why: 'Norway electrolysed water for fertiliser a century ago — the original green hydrogen country.',
        brief: 'A Norwegian hydrogen plant — 90 t/d, hydro-powered, feeding ammonia studies.',
      },
      {
        family: 'ammonia',
        why: 'Yara\u2019s Porsgrunn trains pioneered emissions data for the whole industry — the clean end of ammonia.',
        brief: 'A Norwegian ammonia plant — 1,200 t/d, hydro power, CO2 captured for the food industry.',
      },
    ],
    coming: ['LNG train', 'green ammonia (electrolysis route)'],
  },
  {
    id: 'brazil',
    name: 'Brazil',
    scope: 'Bahia & São Paulo',
    industries: 'Ethanol and fertiliser — a bioeconomy with a gas problem it is solving.',
    here: [
      {
        family: 'ammonia',
        why: 'Brazil imports the fertiliser that grows its soy — the frontier is making it at home.',
        brief: 'A Bahia ammonia plant — 1,200 t/d, natural gas feed.',
      },
      {
        family: 'methanol',
        why: 'Brazilian first-gen ethanol plants are retooling toward renewable methanol for shipping fuel.',
        brief: 'A Brazilian methanol plant — 900 t/d sized for renewable-feedstock studies.',
      },
    ],
    coming: ['sugarcane ethanol distillery', 'green ammonia (electrolysis route)'],
  },
];

/** surprise-me briefs — teaching-grade plants with a twist, one per family */
export const SURPRISE_BRIEFS: string[] = [
  'Build the reference ammonia plant, but size the purge for the tightest hydrogen efficiency that still converges — and report what inerts cost.',
  'Build a methanol plant where the converter runs as cold as the catalyst allows — report what per-pass conversion you gain and what the interbed duty costs.',
  'Build a hydrogen plant tuned for MAXIMUM recovery: push the PSA recovery spec to its ceiling and report the purity trade-off.',
  'Build a Claus sulphur plant with a deliberately lazy second bed (low approach) — show the student what a tired catalyst does to tail-gas slip.',
  'Build a hydrogen plant and prove why the methanator is unnecessary before a PSA — report the CO the PSA simply swallows.',
  'Build an ammonia plant with a warm separator (chill the condensation train to just −5 °C) and report what the circulator has to make up for.',
  'Build a methanol plant with a small purge (0.05 fraction) and report what happens to loop inerts over the solve.',
  'Build a sulphur plant on LEAN acid gas (55 % H2S) and report how the flame temperature and recovery both move.',
];
