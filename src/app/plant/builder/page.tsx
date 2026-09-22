'use client';

/**
 * /plant/builder — the AI plant builder studio: BUILD, then EDIT.
 *
 * Two zones, Flow-inspired but ours: the stage (left) is the live flowsheet —
 * it assembles as the agents work and inspects like the reference plant
 * (pan, zoom, hover streams, click units); the session (right) is the chat —
 * the narrative spine of the build. The session shrinks to a rail so the
 * plant gets the attention, and the whole run lives in useAgentRun (job
 * POST + resumable SSE over Router → Architect → Engineer → Solver → Critic
 * → Docent). Engine and agent: untouched.
 *
 * THE HANDOFF LAW (task 69): this screen BUILDS and EDITS — nothing else
 * lives here. When the build passes, the header grows LEARN and OPERATE:
 * one click hands the plant to its project page (the old Learn | Operate |
 * Edit with AI home, guided tour included — the tour plays THERE, like it
 * always did), and the chat stays put and becomes EDIT WITH AI — the same
 * box, the same transcript; the next instruction edits the plant. Under
 * the input: save to library, nothing else. No tour on this screen, no
 * message bubbles after the build — the flowsheet is the product and the
 * canvas owns the attention.
 *
 * The chat panel is resizable (drag its left edge, 360px → 40% of the
 * screen, never more) and on small screens it is a 40dvh sheet, so the
 * flowsheet stage keeps the majority of the viewport in every state.
 *
 * A SAVED plant still has exactly one home — its project page; ?remix=<id>
 * links redirect there. The transcript travels with the record
 * (session.entries), so the project page's Edit tab opens this conversation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { FlowGraph } from '@/lib/engine/graph';
import { BuildCanvas, UnitInspector, type BuildCanvasHandle } from '@/components/builder/BuildCanvas';
import { SessionPanel, PHASE_COLOR, PHASE_LABEL } from '@/components/builder/SessionPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { C } from '@/lib/design/tokens';
import { getFamily } from '@/lib/families';
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
import { generateTour } from '@/lib/projects/tour';
import { useAgentRun } from '@/lib/agent/useAgentRun';

/** the chat panel's size law: at least a readable column, never more than
 *  40% of the screen — the flowsheet is the product and owns the rest */
const PANEL_MIN = 360;
const PANEL_DEFAULT = 400;
const panelMax = (): number => Math.min(window.innerWidth * 0.4, 760);

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

  // ── the resizable chat panel (desktop widths only; mobile is a sheet) ──
  const [lg, setLg] = useState(false);
  const [panelW, setPanelW] = useState(PANEL_DEFAULT);
  const [panelOpen, setPanelOpen] = useState(true);
  const panelWRef = useRef(panelW);
  useEffect(() => {
    panelWRef.current = panelW;
  }, [panelW]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setLg(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    // deferred so the stored width lands after hydration (no SSR mismatch,
    // no synchronous setState in the effect body)
    const id = requestAnimationFrame(() => {
      try {
        const w = Number(window.localStorage.getItem('fs-chat-w'));
        if (Number.isFinite(w) && w >= PANEL_MIN && w <= panelMax()) setPanelW(w);
      } catch {
        /* private mode — the default width is fine */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const startPanelResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWRef.current;
    let w = startW; // tracked locally — the state ref lags a frame behind the drag
    const move = (ev: PointerEvent) => {
      w = Math.max(PANEL_MIN, Math.min(panelMax(), startW + (startX - ev.clientX)));
      setPanelW(w);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        window.localStorage.setItem('fs-chat-w', String(Math.round(w)));
      } catch {
        /* keep the width in memory only */
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const run = useAgentRun({
    onDone: (_ev, finalGraph) => {
      canvasRef.current?.fit();
      // remix chains: the next instruction edits the LATEST graph
      if (remixSource && finalGraph) setRemixSource({ name: remixSource.name, graph: finalGraph });
    },
  });

  const graph = run.graph;

  // the relayout tool re-emits the sheet — meet it with a fresh camera fit,
  // so "straighten the lines" visibly redraws the whole drawing
  const entriesLen = run.entries.length;
  useEffect(() => {
    const last = run.entries[run.entries.length - 1];
    if (last && last.kind === 'tool' && last.tool === 'relayout') canvasRef.current?.fit();
     
  }, [entriesLen]);

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
        setSavedId(rec.id);
        setPanelOpen(true);
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
        setPanelOpen(true);
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
        setPanelOpen(true);
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
  }, [router]);

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
    setPanelOpen(true);
  }

  // save as a first-class project (IndexedDB, this browser) — one click to
  // reopen it any time from the home grid. The transcript travels with it
  // (session.entries), so the project page's Edit tab opens this chat.
  async function saveProject(): Promise<PlantRecord | null> {
    if (!run.graph) return null;
    const now = new Date().toISOString();
    // the run's first ask beats the (already-cleared) composer state
    const firstAsk = run.entries.find((e) => e.kind === 'user')?.text ?? brief;
    const rec: PlantRecord = {
      id: newPlantId(),
      name: remixSource
        ? `${remixSource.name.slice(0, 40)} — remixed`
        : firstAsk.trim().slice(0, 48) || 'Agent-built plant',
      brief: firstAsk.trim(),
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
      toast.success('Saved to library', {
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

  // THE HANDOFF LAW: a passing build saves itself the moment it lands —
  // LEARN and OPERATE in the header need a project page to hand off to,
  // and the library should hold the plant even if the tab closes
  const autoSavedRef = useRef(false);
  useEffect(() => {
    if (
      run.status === 'finished' &&
      run.doneOk === true &&
      run.graph &&
      !autoSavedRef.current &&
      !savedId
    ) {
      autoSavedRef.current = true;
      const id = window.setTimeout(() => void saveProject(), 0);
      return () => window.clearTimeout(id);
    }
     
  }, [run.status, run.doneOk, savedId]);

  const running = run.running;
  const unitCount = graph?.units.length ?? 0;
  const streamCount = graph?.streams.length ?? 0;
  const status = run.status;
  const phase = run.phase;
  const family = familyChip ?? run.family;
  const built = status === 'finished' && unitCount > 0;

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
          {/* THE HANDOFF — the build passed: Learn and Operate take the
              plant to its project page (tour included); the chat below
              becomes Edit with AI and nothing on this screen moves */}
          {built && savedId && (
            <div className="flex items-center gap-2">
              <Link
                href={`/plant/p/${savedId}`}
                className="hover-band flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold"
                style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
                title="Open the project page — the guided tour, the numbers, the story"
              >
                <BookOpen size={13} />
                Learn
              </Link>
              <Link
                href={`/plant/p/${savedId}?mode=operate`}
                className="hover-band hidden h-8 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold sm:flex"
                style={{ borderColor: 'var(--fs-band-line)', color: C.ink, background: C.paper }}
                title="Open the control room — live levers on the solved plant"
              >
                <SlidersHorizontal size={13} />
                Operate
              </Link>
            </div>
          )}
          {built && !savedId && (
            <button
              onClick={() => void saveProject()}
              className="hover-band flex h-8 items-center rounded-full border px-3.5 text-[12px] font-bold"
              style={{ borderColor: 'var(--fs-band-line)', color: C.ink, background: C.paper }}
              title="Save this plant to your library"
            >
              Save to library
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
              className="hidden rounded-full border px-3 py-1 font-mono text-[11px] font-bold sm:inline"
              style={{ color: run.doneOk ? C.nh3 : C.warn, borderColor: run.doneOk ? C.nh3 : C.warn }}
            >
              {run.doneOk ? 'BUILD OK' : 'BUILD ISSUES'}
            </span>
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

        {/* session — the chat (the one conversation: build, then edit) */}
        {panelOpen ? (
          <aside
            className="relative flex h-[40dvh] w-full shrink-0 flex-col border-t lg:h-auto lg:border-l lg:border-t-0"
            style={{
              borderColor: 'var(--fs-band-line)',
              ...(lg ? { width: panelW, maxWidth: '40vw' } : {}),
            }}
            aria-label="Build session"
          >
            {/* the resize handle — drag to widen the chat (never past 40% of
                the screen); double-click snaps back to the default column */}
            <div
              onPointerDown={startPanelResize}
              onDoubleClick={() => setPanelW(PANEL_DEFAULT)}
              className="group absolute left-0 top-0 z-20 hidden h-full w-[9px] cursor-col-resize lg:block"
              title="Drag to resize the chat · double-click to reset"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the chat panel"
            >
              <span
                className="absolute left-1/2 top-1/2 h-14 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity"
                style={{ background: 'var(--fs-band-line)', opacity: 0.9 }}
              />
            </div>
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
                onCollapse={() => setPanelOpen(false)}
                saved={saved}
                hasGraph={unitCount > 0}
                unitCount={unitCount}
                streamCount={streamCount}
                doneOk={run.doneOk}
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
                onClick={() => setPanelOpen(true)}
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
            {/* mobile reopen pill */}
            <button
              onClick={() => setPanelOpen(true)}
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
