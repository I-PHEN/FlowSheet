/**
 * Flowsheet home — the sell, the ladder, and your work.
 *
 * The hero tells the whole story in one glance: a looping, self-playing AI
 * build (typing → placing → wiring → solving → verdict) rendered by the same
 * mini-renderer the project grid uses. Below it, the state-dependent middle:
 * YOUR PROJECTS appears the moment the local store has one plant. Then the
 * learning path — three rungs from a three-unit flash drum to a 19-unit
 * ammonia plant — and the standing invitation: skip the curriculum, describe
 * any plant, and the agents will engineer it in front of you.
 */

import Link from 'next/link';
import { C } from '@/lib/design/tokens';
import { Diagram } from '@/components/flowsheet/Diagram';
import { FLASH_LAYOUT } from '@/lib/flowsheet/flashLayout';
import { DISTILLATION_LAYOUT } from '@/lib/flowsheet/distillationLayout';
import { REFERENCE_LAYOUT } from '@/lib/flowsheet/layout';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeroDemo } from '@/components/home/HeroDemo';
import { ProjectsGrid } from '@/components/home/ProjectsGrid';
import { BuildFab } from '@/components/home/BuildFab';

function LevelBadge({ text, solid }: { text: string; solid?: boolean }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.12em]"
      style={
        solid
          ? { background: C.ink, color: C.canvas, borderColor: C.ink }
          : { borderColor: C.bandLine, color: C.inkSoft, background: C.paperA95 }
      }
    >
      {text}
    </span>
  );
}

function PlantCard({
  href,
  level,
  start,
  title,
  children,
  action,
  layout,
}: {
  href: string;
  level: string;
  start?: string;
  title: string;
  children: React.ReactNode;
  action: string;
  layout: Parameters<typeof Diagram>[0]['layout'];
}) {
  return (
    <Link
      href={href}
      className="card-lift group overflow-hidden rounded-2xl border"
      style={{ borderColor: C.bandLine, background: C.paper }}
    >
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: C.canvas }}>
        <div className="h-full w-full origin-top-left scale-[1.02] transition-transform duration-300 group-hover:scale-[1.05]">
          <Diagram static layout={layout} />
        </div>
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <LevelBadge text={level} />
          {start && <LevelBadge text={start} solid />}
        </div>
      </div>
      <div className="border-t p-4" style={{ borderColor: C.bandLine }}>
        <div className="text-[15px] font-bold" style={{ color: C.ink }}>
          {title}
        </div>
        <div className="mt-1 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
          {children}
        </div>
        <div
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold"
          style={{ color: C.ink }}
        >
          {action}
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: C.canvas }}>
      <header
        className="flex h-[58px] shrink-0 items-center justify-between border-b px-5"
        style={{ borderColor: C.bandLine, background: C.paper }}
      >
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-extrabold tracking-tight" style={{ color: C.ink }}>
            Flowsheet
          </span>
          <span className="hidden text-[11.5px] font-semibold tracking-wide sm:inline" style={{ color: C.inkFaint }}>
            AI-NATIVE PROCESS SIMULATOR
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 pb-16 pt-10 sm:pt-14">
        {/* ---- the hero: the pitch and the proof, side by side ---- */}
        <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.14em]"
              style={{ borderColor: C.bandLine, color: C.inkSoft, background: C.paper }}
            >
              <span style={{ color: C.ink }} aria-hidden="true">✦</span>
              AI-NATIVE PROCESS SIMULATOR
            </span>
            <h1
              className="mt-4 text-[30px] font-extrabold leading-[1.12] tracking-tight sm:text-[38px]"
              style={{ color: C.ink }}
            >
              Describe any chemical plant.
              <br />
              <span style={{ color: C.inkSoft }}>Watch AI engineer it</span> — live.
            </h1>
            <p className="mt-4 max-w-[520px] text-[13.5px] leading-relaxed" style={{ color: C.inkSoft }}>
              Type a sentence — any route, any capacity. An architect plans it, an engineer wires
              every unit and stream, a solver closes the mass and energy balance, and a critic
              signs it off. Then walk your plant with a narrated, scored tour. No installs —
              everything runs and solves in your browser.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/plant/builder"
                className="flex h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold"
                style={{ background: C.ink, color: C.canvas }}
              >
                <span aria-hidden="true">✦</span>
                Build a plant with AI
              </Link>
              <a
                href="#learning-path"
                className="flex h-11 items-center rounded-full border px-5 text-[13.5px] font-bold"
                style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
              >
                Start at the basics ↓
              </a>
            </div>
          </div>
          <HeroDemo />
        </section>

        {/* ---- your projects (appears when the store has one) ---- */}
        <ProjectsGrid />

        {/* ---- the learning path ---- */}
        <h2
          id="learning-path"
          className="mb-3 mt-12 scroll-mt-6 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: C.inkSoft }}
        >
          The learning path
        </h2>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <PlantCard
            href="/plant/flash"
            level="LEVEL 1 · BEGINNER"
            start="START HERE"
            title="Flash Separation"
            action="Start learning"
            layout={FLASH_LAYOUT}
          >
            One stream in, two phases out — the atom of every separation process. Three units,
            four streams, one guided tour. Fifteen minutes.
          </PlantCard>

          <PlantCard
            href="/plant/distillation"
            level="LEVEL 2 · INTERMEDIATE"
            title="Distillation"
            action="Climb the tower"
            layout={DISTILLATION_LAYOUT}
          >
            Benzene from toluene, tray by tray — the flash drum stacked into a tower. Six units,
            nine streams, reflux and reboil. Forty minutes.
          </PlantCard>

          <PlantCard
            href="/plant/reference"
            level="LEVEL 3 · CAPSTONE"
            title="Steam-Methane Reforming Plant"
            action="Explore plant"
            layout={REFERENCE_LAYOUT}
          >
            The classic route: natural gas + steam to 1,000 t/d of ammonia. 19 units, 27 streams,
            a recycle loop, and three guided tours.
          </PlantCard>
        </div>

        {/* ---- the standing invitation ---- */}
        <p className="mx-auto mt-12 max-w-[560px] text-center text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
          Or skip the curriculum entirely — open the builder, describe the plant in your head,
          and the agents will engineer it in front of you.
        </p>
      </main>

      <footer
        className="border-t px-5 py-5 text-center text-[11.5px]"
        style={{ borderColor: C.bandLine, color: C.inkFaint, background: C.paper }}
      >
        Flowsheet — an AI-native process simulator for chemical engineering students and the
        curious.
      </footer>

      <BuildFab />
    </div>
  );
}
