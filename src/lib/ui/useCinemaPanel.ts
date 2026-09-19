'use client';

/**
 * useCinemaPanel — the cinema owns the side panel while a tour runs.
 *
 * The law the Learn merge was missing: starting a tour COLLAPSES the side
 * panel so the sheet gets the full view (the CinemaBar carries the tour on
 * the stage; the panel's TourIndex is a convenience, not a requirement).
 *
 *   tour starts        → panel hides (whatever its state was)
 *   tour ends, untouched → the panel returns to its pre-tour state
 *   user toggles mid-tour → the panel obeys immediately (pinned open),
 *                           and an explicit choice is never yanked back
 *
 * Deterministic by construction: `showPanel` is DERIVED state (no timers,
 * no ref timing hazards across batched updates).
 */

import { useCallback, useState } from 'react';

export function useCinemaPanel(touring: boolean) {
  /** the user's standing intent, outside tours */
  const [panelOpen, setPanelOpen] = useState(true);
  /** the user explicitly showed the panel during the current tour */
  const [pinned, setPinned] = useState(false);

  const showPanel = touring ? pinned : panelOpen;

  // a fresh tour starts collapsed — a pin belongs to the tour that earned it.
  // (State adjusted during render, the React-doc pattern for prop-derived
  // resets; no effect, no flicker, no stale timer.)
  const [prevTouring, setPrevTouring] = useState(touring);
  if (prevTouring !== touring) {
    setPrevTouring(touring);
    if (touring) setPinned(false);
  }

  /** the header toggle — works during tours too */
  const togglePanel = useCallback(() => {
    if (touring) setPinned((p) => !p);
    else setPanelOpen((p) => !p);
  }, [touring]);

  /** explicit set (mode switches, panel resets) — correct during tours too */
  const openPanel = useCallback(
    (v: boolean) => {
      setPanelOpen(v);
      if (touring) setPinned(v);
    },
    [touring],
  );

  return { panelOpen, showPanel, togglePanel, openPanel };
}
