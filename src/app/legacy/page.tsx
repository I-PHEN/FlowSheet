'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { baseCase, run } from '@/lib/engine';
import type { PlantSpec } from '@/lib/engine/plant';
import { TopBar } from '@/components/workbench/TopBar';
import { PfdCanvas } from '@/components/workbench/PfdCanvas';
import { Inspector } from '@/components/workbench/Inspector';
import { BottomPanel } from '@/components/workbench/BottomPanel';

export default function Workbench() {
  const [liveSpec, setLiveSpec] = useState<PlantSpec>(() => baseCase());
  const [committedSpec, setCommittedSpec] = useState<PlantSpec>(() => baseCase());
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [bottomOpen, setBottomOpen] = useState(true);

  // debounce spec commits so slider drags re-solve at ~10 Hz, not per pixel
  useEffect(() => {
    const t = setTimeout(() => setCommittedSpec(liveSpec), 70);
    return () => clearTimeout(t);
  }, [liveSpec]);

  const result = useMemo(() => run(committedSpec), [committedSpec]);
  const baseRef = useRef(baseCase());

  const patchSpec = (patch: Partial<PlantSpec>) => setLiveSpec((s) => ({ ...s, ...patch }));
  const reset = () => {
    setLiveSpec(baseRef.current);
    setCommittedSpec(baseRef.current);
    setSelectedUnit(null);
    setSelectedStream(null);
  };

  return (
    <div className="wb flex min-h-screen w-full flex-col lg:h-screen lg:overflow-hidden">
      <TopBar result={result} onReset={reset} />

      <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,auto)] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)]">
        {/* PFD + bottom panel column */}
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,auto)]">
          <div className="wb-panel m-2 mb-0 min-h-[46vh] overflow-hidden">
            <PfdCanvas
              result={result}
              selectedUnit={selectedUnit}
              selectedStream={selectedStream}
              onSelectUnit={setSelectedUnit}
              onSelectStream={setSelectedStream}
            />
          </div>
          <div
            className={`m-2 min-h-0 overflow-hidden transition-[height] ${
              bottomOpen ? 'h-[240px]' : 'h-[30px]'
            }`}
          >
            <div className="relative h-full">
              {!bottomOpen && (
                <button
                  onClick={() => setBottomOpen(true)}
                  className="wb-mono absolute inset-0 z-10 flex h-[30px] w-full items-center justify-center border border-[#1f2a34] bg-[#10161c] text-[10px] tracking-[0.12em] text-[#5c7080] hover:text-[#dce5ec]"
                >
                  ▲ STREAM TABLE · SOLVER · MASS BALANCE
                </button>
              )}
              {bottomOpen && (
                <div className="flex h-full flex-col">
                  <div className="relative flex-1">
                    <BottomPanel
                      result={result}
                      selectedStream={selectedStream}
                      onSelectStream={setSelectedStream}
                    />
                    <button
                      onClick={() => setBottomOpen(false)}
                      className="wb-mono absolute right-2 top-1.5 z-20 border border-[#26333f] bg-[#10161c] px-1.5 text-[9px] text-[#5c7080] hover:text-[#dce5ec]"
                      aria-label="collapse panel"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* inspector — docked right on desktop, stacked below on mobile */}
        <aside className="wb-panel m-2 flex min-h-0 flex-col overflow-hidden lg:mt-0 lg:mb-2 h-[360px] lg:h-auto">
          <Inspector
            spec={liveSpec}
            onSpecChange={patchSpec}
            result={result}
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnit}
          />
        </aside>
      </main>
    </div>
  );
}
