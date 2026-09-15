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
 *
 * Species indices are APPEND-ONLY: benzene (9) and toluene (10) were added for
 * the distillation template and every fixed-length array in the codebase must
 * be N_SP-derived, never hardcoded (see ATOM_MATRIX / AIR_COMP notes below).
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
  'C6H6',
  'C7H8',
] as const;

export type Species = (typeof SPECIES)[number];
export type Moles = number[]; // length N_SP, index = SPECIES index

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
  C6H6: 9,
  C7H8: 10,
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
  // benzene / toluene — Smith, Van Ness & Abbott for Tc/Pc/omega; ΔHf° gas
  // from standard tables; Cp = a + b·T anchored at 300 K (82.4 / 103.8) and
  // 700 K (197.7 / 225.6) J/(mol·K) — the distillation rung works in the
  // 350–400 K window where the fit is within ~1–3 % of NIST Shomate.
  C6H6: { mw: 78.114, tc: 562.05, pc: 48.95e5, omega: 0.212, cpA: -4.08, cpB: 0.28825, hf: 82.93e3 },
  C7H8: { mw: 92.141, tc: 591.75, pc: 41.08e5, omega: 0.257, cpA: 12.45, cpB: 0.30450, hf: 50.17e3 },
};

export const N_SP = SPECIES.length;

/** Universal gas constant, J/(mol·K) */
export const RG = 8.314462618;

/** CH4 lower heating value, kJ/kmol (802.6 kJ/mol × 1000) */
export const LHV_CH4 = 802.6e3;

// Atom matrix for element balances: [C, H, O, N, Ar] per species.
// Rows are built per-species so appended species (benzene, toluene) cannot be
// forgotten — a missing column would break the executor's element balance.
const atomRow = (c: number, h: number, o: number, n2: number, ar: number) => [c, h, o, n2, ar];
const ATOMS_BY_SPECIES: Record<Species, number[]> = {
  H2: atomRow(0, 2, 0, 0, 0),
  N2: atomRow(0, 0, 0, 2, 0),
  CO: atomRow(1, 0, 1, 0, 0),
  CO2: atomRow(1, 0, 2, 0, 0),
  CH4: atomRow(1, 4, 0, 0, 0),
  AR: atomRow(0, 0, 0, 0, 1),
  NH3: atomRow(0, 3, 0, 1, 0),
  H2O: atomRow(0, 2, 1, 0, 0),
  O2: atomRow(0, 0, 2, 0, 0),
  C6H6: atomRow(6, 6, 0, 0, 0),
  C7H8: atomRow(7, 8, 0, 0, 0),
};
export const ATOMS = ['C', 'H', 'O', 'N', 'Ar'] as const;
export const ATOM_MATRIX: number[][] = ATOMS.map((_, e) => SPECIES.map((s) => ATOMS_BY_SPECIES[s][e]));

/** Dry air molar composition (CO2 carried for completeness) — N_SP wide so
 *  appended species dilute to zero instead of yielding NaN in air streams. */
export const AIR_COMP: Moles = SPECIES.map((s) =>
  s === 'N2' ? 0.7808 : s === 'CO2' ? 0.0004 : s === 'AR' ? 0.0093 : s === 'O2' ? 0.2095 : 0,
);
