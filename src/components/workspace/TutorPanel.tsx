'use client';

/**
 * Tutor panel — Flow-style "What would you like to learn?" with suggestion
 * chips. Tours are deterministic and authored (no LLM) and narrated: voice
 * (TTS) over a procedural lo-fi music bed. The RUNNING tour no longer lives
 * here — it runs on the stage (CinemaBar) via the tour director; this panel
 * is the catalog you start tours from. Free-form AI Q&A arrives later and
 * the panel says so honestly.
 */

import { C } from '@/lib/design/tokens';
import { COLOR_ANSWER, TOURS, type Tour } from '@/lib/content/units';

export function TutorHome({
  onTour,
  onColors,
  remixHref,
}: {
  onTour: (t: Tour) => void;
  onColors: () => void;
  remixHref?: string;
}) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
        What would you like to learn?
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
        Guided walkthroughs of the reference plant — Orion moves the diagram for you and talks you
        through every unit.
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
      {remixHref && (
        <a
          href={remixHref}
          className="group mt-4 flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left hover-band"
          style={{ borderColor: C.utility, background: C.paper }}
          title="Open this plant in the AI builder — describe a change and the agents will edit, re-solve and re-judge it"
        >
          <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
            Edit this plant with AI
          </span>
          <span className="text-[13px] font-bold transition-transform group-hover:translate-x-0.5" style={{ color: C.utility }}>
            →
          </span>
        </a>
      )}
      <p className="mt-5 text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>
        Every walkthrough is narrated by Orion — your guide, thirty years on the catwalks — over a
        soft music bed. Ask-anything tutoring arrives in a later phase.
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
