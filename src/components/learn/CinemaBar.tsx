'use client';

/**
 * CinemaBar — the one caption system for the Learn mode.
 *
 * A single overlay at the bottom of the stage carries the whole tour:
 * counter, title, streaming caption, progress dots, and the transport
 * controls (step, pause → free roam, resume, voice, music, replay, end).
 * It renders for BOTH paces —
 *
 *   GUIDED: the caption streams in as the narrator speaks each stop;
 *           ⏸ drops the tour into free roam.
 *   ROAM:   the card shows whatever the user clicked (authored stop or
 *           synthesized caption); the primary action becomes RESUME, and
 *           an optional ↺ narrates the card on demand.
 *
 * The bar belongs to the STAGE, never to a side panel — so the experience
 * (and its narration) survives panels opening, closing, or never existing.
 */

import { Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import type { TourDirector } from '@/lib/ui/tourDirector';

function CtrlBtn({
  label,
  onClick,
  on,
  dim,
  children,
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  on?: boolean;
  dim?: boolean;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="hover-band flex items-center justify-center rounded-lg border transition-colors disabled:opacity-35"
      style={{
        height: primary ? 30 : 28,
        width: primary ? undefined : 28,
        paddingLeft: primary ? 12 : undefined,
        paddingRight: primary ? 12 : undefined,
        borderColor: primary ? C.ink : C.bandLine,
        background: primary ? C.ink : 'transparent',
        color: primary ? C.canvas : on ? C.ink : dim ? C.inkFaint : C.inkSoft,
        fontSize: primary ? 11.5 : undefined,
        fontWeight: primary ? 700 : undefined,
        letterSpacing: primary ? '0.04em' : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function CinemaBar({ director }: { director: TourDirector }) {
  const { tour, idx, pace, playing, stop, audio } = director;
  if (!tour || !stop) return null;

  const guided = pace === 'guided' && playing;
  const last = idx === tour.steps.length - 1;
  const speaking = audio.narration === 'speaking';
  const status =
    audio.narration === 'loading'
      ? 'warming the voice…'
      : audio.narration === 'blocked'
        ? 'tap ↺ to start the voice-over'
        : audio.narration === 'error'
          ? 'narration unavailable right now'
          : '';

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-14">
      {/* pb-14: the bar floats above the legend / zoom cluster at every
          width — the stage chrome stays reachable while touring */}
      <div
        className="pointer-events-auto w-full max-w-[720px] rounded-2xl border shadow-2xl"
        style={{ background: C.paperA95, borderColor: C.bandLine }}
        role="region"
        aria-label={`Guided tour — stop ${idx + 1} of ${tour.steps.length}`}
      >
        {/* transport row */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5">
          <span className="font-mono text-[10px] font-bold tracking-[0.14em]" style={{ color: C.inkFaint }}>
            {stop.source === 'stop' ? `${idx + 1} / ${tour.steps.length}` : 'DETOUR'}
          </span>
          <span
            className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em]"
            style={{
              borderColor: guided ? C.gas : C.warn,
              color: guided ? C.gas : C.warn,
            }}
          >
            {guided ? 'GUIDED' : 'ROAM'}
          </span>
          {speaking && (
            <span
              className="bd-pulse ml-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: C.gas }}
              aria-hidden="true"
            />
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <CtrlBtn label="Previous stop" onClick={director.prev} disabled={stop.source === 'stop' && idx === 0}>
              <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
            </CtrlBtn>
            {guided ? (
              <CtrlBtn label="Pause — explore freely" onClick={director.pause}>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              </CtrlBtn>
            ) : (
              <CtrlBtn label="Resume the guided tour" onClick={director.resume} primary>
                <Play className="h-3 w-3" aria-hidden="true" />
                <span className="ml-1">RESUME</span>
              </CtrlBtn>
            )}
            <CtrlBtn
              label={last ? 'Finish the tour' : 'Next stop'}
              onClick={director.next}
              disabled={stop.source === 'stop' && last}
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            </CtrlBtn>
            <span className="mx-0.5 h-5 w-px" style={{ background: C.bandLine }} aria-hidden="true" />
            <CtrlBtn
              label={audio.prefs.voice ? 'Voice on' : 'Voice off'}
              onClick={audio.toggleVoice}
              on={audio.prefs.voice}
            >
              {audio.prefs.voice ? (
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </CtrlBtn>
            <CtrlBtn
              label={audio.prefs.music ? 'Music on' : 'Music off'}
              onClick={audio.toggleMusic}
              on={audio.prefs.music}
            >
              <span className="text-[12px]" aria-hidden="true">
                ♪
              </span>
            </CtrlBtn>
            <CtrlBtn
              label={guided ? 'Replay narration' : 'Narrate this card'}
              onClick={guided ? audio.replay : director.speakCurrent}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </CtrlBtn>
            <CtrlBtn label="End tour" onClick={director.end}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </CtrlBtn>
          </div>
        </div>

        {/* the caption */}
        <div
          key={`${stop.ref.type}:${stop.ref.id}:${stop.source}:${stop.idx ?? 's'}`}
          className="bd-msg-in px-3.5 pb-1 pt-2"
        >
          <div className="text-[14px] font-bold leading-tight" style={{ color: C.ink }}>
            {stop.title}
          </div>
          <p
            className="mt-1 max-h-[104px] overflow-y-auto text-[12.5px] leading-relaxed"
            style={{ color: C.inkSoft }}
          >
            {stop.text}
          </p>
        </div>

        {/* progress / hints */}
        <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-1.5">
          <div className="flex flex-1 gap-1">
            {tour.steps.map((s, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to stop ${i + 1}: ${s.title}`}
                onClick={() => director.jump(i)}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= idx ? C.ink : C.bandLine }}
              />
            ))}
          </div>
          <span className="shrink-0 text-[10px] font-medium tracking-wide" style={{ color: C.inkFaint }}>
            {guided ? status || '← → step · space pause · esc end' : 'paused — click any unit on the sheet'}
          </span>
        </div>
      </div>
    </div>
  );
}
