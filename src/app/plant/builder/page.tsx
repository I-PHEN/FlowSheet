'use client';

/**
 * /plant/builder — the AI plant builder studio, start to finish.
 *
 * Two zones, Flow-inspired but ours: the stage (left) is the live flowsheet —
 * it assembles as the agents work and inspects like the reference plant
 * (pan, zoom, hover streams, click units); the session (right) is the chat —
 * the narrative spine of the build. The session shrinks to a rail so the
 * plant gets the attention, and the whole run lives in useAgentRun (job
 * POST + resumable SSE over Router → Architect → Engineer → Solver → Critic
 * → Docent). Engine and agent: untouched.
 *
 * THE ONE CONVERSATION LAW (owner's law, task 64): build → tour → edit is
 * ONE experience on THIS screen. The tour plays right here — the same
 * cinema stack the project page runs (director + CinemaBar + roam), so
 * "Take the tour" never navigates away; when it ends the session panel
 * comes back exactly where it was. And the composer never stops being an
 * input: once anything is on the table, the next instruction EDITS the
 * plant (the run chains in the same transcript) — edit-with-AI is not a
 * different screen, it is this chat continuing.
 *
 * A SAVED plant still has exactly one home — its project page
 * (Learn | Operate | Edit with AI); ?remix=<savedId> links redirect there.
 * The transcript travels with the record (session.entries), so the project
 * page's Edit tab opens this very conversation.
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
import { CinemaBar } from '@/components/learn/CinemaBar';
import { TourIndex } from '@/components/learn/TourIndex';
import { useTourDirector } from '@/lib/ui/tourDirector';
import { useCinemaPanel } from '@/lib/ui/useCinemaPanel';
import { unlockAudio } from '@/lib/audio/tourAudio';
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
import { generateTour, roamStep } from '@/lib/projects/tour';
import { useAgentRun } from '@/lib/agent/useAgentRun';

export default function BuilderPage() {
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
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

  const graph = run.graph;

  // ── the tour plays HERE (the one conversation law) ──────────────────────
  // The same cinema stack the project page runs: free-roam captions for
  // units without an authored stop are synthesized from registry facts.
  const synthesize = useCallback(
    (ref: { type: 'unit' | 'stream'; id: string }): { title: string; text: string } | null => {
      if (!graph || ref.type !== 'unit') return null;
      return roamStep(graph, ref.id);
    },
    [graph],
  );
  const director = useTourDirector(synthesize);
  const touring = director.tour !== null;

  // camera choreography: the director emits intents, this canvas executes
  useEffect(() => {
    const cam = director.cam;
    if (!cam) return;
    if (cam.kind === 'fit') canvasRef.current?.fit();
    else canvasRef.current?.flyToRef(cam.ref);
  }, [director.cam]);

  // tours collapse the panel for a full-screen view; an untouched panel
  // returns when the tour ends — the chat is never more than a pin away
  const { showPanel, openPanel } = useCinemaPanel(touring);

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
          tour: rec.tour ?? generateTour(rec),
        });
        // the saved transcript beats the summary — the conversation
        // continues exactly where the builder left it
        if (rec.session && rec.session.entries.length > 0) run.seedEntries(rec.session.entries);
        setSaved(true);
        openPanel(true);
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
        openPanel(true);
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
        openPanel(true);
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

  // THE ONE CONVERSATION LAW: once anything is on the table, the next
  // instruction EDITS it — one composer, one transcript, build and edit
  // are the same act
  const startBuild = useCallback(() => {
    const onTable = run.graph ?? remixSource?.graph ?? null;
    void run.start(brief, onTable);
    setBrief('');
  }, [run, brief, remixSource]);

  const stopBuild = useCallback(() => run.stop(), [run]);

  function resetToIdle() {
    run.reset(remixSource?.graph ?? null);
    setBrief('');
    openPanel(true);
  }

  // save as a first-class project (IndexedDB, this browser) — one click to
  // reopen it any time from the home grid. The transcript travels with it
  // (session.entries), so the project page's Edit tab opens this chat.
  async function saveProject(): Promise<PlantRecord | null> {
    if (!run.graph) return null;
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
      graph: run.graph,
      kpis: run.solve?.kpis ?? null,
      verdict: run.verdict,
      productionTpd: run.solve?.kpis.productionTpd ?? null,
      source: 'user',
      family: run.family?.id ?? run.graph.family,
      tour: run.tour,
      session: { entries: run.entries },
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

  // THE ONE CONVERSATION LAW: the tour plays HERE. The plant is saved first
  // (so it lands in the library even if the tab closes), then the docent's
  // tour runs on this very stage; when it ends the session panel returns
  // with the whole conversation — it never looked like you left.
  async function takeTour() {
    const t = run.tour;
    if (!run.graph || !t) return;
    unlockAudio(); // the click is the gesture — unlock before any await
    if (!savedId) await saveProject();
    setSelected(null);
    director.start(t);
  }

  const running = run.running;
  const unitCount = graph?.units.length ?? 0;
  const streamCount = graph?.streams.length ?? 0;
  const status = run.status;
  const phase = run.phase;
  const family = familyChip ?? run.family;
  const spotlightUnit =
    touring && director.stop && director.stop.ref.type === 'unit' ? director.stop.ref.id : selected;

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
          {status === 'finished' && run.tour && graph && !touring && (
            <button
              onClick={() => void takeTour()}
              className="hidden items-center rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold sm:flex"
              style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
              title="Play the docent's guided tour — voice and music, right here"
            >
              ▶ Take the tour
            </button>
          )}
          {phase && status !== 'idle' && !touring && (
            <span
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold"
              style={{ color: PHASE_COLOR[phase], borderColor: 'var(--fs-band-line)', background: C.paper }}
            >
              {running && <span className="bd-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: PHASE_COLOR[phase] }} />}
              {PHASE_LABEL[phase]}
            </span>
          )}
          {status === 'finished' && run.doneOk !== null && !touring && (
            <span
              className="rounded-full border px-3 py-1 font-mono text-[11px] font-bold"
              style={{ color: run.doneOk ? C.nh3 : C.warn, borderColor: run.doneOk ? C.nh3 : C.warn }}
            >
              {run.doneOk ? 'BUILD OK' : 'BUILD ISSUES'}
            </span>
          )}
          {savedId && !touring && (
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
          <div className="relative min-h-0 flex-1">
            <BuildCanvas
              ref={canvasRef}
              graph={graph}
              selected={spotlightUnit}
              warm={status === 'finished'}
              onUnitClick={(id) => {
                if (touring) {
                  // a click during a tour = free roam: fly there, caption, pause
                  director.roamTo({ type: 'unit', id });
                  return;
                }
                setSelected((cur) => (cur === id ? null : id));
              }}
              onBackgroundClick={() => setSelected(null)}
            />
            {/* the tour lives on the stage — same cinema as the project page */}
            <CinemaBar director={director} />
          </div>
          {unitCount > 0 && (
            <div
              className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border px-3 py-1 font-mono text-[10px] font-extrabold tracking-[0.14em]"
              style={{ background: 'var(--fs-paper-a95)', borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
            >
              LIVE FLOWSHEET · {unitCount} UNITS · {streamCount} STREAMS
            </div>
          )}
          {graph && selected && !touring && <UnitInspector graph={graph} unitId={selected} onClose={() => setSelected(null)} />}
        </section>

        {/* session — the chat (the one conversation: build, tour, edit) */}
        {showPanel ? (
          <aside
            className="flex h-[56dvh] w-full shrink-0 flex-col border-t lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0"
            style={{ borderColor: 'var(--fs-band-line)' }}
            aria-label="Build session"
          >
            {touring && (
              <div className="max-h-[38%] shrink-0 overflow-y-auto border-b p-3" style={{ borderColor: 'var(--fs-band-line)' }}>
                <TourIndex director={director} />
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col">
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
                  openPanel(false);
                  canvasRef.current?.fit();
                }}
                onCollapse={() => openPanel(false)}
                saved={saved}
                hasGraph={unitCount > 0}
                unitCount={unitCount}
                streamCount={streamCount}
                doneOk={run.doneOk}
                tourReady={run.tour !== null && status === 'finished'}
                onTakeTour={() => void takeTour()}
                remixName={remixSource?.name ?? null}
              />
            </div>
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
                onClick={() => openPanel(true)}
                aria-label="Open the session panel"
                title="Open the session panel"
                className="hover-band flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: 'var(--fs-band-line)', color: C.ink }}
              >
                <ChevronRight size={16} />
              </button>
              <div className="flex flex-col items-center gap-2 pt-1">
                {(running || touring) && (
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
            {/* mobile reopen pill — raised above the canvas legend; during a
                tour it doubles as the "pin the chat" affordance */}
            <button
              onClick={() => openPanel(true)}
              className="hover-band fixed bottom-16 right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-bold shadow-lg lg:hidden"
              style={{ background: C.paper, borderColor: 'var(--fs-band-line)', color: C.ink }}
            >
              {(running || touring) && (
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
