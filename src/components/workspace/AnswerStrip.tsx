'use client';

/**
 * AnswerStrip — the plant's headline answer, pinned ABOVE the levers.
 *
 * The operate friction this kills: levers on top, targets at the bottom
 * meant scrolling after every change to see what happened. The strip stays
 * glued to the top of the scrolling panel (sticky), shows the two or three
 * numbers that matter with LIVE deltas against the design point, and carries
 * the inline reset — the levers scroll under it.
 */

import { C } from '@/lib/design/tokens';

export interface AnswerCell {
  label: string;
  value: string;
  /** change vs the design point (rendered only when non-trivial) */
  delta?: number;
  deltaUnit?: string;
  /** which direction is "good" (default: up) */
  goodDown?: boolean;
}

export function AnswerStrip({
  cells,
  onReset,
  dirty,
}: {
  cells: AnswerCell[];
  onReset: () => void;
  /** any lever off its design value? (drives the reset affordance) */
  dirty: boolean;
}) {
  return (
    <div
      className="sticky top-0 z-10 -mx-5 mb-4 border-b px-5 pb-3 pt-1"
      style={{ background: C.paper, borderColor: C.bandLine }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: C.inkSoft }}>
          Plant answer
        </span>
        {dirty && (
          <button
            onClick={onReset}
            className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold hover-band"
            style={{ borderColor: C.warn, color: C.warn }}
            title="Every lever back to the design point"
          >
            reset
          </button>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {cells.map((c) => {
          const showDelta = c.delta !== undefined && Math.abs(c.delta) > 0.05;
          const good = showDelta ? (c.delta! > 0) !== !!c.goodDown : true;
          return (
            <div key={c.label} className="min-w-0">
              <div className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: C.inkFaint }}>
                {c.label}
              </div>
              <div className="truncate font-mono text-[15px] font-bold leading-tight" style={{ color: C.ink }}>
                {c.value}
                {showDelta && (
                  <span className="ml-1.5 text-[11px] font-bold" style={{ color: good ? C.nh3 : C.warn }}>
                    {c.delta! > 0 ? '+' : '−'}
                    {Math.abs(c.delta!).toFixed(1)}
                    {c.deltaUnit ? ` ${c.deltaUnit}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
