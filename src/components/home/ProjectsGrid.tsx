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

function verdictChip(rec: PlantRecord) {
  if (!rec.verdict) return null;
  const v = rec.verdict.verdict;
  const ok = v === 'pass';
  const revise = v === 'revise';
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider"
      style={{ borderColor: ok ? C.nh3 : revise ? C.warn : C.utility, color: ok ? C.nh3 : revise ? C.warn : C.utility }}
    >
      {ok ? `CRITIC ${rec.verdict.score}` : revise ? `REVISE ${rec.verdict.score}` : `FAIL ${rec.verdict.score}`}
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
      className="block h-full w-full"
    />
  );
});

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
        {/* + New project — always first, always one click */}
        <Link
          href="/plant/builder"
          className="card-lift group flex min-h-[240px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed"
          style={{ borderColor: C.inkFaint, background: 'transparent' }}
        >
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
            style={{ borderColor: C.bandLine, background: C.paper }}
          >
            <div className="relative aspect-[16/10] overflow-hidden" style={{ background: C.canvas }}>
              <div className="h-full w-full origin-top-left scale-[1.01] transition-transform duration-300 group-hover:scale-[1.04]">
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
                  {rec.graph.units.length} UNITS · {rec.graph.streams.filter((s) => !s.implicit).length} STREAMS
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
