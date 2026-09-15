'use client';

/**
 * Tutor panel — Flow-style "What would you like to learn?" with suggestion
 * chips. Tours are deterministic and authored (no LLM) and narrated: each
 * running tour gets voice (TTS) + a procedural lo-fi music bed that ducks
 * under the narrator. Free-form AI Q&A arrives in a later phase and the
 * panel says so honestly.
 */

import { RotateCcw } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { COLOR_ANSWER, TOURS, type Tour } from '@/lib/content/units';
import { useTourAudio } from '@/lib/audio/tourAudio';

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
        Every walkthrough is narrated — a calm voice over a soft music bed. Ask-anything tutoring
        arrives in a later phase.
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
  // narrated audio for this tour: voice + music + ducking + prefetch.
  // The panel can be mounted twice (desktop aside + mobile sheet) — the
  // narrator dedupes, and both instances stay in sync via subscription.
  const audio = useTourAudio(tour, idx);
  const step = tour.steps[idx];
  const last = idx === tour.steps.length - 1;

  const status = !audio.prefs.voice
    ? 'Narration is off — tap VOICE to hear this step.'
    : audio.narration === 'loading'
      ? 'Loading narration…'
      : audio.narration === 'speaking'
        ? 'Narrating — music lowers while I speak.'
        : audio.narration === 'blocked'
          ? 'Tap the replay arrow to start the voice-over.'
          : audio.narration === 'error'
            ? 'Narration unavailable right now.'
            : '';

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

      {/* audio controls: voice · music · replay */}
      <div className="mt-4 flex items-center gap-1.5">
        <button
          type="button"
          onClick={audio.toggleVoice}
          aria-pressed={audio.prefs.voice}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider transition-colors"
          style={{
            borderColor: audio.prefs.voice ? C.gas : C.bandLine,
            color: audio.prefs.voice ? C.ink : C.inkFaint,
            background: audio.prefs.voice ? C.band : 'transparent',
          }}
          title={audio.prefs.voice ? 'Voice on' : 'Voice off'}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: audio.prefs.voice ? C.gas : C.inkFaint }}
          />
          VOICE
        </button>
        <button
          type="button"
          onClick={audio.toggleMusic}
          aria-pressed={audio.prefs.music}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider transition-colors"
          style={{
            borderColor: audio.prefs.music ? C.nh3 : C.bandLine,
            color: audio.prefs.music ? C.ink : C.inkFaint,
            background: audio.prefs.music ? C.band : 'transparent',
          }}
          title={audio.prefs.music ? 'Music on' : 'Music off'}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: audio.prefs.music ? C.nh3 : C.inkFaint }}
          />
          MUSIC
        </button>
        <button
          type="button"
          onClick={audio.replay}
          className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover-band"
          style={{ borderColor: C.bandLine, color: C.ink }}
          title="Replay narration"
          aria-label="Replay narration"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {status && (
        <p className="mt-1.5 text-[11px] italic leading-relaxed" style={{ color: C.inkFaint }}>
          {status}
        </p>
      )}

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
