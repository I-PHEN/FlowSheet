'use client';

/**
 * SavedPlants — the local library strip on the home page.
 *
 * Client-only: reads the localStorage records written by the builder's
 * "Save to library". Each card shows the brief, the critic verdict chip,
 * and links back into the builder with the graph restored (?load=slug).
 * Renders nothing when the library is empty.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SavedPlant } from '@/lib/agent/protocol';
import { LIBRARY_KEY } from '@/lib/agent/protocol';
import { C } from '@/lib/design/tokens';

export function SavedPlants() {
  const [plants, setPlants] = useState<SavedPlant[] | null>(null);

  useEffect(() => {
    // one-shot read of an external (browser) store, deferred out of the
    // effect body to avoid a synchronous cascading render
    const id = requestAnimationFrame(() => {
      try {
        const list = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as SavedPlant[];
        setPlants(Array.isArray(list) ? list.slice(0, 6) : []);
      } catch {
        setPlants([]);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!plants || plants.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: C.inkSoft }}>
        Your AI builds
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plants.map((p) => {
          const v = p.verdict?.verdict ?? 'revise';
          const color = v === 'pass' ? C.nh3 : v === 'revise' ? C.warn : C.fail;
          return (
            <Link
              key={p.slug}
              href={`/plant/builder?load=${p.slug}`}
              className="card-lift group rounded-2xl border p-4"
              style={{ borderColor: C.bandLine, background: C.paper }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase"
                  style={{ color, borderColor: color }}
                >
                  {v}
                </span>
                {p.productionTpd != null && (
                  <span className="font-mono text-[11px] font-bold" style={{ color: C.ink }}>
                    {p.productionTpd.toFixed(0)} t/d
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px]" style={{ color: C.inkFaint }}>
                  {p.graph?.units?.length ?? '?'} units
                </span>
              </div>
              <div className="mt-2 line-clamp-2 text-[13px] font-bold leading-snug" style={{ color: C.ink }}>
                {p.name}
              </div>
              <div className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed" style={{ color: C.inkSoft }}>
                {p.brief}
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: C.gas }}>
                Open build
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
