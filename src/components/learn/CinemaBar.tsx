'use client';

/**
 * CinemaBar — the one caption system for the Learn mode.
 *
 * A single player bar DOCKED to the very bottom edge of the stage carries
 * the whole tour. It renders for BOTH paces —
 *
 *   GUIDED: the camera flies stop to stop, the caption STREAMS in word by
 *           word AS THE VOICE SPEAKS IT (real playback progress, not an
 *           estimate), and the tour advances itself when the voice
 *           finishes; ⏸ drops into free roam.
 *   ROAM:   the card shows whatever the user clicked (authored stop or
 *           synthesized caption); the primary action becomes RESUME, and
 *           an optional ↺ narrates the card on demand.
 *
 * Four laws shape the experience:
 *
 *   1. THE SYNC LAW — the narrator is the clock. useSyncedCaption maps
 *      word k onto the audio element's actual currentTime/duration, so
 *      captions can never outrun the voice; pausing freezes them where
 *      the voice cut, and a resumed line re-streams as it is re-read.
 *   2. THE DOCK LAW — the bar is flush with the bottom edge of the
 *      stage, player-chrome style: the caption leads, the scrubber dots
 *      ride under it, and the transport row (pause included) is the LAST
 *      row, at the very bottom of the screen. The bar never floats over
 *      the plant; it IS the bottom of the player.
 *   3. THE YOUTUBE LAW — the transport row fades and collapses after a
 *      few idle seconds; any pointer move, key, wheel, or touch brings it
 *      back instantly. Hovering or focusing the bar keeps it up; pausing
 *      keeps it up. The caption and the progress dots always stay.
 *   4. THE GUIDE LAW — Orion's nameplate (the Belt: three stars in his
 *      ammonia green) rides every caption; on the first stop, where his
 *      voice introduces him, the plate reads ORION · YOUR GUIDE.
 */

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import type { TourDirector } from '@/lib/ui/tourDirector';
import { useSyncedCaption } from '@/lib/ui/useSyncedCaption';
import { OrionPlate } from '@/components/learn/OrionMark';

/** idle time before the transport row vanishes — YouTube's beat */
const CHROME_HIDE_MS = 2800;

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
  const touring = tour !== null;

  // ---- the YouTube law: chrome hides on idle, wakes on any activity ------
  const [idle, setIdle] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);

  useEffect(() => {
    let t: number | null = null;
    const arm = () => {
      if (t != null) window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), CHROME_HIDE_MS);
    };
    const wake = () => {
      setIdle(false);
      arm(); // harmless between tours: hidden requires `touring`
    };
    // activity anywhere on the stage counts, exactly like a video player.
    // Listeners live for the component's whole life — so the very click (or
    // key) that starts a tour always wakes the chrome BEFORE the tour does.
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of evs) window.addEventListener(e, wake, { passive: true });
    if (touring) arm(); // the tour just started — show the controls, let them rest
    return () => {
      if (t != null) window.clearTimeout(t);
      for (const e of evs) window.removeEventListener(e, wake);
    };
  }, [touring]);

  const guided = pace === 'guided' && playing;
  const last = tour ? idx === tour.steps.length - 1 : false;
  const speaking = audio.narration === 'speaking';
  const status =
    audio.narration === 'loading'
      ? 'warming the voice…'
      : audio.narration === 'blocked'
        ? 'tap ↺ to start the voice-over'
        : audio.narration === 'error'
          ? 'narration unavailable right now'
          : '';

  // paused or roaming → the chrome stays (like any player paused)
  const chromeHidden = touring && guided && idle && !hovering && !focusWithin;

  // ---- the sync law: words arrive as the voice says them -----------------
  // (hooks run unconditionally — the bar may appear mid-life at any stop)
  const voiceLive = audio.prefs.voice && audio.narration !== 'error' && audio.narration !== 'blocked';
  const { shown, streaming } = useSyncedCaption(stop, voiceLive, guided && voiceLive);
  const textRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = textRef.current; // long captions: keep the newest words in view
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [shown]);

  if (!tour || !stop) return null;

  // the first stop is Orion's introduction — the voice says his name there,
  // so the nameplate says it too
  const firstStop = stop.source === 'stop' && stop.idx === 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
      {/* THE DOCK: flush with the bottom edge of the stage, full width —
          player chrome, never a card hovering over the plant. The legend
          and zoom cluster yield beneath it for the length of the tour. */}
      <div
        className="pointer-events-auto w-full border-t shadow-2xl"
        style={{ background: C.paperA95, borderColor: C.bandLine }}
        role="region"
        aria-label={`Guided tour — stop ${idx + 1} of ${tour.steps.length}`}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={() => setFocusWithin(false)}
      >
        {/* 1 — the caption: streams in word by word as the voice speaks */}
        <div
          key={`${stop.ref.type}:${stop.ref.id}:${stop.source}:${stop.idx ?? 's'}`}
          className="bd-msg-in px-4 pt-2.5"
        >
          <div className="max-w-[720px] text-[14px] font-bold leading-tight" style={{ color: C.ink }}>
            {stop.title}
          </div>
          <p
            ref={textRef}
            className="mt-1 max-h-[104px] max-w-[720px] overflow-y-auto text-[12.5px] leading-relaxed"
            style={{ color: C.inkSoft }}
          >
            {shown}
            {streaming && (
              <span
                className="caret ml-0.5 inline-block h-[13px] w-[6px] align-[-2px]"
                style={{ background: C.inkSoft }}
                aria-hidden="true"
              />
            )}
          </p>
        </div>

        {/* 2 — progress / hints — always visible (the dots are the scrubber) */}
        <div className="flex items-center gap-2 px-4 pb-1.5 pt-1.5">
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

        {/* 3 — the transport row: the very bottom of the screen. Fades and
              collapses away when the viewer is idle; the pause button lives
              on the bottom edge, where every player keeps it. */}
        <div
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none"
          style={{
            gridTemplateRows: chromeHidden ? '0fr' : '1fr',
            opacity: chromeHidden ? 0 : 1,
            pointerEvents: chromeHidden ? 'none' : 'auto',
          }}
          aria-hidden={chromeHidden}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 pb-2.5 pt-1">
              {/* the guide's nameplate rides every caption — one identity,
                  every plant; his introduction stop widens it */}
              <OrionPlate guide={firstStop} />
              <span className="ml-1 font-mono text-[10px] font-bold tracking-[0.14em]" style={{ color: C.inkFaint }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
