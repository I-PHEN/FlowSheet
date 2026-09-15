'use client';

import { useSyncExternalStore } from 'react';
import { RotateCcw } from 'lucide-react';
import type { PlantResult } from '@/lib/engine/types';

interface Props {
  result: PlantResult;
  onReset: () => void;
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-[86px] flex-col items-end border-l border-[#1f2a34] pl-3 pr-3 first:border-l-0 first:pl-0">
      <span className="wb-label">{label}</span>
      <span className={`wb-mono text-[13px] leading-tight ${accent ? 'text-[#f2a93b]' : 'text-[#dce5ec]'}`}>
        {value}
      </span>
    </div>
  );
}

export function TopBar({ result, onReset }: Props) {
  const k = result.kpis;
  // solve time is machine-dependent — suppress during SSR to avoid hydration mismatch
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#1f2a34] bg-[#10161c] px-4 py-2">
      {/* wordmark */}
      <div className="flex items-baseline gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold tracking-[0.12em] text-[#dce5ec]">
            NH<span className="text-[#f2a93b]">3</span> PLANT BUILDER
          </span>
        </div>
        <span className="hidden wb-mono text-[9.5px] tracking-[0.14em] text-[#5c7080] md:inline">
          STEAM-METHANE REFORMING · SINGLE TRAIN · FLowsheet WORKBENCH
        </span>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap items-center gap-y-2 md:ml-auto">
        <Kpi label="Production" value={`${k.productionTpd.toFixed(0)} t/d`} accent />
        <Kpi label="Purity" value={`${(k.productPurityWt * 100).toFixed(1)} wt%`} />
        <Kpi label="Per-pass" value={`${(k.perPassConv * 100).toFixed(1)} %`} />
        <Kpi label="Inerts" value={`${(k.loopInerts * 100).toFixed(1)} %`} />
        <Kpi label="H2/N2" value={k.h2n2Ratio.toFixed(2)} />
        <Kpi label="Energy" value={`${k.specificEnergyGJt.toFixed(1)} GJ/t`} />

        {/* solve status */}
        <div className="ml-3 flex items-center gap-2 border-l border-[#1f2a34] pl-3">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              result.converged ? 'bg-[#34d399]' : 'bg-[#f87171] animate-pulse'
            }`}
          />
          <div className="flex flex-col">
            <span className="wb-label">Solver</span>
            <span
              className={`wb-mono text-[11px] leading-tight ${
                result.converged ? 'text-[#34d399]' : 'text-[#f87171]'
              }`}
            >
              {result.converged ? 'CONVERGED' : 'NOT CONVERGED'} · {result.iterations} it ·{' '}
              {mounted ? `${result.solveMs.toFixed(0)} ms` : '··· ms'}
            </span>
          </div>
        </div>

        <button
          onClick={onReset}
          className="ml-2 flex items-center gap-1.5 border border-[#26333f] px-2.5 py-1 text-[10.5px] tracking-wide text-[#8ca0ae] hover:border-[#f2a93b] hover:text-[#f2a93b]"
        >
          <RotateCcw size={11} />
          RESET BASE CASE
        </button>
      </div>
    </header>
  );
}
