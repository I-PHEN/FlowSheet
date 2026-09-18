'use client';

/**
 * /plant/p/[id] — a saved plant as a first-class citizen.
 *
 * Same stage as the prebuilts: the live BuildCanvas renderer (pan, zoom,
 * hover streams, click units), an inspector, and — the point of the page —
 * a narrated guided tour generated from the build itself. The record in
 * the local project store is the only input; nothing here knows or cares
 * that the plant was drawn by AI agents rather than shipped in code.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Download, RotateCcw, Volume2, VolumeX, Wand2, X } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { BuildCanvas, UnitInspector, type BuildCanvasHandle } from '@/components/builder/BuildCanvas';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getPlant, ensureMigrated, exportRecord } from '@/lib/projects/store';
import { effectiveFamily, type PlantRecord } from '@/lib/projects/record';
import { getFamily } from '@/lib/families';
import { SPECIES } from '@/lib/engine/species';
import { generateTour } from '@/lib/projects/tour';
import { useTourAudio, unlockAudio } from '@/lib/audio/tourAudio';
import { setTourActive } from '@/lib/ui/tourBus';

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [rec, setRec] = useState<PlantRecord | null | 'missing'>(null);
  const [userSelected, setUserSelected] = useState<string | null>(null);
  const [tourIdx, setTourIdx] = useState<number | null>(null);
  const canvasRef = useRef<BuildCanvasHandle>(null);

  useEffect(() => {
    let alive = true;
    void ensureMigrated().then(async () => {
      const r = await getPlant(id);
      if (alive) setRec(r ?? 'missing');
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // the docent's authored tour (saved with the record) beats the auto-tour
  const tour = useMemo(
    () => (rec && rec !== 'missing' ? (rec.tour ?? generateTour(rec)) : null),
    [rec],
  );
  const fam = useMemo(
    () => (rec && rec !== 'missing' ? getFamily(effectiveFamily(rec)) : null),
    [rec],
  );

  // narrated audio for the running tour (voice + music + ducking)
  const audio = useTourAudio(tour ?? DUMMY_TOUR, tourIdx ?? 0);

  // the tour owns the spotlight while it runs; the user owns it otherwise
  const spotlightStep = tourIdx !== null && tour ? tour.steps[tourIdx] : null;
  const selected =
    spotlightStep && spotlightStep.ref.type === 'unit' ? spotlightStep.ref.id : userSelected;

  // publish tour state for the floating Build button
  useEffect(() => {
    setTourActive(tourIdx !== null);
    return () => setTourActive(false);
  }, [tourIdx]);

  const startTour = useCallback(() => {
    unlockAudio();
    setUserSelected(null);
    setTourIdx(0);
  }, []);

  const endTour = useCallback(() => {
    setTourIdx(null);
    setUserSelected(null);
    canvasRef.current?.fit();
  }, []);

  const go = useCallback(
    (i: number) => {
      if (!tour) return;
      setTourIdx(Math.max(0, Math.min(tour.steps.length - 1, i)));
    },
    [tour],
  );

  if (rec === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: C.canvas }}>
        <span className="bd-pulse font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: C.inkSoft }}>
          LOADING PROJECT…
        </span>
      </div>
    );
  }

  if (rec === 'missing') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: C.canvas }}>
        <div className="text-[20px] font-extrabold" style={{ color: C.ink }}>Project not found</div>
        <p className="max-w-[380px] text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
          It may have been deleted in this browser, or the link belongs to another browser&apos;s
          library. Exported plants travel as files — import one from the home page.
        </p>
        <Link href="/" className="mt-1 rounded-full px-5 py-2.5 text-[13px] font-bold" style={{ background: C.ink, color: C.canvas }}>
          Back to Flowsheet
        </Link>
      </div>
    );
  }

  const unitCount = rec.graph.units.length;
  const streamCount = rec.graph.streams.filter((s) => !s.implicit).length;
  const step = tourIdx !== null && tour ? tour.steps[tourIdx] : null;
  const k = rec.kpis;

  return (
    <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
      {/* header */}
      <header
        className="flex h-[54px] shrink-0 items-center gap-3 border-b px-3 sm:px-4"
        style={{ borderColor: C.bandLine, background: C.paper }}
      >
        <Link
          href="/"
          className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold"
          style={{ borderColor: C.bandLine, color: C.ink }}
          title="Back to Flowsheet"
          aria-label="Back to Flowsheet"
        >
          ←
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
              {rec.name}
            </span>
            {fam && (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em] sm:inline"
                style={{ borderColor: C.nh3, color: C.nh3 }}
                title={fam.route}
              >
                {fam.name.toUpperCase()} · {fam.id === 'general' ? (rec.graph.product?.species ?? 'CUSTOM') : fam.productSpecies}
              </span>
            )}
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            {unitCount} units · {streamCount} streams · saved{' '}
            {new Date(rec.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportRecord(rec)}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold"
            style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
            title="Export as .flowsheet.json"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <Link
            href={`/plant/builder?remix=${rec.id}`}
            className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold"
            style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
            title="Open this plant in the AI builder — describe changes and the agents will remix, re-solve and re-judge it"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Remix with AI</span>
            <span className="sm:hidden">Remix</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* the studio: stage + project panel */}
      <main className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* stage */}
        <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Project flowsheet">
          <div className="min-h-0 flex-1">
            <BuildCanvas
              ref={canvasRef}
              graph={rec.graph}
              selected={selected}
              warm
              onUnitClick={(uid) => {
                if (tourIdx !== null) return; // a running tour owns the spotlight
                setUserSelected((cur) => (cur === uid ? null : uid));
              }}
              onBackgroundClick={() => setUserSelected(null)}
            />
          </div>
          <div
            className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.14em]"
            style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
          >
            YOUR PLANT · {unitCount} UNITS · {streamCount} STREAMS
          </div>
          {rec.graph && selected && tourIdx === null && (
            <UnitInspector graph={rec.graph} unitId={selected} onClose={() => setUserSelected(null)} />
          )}
        </section>

        {/* project panel */}
        <aside
          className="flex h-[52dvh] w-full shrink-0 flex-col overflow-y-auto border-t lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0"
          style={{ borderColor: C.bandLine, background: C.paper }}
          aria-label="Project details"
        >
          {/* brief */}
          <div className="border-b p-4" style={{ borderColor: C.bandLine }}>
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
              THE BRIEF
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: C.ink }}>
              {rec.brief || 'No brief was recorded for this plant.'}
            </p>
          </div>

          {/* the numbers */}
          <div className="border-b p-4" style={{ borderColor: C.bandLine }}>
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
              THE NUMBERS
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(k?.familyKpis && k.familyKpis.length > 0
                ? k.familyKpis.map((f) => ({
                    label: f.label.toUpperCase(),
                    value: f.value,
                  }))
                : [
                    { label: 'PRODUCTION', value: k ? `${Math.round(k.productionTpd).toLocaleString()} t/d` : '—' },
                    { label: 'PRODUCT PURITY', value: k ? `${(k.productPurityWt * 100).toFixed(1)} wt%` : '—' },
                    { label: 'PER-PASS CONVERSION', value: k ? `${(k.perPassConv * 100).toFixed(1)}%` : '—' },
                  ]
              ).map((f) => (
                <Stat key={f.label} label={f.label} value={f.value} />
              ))}
              <Stat label="UNITS · STREAMS" value={`${unitCount} · ${streamCount}`} />
            </div>
            {k && (
              <div
                className="mt-2.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider"
                style={{ borderColor: C.nh3, color: C.nh3 }}
              >
                MASS + ENERGY BALANCE CONVERGED
              </div>
            )}
          </div>

          {/* the critic */}
          {rec.verdict && (
            <div className="border-b p-4" style={{ borderColor: C.bandLine }}>
              <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
                THE CRITIC
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider"
                  style={{
                    borderColor: rec.verdict.verdict === 'pass' ? C.nh3 : C.warn,
                    color: rec.verdict.verdict === 'pass' ? C.nh3 : C.warn,
                  }}
                >
                  {rec.verdict.verdict.toUpperCase()} · {rec.verdict.score}/100
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
                {rec.verdict.summary}
              </p>
              {rec.verdict.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {rec.verdict.issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed" style={{ color: C.inkSoft }}>
                      <span style={{ color: C.warn }}>·</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* the tour */}
          <div className="p-4">
            <div className="font-mono text-[9.5px] font-bold tracking-[0.16em]" style={{ color: C.inkFaint }}>
              {'GUIDED TOUR · ' + (rec.tour ? 'WRITTEN BY THE DOCENT FOR THIS PLANT' : 'GENERATED FROM YOUR BUILD')}
            </div>

            {tourIdx === null || !tour ? (
              <>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
                  A narrated walk down the process path — intro, unit by unit, the numbers.
                  Voice and a soft instrumental bed, just like the prebuilt plants.
                </p>
                <button
                  type="button"
                  onClick={startTour}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-bold"
                  style={{ background: C.ink, color: C.canvas }}
                >
                  <span aria-hidden="true">▶</span>
                  {tour ? tour.chip : 'Walk my plant'}
                </button>
              </>
            ) : (
              <div className="mt-2">
                {/* controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => audio.toggleVoice()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ borderColor: C.bandLine, color: audio.prefs.voice ? C.ink : C.inkFaint }}
                    title={audio.prefs.voice ? 'Voice on' : 'Voice off'}
                    aria-label={audio.prefs.voice ? 'Voice on' : 'Voice off'}
                  >
                    {audio.prefs.voice ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => audio.toggleMusic()}
                    className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[10px] font-bold tracking-wider"
                    style={{ borderColor: C.bandLine, color: audio.prefs.music ? C.ink : C.inkFaint }}
                    title={audio.prefs.music ? 'Music on' : 'Music off'}
                  >
                    <span aria-hidden="true">♪</span>
                    {audio.prefs.music ? 'MUSIC' : 'MUTED'}
                  </button>
                  <button
                    type="button"
                    onClick={audio.replay}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ borderColor: C.bandLine, color: C.ink }}
                    title="Replay narration"
                    aria-label="Replay narration"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={endTour}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ borderColor: C.bandLine, color: C.ink }}
                    title="End tour"
                    aria-label="End tour"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {/* the step */}
                {step && (
                  <div key={tourIdx} className="bd-msg-in mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] font-bold tracking-wider" style={{ color: C.inkFaint }}>
                        {tourIdx + 1} / {tour.steps.length}
                      </span>
                      <span className="text-[13.5px] font-bold" style={{ color: C.ink }}>
                        {step.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
                      {step.text}
                    </p>
                  </div>
                )}

                {/* nav */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go(tourIdx - 1)}
                    disabled={tourIdx === 0}
                    className="flex h-9 items-center rounded-full border px-4 text-[12px] font-bold disabled:opacity-35"
                    style={{ borderColor: C.bandLine, color: C.ink }}
                  >
                    ← Back
                  </button>
                  {tourIdx < tour.steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => go(tourIdx + 1)}
                      className="flex h-9 flex-1 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: C.ink, color: C.canvas }}
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={endTour}
                      className="flex h-9 flex-1 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: C.ink, color: C.canvas }}
                    >
                      Finish tour ✓
                    </button>
                  )}
                </div>

                {/* progress */}
                <div className="mt-3 flex gap-1">
                  {tour.steps.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to step ${i + 1}`}
                      onClick={() => go(i)}
                      className="h-1.5 flex-1 rounded-full transition-colors"
                      style={{ background: i <= tourIdx ? C.ink : C.bandLine }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: C.bandLine, background: C.canvas }}>
      <div className="font-mono text-[8.5px] font-bold tracking-[0.14em]" style={{ color: C.inkFaint }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-bold" style={{ color: C.ink }}>
        {value}
      </div>
    </div>
  );
}

/** placeholder tour so the audio hook always has a valid shape */
const DUMMY_TOUR = {
  id: 'none',
  chip: '',
  title: '',
  steps: [{ ref: { type: 'unit' as const, id: '' }, title: '', text: '' }],
};
