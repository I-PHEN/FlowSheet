'use client';

/**
 * Tutor panel — Flow-style "What would you like to learn?" with suggestion
 * chips. Tours are deterministic and authored (no LLM); free-form AI Q&A
 * arrives in a later phase and the panel says so honestly.
 */

import { C } from '@/lib/design/tokens';
import { COLOR_ANSWER, TOURS, type Tour } from '@/lib/content/units';

export function TutorHome({
  onTour,
  onColors,
}: {
  onTour: (t: Tour) => void;
  onColors: () => void;
}) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
        What would you like to learn?
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
        Guided walkthroughs of the reference plant — each one moves the diagram for you.
      </p>
      <div className="mt-4 space-y-2">
        {TOURS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTour(t)}
            className="group flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left hover-band"
            style={{ borderColor: C.bandLine, background: C.paper }}
          >
            <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
              {t.chip}
            </span>
            <span className="text-[13px] font-bold transition-transform group-hover:translate-x-0.5" style={{ color: C.inkSoft }}>
              →
            </span>
          </button>
        ))}
        <button
          onClick={onColors}
          className="group flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left hover-band"
          style={{ borderColor: C.bandLine, background: C.paper }}
        >
          <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
            What do the colors and numbers mean?
          </span>
          <span className="text-[13px] font-bold transition-transform group-hover:translate-x-0.5" style={{ color: C.inkSoft }}>
            →
          </span>
        </button>
      </div>
      <p className="mt-5 text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>
        These walkthroughs are built in. Ask-anything tutoring and voice narration arrive in a
        later phase.
      </p>
    </div>
  );
}

export function ColorAnswer({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
        {COLOR_ANSWER.title}
      </h3>
      {COLOR_ANSWER.text.map((p, i) => (
        <p key={i} className="mt-3 text-[13px] leading-relaxed" style={{ color: C.ink }}>
          {p}
        </p>
      ))}
      <button
        onClick={onBack}
        className="mt-5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold hover-band"
        style={{ borderColor: C.bandLine, color: C.ink }}
      >
        ← Back
      </button>
    </div>
  );
}

export function TourRunner({
  tour,
  idx,
  onStep,
  onExit,
}: {
  tour: Tour;
  idx: number;
  onStep: (i: number) => void;
  onExit: () => void;
}) {
  const step = tour.steps[idx];
  const last = idx === tour.steps.length - 1;
  return (
    <div className="flex h-full flex-col">
      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: C.band }}>
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${((idx + 1) / tour.steps.length) * 100}%`, background: C.gas }}
        />
      </div>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] font-bold tracking-widest" style={{ color: C.inkSoft }}>
            {idx + 1} / {tour.steps.length}
          </div>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-tight" style={{ color: C.ink }}>
            {tour.title}
          </h3>
        </div>
        <button
          onClick={onExit}
          aria-label="Exit tour"
          className="mt-0.5 rounded-md border px-2 py-0.5 text-[12px] font-bold hover-band"
          style={{ borderColor: C.bandLine, color: C.inkSoft }}
        >
          ✕
        </button>
      </header>

      <h4 className="mt-5 text-[15px] font-bold" style={{ color: C.ink }}>
        {step.title}
      </h4>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: C.ink }}>
        {step.text}
      </p>

      <div className="mt-auto flex gap-2 pt-6">
        <button
          onClick={() => onStep(idx - 1)}
          disabled={idx === 0}
          className="rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold hover-band disabled:opacity-35"
          style={{ borderColor: C.bandLine, color: C.ink }}
        >
          ← Back
        </button>
        <button
          onClick={() => (last ? onExit() : onStep(idx + 1))}
          className="flex-1 rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-opacity hover:opacity-90"
          style={{ background: C.ink, color: C.paper }}
        >
          {last ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
