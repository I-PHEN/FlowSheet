'use client';

/**
 * ModelCard — the light 3D proof, beside Orion's voice card.
 *
 * "Less talk, more visualization": the landing page's 3D promise (the
 * EXPLORED IN 3D beat) demonstrated by the REAL viewer — the same
 * ModelStage the /plant/…/3d route uses, rendering the procedural
 * shell-and-tube model (geometry built in code — no GLB download, which
 * is what makes this card "light"). Drag to orbit; the CUTAWAY toggle
 * opens the shell exactly like the sectioned twin of the training unit.
 *
 * LIGHT BY CONSTRUCTION:
 *   - three.js never touches the server bundle or the initial page load
 *     (next/dynamic, ssr:false)
 *   - the canvas mounts only when the card approaches the viewport
 *     (IntersectionObserver, 300px margin) and stays mounted once up
 *   - the card has a fixed height, so like HeroDemo it can never shift
 *     the page
 *   - prefers-reduced-motion mounts the viewer with the turntable off —
 *     the model still orbits on drag, nothing spins on its own
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { C } from '@/lib/design/tokens';
import { SHELL_AND_TUBE } from '@/lib/three/registry';

const ModelStage = dynamic(() => import('@/components/three/ModelStage'), {
  ssr: false,
  loading: () => null,
});

export function ModelCard() {
  const holder = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [reduced, setReduced] = useState(false);

  // mount the canvas only as the card approaches the viewport
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return (
    <div
      ref={holder}
      className="flex flex-col rounded-2xl border"
      style={{ borderColor: C.bandLine, background: C.paper }}
    >
      <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
        <span
          className="font-mono text-[9.5px] font-bold tracking-[0.14em]"
          style={{ color: C.inkSoft }}
        >
          EXPLORE IN 3D
        </span>
        <span
          className="font-mono text-[9.5px] font-bold tracking-[0.14em]"
          style={{ color: C.inkFaint }}
        >
          DRAG TO ORBIT
        </span>
      </div>

      {/* the viewer — fixed height, the real ModelStage, the real model */}
      <div className="relative h-[210px] overflow-hidden border-y" style={{ borderColor: C.bandLine }}>
        {mounted ? (
          <ModelStage model={SHELL_AND_TUBE} cutaway={cutaway} spin={!reduced} />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ background: C.canvas }}>
            <span className="font-mono text-[9.5px] font-bold tracking-[0.14em]" style={{ color: C.inkFaint }}>
              SHELL-AND-TUBE EXCHANGER
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
        {/* the section toggle — open the shell like the training unit's twin */}
        <span className="flex overflow-hidden rounded-full border" style={{ borderColor: C.bandLine }}>
          {[false, true].map((mode) => (
            <button
              key={String(mode)}
              type="button"
              onClick={() => setCutaway(mode)}
              aria-pressed={cutaway === mode}
              className="px-3 py-1 font-mono text-[9.5px] font-bold tracking-[0.12em]"
              style={{
                background: cutaway === mode ? C.accent : 'transparent',
                color: cutaway === mode ? C.onAccent : C.inkSoft,
                borderColor: cutaway === mode ? C.accentLine : 'transparent',
              }}
            >
              {mode ? 'CUTAWAY' : 'ASSEMBLED'}
            </button>
          ))}
        </span>
        <span className="text-[11.5px] leading-tight" style={{ color: C.inkFaint }}>
          Shell-and-tube exchanger — modeled after the training unit. Cut it open.
        </span>
      </div>
    </div>
  );
}
