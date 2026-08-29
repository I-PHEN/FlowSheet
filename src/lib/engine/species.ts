/**
 * Ammonia Plant Builder — deterministic process engine.
 *
 * Phase 1 core. Species set, physical property data, and unit conventions.
 *
 * CONVENTIONS (internal, SI-ish):
 *   - Molar flows in kmol/h, stored per-species as number[N_SP]  (n[i] = kmol/h of species i)
 *   - Temperature in K, Pressure in Pa
 *   - Mole fractions derived on demand; flows are the single source of truth
 *
 * Property sources: Smith, Van Ness & Abbott (Intro. Chem. Eng. Thermodynamics)
 * for Tc/Pc/omega; standard tables for ΔHf°(298.15 K, gas); Cp(T) = a + b·T
 * linear fits anchored at 300 K / 700 K textbook values (valid 273–800 K,
 * ±2–3 %). All values are steady-state teaching-grade; documented in docs/.
 */

export const SPECIES = [
  'H2',
  'N2',
  'CO',
  'CO2',
  'CH4',
  'AR',
  'NH3',
  'H2O',
  'O2',
] as const;

export type Species = (typeof SPECIES)[number];
export type Moles = number[]; // length 9, index = SPECIES index

export const I: Record<Species, number> = {
  H2: 0,
  N2: 1,
  CO: 2,
  CO2: 3,
  CH4: 4,
  AR: 5,
  NH3: 6,
  H2O: 7,
  O2: 8,
};

interface SpeciesData {
  /** kg/kmol */
  mw: number;
  /** critical temperature, K */
  tc: number;
  /** critical pressure, Pa */
  pc: number;
  /** Pitzer acentric factor */
  omega: number;
  /** ideal-gas Cp = a + b·T  [J/(mol·K)] */
  cpA: number;
  cpB: number;
  /** standard enthalpy of formation at 298.15 K, gas phase, J/mol */
  hf: number;
}

export const SP: Record<Species, SpeciesData> = {
  H2: { mw: 2.016, tc: 33.19, pc: 13.13e5, omega: -0.22, cpA: 28.6, cpB: 1.6e-3, hf: 0 },
  N2: { mw: 28.014, tc: 126.2, pc: 33.98e5, omega: 0.037, cpA: 27.6, cpB: 5.1e-3, hf: 0 },
  CO: { mw: 28.01, tc: 132.92, pc: 34.99e5, omega: 0.045, cpA: 27.7, cpB: 5.0e-3, hf: -110.53e3 },
  CO2: { mw: 44.01, tc: 304.12, pc: 73.83e5, omega: 0.224, cpA: 27.7, cpB: 31.2e-3, hf: -393.52e3 },
  CH4: { mw: 16.043, tc: 190.56, pc: 45.99e5, omega: 0.011, cpA: 24.5, cpB: 37.3e-3, hf: -74.85e3 },
  AR: { mw: 39.948, tc: 150.86, pc: 48.98e5, omega: 0.0, cpA: 20.8, cpB: 0.0, hf: 0 },
  NH3: { mw: 17.031, tc: 405.4, pc: 113.53e5, omega: 0.252, cpA: 29.1, cpB: 21.7e-3, hf: -45.9e3 },
  H2O: { mw: 18.015, tc: 647.1, pc: 220.64e5, omega: 0.344, cpA: 30.6, cpB: 10.0e-3, hf: -241.83e3 },
  O2: { mw: 31.999, tc: 154.58, pc: 50.43e5, omega: 0.022, cpA: 27.4, cpB: 6.7e-3, hf: 0 },
};

export const N_SP = SPECIES.length;

/** Universal gas constant, J/(mol·K) */
export const RG = 8.314462618;

/** CH4 lower heating value, kJ/kmol (802.6 kJ/mol × 1000) */
export const LHV_CH4 = 802.6e3;

// Atom matrix for element balances: [C, H, O, N, Ar] per species
export const ATOMS = ['C', 'H', 'O', 'N', 'Ar'] as const;
export const ATOM_MATRIX: number[][] = [
  //      H2   N2   CO  CO2  CH4  AR  NH3  H2O   O2
  /* C */ [0, 0, 1, 1, 1, 0, 0, 0, 0],
  /* H */ [2, 0, 0, 0, 4, 0, 3, 2, 0],
  /* O */ [0, 0, 1, 2, 0, 0, 0, 1, 2],
  /* N */ [0, 2, 0, 0, 0, 0, 1, 0, 0],
  /*Ar*/ [0, 0, 0, 0, 0, 1, 0, 0, 0],
];

/** Dry air molar composition (CO2 carried for completeness) */
export const AIR_COMP: Moles = [0, 0.7808, 0, 0.0004, 0, 0.0093, 0, 0, 0.2095];
