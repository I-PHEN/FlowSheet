'use client';

import { useState } from 'react';
import type { PlantResult } from '@/lib/engine/types';
import { SPECIES } from '@/lib/engine/species';
import { massFlow, mwMix, total } from '@/lib/engine/thermo';
import { STREAMS } from '@/lib/workbench/layout';

interface Props {
  result: PlantResult;
  selectedStream: string | null;
  onSelectStream: (id: string | null) => void;
}

type Tab = 'streams' | 'solver' | 'balance';

export function BottomPanel({ result, selectedStream, onSelectStream }: Props) {
  const [tab, setTab] = useState<Tab>('streams');
  const [dryBasis, setDryBasis] = useState(false);

  const tabs: Array<[Tab, string]> = [
    ['streams', 'STREAM TABLE'],
    ['solver', 'SOLVER'],
    ['balance', 'MASS BALANCE'],
  ];

  return (
    <div className="flex h-full flex-col border-t border-[#1f2a34] bg-[#10161c]">
      <div className="flex items-center border-b border-[#1f2a34]">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`wb-mono border-r border-[#1f2a34] px-4 py-1.5 text-[10px] tracking-[0.1em] ${
              tab === t ? 'bg-[#151d25] text-[#f2a93b]' : 'text-[#5c7080] hover:text-[#8ca0ae]'
            }`}
          >
            {label}
          </button>
        ))}
        {tab === 'streams' && (
          <div className="ml-auto flex items-center gap-2 pr-3">
            <span className="wb-label">basis</span>
            <div className="flex border border-[#26333f]">
              {[
                ['wet', 'WET'],
                ['dry', 'DRY'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setDryBasis(v === 'dry')}
                  className={`wb-mono px-2 py-0.5 text-[9.5px] ${
                    dryBasis === (v === 'dry')
                      ? 'bg-[#26333f] text-[#dce5ec]'
                      : 'text-[#5c7080]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="wb-scroll min-h-0 flex-1 overflow-auto">
        {tab === 'streams' && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="wb-th sticky left-0 z-10 text-left">TAG</th>
                <th className="wb-th text-left">NAME</th>
                <th className="wb-th text-right">T °C</th>
                <th className="wb-th text-right">P bar</th>
                <th className="wb-th text-right">kmol/h</th>
                <th className="wb-th text-right">t/h</th>
                <th className="wb-th text-right">MW</th>
                {SPECIES.map((sp) => (
                  <th key={sp} className="wb-th text-right">
                    {sp}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STREAMS.map((edge) => {
                const s = result.streams[edge.id];
                if (!s) return null;
                const F = total(s.n);
                const dryF = F - s.n[7];
                const basis = dryBasis ? Math.max(dryF, 1e-9) : Math.max(F, 1e-9);
                const selected = selectedStream === edge.id;
                return (
                  <tr
                    key={edge.id}
                    className={`wb-row-hover cursor-pointer ${selected ? 'bg-[#1d2612]' : ''}`}
                    onClick={() => onSelectStream(selected ? null : edge.id)}
                  >
                    <td
                      className={`wb-td wb-mono sticky left-0 z-10 bg-[#10161c] font-medium ${
                        selected ? 'text-[#f2a93b]' : 'text-[#c2ced8]'
                      }`}
                    >
                      {edge.id}
                    </td>
                    <td className="wb-td text-[#8ca0ae]">{s.name}</td>
                    <td className="wb-td wb-td-num">{(s.T - 273.15).toFixed(0)}</td>
                    <td className="wb-td wb-td-num">{(s.P / 1e5).toFixed(1)}</td>
                    <td className="wb-td wb-td-num">{F >= 100 ? F.toFixed(0) : F.toFixed(1)}</td>
                    <td className="wb-td wb-td-num">{(massFlow(s.n) / 1000).toFixed(2)}</td>
                    <td className="wb-td wb-td-num">{mwMix(s.n).toFixed(2)}</td>
                    {SPECIES.map((sp, i) => (
                      <td
                        key={sp}
                        className={`wb-td wb-td-num ${
                          s.n[i] / basis > 0.005 ? 'text-[#c2ced8]' : 'text-[#3d4c58]'
                        } ${selected ? 'text-[#e8d5ac]' : ''}`}
                      >
                        {s.n[i] > 1e-9 ? ((s.n[i] / basis) * 100).toFixed(s.n[i] / basis > 0.05 ? 1 : 3) : '·'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'solver' && <SolverTab result={result} />}

        {tab === 'balance' && <BalanceTab result={result} />}
      </div>
    </div>
  );
}

function SolverTab({ result }: { result: PlantResult }) {
  return (
    <div className="flex flex-col gap-0 lg:flex-row">
      <div className="min-w-[320px] border-b border-[#1f2a34] p-3 lg:border-b-0 lg:border-r">
        <div className="wb-label mb-2">Status</div>
        <table className="w-full">
          <tbody>
            {[
              ['Loop convergence', result.converged ? 'CONVERGED' : 'NOT CONVERGED'],
              ['Tear iterations', String(result.iterations)],
              ['Solve time', `${result.solveMs.toFixed(1)} ms`],
              ['Tear method', 'damped-DS ×4 → Broyden (9-var)'],
              ['Tear stream', 'S20 converter feed'],
              [
                'H2/N2 controller',
                result.h2n2Err === null
                  ? 'manual air'
                  : `residual ${result.h2n2Err.toFixed(4)}`,
              ],
              ['Air flow', `${result.kpis.airFlow.toFixed(0)} kmol/h`],
            ].map(([a, b]) => (
              <tr key={a}>
                <td className="wb-td text-[#8ca0ae]">{a}</td>
                <td className="wb-td wb-td-num">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.warnings.length > 0 && (
          <>
            <div className="wb-label mb-1.5 mt-3">Warnings</div>
            {result.warnings.map((w) => (
              <div key={w} className="mb-1 border border-[#5c2b2b] bg-[#2a1414] px-2 py-1 text-[10.5px] text-[#f87171]">
                {w}
              </div>
            ))}
          </>
        )}
      </div>
      <div className="flex-1">
        <div className="wb-label px-3 pt-3">Convergence trace — max residual per iteration</div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="wb-th text-right">ITER</th>
              <th className="wb-th text-left">METHOD</th>
              <th className="wb-th text-right">RESIDUAL</th>
            </tr>
          </thead>
          <tbody>
            {result.solverTrace.map((row) => (
              <tr key={row.iter} className="wb-row-hover">
                <td className="wb-td wb-td-num">{row.iter}</td>
                <td className="wb-td">{row.method}</td>
                <td className="wb-td wb-td-num">{row.err.toExponential(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalanceTab({ result }: { result: PlantResult }) {
  const k = result.kpis;
  return (
    <div className="flex flex-col gap-0 lg:flex-row">
      <div className="min-w-[380px] border-b border-[#1f2a34] lg:border-b-0 lg:border-r">
        <div className="wb-label px-3 pt-3">Element balance — feeds vs products</div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="wb-th text-left">ELEMENT</th>
              <th className="wb-th text-right">IN kmol/h</th>
              <th className="wb-th text-right">OUT kmol/h</th>
              <th className="wb-th text-right">CLOSURE</th>
            </tr>
          </thead>
          <tbody>
            {result.balance.map((b) => (
              <tr key={b.element} className="wb-row-hover">
                <td className="wb-td font-medium">{b.element}</td>
                <td className="wb-td wb-td-num">{b.in.toFixed(2)}</td>
                <td className="wb-td wb-td-num">{b.out.toFixed(2)}</td>
                <td
                  className={`wb-td wb-td-num ${
                    b.relErr < 1e-6 ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                >
                  {(b.relErr * 100).toExponential(1)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[10px] leading-relaxed text-[#5c7080]">
          Inlets: natural gas, process steam, process air. Outlets: NH3 product, purge, CO2
          offgas, condensate drains. Closure &lt; 10⁻⁴ % is machine-level for this solver.
        </div>
      </div>
      <div className="flex-1">
        <div className="wb-label px-3 pt-3">Key plant figures</div>
        <table className="w-full">
          <tbody>
            {[
              ['NH3 production', `${k.productionTpd.toFixed(0)} t/d`],
              ['Product purity', `${(k.productPurityWt * 100).toFixed(2)} wt %`],
              ['Natural gas feed', `${((result.streams.S01.n[4] * 16.043 * 24) / 1000).toFixed(0)} t/d CH4`],
              ['Steam / carbon', '3.0 mol/mol (base)'],
              ['Process air', `${k.airFlow.toFixed(0)} kmol/h`],
              ['CO2 byproduct', `${(result.streams.S14.n[3] * 44.01 * 24) / 1000 >= 100 ? (result.streams.S14.n[3] * 44.01 * 24 / 1000).toFixed(0) : (result.streams.S14.n[3] * 44.01 * 24 / 1000).toFixed(1)} t/d`],
              ['Purge loss', `${(result.streams.S26.n[6] * 17.031 * 24 / 1000).toFixed(1)} t/d NH3`],
              ['Specific energy', `${k.specificEnergyGJt.toFixed(1)} GJ/t (feed + fuel + power)`],
              ['BAT reference', '28–29 GJ/t (EFMA best available)'],
            ].map(([a, b]) => (
              <tr key={a} className="wb-row-hover">
                <td className="wb-td text-[#8ca0ae]">{a}</td>
                <td className="wb-td wb-td-num">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[10px] leading-relaxed text-[#5c7080]">
          Specific energy scope: feed LHV + furnace fuel (92 % efficiency) + electric power
          (syngas compression, circulator, refrigeration at COP 2.4). Steam system credits and
          air-compressor drive excluded — a partial-scope figure, therefore slightly below BAT.
        </div>
      </div>
    </div>
  );
}
