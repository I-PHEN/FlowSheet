'use client';

/**
 * /plant/[plant]/3d/[unit] — the 3D component viewer.
 *
 * Full-bleed stage (orbit / zoom / turntable) for a flowsheet unit's real 3D
 * model, with an overlay card carrying the plain-language explainer, the
 * real-world dimensions, and honest attribution. Units without a model get
 * an honest state instead of a fake render.
 *
 * The three.js bundle is dynamically imported client-side only — flowsheet
 * pages never pay for it.
 */

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Box, ChevronDown, X } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PLANTS, modelForKind, resolveUnit, type ModelEntry } from '@/lib/three/registry';
const ModelStage = dynamic(() => import('@/components/three/ModelStage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span
        className="bd-pulse font-mono text-[11px] font-bold tracking-[0.18em]"
        style={{ color: C.inkSoft }}
      >
        LOADING MODEL…
      </span>
    </div>
  ),
});

export default function Unit3dPage() {
  const params = useParams<{ plant: string; unit: string }>();
  const plantId = params?.plant ?? '';
  const unitId = params?.unit ?? '';
  const resolved = resolveUnit(plantId, unitId);
  const [infoOpen, setInfoOpen] = useState(true);
  const [cutaway, setCutaway] = useState(false);

  // ---- header shell (always present) --------------------------------------
  const header = (
    <header
      className="flex h-[54px] shrink-0 items-center gap-3 border-b px-3 sm:px-4"
      style={{ background: C.paper, borderColor: C.bandLine }}
    >
      <Link
        href={resolved?.plant.home ?? '/'}
        aria-label="Back to the plant"
        className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold"
        style={{ borderColor: C.bandLine, color: C.ink }}
      >
        ←
      </Link>
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
          {resolved ? `${resolved.node.tag} · ${resolved.node.label}` : '3D component viewer'}
        </div>
        <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
          {resolved ? `${resolved.plant.title} · 3D component model` : 'Flowsheet · 3D component models'}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );

  // ---- honest states -------------------------------------------------------
  if (!resolved) {
    return (
      <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Box className="h-8 w-8" aria-hidden="true" style={{ color: C.inkFaint }} />
          <div className="text-[20px] font-extrabold" style={{ color: C.ink }}>
            Nothing to render here
          </div>
          <p className="max-w-[400px] text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
            That plant or unit doesn&apos;t exist. Open a flowsheet, click a unit, and look for the
            &ldquo;View in 3D&rdquo; button.
          </p>
          <Link
            href="/"
            className="mt-1 rounded-full px-5 py-2.5 text-[13px] font-bold"
            style={{ background: C.ink, color: C.canvas }}
          >
            Back to Flowsheet
          </Link>
        </div>
      </div>
    );
  }

  const { plant, node } = resolved;
  const model: ModelEntry | null = modelForKind(node.kind);

  if (!model) {
    // which units on this plant DO have models? show them honestly
    const withModels = Object.values(plant.unitMap).filter((u) => modelForKind(u.kind));
    return (
      <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Box className="h-8 w-8" aria-hidden="true" style={{ color: C.inkFaint }} />
          <div className="text-[20px] font-extrabold" style={{ color: C.ink }}>
            No 3D model for {node.tag} yet
          </div>
          <p className="max-w-[420px] text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
            3D models ship one unit type at a time, and the shell-and-tube heat exchanger is first.
            Everything else on the sheet is still the honest 2D symbol for now.
          </p>
          {withModels.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[11.5px]" style={{ color: C.inkFaint }}>
                on this plant, see:
              </span>
              {withModels.map((u) => (
                <Link
                  key={u.id}
                  href={`/plant/${plant.id}/3d/${u.id}`}
                  className="rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold hover-band"
                  style={{ borderColor: C.bandLine, color: C.ink }}
                >
                  {u.tag} · {modelForKind(u.kind)?.title ?? ''}
                </Link>
              ))}
            </div>
          )}
          <Link
            href={plant.home}
            className="mt-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
            style={{ background: C.ink, color: C.canvas }}
          >
            Back to the flowsheet
          </Link>
        </div>
      </div>
    );
  }

  // ---- the viewer ----------------------------------------------------------
  return (
    <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
      {header}

      <main className="relative min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <span
                className="bd-pulse font-mono text-[11px] font-bold tracking-[0.18em]"
                style={{ color: C.inkSoft }}
              >
                LOADING MODEL…
              </span>
            </div>
          }
        >
          <ModelStage model={model} cutaway={cutaway && !!model.cutaway} />
        </Suspense>

        {/* HUD: stage chip */}
        <div
          className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.14em]"
          style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
        >
          3D COMPONENT MODEL · {node.tag} · REAL SCALE
        </div>

        {/* cutaway toggle — section the model like the training unit's twin */}
        {model.cutaway && (
          <div
            className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-full border font-mono text-[10px] font-extrabold tracking-[0.12em]"
            style={{ borderColor: C.bandLine, background: C.paperA95 }}
          >
            {([
              [false, 'ASSEMBLED'],
              [true, 'CUTAWAY'],
            ] as const).map(([mode, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setCutaway(mode)}
                aria-pressed={cutaway === mode}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: cutaway === mode ? C.ink : 'transparent',
                  color: cutaway === mode ? C.canvas : C.inkSoft,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* cutaway caption */}
        {cutaway && model.cutaway && (
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full border px-3.5 py-1.5 font-mono text-[9.5px] font-bold tracking-[0.12em] sm:block"
            style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
          >
            SECTIONED · TUBE BUNDLE · SEGMENTAL BAFFLES · TUBESHEETS
          </div>
        )}

        {/* HUD: dimensions chip */}
        <div
          className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-bold tracking-wider"
          style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
        >
          {model.dims[0].toFixed(2)} × {model.dims[1].toFixed(2)} × {model.dims[2].toFixed(2)} m
        </div>

        {/* HUD: interaction hint */}
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full px-3 py-1 text-[10.5px]"
          style={{ color: C.inkFaint }}
        >
          drag to orbit · scroll to zoom
        </div>

        {/* info card (collapsible) */}
        {infoOpen ? (
          <aside
            className="absolute bottom-10 left-3 z-10 w-[min(340px,calc(100vw-24px))] rounded-xl border p-4 shadow-sm"
            style={{ background: C.paperA95, borderColor: C.bandLine }}
            aria-label="About this model"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  className="font-mono text-[9.5px] font-bold tracking-[0.16em]"
                  style={{ color: C.inkFaint }}
                >
                  THE COMPONENT
                </div>
                <h2 className="mt-0.5 text-[15px] font-bold leading-tight" style={{ color: C.ink }}>
                  {model.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                aria-label="Hide model info"
                className="rounded-md border px-1.5 py-0.5 text-[11px] font-bold hover-band"
                style={{ borderColor: C.bandLine, color: C.inkSoft }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.inkSoft }}>
              {model.blurb}
            </p>
            <div
              className="mt-3 border-t pt-2 font-mono text-[9.5px] leading-relaxed"
              style={{ borderColor: C.bandLine, color: C.inkFaint }}
            >
              {model.credit}
            </div>
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="absolute bottom-10 left-3 z-10 flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider hover-band"
            style={{ background: C.paperA95, borderColor: C.bandLine, color: C.inkSoft }}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ABOUT THIS MODEL
          </button>
        )}
      </main>
    </div>
  );
}
