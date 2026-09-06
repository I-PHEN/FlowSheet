/**
 * Library home — projects are plants. Minimal chrome: one reference card
 * with a real flowsheet thumbnail, the AI builder card (describe a plant,
 * agents build it), and the local library of saved agent builds.
 */

import Link from 'next/link';
import { C } from '@/lib/design/tokens';
import { Diagram } from '@/components/flowsheet/Diagram';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SavedPlants } from '@/components/builder/SavedPlants';

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: C.canvas }}>
      <header
        className="flex h-[58px] shrink-0 items-center justify-between border-b px-5"
        style={{ borderColor: C.bandLine, background: C.paper }}
      >
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-extrabold tracking-tight" style={{ color: C.ink }}>
            Ammonia Plant Lab
          </span>
          <span className="text-[11.5px] font-semibold tracking-wide" style={{ color: C.inkFaint }}>
            EDUCATIONAL PROCESS SIMULATOR
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-[1060px] flex-1 px-5 py-10 sm:py-14">
        <h1 className="max-w-[560px] text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]" style={{ color: C.ink }}>
          Open a plant. Follow a molecule. Learn how ammonia is made.
        </h1>
        <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed" style={{ color: C.inkSoft }}>
          Every plant below is a live process flowsheet — hover any stream, click any unit, take a
          guided tour. Built for chemical engineering students and the curious.
        </p>

        <h2
          className="mb-3 mt-10 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: C.inkSoft }}
        >
          Reference plants
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* reference plant card */}
          <Link
            href="/plant/reference"
            className="card-lift group overflow-hidden rounded-2xl border"
            style={{ borderColor: C.bandLine, background: C.paper }}
          >
            <div className="aspect-[16/9] overflow-hidden" style={{ background: C.canvas }}>
              <div className="h-full w-full origin-top-left scale-[1.02] transition-transform duration-300 group-hover:scale-[1.05]">
                <Diagram static />
              </div>
            </div>
            <div className="border-t p-4" style={{ borderColor: C.bandLine }}>
              <div className="text-[15px] font-bold" style={{ color: C.ink }}>
                Steam-Methane Reforming Plant
              </div>
              <div className="mt-1 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
                The classic route: natural gas + steam to 1,000 t/d of ammonia. 19 units, 27
                streams, three guided tours.
              </div>
              <div
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold"
                style={{ color: C.gas }}
              >
                Explore plant
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </div>
          </Link>

          {/* AI builder card — describe a plant, agents build it live */}
          <Link
            href="/plant/builder"
            className="card-lift group overflow-hidden rounded-2xl border"
            style={{ borderColor: C.bandLine, background: C.paper }}
          >
            <div
              className="flex aspect-[16/9] flex-col items-center justify-center gap-3 px-6 text-center"
              style={{ background: C.canvas }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full border font-mono text-[15px] font-bold"
                style={{ borderColor: C.inkSoft, color: C.ink }}
              >
                AI
              </div>
              <div className="text-[14.5px] font-bold" style={{ color: C.ink }}>
                Build a plant with the AI agent
              </div>
              <div className="max-w-[320px] text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
                Describe the plant — route, capacity, features — and watch the
                architect, engineer, and critic assemble and verify a live
                flowsheet, unit by unit.
              </div>
              <div
                className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold"
                style={{ color: C.gas }}
              >
                Open builder
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </div>
          </Link>
        </div>

        {/* local library of agent-built plants (client-only, localStorage) */}
        <SavedPlants />

        <p className="mt-12 text-[11.5px] leading-relaxed" style={{ color: C.inkFaint }}>
          Simulation engine validated against published plant data (EFMA Booklet No. 1;
          Flórez-Orrego et al. 2017). Educational use — teaching-grade models, not design
          documentation.
        </p>
      </main>
    </div>
  );
}
