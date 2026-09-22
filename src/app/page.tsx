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
import { TopBar } from '@/components/home/TopBar';
import { HeroDemo } from '@/components/home/HeroDemo';
import { ProjectsGrid } from '@/components/home/ProjectsGrid';
import { BuildFab } from '@/components/home/BuildFab';
import { MeetOrion } from '@/components/home/MeetOrion';
import { PipelineRail } from '@/components/home/PipelineRail';
import { Belt } from '@/components/learn/OrionMark';

function LevelBadge({ text, solid }: { text: string; solid?: boolean }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.12em]"
      style={
        solid
          ? { background: C.accent, color: C.onAccent, borderColor: C.accentLine }
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
  tpd,
}: {
  href: string;
  level: string;
  start?: string;
  title: string;
  children: React.ReactNode;
  action: string;
  layout: NonNullable<Parameters<typeof Diagram>[0]['layout']>;
  /** design production, tonnes per day — shown in the census when the plant has one */
  tpd?: number;
}) {
  const nUnits = layout.units.length;
  const nStreams = layout.streams.length;
  return (
    <Link
      href={href}
      className="card-lift group overflow-hidden rounded-2xl border"
      style={{ borderColor: C.bandLine, background: C.paper, boxShadow: 'var(--fs-card-shadow)' }}
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
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15px] font-bold" style={{ color: C.ink }}>
            {title}
          </div>
          {/* every plant's tour is narrated by Orion — say so on the card */}
          <span
            className="flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5"
            style={{ borderColor: C.bandLine, background: C.paper, color: C.inkSoft }}
            title="Narrated by Orion — your guide"
          >
            <Belt color={C.inkSoft} size={11} />
            <span className="font-mono text-[8px] font-extrabold tracking-[0.12em]">ORION</span>
          </span>
        </div>
        {/* the census — the SAME mono metadata line every project card
            carries (user plants and prebuilts speak one grammar) */}
        <div className="mt-1.5 font-mono text-[10px] tracking-wider" style={{ color: C.inkSoft }}>
          {nUnits} {nUnits === 1 ? 'UNIT' : 'UNITS'} · {nStreams} {nStreams === 1 ? 'STREAM' : 'STREAMS'}
          {tpd != null ? ` · ${tpd.toLocaleString()} T/D` : ''}
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
    <div className="fs-page flex min-h-dvh flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 pb-20 pt-12 sm:pt-16">
        {/* ---- the hero: the pitch and the proof, side by side — the demo
             column is the wider one: the diagram is the product (reviewer
             round 66: “let it be the dominant visual”) ---- */}
        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            {/* ONE weight on the setup line — the payoff line below is the
                loud one (bigger, bolder, the one accent) */}
            <h1 className="tracking-tight">
              <span className="block text-[20px] font-semibold leading-[1.2] sm:text-[24px]" style={{ color: C.ink }}>
                Describe any chemical plant.
              </span>
              <span
                className="mt-1.5 block text-[31px] font-extrabold leading-[1.07] [text-wrap:balance] sm:mt-2 sm:text-[44px]"
                style={{ color: C.nh3 }}
              >
                Watch AI engineer it — live.
              </span>
            </h1>

            <p className="mt-5 max-w-[520px] text-[13.5px] leading-relaxed" style={{ color: C.inkSoft }}>
              Type a sentence — any route, any capacity. The agents plan it, build it, solve it —
              then Orion walks you through it, and every unit opens in 3D. No installs: it all
              runs in your browser.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/plant/builder"
                className="flex h-11 items-center gap-2 rounded-full border px-5 text-[13.5px] font-bold"
                style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
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

        {/* ---- the three beats — ONE visual sentence below the fold (the
             old text pills are gone from the hero: it sells, this explains) ---- */}
        <PipelineRail />

        {/* ---- the guide gets a face: his nameplate and his real voice ---- */}
        <MeetOrion />

        {/* ---- your projects (appears when the store has one) ---- */}
        <ProjectsGrid />

        {/* ---- the learning path ---- */}
        <h2
          id="learning-path"
          className="mb-3 mt-20 scroll-mt-6 text-[11px] font-bold uppercase tracking-[0.16em] sm:mt-24"
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
            One stream in, two phases out — the atom of every separation. One guided tour,
            fifteen minutes.
          </PlantCard>

          <PlantCard
            href="/plant/distillation"
            level="LEVEL 2 · INTERMEDIATE"
            title="Distillation"
            action="Climb the tower"
            layout={DISTILLATION_LAYOUT}
          >
            Benzene from toluene, tray by tray — reflux and reboil, and the mass balances
            solve live under your sliders.
          </PlantCard>

          <PlantCard
            href="/plant/reference"
            level="LEVEL 3 · CAPSTONE"
            title="Steam-Methane Reforming Plant"
            action="Explore plant"
            layout={REFERENCE_LAYOUT}
            tpd={1000}
          >
            Natural gas + steam to ammonia — a full recycle loop, and every unit opens in 3D.
          </PlantCard>
        </div>

        {/* ---- the standing invitation ---- */}
        <p className="mx-auto mt-16 max-w-[560px] text-center text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
          Or skip the curriculum — describe the plant in your head and watch the agents build it.
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
