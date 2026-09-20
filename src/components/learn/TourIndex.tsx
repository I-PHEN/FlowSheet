'use client';

/**
 * TourIndex — the guided thread as a clickable list, for the side panel.
 *
 * While the CinemaBar owns the stage, the panel shows where the tour is
 * and where it can go: every stop is a jump button. The same component
 * serves the reference workspace, the flash and distillation studies, and
 * every saved AI plant.
 */

import { C } from '@/lib/design/tokens';
import { Belt } from '@/components/learn/OrionMark';
import type { TourDirector } from '@/lib/ui/tourDirector';

export function TourIndex({ director }: { director: TourDirector }) {
  const { tour, idx, pace, playing, jump } = director;
  if (!tour) return null;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold tracking-[0.16em]"
        style={{ color: C.inkFaint }}
      >
        <Belt color={C.inkSoft} size={15} />
        ORION ON TOUR — {tour.title.toUpperCase()}
      </div>
      <div className="mt-2 space-y-1">
        {tour.steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => jump(i)}
            className="hover-band flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left"
            style={{
              borderColor: i === idx ? C.ink : C.bandLine,
              background: i === idx ? C.band : C.paper,
            }}
          >
            <span className="font-mono text-[10px] font-bold" style={{ color: C.inkFaint }}>
              {i + 1}
            </span>
            <span className="truncate text-[12px] font-semibold" style={{ color: C.ink }}>
              {s.title}
            </span>
            {i === idx && (
              <span
                className="ml-auto shrink-0 font-mono text-[9px] font-bold tracking-wider"
                style={{ color: pace === 'guided' && playing ? C.gas : C.warn }}
              >
                {pace === 'guided' && playing ? 'PLAYING' : 'PAUSED'}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>
        The tour runs on the sheet — pause anytime and click a unit to explore on your own. Closing
        this panel won&apos;t stop the narration.
      </p>
    </div>
  );
}
