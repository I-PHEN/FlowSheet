/**
 * Library home — projects are plants. Minimal chrome, one reference card
 * with a real thumbnail of the actual flowsheet, one honest "+ New plant"
 * card. Nothing else.
 */

import Link from 'next/link';
import { C } from '@/lib/design/tokens';
import { Diagram } from '@/components/flowsheet/Diagram';

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
        <a
          href="/legacy"
          className="rounded-full px-2 py-1 text-[11px] font-semibold underline-offset-2 hover:underline"
          style={{ color: C.inkFaint }}
        >
          Console
        </a>
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
            className="group overflow-hidden rounded-2xl border transition-shadow hover:shadow-[0_6px_28px_rgba(38,40,43,0.12)]"
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

          {/* new plant card — honest placeholder until the AI builder ships */}
          <div
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center"
            style={{ borderColor: C.bandLine, background: 'transparent' }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full border text-[20px] font-light"
              style={{ borderColor: C.inkSoft, color: C.ink }}
            >
              +
            </div>
            <div className="mt-3 text-[14.5px] font-bold" style={{ color: C.ink }}>
              New plant
            </div>
            <div className="mt-1 max-w-[300px] text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
              Describe the plant you want — capacity, feed, route — and the builder drafts it for
              you. Arriving in a coming update.
            </div>
          </div>
        </div>

        <p className="mt-12 text-[11.5px] leading-relaxed" style={{ color: C.inkFaint }}>
          Simulation engine validated against published plant data (EFMA Booklet No. 1;
          Flórez-Orrego et al. 2017). Educational use — teaching-grade models, not design
          documentation.
        </p>
      </main>
    </div>
  );
}
