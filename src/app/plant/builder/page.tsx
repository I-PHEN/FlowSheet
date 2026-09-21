'use client';

/**
 * /plant/builder — the AI plant builder studio.
 *
 * Two zones, Flow-inspired but ours: the stage (left) is the live flowsheet —
 * it assembles as the agents work and inspects like the reference plant
 * (pan, zoom, hover streams, click units); the session (right) is the chat —
 * the narrative spine of the build. The session shrinks to a rail so the
 * plant gets the attention, and the whole run lives in useAgentRun (job
 * POST + resumable SSE over Router → Architect → Engineer → Solver → Critic
 * → Docent). Engine and agent: untouched.
 *
 * The builder is the home of FRESH builds and reference remixes. A SAVED
 * plant is edited in place on its own project page (Learn | Operate | Edit
 * with AI) — ?remix=<savedId> links are redirected there, so no plant ever
 * has two homes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { FlowGraph } from '@/lib/engine/graph';
import { BuildCanvas, UnitInspector, type BuildCanvasHandle } from '@/components/builder/BuildCanvas';
import { SessionPanel, PHASE_COLOR, PHASE_LABEL } from '@/components/builder/SessionPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { C } from '@/lib/design/tokens';
import { isFamilyId, getFamily } from '@/lib/families';
// (isFamilyId kept for future family chips on general builds)
import {
  getPlant,
  findLegacyBySlug,
  putPlant,
} from '@/lib/projects/store';
import {
  getOwnerId,
  newPlantId,
  PLANT_SCHEMA_VERSION,
  type PlantRecord,
} from '@/lib/projects/record';
import { useAgentRun } from '@/lib/agent/useAgentRun';

export default function BuilderPage() {
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [familyChip, setFamilyChip] = useState<{ id: string; label: string } | null>(null);
  // remix mode (?remix=reference): the family reference graph is loaded on
  // the canvas and the composer sends CHANGE instructions, not build briefs.
  // (saved plants redirect to their project page — they edit in place there)
  const [remixSource, setRemixSource] = useState<{ name: string; graph: FlowGraph } | null>(null);
  const canvasRef = useRef<BuildCanvasHandle>(null);

  const run = useAgentRun({
    onDone: (_ev, finalGraph) => {
      canvasRef.current?.fit();
      // remix chains: the next instruction edits the LATEST graph
      if (remixSource && finalGraph) setRemixSource({ name: remixSource.name, graph: finalGraph });
    },
  });

  // restore a project (?load=id reads the IndexedDB store, then falls back
  // to the legacy localStorage slug) — client-only
  useEffect(() => {
    const loadId = new URLSearchParams(window.location.search).get('load');
    if (!loadId) return;
    let alive = true;
    void (async () => {
      const rec = await getPlant(loadId);
      if (!alive) return;
      if (rec) {
        setBrief(rec.brief);
        run.restore({
          brief: rec.brief,
          graph: rec.graph,
          verdict: rec.verdict,
          kpis: rec.kpis,
          name: rec.name,
        });
        setSaved(true);
        setChatOpen(true);
        return;
      }
      // pre-migration links still work
      const legacy = findLegacyBySlug(loadId);
      if (legacy) {
        setBrief(legacy.brief);
        run.restore({
          brief: legacy.brief,
          graph: legacy.graph,
          verdict: legacy.verdict,
          kpis: legacy.kpis,
          name: legacy.name,
        });
        setSaved(true);
        setChatOpen(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // remix entry (?remix=reference → the ammonia family's reference graph;
  // ?remix=<savedId> → that plant's project page, where editing lives now)
  useEffect(() => {
    const remixId = new URLSearchParams(window.location.search).get('remix');
    if (!remixId) return;
    let alive = true;
    void (async () => {
      if (remixId === 'reference') {
        const fam = getFamily('ammonia');
        if (!alive) return;
        setRemixSource({ name: 'The reference plant', graph: fam.referenceGraph() });
        setFamilyChip({ id: 'ammonia', label: `${fam.name} — ${fam.route}` });
        setChatOpen(true);
        return;
      }
      // a saved plant: its project page is the one home — edit mode lives there
      const rec = await getPlant(remixId);
      if (!alive) return;
      if (rec) {
        router.replace(`/plant/p/${rec.id}`);
      }
      // unknown id: fall through to a plain fresh-build session
    })();
    return () => {
      alive = false;
    };
  }, []);

  const startBuild = useCallback(() => {
    void run.start(brief, remixSource?.graph ?? null);
  }, [run, brief, remixSource]);

  const stopBuild = useCallback(() => run.stop(), [run]);

  function resetToIdle() {
    run.reset(remixSource?.graph ?? null);
    setChatOpen(true);
  }

  // save as a first-class project (IndexedDB, this browser) — one click to
  // reopen it any time from the home grid
  async function saveProject(): Promise<PlantRecord | null> {
    const graph = run.graph;
    if (!graph) return null;
    const now = new Date().toISOString();
    const rec: PlantRecord = {
      id: newPlantId(),
      name: remixSource
        ? `${remixSource.name.slice(0, 40)} — remixed`
        : brief.trim().slice(0, 48) || 'Agent-built plant',
      brief: brief.trim(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: PLANT_SCHEMA_VERSION,
      ownerId: getOwnerId(),
      graph,
      kpis: run.solve?.kpis ?? null,
      verdict: run.verdict,
      productionTpd: run.solve?.kpis.productionTpd ?? null,
      source: 'user',
      family: run.family?.id ?? graph.family,
      tour: run.tour,
    };
    try {
      await putPlant(rec);
      setSaved(true);
      setSavedId(rec.id);
      toast.success('Project saved', {
        action: {
          label: 'Open',
          onClick: () => {
            window.location.href = `/plant/p/${rec.id}`;
          },
        },
      });
      return rec;
    } catch {
      run.note('Could not save in this browser (storage unavailable).');
      return null;
    }
  }

  // save (if needed) and jump to the project page where the tour player
  // lives — voice, music, spotlight, step controls
  async function takeTour() {
    if (!run.graph) return;
    let id = savedId;
    if (!id) {
      const rec = await saveProject();
      id = rec?.id ?? null;
    }
    if (id) window.location.href = `/plant/p/${id}`;
  }

  const running = run.running;
  const graph = run.graph;
  const unitCount = graph?.units.length ?? 0;
  const streamCount = graph?.streams.length ?? 0;
  const status = run.status;
  const phase = run.phase;
  const family = familyChip ?? run.family;

  return (
    <div className="flex h-dvh flex-col" style={{ background: C.canvas }}>
      {/* header */}
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b px-3 sm:px-4" style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}>
        <Link href="/" className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border text-[14px] font-bold" style={{ color: C.ink }} title="Back to library">
          ←
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold leading-tight" style={{ color: C.ink }}>
              AI Plant Builder
            </span>
            {remixSource && (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em] sm:inline"
                style={{ borderColor: C.utility, color: C.utility }}
                title={`Editing ${remixSource.name}`}
              >
                EDITING · {remixSource.name.slice(0, 24).toUpperCase()}
              </span>
            )}
            {family && !remixSource && (
              <span
                className="hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-[0.12em] sm:inline"
                style={{ borderColor: C.nh3, color: C.nh3 }}
                title={family.label}
              >
                {family.id === 'general' ? 'GENERAL BUILD' : `${family.label.split(' — ')[0].toUpperCase()} FAMILY`}
              </span>
            )}
          </div>
          <div className="hidden truncate text-[11px] leading-tight sm:block" style={{ color: C.inkSoft }}>
            {remixSource
              ? `editing: ${remixSource.name} · ${unitCount} units`
              : unitCount > 0
                ? `${unitCount} units · ${streamCount} streams`
                : 'describe the plant — the agents build it'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status === 'finished' && run.tour && graph && (
            <button
              onClick={() => void takeTour()}
              className="hidden items-center rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold sm:flex"
              style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
              title="Save the plant and play the docent's guided tour — voice and music"
            >
              ▶ Take the tour
            </button>
          )}
          {phase && status !== 'idle' && (
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold"
              style={{ color: PHASE_COLOR[phase], borderColor: 'var(--fs-band-line)', background: C.paper }}
            >
              {running && <span className="bd-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: PHASE_COLOR[phase] }} />}
              {PHASE_LABEL[phase]}
            </span>
          )}
          {status === 'finished' && run.doneOk !== null && (
            <span
              className="rounded-full border px-3 py-1 font-mono text-[11px] font-bold"
              style={{ color: run.doneOk ? C.nh3 : C.warn, borderColor: run.doneOk ? C.nh3 : C.warn }}
            >
              {run.doneOk ? 'BUILD OK' : 'BUILD ISSUES'}
            </span>
          )}
          {savedId && (
            <Link
              href={`/plant/p/${savedId}`}
              className="hidden items-center rounded-full border px-3 py-1 text-[11.5px] font-bold sm:flex"
              style={{ borderColor: C.bandLine, color: C.ink, background: C.paper }}
              title="Open the saved project"
            >
              Open project →
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* the studio: stage + session */}
      <main className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* stage */}
        <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Live flowsheet stage">
          <div className="min-h-0 flex-1">
            <BuildCanvas
              ref={canvasRef}
              graph={graph}
              selected={selected}
              warm={status === 'finished'}
              onUnitClick={(id) => setSelected((cur) => (cur === id ? null : id))}
              onBackgroundClick={() => setSelected(null)}
            />
          </div>
          {unitCount > 0 && (
            <div
              className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.14em]"
              style={{ background: 'var(--fs-paper-a95)', borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
            >
              LIVE FLOWSHEET · {unitCount} UNITS · {streamCount} STREAMS
            </div>
          )}
          {graph && selected && <UnitInspector graph={graph} unitId={selected} onClose={() => setSelected(null)} />}
        </section>

        {/* session — the chat */}
        {chatOpen ? (
          <aside
            className="flex h-[56dvh] w-full shrink-0 flex-col border-t lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0"
            style={{ borderColor: 'var(--fs-band-line)' }}
            aria-label="Build session"
          >
            <SessionPanel
              entries={run.entries}
              status={status}
              phase={phase}
              brief={brief}
              onBriefChange={setBrief}
              onStart={startBuild}
              onStop={stopBuild}
              onReset={resetToIdle}
              onSave={() => void saveProject()}
              onZoomIn={() => {
                setChatOpen(false);
                canvasRef.current?.fit();
              }}
              onCollapse={() => setChatOpen(false)}
              saved={saved}
              hasGraph={unitCount > 0}
              unitCount={unitCount}
              streamCount={streamCount}
              doneOk={run.doneOk}
              tourReady={run.tour !== null && status === 'finished'}
              onTakeTour={() => void takeTour()}
              remixName={remixSource?.name ?? null}
            />
          </aside>
        ) : (
          <>
            {/* desktop rail */}
            <aside
              className="hidden w-[52px] shrink-0 flex-col items-center gap-3 border-l py-3 lg:flex"
              style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}
              aria-label="Session, collapsed"
            >
              <button
                onClick={() => setChatOpen(true)}
                aria-label="Open the session panel"
                title="Open the session panel"
                className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: 'var(--fs-band-line)', color: C.ink }}
              >
                <ChevronRight size={16} />
              </button>
              <div className="flex flex-col items-center gap-2 pt-1">
                {running && (
                  <span
                    className="bd-pulse inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: phase ? PHASE_COLOR[phase] : C.gas }}
                  />
                )}
                <span
                  className="font-mono text-[10px] font-extrabold tracking-[0.22em]"
                  style={{ color: C.inkSoft, writingMode: 'vertical-rl' }}
                >
                  SESSION
                </span>
              </div>
            </aside>
            {/* mobile reopen pill — raised above the canvas legend */}
            <button
              onClick={() => setChatOpen(true)}
              className="hover-band fixed bottom-16 right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-bold shadow-lg lg:hidden"
              style={{ background: C.paper, borderColor: 'var(--fs-band-line)', color: C.ink }}
            >
              {running && (
                <span
                  className="bd-pulse inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: phase ? PHASE_COLOR[phase] : C.gas }}
                />
              )}
              Session
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </main>
    </div>
  );
}
