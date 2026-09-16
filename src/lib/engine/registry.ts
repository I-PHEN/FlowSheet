/**
 * Unit registry — the ammonia catalog: every unit type the flowsheet graph
 * can be built from. Each type declares typed ports, spec fields with
 * physical clamps/defaults, and a solve() that wraps the EXISTING physics
 * in units.ts verbatim (same calls, same formatting — this is what lets
 * the graph executor reproduce the legacy plant.ts numbers exactly).
 *
 * solve() receives inlet StreamStates and returns outlet StreamStates +
 * the UnitResult payload (name/model/metrics/warnings). Wrappers read
 * NOTHING outside their own inlets and specs — unit independence is what
 * makes free composition safe.
 */

import type { PortDef, SpecField, StreamState } from './graph';
import type { UnitResult } from './types';
import { AIR_COMP, I, N_SP, SP } from './species';
import type { Moles } from './species';
import { enthalpyRate, massFlow, total } from './thermo';
import {
  adiabaticEqReactor,
  co2Removal,
  compressorTrain,
  converterBed,
  cooler,
  distillationColumn,
  flashDrum,
  isenthalpicFlash,
  meohBed,
  methanator,
  mixStreams,
  phaseEnthalpyRate,
  primaryReformer,
  secondaryReformer,
  zeroN,
} from './units';

// ---------------------------------------------------------------------------
// helpers (formatting identical to plant.ts — the identity gate depends on it)
// ---------------------------------------------------------------------------

const C = (celsius: number) => celsius + 273.15;
const BAR = (b: number) => b * 1e5;
const MW = (kJh: number) => kJh / 3.6e6;
const d1 = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));
const d2 = (x: number) => x.toFixed(2);

export interface SolveCtx {
  specs: Record<string, number | boolean | number[]>;
  inlet: (port: string) => StreamState;
  /** push a SECTION-level warning (mirrors the old fe.warnings list) */
  warn: (msg: string) => void;
}

export interface SolveOut {
  outlets: Record<string, StreamState>;
  /** UnitResult minus id — the executor stamps the instance id */
  result: Pick<UnitResult, 'name' | 'model' | 'metrics' | 'warnings'>;
}

export interface UnitTypeDef {
  type: string;
  /** default display name (instances may not override in v1) */
  name: string;
  model: (specs: Record<string, number | boolean | number[]>) => string;
  ports: { in: PortDef[]; out: PortDef[] };
  specFields: SpecField[];
  solve: (ctx: SolveCtx) => SolveOut;
  /**
   * Present when this unit's outlet T and P are fully spec-determined
   * (independent of its inlet). The executor tears recycle loops at such
   * edges: the cut stream's T/P stay exact on every iteration.
   */
  fixedOutlet?: (specs: Record<string, number | boolean | number[]>) => { T: number; P: number };
}

const num = (s: Record<string, number | boolean | number[]>, k: string): number => s[k] as number;
const arr = (s: Record<string, number | boolean | number[]>, k: string): number[] => s[k] as number[];

// ---------------------------------------------------------------------------
// sources — feeds are units too, so the controller can manipulate them
// ---------------------------------------------------------------------------

const ngSource: UnitTypeDef = {
  type: 'ng-source',
  name: 'Natural gas feed',
  model: () => 'Feed definition — pure CH4 at battery limit',
  ports: { in: [], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'flow', kind: 'number', min: 100, max: 3000, default: 1000, unit: 'kmol/h', doc: 'CH4 feed rate' },
    { key: 'T', kind: 'number', min: 0, max: 100, default: 40, unit: '°C' },
    { key: 'P', kind: 'number', min: 10, max: 60, default: 32, unit: 'bar' },
  ],
  solve: ({ specs }) => {
    const n = zeroN();
    n[4] = num(specs, 'flow');
    return {
      outlets: { out: { T: C(num(specs, 'T')), P: BAR(num(specs, 'P')), n } },
      result: { name: 'Natural gas feed', model: 'Feed definition — pure CH4 at battery limit', metrics: [], warnings: [] },
    };
  },
};

const steamSource: UnitTypeDef = {
  type: 'steam-source',
  name: 'Process steam',
  model: () => 'HP process steam at battery limit',
  ports: { in: [], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'flow', kind: 'number', min: 200, max: 15000, default: 3000, unit: 'kmol/h', doc: 'steam = ngFeed × steam/carbon' },
    { key: 'T', kind: 'number', min: 150, max: 500, default: 400, unit: '°C' },
    { key: 'P', kind: 'number', min: 10, max: 60, default: 32, unit: 'bar' },
  ],
  solve: ({ specs }) => {
    const n = zeroN();
    n[7] = num(specs, 'flow');
    return {
      outlets: { out: { T: C(num(specs, 'T')), P: BAR(num(specs, 'P')), n } },
      result: { name: 'Process steam', model: 'HP process steam at battery limit', metrics: [], warnings: [] },
    };
  },
};

const airSource: UnitTypeDef = {
  type: 'air-source',
  name: 'Process air',
  model: () => 'Compressed process air (21/79 O2/N2 + Ar)',
  ports: { in: [], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'flow', kind: 'number', min: 100, max: 6000, default: 1560, unit: 'kmol/h', doc: 'controller-manipulated in auto mode' },
    { key: 'T', kind: 'number', min: 20, max: 300, default: 180, unit: '°C' },
    { key: 'P', kind: 'number', min: 10, max: 60, default: 30.5, unit: 'bar' },
  ],
  solve: ({ specs }) => ({
    outlets: {
      out: { T: C(num(specs, 'T')), P: BAR(num(specs, 'P')), n: AIR_COMP.map((f) => f * num(specs, 'flow')) },
    },
    result: { name: 'Process air', model: 'Compressed process air (21/79 O2/N2 + Ar)', metrics: [], warnings: [] },
  }),
};

// ---------------------------------------------------------------------------
// front end
// ---------------------------------------------------------------------------

const feedMixer: UnitTypeDef = {
  type: 'feed-mixer',
  name: 'Feed mixer',
  model: () => 'Adiabatic mixing of natural gas and process steam',
  ports: {
    in: [
      { key: 'ng', kind: 'gas' },
      { key: 'steam', kind: 'gas' },
    ],
    out: [{ key: 'out', kind: 'gas' }],
  },
  specFields: [
    { key: 'steamCarbon', kind: 'number', min: 2.0, max: 5.0, default: 3.0, unit: 'mol/mol' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 1, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const ng = inlet('ng');
    const st = inlet('steam');
    const outP = ng.P - BAR(num(specs, 'dp'));
    const mixed = mixStreams(
      [
        { n: ng.n, T: ng.T, P: ng.P },
        { n: st.n, T: st.T, P: st.P },
      ],
      outP,
    );
    return {
      outlets: { out: { T: mixed.T, P: outP, n: mixed.n } },
      result: {
        name: 'Feed mixer',
        model: 'Adiabatic mixing of natural gas and process steam',
        metrics: [
          { label: 'Mixed flow', value: `${d1(total(mixed.n))} kmol/h` },
          { label: 'Steam/carbon', value: d2(num(specs, 'steamCarbon')) },
          { label: 'Mixer outlet T', value: `${d1(mixed.T - 273.15)} °C` },
        ],
        warnings: [],
      },
    };
  },
};

const primaryReformerDef: UnitTypeDef = {
  type: 'primary-reformer',
  name: 'Primary reformer',
  model: () => 'Fired furnace — SMR + WGS equilibrium at outlet T (K_SR1, K_WGS; ATE on CH4)',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'outletT', kind: 'number', min: 700, max: 900, default: 805, unit: '°C', doc: 'reformer exit temperature' },
    { key: 'ate', kind: 'number', min: 0, max: 40, default: 10, unit: 'K', doc: 'approach-to-equilibrium on CH4' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 1, unit: 'bar', doc: 'firebox pressure drop (inlet 31 bar → outlet 30 bar)' },
  ],
  solve: ({ specs, inlet, warn }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const prim = primaryReformer(i.n, i.T, C(num(specs, 'outletT')), outP, num(specs, 'ate'), 10);
    if (!prim.reached) warn('R1: CH4 equilibrium not reachable within bounds');
    return {
      outlets: { out: { T: prim.T, P: outP, n: prim.n } },
      result: {
        name: 'Primary reformer',
        model: 'Fired furnace — SMR + WGS equilibrium at outlet T (K_SR1, K_WGS; ATE on CH4)',
        metrics: [
          { label: 'Furnace duty', value: `${d1(MW(prim.dutyKJh))} MW`, raw: MW(prim.dutyKJh) },
          { label: 'Outlet T', value: `${d1(prim.T - 273.15)} °C` },
          { label: 'CH4 slip (dry)', value: `${(prim.ch4SlipDry * 100).toFixed(2)} %` },
          { label: 'H2 (dry)', value: `${(prim.h2Dry * 100).toFixed(1)} %` },
          { label: 'CH4 conversion', value: `${d1((1 - prim.n[4] / Math.max(i.n[4], 1e-9)) * 100)} %` },
        ],
        warnings: prim.reached ? [] : ['equilibrium not reached'],
      },
    };
  },
};

const secondaryReformerDef: UnitTypeDef = {
  type: 'secondary-reformer',
  name: 'Secondary reformer',
  model: () => 'Zone 1 adiabatic H2 combustion → Zone 2 catalytic SMR+WGS equilibrium (research C3)',
  ports: {
    in: [
      { key: 'gas', kind: 'gas' },
      { key: 'air', kind: 'gas' },
    ],
    out: [{ key: 'out', kind: 'gas' }],
  },
  specFields: [
    { key: 'ate', kind: 'number', min: 0, max: 80, default: 30, unit: 'K' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 1.5, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const gas = inlet('gas');
    const air = inlet('air');
    const outP = gas.P - BAR(num(specs, 'dp'));
    const sec = secondaryReformer(gas.n, gas.T, air.n, air.T, outP, num(specs, 'ate'), 15);
    return {
      outlets: { out: { T: sec.T, P: outP, n: sec.n } },
      result: {
        name: 'Secondary reformer',
        model: 'Zone 1 adiabatic H2 combustion → Zone 2 catalytic SMR+WGS equilibrium (research C3)',
        metrics: [
          { label: 'Combustion-zone T', value: `${d1(sec.tCombust - 273.15)} °C`, raw: sec.tCombust },
          { label: 'Catalytic exit T', value: `${d1(sec.T - 273.15)} °C`, raw: sec.T },
          { label: 'CH4 slip (dry)', value: `${(sec.ch4SlipDry * 100).toFixed(2)} %` },
          { label: 'CO (dry)', value: `${(sec.coDry * 100).toFixed(1)} %` },
          { label: 'O2 remaining', value: `${d2(sec.o2Remaining)} kmol/h` },
        ],
        warnings: sec.o2Remaining > 0.5 ? ['residual O2 after combustion zone'] : [],
      },
    };
  },
};

const whbCooler: UnitTypeDef = {
  type: 'whb-cooler',
  name: 'Waste-heat boiler',
  model: () => 'Cools secondary effluent to HTS inlet (HP steam generation implied)',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'outletT', kind: 'number', min: 30, max: 450, default: 340, unit: '°C', doc: 'next-section inlet temperature (30 °C for cold KO + compression)' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 0.5, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const c = cooler(i.n, i.T, C(num(specs, 'outletT')), outP);
    return {
      outlets: { out: { T: c.T, P: outP, n: c.n } },
      result: {
        name: 'Waste-heat boiler',
        model: 'Cools secondary effluent to HTS inlet (HP steam generation implied)',
        metrics: [{ label: 'Duty', value: `${d1(MW(c.dutyKJh))} MW`, raw: MW(c.dutyKJh) }],
        warnings: [],
      },
    };
  },
};

const wgs = (type: string, catalyst: string, coDecimals: number, ateMax: number, ateDefault: number): UnitTypeDef => ({
  type,
  name: type === 'wgs-hts' ? 'High-temp shift' : 'Low-temp shift',
  model: () => `Adiabatic WGS equilibrium on ${catalyst} catalyst (methane reactions frozen)`,
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'ate', kind: 'number', min: 0, max: ateMax, default: ateDefault, unit: 'K' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 0.5, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const r = adiabaticEqReactor(i.n, i.T, outP, false, 0, num(specs, 'ate'));
    return {
      outlets: { out: { T: r.TOut, P: outP, n: r.n } },
      result: {
        name: type === 'wgs-hts' ? 'High-temp shift' : 'Low-temp shift',
        model: `Adiabatic WGS equilibrium on ${catalyst} catalyst (methane reactions frozen)`,
        metrics: [
          { label: 'Outlet T', value: `${d1(r.TOut - 273.15)} °C` },
          { label: 'CO (dry)', value: `${(r.coDry * 100).toFixed(coDecimals)} %` },
          { label: 'ΔT (adiabatic rise)', value: `${d1(r.TOut - i.T)} K` },
        ],
        warnings: [],
      },
    };
  },
});

const intercooler: UnitTypeDef = {
  type: 'intercooler',
  name: 'Shift intercooler',
  model: () => 'Cools HTS effluent to LTS inlet',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'outletT', kind: 'number', min: 150, max: 300, default: 205, unit: '°C', doc: 'LTS inlet temperature' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 0.5, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const c = cooler(i.n, i.T, C(num(specs, 'outletT')), outP);
    return {
      outlets: { out: { T: c.T, P: outP, n: c.n } },
      result: {
        name: 'Shift intercooler',
        model: 'Cools HTS effluent to LTS inlet',
        metrics: [{ label: 'Duty', value: `${d1(MW(c.dutyKJh))} MW`, raw: MW(c.dutyKJh) }],
        warnings: [],
      },
    };
  },
};

const koDrum = (type: string, name: string, model: string): UnitTypeDef => ({
  type,
  name,
  model: () => model,
  ports: {
    in: [{ key: 'in', kind: 'gas' }],
    out: [
      { key: 'vapor', kind: 'gas' },
      { key: 'liquid', kind: 'liquid' },
    ],
  },
  specFields: [
    { key: 'flashT', kind: 'number', min: 10, max: 80, default: 40, unit: '°C' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 0.5, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const f = flashDrum(i.n, i.T, C(num(specs, 'flashT')), outP, 7);
    return {
      outlets: {
        vapor: { T: C(num(specs, 'flashT')), P: outP, n: f.vapor },
        liquid: { T: C(num(specs, 'flashT')), P: outP, n: f.liquid },
      },
      result: {
        name,
        model,
        metrics: [
          { label: 'Condensate', value: `${d1(massFlow(f.liquid))} kg/h` },
          { label: 'Vapor fraction', value: d2(f.beta) },
        ],
        warnings: [],
      },
    };
  },
});

const co2RemovalDef: UnitTypeDef = {
  type: 'co2-removal',
  name: 'CO2 removal',
  model: () => 'aMDEA black box — spec residual ppmvd and H2 co-absorption (research Q5)',
  ports: {
    in: [{ key: 'in', kind: 'gas' }],
    out: [
      { key: 'gas', kind: 'gas' },
      { key: 'offgas', kind: 'gas' },
    ],
  },
  specFields: [
    { key: 'residualPpm', kind: 'number', min: 20, max: 2000, default: 300, unit: 'ppmvd' },
    { key: 'h2Slip', kind: 'number', min: 0, max: 0.01, default: 0.003, unit: 'fraction' },
    { key: 'postT', kind: 'number', min: 20, max: 80, default: 45, unit: '°C' },
    { key: 'offgasT', kind: 'number', min: 20, max: 90, default: 60, unit: '°C' },
    { key: 'offgasP', kind: 'number', min: 1, max: 5, default: 1.8, unit: 'bar' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 1, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const r = co2Removal(i.n, num(specs, 'residualPpm'), num(specs, 'h2Slip'));
    return {
      outlets: {
        gas: { T: C(num(specs, 'postT')), P: outP, n: r.gas },
        offgas: { T: C(num(specs, 'offgasT')), P: BAR(num(specs, 'offgasP')), n: r.offgas },
      },
      result: {
        name: 'CO2 removal',
        model: 'aMDEA black box — spec residual ppmvd and H2 co-absorption (research Q5)',
        metrics: [
          { label: 'CO2 removed', value: `${d1(r.co2Removed)} kmol/h` },
          { label: 'Residual CO2', value: `${d1(r.residualPpm)} ppmvd` },
          { label: 'H2 slip', value: `${d1(r.offgas[0])} kmol/h` },
          { label: 'Regeneration duty', value: `${d1(MW(r.co2Removed * 45e3))} MW (est. 45 MJ/kmol)` },
        ],
        warnings: [],
      },
    };
  },
};

const methanatorDef: UnitTypeDef = {
  type: 'methanator',
  name: 'Methanator',
  model: () => 'Adiabatic CO/CO2 methanation equilibrium — carbon oxides to ppm',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'inletT', kind: 'number', min: 250, max: 360, default: 300, unit: '°C' },
    { key: 'dp', kind: 'number', min: 0, max: 5, default: 0.5, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const m = methanator(i.n, C(num(specs, 'inletT')), outP);
    const oxidesPpm = m.oxidesPpmDry;
    return {
      outlets: { out: { T: m.TOut, P: outP, n: m.n } },
      result: {
        name: 'Methanator',
        model: 'Adiabatic CO/CO2 methanation equilibrium — carbon oxides to ppm',
        metrics: [
          { label: 'Outlet T', value: `${d1(m.TOut - 273.15)} °C` },
          { label: 'CO+CO2 out', value: `${d1(oxidesPpm)} ppmvd` },
          { label: 'ΔT (rise)', value: `${d1(m.TOut - C(num(specs, 'inletT')))} K` },
        ],
        warnings: oxidesPpm > 10 ? ['carbon oxides above 10 ppm — synthesis catalyst at risk'] : [],
      },
    };
  },
};

// ---------------------------------------------------------------------------
// compression & synthesis loop
// ---------------------------------------------------------------------------

const syngasCompressor: UnitTypeDef = {
  type: 'syngas-compressor',
  name: 'Syngas compressor',
  model: (specs) => `${num(specs, 'stages')}-stage polytropic train with intercooling (research Q7)`,
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'stages', kind: 'number', min: 1, max: 5, default: 3 },
    { key: 'eta', kind: 'number', min: 0.6, max: 0.85, default: 0.75, doc: 'polytropic efficiency' },
    { key: 'dischargeP', kind: 'number', min: 40, max: 250, default: 150, unit: 'bar' },
    { key: 'postT', kind: 'number', min: 20, max: 80, default: 40, unit: '°C', doc: 'final intercool temperature' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = BAR(num(specs, 'dischargeP'));
    const c = compressorTrain(i.n, i.T, i.P, outP, num(specs, 'stages'), num(specs, 'eta'), C(num(specs, 'postT')));
    return {
      // the intercooled train is modeled as returning the gas at intercool T
      // (composition unchanged) — mirrors the legacy wiring exactly
      outlets: { out: { T: C(num(specs, 'postT')), P: outP, n: i.n } },
      result: {
        name: 'Syngas compressor',
        model: `${num(specs, 'stages')}-stage polytropic train with intercooling (research Q7)`,
        metrics: [
          { label: 'Shaft power', value: `${d1(c.powerKW / 1000)} MW`, raw: c.powerKW / 1000 },
          { label: 'Stage ratio', value: d2(c.stageRatios[0]) },
          { label: 'Discharge', value: `${d1(c.T - 273.15)} °C / ${num(specs, 'dischargeP')} bar` },
          { label: 'Intercooling duty', value: `${d1(MW(c.intercoolDutyKJh))} MW` },
        ],
        warnings: [],
      },
    };
  },
};

const loopMixer: UnitTypeDef = {
  type: 'loop-mixer',
  name: 'Loop mixer',
  model: () => 'Make-up added after condensation, after purge (EFMA BAT arrangement)',
  ports: {
    in: [
      { key: 'makeup', kind: 'gas' },
      { key: 'recycle', kind: 'gas' },
    ],
    out: [{ key: 'out', kind: 'gas' }],
  },
  specFields: [{ key: 'outletP', kind: 'number', min: 40, max: 250, default: 150, unit: 'bar' }],
  solve: ({ specs, inlet }) => {
    const mu = inlet('makeup');
    const rc = inlet('recycle');
    const outP = BAR(num(specs, 'outletP'));
    const mix = mixStreams(
      [
        { n: mu.n, T: mu.T, P: outP },
        { n: rc.n, T: rc.T, P: outP },
      ],
      outP,
    );
    return {
      outlets: { out: { T: mix.T, P: outP, n: mix.n } },
      result: {
        name: 'Loop mixer',
        model: 'Make-up added after condensation, after purge (EFMA BAT arrangement)',
        metrics: [
          { label: 'Converter feed', value: `${d1(total(mix.n))} kmol/h` },
          { label: 'Recycle multiple', value: d2(total(rc.n) / Math.max(total(mu.n), 1e-9)) },
          { label: 'Mixed T', value: `${d1(mix.T - 273.15)} °C` },
        ],
        warnings: [],
      },
    };
  },
};

const feedPreheater: UnitTypeDef = {
  type: 'feed-preheater',
  name: 'Feed preheater',
  model: (specs) => `Implied feed/effluent exchange to bed-1 inlet (${num(specs, 'outletT').toFixed(0)} °C)`,
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'outletT', kind: 'number', min: 150, max: 450, default: 400, unit: '°C', doc: 'converter bed-1 inlet' },
    { key: 'outletP', kind: 'number', min: 40, max: 250, default: 150, unit: 'bar', doc: 'loop pressure (pass-through)' },
  ],
  // outlet T and P are pure spec — this is what makes the synthesis-loop
  // tear land here with exact T/P on every iteration
  fixedOutlet: (specs) => ({ T: C(num(specs, 'outletT')), P: BAR(num(specs, 'outletP')) }),
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const duty = enthalpyRate(i.n, C(num(specs, 'outletT'))) - enthalpyRate(i.n, i.T);
    return {
      outlets: { out: { T: C(num(specs, 'outletT')), P: BAR(num(specs, 'outletP')), n: i.n } },
      result: {
        name: 'Feed preheater',
        model: `Implied feed/effluent exchange to bed-1 inlet (${num(specs, 'outletT').toFixed(0)} °C)`,
        metrics: [{ label: 'Preheat duty', value: `${d1(MW(duty))} MW` }],
        warnings: [],
      },
    };
  },
};

const converterDef: UnitTypeDef = {
  type: 'converter',
  name: 'Synthesis converter',
  model: () => '3 adiabatic beds, fractional approach to G-B equilibrium per bed (research C1)',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'bedTs', kind: 'number[]', elemMin: 350, elemMax: 470, default: [400, 430, 415], unit: '°C', doc: 'bed inlet temps (bed 1 = feed)' },
    { key: 'approach', kind: 'number[]', elemMin: 0.5, elemMax: 0.99, default: [0.9, 0.9, 0.9], doc: 'fractional approach per bed' },
    { key: 'dp', kind: 'number', min: 1, max: 8, default: 3, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const bedTs = arr(specs, 'bedTs').map((t) => C(t));
    const appr = arr(specs, 'approach');
    const feedP = i.P;
    const beds: Array<{ n: Moles; T: number; xi: number; nh3Out: number; nh3In: number }> = [];
    let cur = { n: i.n, T: bedTs[0] };
    let interbedDuty = 0;
    for (let b = 0; b < 3; b++) {
      const bed = converterBed(cur.n, cur.T, feedP, appr[b]);
      beds.push({ n: bed.n, T: bed.TOut, xi: bed.xi, nh3Out: bed.nh3Out, nh3In: bed.nh3In });
      if (b < 2) {
        const nextT = Math.min(bed.TOut, bedTs[b + 1]);
        interbedDuty += enthalpyRate(bed.n, bed.TOut) - enthalpyRate(bed.n, nextT);
        cur = { n: bed.n, T: nextT };
      } else {
        cur = { n: bed.n, T: bed.TOut };
      }
    }
    const nEff = cur.n;
    const effP = feedP - BAR(num(specs, 'dp'));
    const totIn = total(i.n);
    const totOut = total(nEff);
    const nh3InPct = totIn > 0 ? (i.n[6] / totIn) * 100 : 0;
    const nh3OutPct = totOut > 0 ? (nEff[6] / totOut) * 100 : 0;
    const perPass = i.n[1] > 1e-9 ? (1 - nEff[1] / i.n[1]) * 100 : 0;
    const bedMetrics = beds.flatMap((b, idx) => [
      { label: `Bed ${idx + 1} NH3 in→out`, value: `${(b.nh3In * 100).toFixed(1)} → ${(b.nh3Out * 100).toFixed(1)} %` },
      { label: `Bed ${idx + 1} outlet T`, value: `${d1(b.T - 273.15)} °C` },
    ]);
    return {
      outlets: { out: { T: cur.T, P: effP, n: nEff } },
      result: {
        name: 'Synthesis converter',
        model: '3 adiabatic beds, fractional approach to G-B equilibrium per bed (research C1)',
        metrics: [
          ...bedMetrics,
          { label: 'NH3 (converter in→out)', value: `${nh3InPct.toFixed(1)} → ${nh3OutPct.toFixed(1)} %` },
          { label: 'Per-pass N2 conversion', value: `${d1(perPass)} %`, raw: perPass },
          { label: 'Interbed duty', value: `${d1(MW(interbedDuty))} MW` },
        ],
        warnings: [],
      },
    };
  },
};

const condensationTrain: UnitTypeDef = {
  type: 'condensation-train',
  name: 'Condensation train',
  model: () => 'Water cooler (35 °C) + refrigerated chiller — PR residual enthalpy for latent heat',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'chillT', kind: 'number', min: -40, max: 30, default: -20, unit: '°C' },
    { key: 'wcT', kind: 'number', min: 20, max: 45, default: 35, unit: '°C', doc: 'cooling-water temperature' },
    { key: 'dp', kind: 'number', min: 1, max: 6, default: 2, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const condP = i.P - BAR(num(specs, 'dp'));
    const wc = cooler(i.n, i.T, C(num(specs, 'wcT')), condP);
    const ch = cooler(wc.n, wc.T, C(num(specs, 'chillT')), condP);
    // duties are defined against the separator split that terminates the
    // train (flash duplicated here for the metric — deterministic, same
    // inputs as the separator unit computes)
    const sep = flashDrum(ch.n, ch.T, ch.T, condP, 6);
    const condDuty =
      phaseEnthalpyRate(i.n, i.T, i.P, 'vapor') -
      (phaseEnthalpyRate(sep.vapor, ch.T, condP, 'vapor') + phaseEnthalpyRate(sep.liquid, ch.T, condP, 'liquid'));
    const refrDuty =
      phaseEnthalpyRate(i.n, C(num(specs, 'wcT')), i.P, 'vapor') -
      (phaseEnthalpyRate(sep.vapor, ch.T, condP, 'vapor') + phaseEnthalpyRate(sep.liquid, ch.T, condP, 'liquid'));
    return {
      outlets: { out: { T: ch.T, P: condP, n: ch.n } },
      result: {
        name: 'Condensation train',
        model: 'Water cooler (35 °C) + refrigerated chiller — PR residual enthalpy for latent heat',
        metrics: [
          { label: 'Condensation duty', value: `${d1(MW(condDuty))} MW`, raw: MW(condDuty) },
          { label: 'Refrigeration duty', value: `${d1(MW(refrDuty))} MW`, raw: MW(refrDuty) },
          { label: 'Refrig. shaft power', value: `${d1(MW(refrDuty) / 2.4)} MW (COP 2.4)` },
        ],
        warnings: [],
      },
    };
  },
};

const nh3Separator: UnitTypeDef = {
  type: 'nh3-separator',
  name: 'Ammonia separator + letdown',
  model: () => 'PT flash at loop P, then product letdown to 2 bar (degassing)',
  ports: {
    in: [
      { key: 'chilled', kind: 'gas' },
      { key: 'letdownIn', kind: 'liquid', doc: 'internal self-loop (separator liquid → letdown)' },
    ],
    out: [
      { key: 'gas', kind: 'gas' },
      { key: 'sepLiquid', kind: 'liquid' },
      { key: 'product', kind: 'liquid' },
      { key: 'flash', kind: 'gas', doc: 'letdown flash vapor (implicit — merges into purge)' },
    ],
  },
  specFields: [{ key: 'letdownP', kind: 'number', min: 1, max: 5, default: 2, unit: 'bar' }],
  solve: ({ specs, inlet }) => {
    const i = inlet('chilled');
    const condP = i.P;
    const sep = flashDrum(i.n, i.T, i.T, condP, 6);
    const LETDOWN_P = BAR(num(specs, 'letdownP'));
    const letdown = isenthalpicFlash(sep.liquid, sep.T, condP, LETDOWN_P);
    const prodTpd = (massFlow(letdown.liquid) * 24) / 1000;
    const prodKg = massFlow(letdown.liquid);
    const prodNH3kg = letdown.liquid[6] * SP.NH3.mw;
    const recovered = i.n[6] > 1e-9 ? letdown.liquid[6] / i.n[6] : 0;
    const sepMolPurity = total(letdown.liquid) > 0 ? letdown.liquid[6] / total(letdown.liquid) : 0;
    return {
      outlets: {
        gas: { T: sep.T, P: condP, n: sep.vapor },
        sepLiquid: { T: sep.T, P: condP, n: sep.liquid },
        product: { T: letdown.T, P: LETDOWN_P, n: letdown.liquid },
        flash: { T: letdown.T, P: LETDOWN_P, n: letdown.vapor },
      },
      result: {
        name: 'Ammonia separator + letdown',
        model: 'PT flash at loop P, then product letdown to 2 bar (degassing)',
        metrics: [
          { label: 'Product', value: `${d1(prodTpd)} t/d`, raw: prodTpd },
          {
            label: 'Purity',
            value: `${(sepMolPurity * 100).toFixed(2)} mol % / ${((prodNH3kg / Math.max(prodKg, 1e-9)) * 100).toFixed(2)} wt %`,
          },
          { label: 'NH3 recovered', value: `${(recovered * 100).toFixed(1)} %` },
          { label: 'Separator T', value: `${d1(sep.T - 273.15)} °C` },
          { label: 'Letdown T', value: `${d1(letdown.T - 273.15)} °C / ${num(specs, 'letdownP')} bar` },
          { label: 'Flashed vapor', value: `${(letdown.flashedFrac * 100).toFixed(1)} % of liquid` },
        ],
        warnings: letdown.liquid[6] <= 0 ? ['no ammonia condensation — check separator T'] : [],
      },
    };
  },
};

const purgeSplit: UnitTypeDef = {
  type: 'purge-split',
  name: 'Purge split',
  model: () => 'Controls loop inert inventory (CH4 + Ar from make-up and air)',
  ports: {
    in: [
      { key: 'gas', kind: 'gas' },
      { key: 'flash', kind: 'gas', doc: 'letdown flash vapor joining the purge' },
    ],
    out: [
      { key: 'purge', kind: 'gas' },
      { key: 'recycle', kind: 'gas' },
    ],
  },
  specFields: [{ key: 'purgeFrac', kind: 'number', min: 0.01, max: 0.25, default: 0.028, doc: 'fraction of separator gas' }],
  solve: ({ specs, inlet }) => {
    const gas = inlet('gas');
    const flash = inlet('flash');
    const frac = num(specs, 'purgeFrac');
    const purgeN = gas.n.map((v, idx) => v * frac + flash.n[idx]);
    const recycleN = gas.n.map((v) => v * (1 - frac));
    return {
      outlets: {
        purge: { T: gas.T, P: gas.P, n: purgeN },
        recycle: { T: gas.T, P: gas.P, n: recycleN },
      },
      result: {
        name: 'Purge split',
        model: 'Controls loop inert inventory (CH4 + Ar from make-up and air)',
        metrics: [
          { label: 'Purge flow', value: `${d1(total(purgeN))} kmol/h` },
          { label: 'Purge fraction', value: `${(frac * 100).toFixed(1)} %` },
          { label: 'Purge NH3 loss', value: `${d1((purgeN[6] * SP.NH3.mw * 24) / 1000)} t/d` },
        ],
        warnings: [],
      },
    };
  },
};

const loopCirculator: UnitTypeDef = {
  type: 'loop-circulator',
  name: 'Loop circulator',
  model: () => 'Single-stage centrifugal booster, polytropic',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'eta', kind: 'number', min: 0.6, max: 0.85, default: 0.75 },
    { key: 'dischargeP', kind: 'number', min: 40, max: 250, default: 150, unit: 'bar' },
    { key: 'postT', kind: 'number', min: 20, max: 80, default: 40, unit: '°C' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = BAR(num(specs, 'dischargeP'));
    const c = compressorTrain(i.n, i.T, i.P, outP, 1, num(specs, 'eta'), C(num(specs, 'postT')));
    return {
      outlets: { out: { T: c.T, P: outP, n: c.n } },
      result: {
        name: 'Loop circulator',
        model: 'Single-stage centrifugal booster, polytropic',
        metrics: [
          { label: 'Shaft power', value: `${d1(c.powerKW)} kW`, raw: c.powerKW },
          { label: 'Boost', value: `${(i.P / 1e5).toFixed(1)} → ${num(specs, 'dischargeP').toFixed(1)} bar` },
          { label: 'Discharge T', value: `${d1(c.T - 273.15)} °C` },
        ],
        warnings: [],
      },
    };
  },
};

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// teaching templates — flash separation (L1) and distillation (L2). Same
// UnitTypeDef grammar as the ammonia catalog: typed ports, clamped specs,
// physics wrappers in units.ts. The graph executor treats them identically.
// ---------------------------------------------------------------------------

const syngasFeedSource: UnitTypeDef = {
  type: 'syngas-feed',
  name: 'Syngas feed',
  model: () => 'Loop-gas-like feed at battery limit — H2/N2 3:1 with NH3 vapor and inerts',
  ports: { in: [], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'flow', kind: 'number', min: 200, max: 6000, default: 2000, unit: 'kmol/h', doc: 'total feed gas' },
    { key: 'yNH3', kind: 'number', min: 0, max: 0.6, default: 0.12, unit: 'mol frac', doc: 'ammonia content' },
    { key: 'yInerts', kind: 'number', min: 0, max: 0.3, default: 0.06, unit: 'mol frac', doc: 'CH4 + Ar (split 50/50)' },
    { key: 'T', kind: 'number', min: -40, max: 200, default: 30, unit: '°C' },
    { key: 'P', kind: 'number', min: 5, max: 250, default: 140, unit: 'bar' },
  ],
  solve: ({ specs }) => {
    const n = zeroN();
    const flow = num(specs, 'flow');
    const rest = Math.max(0, 1 - num(specs, 'yNH3') - num(specs, 'yInerts'));
    n[0] = flow * rest * 0.75; // H2
    n[1] = flow * rest * 0.25; // N2
    n[4] = (flow * num(specs, 'yInerts')) / 2; // CH4
    n[5] = (flow * num(specs, 'yInerts')) / 2; // Ar
    n[6] = flow * num(specs, 'yNH3'); // NH3
    return {
      outlets: { out: { T: C(num(specs, 'T')), P: BAR(num(specs, 'P')), n } },
      result: {
        name: 'Syngas feed',
        model: 'Loop-gas-like feed at battery limit — H2/N2 3:1 with NH3 vapor and inerts',
        metrics: [],
        warnings: [],
      },
    };
  },
};

const chillerDef: UnitTypeDef = {
  type: 'chiller',
  name: 'Chiller',
  model: () => 'Refrigerated cooler — sets the flash temperature',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'outletT', kind: 'number', min: -60, max: 200, default: -20, unit: '°C', doc: 'drum feed temperature' },
    { key: 'dp', kind: 'number', min: 0, max: 10, default: 2, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const c = cooler(i.n, i.T, C(num(specs, 'outletT')), outP);
    return {
      outlets: { out: { T: c.T, P: outP, n: c.n } },
      result: {
        name: 'Chiller',
        model: 'Refrigerated cooler — sets the flash temperature',
        metrics: [{ label: 'Duty', value: `${d1(MW(c.dutyKJh))} MW`, raw: MW(c.dutyKJh) }],
        warnings: [],
      },
    };
  },
};

const flashDrumDef: UnitTypeDef = {
  type: 'flash-drum',
  name: 'Flash drum',
  model: () => 'Vertical two-phase separator — PT flash (Peng-Robinson) at the inlet temperature',
  ports: {
    in: [{ key: 'in', kind: 'gas' }],
    out: [
      { key: 'vapor', kind: 'gas' },
      { key: 'liquid', kind: 'liquid' },
    ],
  },
  specFields: [{ key: 'dp', kind: 'number', min: 0, max: 10, default: 1, unit: 'bar' }],
  solve: ({ specs, inlet, warn }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const f = flashDrum(i.n, i.T, i.T, outP, 6);
    const liqTot = total(f.liquid);
    if (liqTot < 1e-6) warn('No liquid forms — everything leaves as vapor (warm drum?)');
    return {
      outlets: {
        vapor: { T: i.T, P: outP, n: f.vapor },
        liquid: { T: i.T, P: outP, n: f.liquid },
      },
      result: {
        name: 'Flash drum',
        model: 'Vertical two-phase separator — PT flash (Peng-Robinson) at the inlet temperature',
        metrics: [
          { label: 'Liquid product', value: `${d1((massFlow(f.liquid) * 24) / 1000)} t/d` },
          { label: 'Vapor fraction', value: d2(f.beta) },
          { label: 'Liquid purity', value: `${(f.liquidPurity * 100).toFixed(1)} % NH3` },
        ],
        warnings: [],
      },
    };
  },
};

const columnFeedSource: UnitTypeDef = {
  type: 'column-feed',
  name: 'Binary feed',
  model: () => 'Benzene–toluene feed at battery limit (the textbook binary pair)',
  ports: { in: [], out: [{ key: 'out', kind: 'liquid' }] },
  specFields: [
    { key: 'flow', kind: 'number', min: 50, max: 2000, default: 500, unit: 'kmol/h', doc: 'total binary feed' },
    { key: 'zLight', kind: 'number', min: 0.05, max: 0.95, default: 0.45, unit: 'mol frac', doc: 'benzene (light key)' },
    { key: 'T', kind: 'number', min: 10, max: 180, default: 25, unit: '°C' },
    { key: 'P', kind: 'number', min: 1, max: 5, default: 1.4, unit: 'bar' },
  ],
  solve: ({ specs }) => {
    const n = zeroN();
    n[I.C6H6] = num(specs, 'flow') * num(specs, 'zLight');
    n[I.C7H8] = num(specs, 'flow') * (1 - num(specs, 'zLight'));
    return {
      outlets: { out: { T: C(num(specs, 'T')), P: BAR(num(specs, 'P')), n } },
      result: {
        name: 'Binary feed',
        model: 'Benzene–toluene feed at battery limit (the textbook binary pair)',
        metrics: [],
        warnings: [],
      },
    };
  },
};

const feedHeaterDef: UnitTypeDef = {
  type: 'feed-heater',
  name: 'Feed preheater',
  model: () => 'Sets the feed thermal condition q entering the column',
  ports: { in: [{ key: 'in', kind: 'liquid' }], out: [{ key: 'out', kind: 'any' }] },
  specFields: [
    { key: 'outletT', kind: 'number', min: 20, max: 200, default: 103, unit: '°C', doc: 'column feed temperature' },
    { key: 'dp', kind: 'number', min: 0, max: 2, default: 0.1, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const outP = i.P - BAR(num(specs, 'dp'));
    const c = cooler(i.n, i.T, C(num(specs, 'outletT')), outP);
    return {
      outlets: { out: { T: c.T, P: outP, n: c.n } },
      result: {
        name: 'Feed preheater',
        model: 'Sets the feed thermal condition q entering the column',
        metrics: [{ label: 'Duty', value: `${d1(MW(c.dutyKJh))} MW`, raw: MW(c.dutyKJh) }],
        warnings: [],
      },
    };
  },
};

const distillationColumnDef: UnitTypeDef = {
  type: 'distillation-column',
  name: 'Distillation column',
  model: (specs) =>
    `Binary McCabe–Thiele column — ${Math.round(num(specs, 'stages'))} stages, feed tray ${Math.round(num(specs, 'feedStage'))}, total condenser`,
  ports: {
    in: [{ key: 'feed', kind: 'any' }],
    out: [
      { key: 'distillate', kind: 'liquid' },
      { key: 'bottoms', kind: 'liquid' },
    ],
  },
  specFields: [
    { key: 'xD', kind: 'number', min: 0.5, max: 0.9995, default: 0.97, unit: 'mol frac', doc: 'distillate purity (light key)' },
    { key: 'reflux', kind: 'number', min: 0.2, max: 15, default: 2.5, unit: 'L/D', doc: 'reflux ratio' },
    { key: 'stages', kind: 'number', min: 4, max: 40, default: 14, unit: 'count', doc: 'equilibrium stages incl. reboiler' },
    { key: 'feedStage', kind: 'number', min: 2, max: 39, default: 8, unit: 'count', doc: 'feed tray from the top' },
    { key: 'dp', kind: 'number', min: 0, max: 1, default: 0.15, unit: 'bar', doc: 'top → bottom pressure drop' },
  ],
  solve: ({ specs, inlet, warn }) => {
    const i = inlet('feed');
    const N = Math.max(4, Math.round(num(specs, 'stages')));
    const nf = Math.max(2, Math.min(N - 1, Math.round(num(specs, 'feedStage'))));
    const Ptop = i.P;
    const col = distillationColumn(
      i.n,
      i.T,
      Ptop,
      Ptop + BAR(num(specs, 'dp')),
      I.C6H6,
      I.C7H8,
      num(specs, 'xD'),
      num(specs, 'reflux'),
      N,
      nf,
    );
    if (col.pinched) {
      warn(
        col.Rmin > num(specs, 'reflux')
          ? `Column pinched — reflux R=${num(specs, 'reflux').toFixed(2)} is below Rmin=${col.Rmin.toFixed(2)}; no honest split is possible`
          : `Column pinched — no feasible split at this feed tray`,
      );
    }
    if (nf < col.feedStageOptimal) {
      warn(
        `Feed tray ${nf} is too high — the feed belongs around tray ${col.feedStageOptimal}`,
      );
    } else if (!col.pinched && nf > col.feedStageOptimal) {
      warn(
        `Feed tray ${nf} is below the optimal ${col.feedStageOptimal} — separation degrades`,
      );
    }
    const distillate = zeroN();
    distillate[I.C6H6] = col.D * col.xD;
    distillate[I.C7H8] = col.D * (1 - col.xD);
    const bottoms = zeroN();
    bottoms[I.C6H6] = col.B * col.xB;
    bottoms[I.C7H8] = col.B * (1 - col.xB);
    return {
      outlets: {
        distillate: { T: col.Ttop, P: Ptop, n: distillate },
        bottoms: { T: col.Tbot, P: Ptop + BAR(num(specs, 'dp')), n: bottoms },
      },
      result: {
        name: 'Distillation column',
        model: `Binary McCabe–Thiele column — ${N} stages, feed tray ${nf}, total condenser`,
        metrics: [
          { label: 'Distillate D', value: `${d1(col.D)} kmol/h`, raw: col.D },
          { label: 'Bottoms xB', value: `${(col.xB * 100).toFixed(2)} % benzene` },
          { label: 'Recovery', value: `${((col.D * col.xD) / Math.max(1e-9, col.D * col.xD + col.B * col.xB) * 100).toFixed(1)} %` },
          { label: 'Reflux ratio', value: `${d2(num(specs, 'reflux'))} (Rmin ${d2(col.Rmin)})` },
          { label: 'Stages / Fenske Nmin', value: `${N} / ${col.Nmin.toFixed(1)}` },
          { label: 'Feed tray', value: `${nf} (optimal ${col.feedStageOptimal})` },
          { label: 'Thermal condition q', value: d2(col.q) },
          { label: 'Relative volatility α', value: d2(col.alpha) },
          { label: 'Condenser duty', value: `${d2(MW(col.QcKJh))} MW`, raw: MW(col.QcKJh) },
          { label: 'Reboiler duty', value: `${d2(MW(col.QrKJh))} MW`, raw: MW(col.QrKJh) },
          { label: 'Top T', value: `${d1(col.Ttop - 273.15)} °C` },
          { label: 'Bottom T', value: `${d1(col.Tbot - 273.15)} °C` },
        ],
        warnings: [],
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Methanol family units (species #3) + hydrogen PSA
// ---------------------------------------------------------------------------

const meohConverter: UnitTypeDef = {
  type: 'meoh-converter',
  name: 'Methanol converter',
  model: () => '3 adiabatic Cu/ZnO/Al2O3 beds, fractional approach to MeOH equilibrium per bed',
  ports: { in: [{ key: 'in', kind: 'gas' }], out: [{ key: 'out', kind: 'gas' }] },
  specFields: [
    { key: 'bedTs', kind: 'number[]', elemMin: 200, elemMax: 280, default: [225, 245, 230], unit: '°C', doc: 'bed inlet temps (bed 1 = feed)' },
    { key: 'approach', kind: 'number[]', elemMin: 0.5, elemMax: 0.99, default: [0.85, 0.85, 0.85], doc: 'fractional approach per bed' },
    { key: 'dp', kind: 'number', min: 1, max: 8, default: 3, unit: 'bar' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const bedTs = arr(specs, 'bedTs').map((t) => C(t));
    const appr = arr(specs, 'approach');
    const feedP = i.P;
    let cur = { n: i.n, T: bedTs[0] };
    let interbedDuty = 0;
    const beds: Array<{ TOut: number; coIn: number; coOut: number }> = [];
    for (let b = 0; b < 3; b++) {
      const bed = meohBed(cur.n, cur.T, feedP, appr[b]);
      beds.push({ TOut: bed.TOut, coIn: bed.coIn, coOut: bed.coOut });
      if (b < 2) {
        const nextT = Math.min(bed.TOut, bedTs[b + 1]);
        interbedDuty += enthalpyRate(bed.n, bed.TOut) - enthalpyRate(bed.n, nextT);
        cur = { n: bed.n, T: nextT };
      } else {
        cur = { n: bed.n, T: bed.TOut };
      }
    }
    const nEff = cur.n;
    const effP = feedP - BAR(num(specs, 'dp'));
    const totIn = total(i.n);
    const totOut = total(nEff);
    const carbonIn = i.n[2] + i.n[3];
    const carbonOut = nEff[2] + nEff[3];
    const perPass = carbonIn > 1e-9 ? (1 - carbonOut / carbonIn) * 100 : 0;
    const meohOutPct = totOut > 0 ? (nEff[11] / totOut) * 100 : 0;
    const bedMetrics = beds.flatMap((b, idx) => [
      { label: `Bed ${idx + 1} (CO+CO2) in→out`, value: `${b.coIn.toFixed(1)} → ${b.coOut.toFixed(1)} %` },
      { label: `Bed ${idx + 1} outlet T`, value: `${d1(b.TOut - 273.15)} °C` },
    ]);
    void totIn;
    return {
      outlets: { out: { T: cur.T, P: effP, n: nEff } },
      result: {
        name: 'Methanol converter',
        model: '3 adiabatic Cu/ZnO/Al2O3 beds, fractional approach to MeOH equilibrium per bed',
        metrics: [
          ...bedMetrics,
          { label: 'MeOH (converter out)', value: `${meohOutPct.toFixed(1)} %` },
          { label: 'Per-pass carbon conversion', value: `${d1(perPass)} %`, raw: perPass },
          { label: 'Interbed duty', value: `${d1(MW(interbedDuty))} MW` },
        ],
        warnings: [],
      },
    };
  },
};

const meohSeparator: UnitTypeDef = {
  type: 'meoh-separator',
  name: 'Crude-methanol separator + letdown',
  model: () => 'PT flash at loop P, then crude product letdown to 2 bar (degassing)',
  ports: {
    in: [
      { key: 'chilled', kind: 'gas' },
      { key: 'letdownIn', kind: 'liquid', doc: 'internal self-loop (separator liquid → letdown)' },
    ],
    out: [
      { key: 'gas', kind: 'gas' },
      { key: 'sepLiquid', kind: 'liquid' },
      { key: 'product', kind: 'liquid' },
      { key: 'flash', kind: 'gas', doc: 'letdown flash vapor (implicit — merges into purge)' },
    ],
  },
  specFields: [{ key: 'letdownP', kind: 'number', min: 1, max: 5, default: 2, unit: 'bar' }],
  solve: ({ specs, inlet }) => {
    const i = inlet('chilled');
    const condP = i.P;
    const sep = flashDrum(i.n, i.T, i.T, condP, 6);
    const LETDOWN_P = BAR(num(specs, 'letdownP'));
    const letdown = isenthalpicFlash(sep.liquid, sep.T, condP, LETDOWN_P);
    const prodTpd = (massFlow(letdown.liquid) * 24) / 1000;
    const prodKg = massFlow(letdown.liquid);
    const prodMeOHkg = letdown.liquid[11] * SP.CH3OH.mw;
    const recovered = i.n[11] > 1e-9 ? letdown.liquid[11] / i.n[11] : 0;
    const sepMolPurity = total(letdown.liquid) > 0 ? letdown.liquid[11] / total(letdown.liquid) : 0;
    const waterWt = (letdown.liquid[7] * SP.H2O.mw) / Math.max(prodKg, 1e-9);
    return {
      outlets: {
        gas: { T: sep.T, P: condP, n: sep.vapor },
        sepLiquid: { T: sep.T, P: condP, n: sep.liquid },
        product: { T: letdown.T, P: LETDOWN_P, n: letdown.liquid },
        flash: { T: letdown.T, P: LETDOWN_P, n: letdown.vapor },
      },
      result: {
        name: 'Crude-methanol separator + letdown',
        model: 'PT flash at loop P, then crude product letdown to 2 bar (degassing)',
        metrics: [
          { label: 'Crude MeOH', value: `${d1(prodTpd)} t/d`, raw: prodTpd },
          {
            label: 'Purity',
            value: `${(sepMolPurity * 100).toFixed(2)} mol % / ${((prodMeOHkg / Math.max(prodKg, 1e-9)) * 100).toFixed(2)} wt %`,
          },
          { label: 'Water in crude', value: `${(waterWt * 100).toFixed(2)} wt %` },
          { label: 'MeOH recovered', value: `${(recovered * 100).toFixed(1)} %` },
          { label: 'Separator T', value: `${d1(sep.T - 273.15)} °C` },
          { label: 'Letdown T', value: `${d1(letdown.T - 273.15)} °C / ${num(specs, 'letdownP')} bar` },
        ],
        warnings: letdown.liquid[11] <= 0 ? ['no methanol condensation — check separator T'] : [],
      },
    };
  },
};

const psaUnit: UnitTypeDef = {
  type: 'psa',
  name: 'PSA hydrogen purification',
  model: () => 'Pressure-swing adsorption — recovery-spec H2 split with pro-rata impurity slip to hold product purity',
  ports: {
    in: [{ key: 'in', kind: 'gas' }],
    out: [
      { key: 'product', kind: 'gas' },
      { key: 'tailgas', kind: 'gas' },
    ],
  },
  specFields: [
    { key: 'h2Recovery', kind: 'number', min: 0.7, max: 0.97, default: 0.9, doc: 'fraction of feed H2 recovered to product' },
    { key: 'purity', kind: 'number', min: 0.98, max: 0.99999, default: 0.9995, doc: 'H2 mole fraction in product' },
    { key: 'dp', kind: 'number', min: 0.3, max: 3, default: 1, unit: 'bar', doc: 'adsorber pressure drop' },
  ],
  solve: ({ specs, inlet }) => {
    const i = inlet('in');
    const rec = num(specs, 'h2Recovery');
    const purity = num(specs, 'purity');
    const h2p = i.n[0] * rec;
    // impurities slip pro-rata so the product hits the purity spec, capped
    // by what is actually available in the feed
    const impFeed = total(i.n) - i.n[0];
    const impTarget = (h2p * (1 - purity)) / purity;
    const imp = Math.min(impTarget, impFeed);
    const product = zeroN();
    const tailgas = zeroN();
    product[0] = h2p;
    if (impFeed > 1e-9) {
      for (let s = 1; s < N_SP; s++) {
        const slip = (imp * i.n[s]) / impFeed;
        product[s] = slip;
      }
    }
    for (let s = 0; s < N_SP; s++) tailgas[s] = i.n[s] - product[s];
    const prodTot = total(product);
    const prodPurity = prodTot > 0 ? product[0] / prodTot : 0;
    const prodNm3h = product[0] * 22.414; // kmol/h → Nm³/h (ideal, 0 °C)
    const prodTpd = (product[0] * SP.H2.mw * 24) / 1000;
    const tailLhvMJ = (tailgas[4] * 50.0 + tailgas[2] * 10.1) / 1000; // MJ/h from CH4 + CO (LHV)
    const outP = i.P - BAR(num(specs, 'dp'));
    return {
      outlets: {
        product: { T: i.T, P: outP, n: product },
        tailgas: { T: i.T, P: BAR(1.2), n: tailgas },
      },
      result: {
        name: 'PSA hydrogen purification',
        model: 'Pressure-swing adsorption — recovery-spec H2 split with pro-rata impurity slip to hold product purity',
        metrics: [
          { label: 'H2 product', value: `${d1(prodTpd)} t/d (${Math.round(prodNm3h).toLocaleString()} Nm³/h)`, raw: prodTpd },
          { label: 'Purity', value: `${(prodPurity * 100).toFixed(3)} mol %`, raw: prodPurity },
          { label: 'H2 recovery', value: `${(rec * 100).toFixed(1)} %`, raw: rec },
          { label: 'Tailgas', value: `${d1(total(tailgas))} kmol/h (fuel, ~${d1(tailLhvMJ)} MJ/h)` },
        ],
        warnings: impTarget > impFeed ? ['feed too impure to reach purity spec — product purity limited'] : [],
      },
    };
  },
};

export const UNIT_TYPES: Record<string, UnitTypeDef> = {
  'ng-source': ngSource,
  'steam-source': steamSource,
  'air-source': airSource,
  'feed-mixer': feedMixer,
  'primary-reformer': primaryReformerDef,
  'secondary-reformer': secondaryReformerDef,
  'whb-cooler': whbCooler,
  'wgs-hts': wgs('wgs-hts', 'Fe-Cr', 2, 50, 20),
  intercooler,
  'wgs-lts': wgs('wgs-lts', 'Cu-Zn', 3, 60, 15),
  'ko-drum-shift': koDrum('ko-drum-shift', 'Knockout drum 1', 'PT flash (Peng-Robinson) — condenses shift steam'),
  'co2-removal': co2RemovalDef,
  methanator: methanatorDef,
  'ko-drum-meth': koDrum('ko-drum-meth', 'Knockout drum 2', 'PT flash (Peng-Robinson) — removes methanation water'),
  'syngas-compressor': syngasCompressor,
  'loop-mixer': loopMixer,
  'feed-preheater': feedPreheater,
  converter: converterDef,
  'condensation-train': condensationTrain,
  'nh3-separator': nh3Separator,
  'purge-split': purgeSplit,
  'loop-circulator': loopCirculator,
  // teaching templates (flash L1 + distillation L2)
  'syngas-feed': syngasFeedSource,
  chiller: chillerDef,
  'flash-drum': flashDrumDef,
  'column-feed': columnFeedSource,
  'feed-heater': feedHeaterDef,
  'distillation-column': distillationColumnDef,
  // plant families (species #3): methanol loop + hydrogen PSA
  'meoh-converter': meohConverter,
  'meoh-separator': meohSeparator,
  psa: psaUnit,
};

export function getUnitType(type: string): UnitTypeDef | undefined {
  return UNIT_TYPES[type];
}

/** merge a unit's specs over the type defaults */
export function resolveSpecs(unit: { type: string; specs: Record<string, number | boolean | number[]> }): Record<string, number | boolean | number[]> {
  const def = getUnitType(unit.type);
  const out: Record<string, number | boolean | number[]> = {};
  if (def) for (const f of def.specFields) out[f.key] = f.default;
  return { ...out, ...unit.specs };
}

// ---------------------------------------------------------------------------
// species-level solve knowledge (ammonia) — tear & controller initialization
// ---------------------------------------------------------------------------

/**
 * Initial tear guess for the synthesis loop: converter feed ≈ 5× make-up at
 * a typical loop-gas composition (research Q9 tip). This is the same
 * initializer the legacy plant.ts used — keeping it identical keeps the
 * iteration path (and therefore the trace) identical.
 */
export function tearInit(makeup: Moles): Moles {
  const tear0: Moles = zeroN();
  const f0 = total(makeup) * 5;
  // loop-gas guess (H2 N2 CO CO2 CH4 AR NH3 H2O O2) — extended species dilute to zero
  const y0 = new Array(N_SP).fill(0);
  const base = [0.58, 0.195, 0, 0, 0.11, 0.033, 0.025, 0, 0];
  for (let i = 0; i < Math.min(base.length, N_SP); i++) y0[i] = base[i];
  for (let i = 0; i < N_SP; i++) tear0[i] = f0 * y0[i];
  return tear0;
}

/** Secant bracket for the air controller (legacy init, verbatim). */
export function airControllerInit(ngFeed: number): { x0: number; x1: number } {
  return {
    x0: Math.max(200, 1.3 * ngFeed),
    x1: Math.max(300, 1.6 * ngFeed),
  };
}
