'use client';

/**
 * Detail panel — dual-layer educational content for the selected unit or
 * stream. Plain language first, technical layer second, live numbers from
 * the solved engine underneath. Units with a 3D model in the registry get
 * a "View in 3D" action that opens the component viewer.
 */

import Link from 'next/link';
import { Box } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { BANDS, UNIT_MAP, UNIT_STREAMS, type Band, type UnitNode } from '@/lib/flowsheet/layout';
import { UNIT_CONTENT, type UnitContent } from '@/lib/content/units';
import { SPECIES } from '@/lib/engine/species';
import { hasModel } from '@/lib/three/registry';
import type { PlantResult } from '@/lib/engine/types';
import type { Focus } from '@/components/flowsheet/Diagram';

const fmt = (x: number, d = 0) =>
  x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/**
 * Per-plant content bundle — what the detail panels need to teach ANY
 * plant, not just the reference sheet. Prebuilts assemble one; the default
 * is the ammonia reference content.
 */
export interface PlantContent {
  /** URL segment for 3D links: /plant/<plantId>/3d/<unitId> */
  plantId: string;
  unitMap: Record<string, UnitNode>;
  unitStreams: Record<string, { in: string[]; out: string[] }>;
  unitContent: Record<string, UnitContent>;
  /** section bands (only the reference sheet has them) */
  zones?: Band[];
}

const REFERENCE_CONTENT: PlantContent = {
  plantId: 'reference',
  unitMap: UNIT_MAP,
  unitStreams: UNIT_STREAMS,
  unitContent: UNIT_CONTENT,
  zones: BANDS,
};

function bandOf(unitId: string, plant: PlantContent): string {
  const u = plant.unitMap[unitId];
  if (!u || !plant.zones) return '';
  const cx = u.x + u.w / 2;
  const cy = u.y + u.h / 2;
  const b = plant.zones.find((bb) => cx >= bb.x && cx <= bb.x + bb.w && cy >= bb.y && cy <= bb.y + bb.h);
  return b?.label ?? '';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h4
        className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
        style={{ color: C.inkSoft }}
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

export function DetailPanel({
  result,
  selected,
  onSelect,
  onClose,
  condLabel = 'base case',
  plant = REFERENCE_CONTENT,
}: {
  result: PlantResult;
  selected: Focus;
  onSelect: (f: Focus) => void;
  onClose: () => void;
  /** live-conditions label: "base case" in Explore, "operating point" in Operate */
  condLabel?: string;
  /** the plant whose content the panels teach (default: the reference sheet) */
  plant?: PlantContent;
}) {
  if (selected.type === 'unit')
    return (
      <UnitDetail result={result} id={selected.id} onSelect={onSelect} onClose={onClose} condLabel={condLabel} plant={plant} />
    );
  return <StreamDetail result={result} id={selected.id} onSelect={onSelect} onClose={onClose} condLabel={condLabel} plant={plant} />;
}

function PanelHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <div
          className="font-mono text-[11px] font-bold tracking-widest"
          style={{ color: C.inkSoft }}
        >
          {eyebrow}
        </div>
        <h3 className="mt-0.5 text-[17px] font-semibold leading-tight" style={{ color: C.ink }}>
          {title}
        </h3>
      </div>
      <button
        onClick={onClose}
        aria-label="Close panel"
        className="mt-0.5 rounded-md border px-2 py-0.5 text-[12px] font-bold hover-band"
        style={{ borderColor: C.bandLine, color: C.inkSoft }}
      >
        ✕
      </button>
    </header>
  );
}

function StreamChip({ id, result, onSelect }: { id: string; result: PlantResult; onSelect: (f: Focus) => void }) {
  const num = id.replace(/^S0?/, '');
  return (
    <button
      onClick={() => onSelect({ type: 'stream', id })}
      className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold hover-band"
      style={{ borderColor: C.bandLine, color: C.ink }}
    >
      {num} · {result.streams[id]?.name ?? id}
    </button>
  );
}

function UnitDetail({
  result,
  id,
  onSelect,
  onClose,
  condLabel,
  plant,
}: {
  result: PlantResult;
  id: string;
  onSelect: (f: Focus) => void;
  onClose: () => void;
  condLabel: string;
  plant: PlantContent;
}) {
  const node = plant.unitMap[id];
  const unit = result.units[id];
  const content = plant.unitContent[id];
  if (!node || !unit) return null;
  const io = plant.unitStreams[id] ?? { in: [], out: [] };
  const band = bandOf(id, plant);

  return (
    <div>
      <PanelHeader eyebrow={band ? `${node.tag} · ${band}` : node.tag} title={unit.name} onClose={onClose} />

      {plant.plantId && hasModel(node.kind) && (
        <Link
          href={`/plant/${plant.plantId}/3d/${id}`}
          className="mt-3 flex h-9 items-center justify-center gap-2 rounded-lg border text-[12.5px] font-bold hover-band"
          style={{ borderColor: C.bandLine, color: C.ink, background: C.band }}
        >
          <Box className="h-3.5 w-3.5" aria-hidden="true" />
          View in 3D — real component model
        </Link>
      )}

      {content && (
        <>
          <Section title="What it does">
            <p className="text-[13px] leading-relaxed" style={{ color: C.ink }}>
              {content.plain}
            </p>
          </Section>
          <Section title="How it works">
            <p className="text-[13px] leading-relaxed" style={{ color: C.ink }}>
              {content.how}
            </p>
          </Section>
          <Section title="Why it matters">
            <p className="text-[13px] leading-relaxed" style={{ color: C.inkSoft }}>
              {content.why}
            </p>
          </Section>
        </>
      )}

      <Section title={`Live conditions — ${condLabel}`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {unit.metrics.map((m) => (
            <div key={m.label} className="flex items-baseline justify-between gap-2 border-b py-1" style={{ borderColor: C.bandLine }}>
              <span className="text-[11.5px]" style={{ color: C.inkSoft }}>
                {m.label}
              </span>
              <span className="font-mono text-[12px] font-semibold" style={{ color: C.ink }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {unit.warnings.length > 0 && (
        <Section title="Notes">
          {unit.warnings.map((w) => (
            <p key={w} className="text-[12px] leading-relaxed" style={{ color: C.warn }}>
              ⚠ {w}
            </p>
          ))}
        </Section>
      )}

      <Section title="Streams in · out">
        <div className="flex flex-wrap gap-1.5">
          {io.in.map((s) => (
            <StreamChip key={s} id={s} result={result} onSelect={onSelect} />
          ))}
          <span className="self-center text-[13px]" style={{ color: C.inkFaint }}>
            →
          </span>
          {io.out.map((s) => (
            <StreamChip key={s} id={s} result={result} onSelect={onSelect} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function StreamDetail({
  result,
  id,
  onSelect,
  onClose,
  condLabel,
  plant,
}: {
  result: PlantResult;
  id: string;
  onSelect: (f: Focus) => void;
  onClose: () => void;
  condLabel: string;
  plant: PlantContent;
}) {
  const s = result.streams[id];
  if (!s) return null;
  const tot = s.n.reduce((a, b) => a + b, 0) || 1;
  const MW = [2.016, 28.014, 28.01, 44.01, 16.043, 39.948, 17.031, 18.015, 31.999];
  const mass = s.n.reduce((a, v, i) => a + v * MW[i], 0);
  const comps = s.n
    .map((v, i) => ({ sp: SPECIES[i], x: v / tot, kmol: v }))
    .filter((e) => e.x > 0.0005)
    .sort((a, b) => b.x - a.x);

  // which units feed / receive this stream
  let from = '';
  let to = '';
  for (const [uid, io] of Object.entries(plant.unitStreams)) {
    if (io.out.includes(id)) from = plant.unitMap[uid]?.tag ?? from;
    if (io.in.includes(id)) to = plant.unitMap[uid]?.tag ?? to;
  }

  return (
    <div>
      <PanelHeader eyebrow={`${id} · ${from || 'FEED'} → ${to || 'PRODUCT'}`} title={s.name} onClose={onClose} />

      <Section title={`Live conditions — ${condLabel}`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            { k: 'Temperature', v: `${fmt(s.T - 273.15)} °C` },
            { k: 'Pressure', v: `${fmt(s.P / 1e5, 1)} bar` },
            { k: 'Molar flow', v: `${fmt(tot)} kmol/h` },
            { k: 'Mass flow', v: `${fmt(mass / 1000, 1)} t/h` },
          ].map((r) => (
            <div key={r.k} className="flex items-baseline justify-between gap-2 border-b py-1" style={{ borderColor: C.bandLine }}>
              <span className="text-[11.5px]" style={{ color: C.inkSoft }}>
                {r.k}
              </span>
              <span className="font-mono text-[12px] font-semibold" style={{ color: C.ink }}>
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Composition">
        <div className="space-y-1.5">
          {comps.map((e) => (
            <div key={e.sp} className="flex items-center gap-2.5">
              <span className="w-9 font-mono text-[11.5px] font-bold" style={{ color: C.ink }}>
                {e.sp}
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: C.band }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(1.5, e.x * 100)}%`, background: C.gas }}
                />
              </div>
              <span className="w-14 text-right font-mono text-[11.5px]" style={{ color: C.inkSoft }}>
                {(e.x * 100).toFixed(e.x > 0.0995 ? 1 : 2)}%
              </span>
              <span className="w-20 text-right font-mono text-[10.5px]" style={{ color: C.inkFaint }}>
                {fmt(e.kmol)} kmol/h
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
