'use client';

/**
 * ProjectsGrid — your plants, first-class.
 *
 * The Flow-style project dashboard on the home page: every AI-built plant
 * the user saved (or imported) is a card in the grid with a live-rendered
 * miniature of its flowsheet, a critic verdict chip, and hover actions —
 * open, edit in the builder, rename, duplicate, export, delete-with-undo.
 * The first card in the grid is always "+ New project".
 *
 * Renders nothing until the store loads and reports at least one plant —
 * a first-time visitor never sees an empty grid, just the learning path.
 */

import { memo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { C } from '@/lib/design/tokens';
import { MiniFlow, miniLayout } from './MiniFlow';
import {
  deletePlant,
  exportRecord,
  importRecord,
  listPlants,
  putPlant,
} from '@/lib/projects/store';
import { newPlantId, type PlantRecord } from '@/lib/projects/record';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/** the critic's score as a tiny radial gauge. The number IS a score out
 *  of 100 — never a revision count — so the card says exactly that:
 *  ring + "CRITIC n/100". The ring's arc carries the verdict (sage pass ·
 *  amber revise · rust fail) and the tooltip spells the word out. */
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 7;
  const circ = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r={r} fill="none" stroke={C.bandLine} strokeWidth="2.4" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

function verdictChip(rec: PlantRecord) {
  if (!rec.verdict) return null;
  const v = rec.verdict.verdict;
  const color = v === 'pass' ? C.nh3 : v === 'revise' ? C.warn : C.fail;
  const word = v === 'pass' ? 'PASS' : v === 'revise' ? 'REVISE' : 'FAIL';
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border px-2 py-0.5"
      style={{ borderColor: C.bandLine, background: C.paperA95 }}
      title={`Critic verdict: ${word} — ${rec.verdict.score}/100`}
      aria-label={`Critic verdict ${word}, score ${rec.verdict.score} out of 100`}
    >
      <ScoreRing score={rec.verdict.score} color={color} />
      <span className="font-mono text-[9px] font-bold tracking-wider" style={{ color: C.inkSoft }}>
        CRITIC {rec.verdict.score}/100
      </span>
    </span>
  );
}

const Thumb = memo(function Thumb({ rec }: { rec: PlantRecord }) {
  const { canvas, units, streams } = miniLayout(rec.graph);
  return (
    <MiniFlow
      canvas={canvas}
      units={units}
      streams={streams}
      dots
      className="block h-full w-full"
    />
  );
});

/** the ghost flowsheet — a PFD outline that pencils itself in, holds, and
 *  erases, forever (`.np-draw` in globals.css; the paths stagger via
 *  animation-delay, so the sketch grows left to right like a drawing being
 *  made). A first-time visitor sees what the box does before clicking it. */
function GhostSketch() {
  const parts: Array<{ d: string; delay: number }> = [
    // feed line in
    { d: 'M 6 42 H 38', delay: 0 },
    // feed vessel (rounded body + boot)
    { d: 'M 45 24 H 59 A 7 7 0 0 1 66 31 V 51 A 7 7 0 0 1 59 58 H 45 A 7 7 0 0 1 38 51 V 31 A 7 7 0 0 1 45 24 Z', delay: 0.55 },
    { d: 'M 50 58 V 67', delay: 0.8 },
    // pipe over to the column
    { d: 'M 66 41 H 94', delay: 1.15 },
    // distillation column (rounded, four trays)
    { d: 'M 98 10 H 114 A 4 4 0 0 1 118 14 V 70 A 4 4 0 0 1 114 74 H 98 A 4 4 0 0 1 94 70 V 14 A 4 4 0 0 1 98 10 Z', delay: 1.6 },
    { d: 'M 98 24 H 114', delay: 1.85 },
    { d: 'M 98 36 H 114', delay: 1.95 },
    { d: 'M 98 48 H 114', delay: 2.05 },
    { d: 'M 98 60 H 114', delay: 2.15 },
    // pipe over to the exchanger
    { d: 'M 118 41 H 146', delay: 2.4 },
    // shell-and-tube outline + internals
    { d: 'M 150 30 H 170 A 4 4 0 0 1 174 34 V 48 A 4 4 0 0 1 170 52 H 150 A 4 4 0 0 1 146 48 V 34 A 4 4 0 0 1 150 30 Z', delay: 2.75 },
    { d: 'M 150 47 L 170 35', delay: 3.0 },
    // product out
    { d: 'M 174 41 H 214', delay: 3.25 },
  ];
  return (
    <svg
      viewBox="0 0 220 84"
      className="h-auto w-[220px] max-w-full opacity-70 transition-opacity duration-300 group-hover:opacity-95"
      aria-hidden="true"
    >
      {parts.map((p, i) => (
        <path
          key={i}
          d={p.d}
          pathLength={1}
          className="np-draw"
          style={{
            animationDelay: `${p.delay}s`,
            fill: 'none',
            stroke: C.inkFaint,
            strokeWidth: 1.5,
            strokeLinecap: 'round',
          }}
        />
      ))}
    </svg>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border transition-transform hover:scale-110"
      style={{ borderColor: C.bandLine, background: C.paperA95, color: C.ink }}
    >
      {children}
    </button>
  );
}

export function ProjectsGrid() {
  const [plants, setPlants] = useState<PlantRecord[] | null>(null);
  const [renaming, setRenaming] = useState<PlantRecord | null>(null);
  const [renameText, setRenameText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<PlantRecord | null>(null);

  useEffect(() => {
    let alive = true;
    void listPlants().then((list) => {
      if (alive) setPlants(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (plants === null || plants.length === 0) return null;

  const refresh = async () => setPlants(await listPlants());

  const doRename = async () => {
    if (!renaming) return;
    const name = renameText.trim().slice(0, 64);
    setRenaming(null);
    if (!name || name === renaming.name) return;
    await putPlant({ ...renaming, name, updatedAt: new Date().toISOString() });
    await refresh();
    toast.success('Project renamed');
  };

  const doDuplicate = async (rec: PlantRecord, e: React.MouseEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    await putPlant({
      ...rec,
      id: newPlantId(),
      name: `${rec.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    });
    await refresh();
    toast.success('Project duplicated');
  };

  const doExport = (rec: PlantRecord, e: React.MouseEvent) => {
    e.preventDefault();
    exportRecord(rec);
  };

  const doDelete = async (rec: PlantRecord, e: React.MouseEvent) => {
    e.preventDefault();
    undoRef.current = rec;
    await deletePlant(rec.id);
    await refresh();
    toast('Project deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          const restore = undoRef.current;
          if (!restore) return;
          await putPlant(restore);
          await refresh();
          undoRef.current = null;
        },
      },
    });
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    const rec = await importRecord(file);
    if (!rec) {
      toast.error('That file is not a Flowsheet plant export');
      return;
    }
    await putPlant(rec);
    await refresh();
    toast.success(`Imported “${rec.name}”`);
  };

  return (
    <section className="mt-16 sm:mt-20" aria-label="Your projects">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          className="text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: C.inkSoft }}
        >
          Your projects{' '}
          <span className="ml-1 font-mono text-[10px] tracking-wider" style={{ color: C.inkFaint }}>
            {plants.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-[11.5px] font-bold transition-opacity hover:opacity-70"
          style={{ color: C.inkSoft }}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void doImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* + New project — always first, always one click. The ghost
            flowsheet sketches itself on loop inside the dashed box: a
            whisper of what a click starts */}
        <Link
          href="/plant/builder"
          className="card-lift group flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4"
          style={{ borderColor: C.inkFaint, background: 'transparent' }}
        >
          <GhostSketch />
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: C.bandLine, color: C.ink }}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-[14.5px] font-bold" style={{ color: C.ink }}>
            New project
          </span>
          <span className="max-w-[200px] px-4 text-center text-[11.5px] leading-relaxed" style={{ color: C.inkSoft }}>
            Describe any plant — the agents design, wire and solve it, live
          </span>
        </Link>

        {plants.map((rec) => (
          <Link
            key={rec.id}
            href={`/plant/p/${rec.id}`}
            className="card-lift group relative overflow-hidden rounded-2xl border"
            style={{ borderColor: C.bandLine, background: C.paper, boxShadow: 'var(--fs-card-shadow)' }}
          >
            {/* the thumbnail sits the way every prebuilt card's does: a
                canvas mat inside the card, the flowsheet on a WHITE sheet
                with a hairline and a soft shadow — never raw on the page
                gray (round 68: one card grammar for every plant) */}
            <div className="relative aspect-[16/10] p-2.5" style={{ background: C.canvas }}>
              <div
                className="h-full w-full origin-center overflow-hidden rounded-lg border transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ borderColor: C.bandLine, background: C.sheet, boxShadow: 'var(--fs-tip-shadow)' }}
              >
                <Thumb rec={rec} />
              </div>
              {/* hover actions */}
              <div className="absolute right-2.5 top-2.5 flex gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <IconBtn label="Rename" onClick={(e) => { e.preventDefault(); setRenaming(rec); setRenameText(rec.name); }}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </IconBtn>
                {/* one home per plant: the project page is where editing
                    lives — its Edit tab opens the saved conversation */}
                <IconBtn label="Edit with AI" onClick={(e) => { e.preventDefault(); window.location.href = `/plant/p/${rec.id}`; }}>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </IconBtn>
                <IconBtn label="Duplicate" onClick={(e) => void doDuplicate(rec, e)}>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </IconBtn>
                <IconBtn label="Export as JSON" onClick={(e) => doExport(rec, e)}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                </IconBtn>
                <IconBtn label="Delete" onClick={(e) => void doDelete(rec, e)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </IconBtn>
              </div>
            </div>
            <div className="border-t p-4" style={{ borderColor: C.bandLine }}>
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-bold" style={{ color: C.ink }}>
                  {rec.name}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px]" style={{ color: C.inkFaint }}>
                  {fmtDate(rec.updatedAt)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider" style={{ color: C.inkSoft }}>
                  {rec.graph.units.length} {rec.graph.units.length === 1 ? 'UNIT' : 'UNITS'} ·{' '}
                  {rec.graph.streams.filter((s) => !s.implicit).length}{' '}
                  {rec.graph.streams.filter((s) => !s.implicit).length === 1 ? 'STREAM' : 'STREAMS'}
                  {rec.productionTpd != null ? ` · ${Math.round(rec.productionTpd).toLocaleString()} T/D` : ''}
                </span>
                <span className="ml-auto">{verdictChip(rec)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void doRename()}
            maxLength={64}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={() => void doRename()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
