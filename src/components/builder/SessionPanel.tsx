'use client';

/**
 * SessionPanel — the chat half of the builder studio.
 *
 * Flow-inspired, but ours: the session is the narrative spine of a build.
 * The user's brief is a chat message; agent reasoning reads like a story;
 * the engineer's tool calls collapse into quiet activity clusters (expand
 * on demand) instead of forty bubbles of noise; the solver's answer and the
 * critic's verdict land as rich cards; and when the curtain falls the
 * composer hands over to the next-move actions (zoom, save, new session).
 *
 * Pure presentation — every piece of state lives in the page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Factory,
  FlaskConical,
  RotateCcw,
  Save,
  Square,
  ZoomIn,
  Zap,
} from 'lucide-react';
import type { BuildPhase, CriticVerdict, SolveSummary } from '@/lib/agent/protocol';
import { PRESET_BRIEFS } from '@/lib/agent/protocol';
import { C } from '@/lib/design/tokens';

// ── the log model (page-owned, derived from BuildEvents) ─────────────────────

export interface LogEntry {
  key: number;
  kind: 'user' | 'phase' | 'message' | 'tool' | 'solve' | 'verdict' | 'error' | 'note';
  phase?: BuildPhase;
  label?: string;
  role?: 'architect' | 'engineer' | 'critic' | 'system';
  text?: string;
  tool?: string;
  ok?: boolean;
  seq?: number;
  solve?: SolveSummary;
  verdict?: CriticVerdict;
}

export const PHASE_LABEL: Record<BuildPhase, string> = {
  architect: 'Architect planning',
  engineer: 'Engineer building',
  solver: 'Solver verifying',
  critic: 'Critic reviewing',
  done: 'Done',
};

export const PHASE_COLOR: Record<BuildPhase, string> = {
  architect: C.feed,
  engineer: C.gas,
  solver: C.inkSoft,
  critic: C.nh3,
  done: C.nh3,
};

const ROLE_LABEL: Record<string, string> = {
  architect: 'ARCHITECT',
  engineer: 'ENGINEER',
  critic: 'CRITIC',
  system: 'SYSTEM',
};

const ROLE_COLOR: Record<string, string> = {
  architect: C.feed,
  engineer: C.gas,
  critic: C.nh3,
  system: C.inkFaint,
};

// ── chat derivation: group consecutive tool calls into activity clusters ─────

type ToolLine = { key: number; tool: string; ok: boolean; seq: number; text: string };

type Block =
  | { kind: 'user'; key: number; text: string }
  | { kind: 'phase'; key: number; phase: BuildPhase; label: string }
  | { kind: 'message'; key: number; role: 'architect' | 'engineer' | 'critic' | 'system'; text: string }
  | { kind: 'activity'; key: number; lines: ToolLine[] }
  | { kind: 'solve'; key: number; solve: SolveSummary }
  | { kind: 'verdict'; key: number; verdict: CriticVerdict }
  | { kind: 'error'; key: number; text: string }
  | { kind: 'note'; key: number; text: string };

function deriveBlocks(entries: LogEntry[]): Block[] {
  const blocks: Block[] = [];
  let pending: ToolLine[] = [];
  const flush = () => {
    if (pending.length > 0) {
      blocks.push({ kind: 'activity', key: pending[0].key, lines: pending });
      pending = [];
    }
  };
  for (const e of entries) {
    if (e.kind === 'tool') {
      pending.push({ key: e.key, tool: e.tool ?? '?', ok: e.ok !== false, seq: e.seq ?? 0, text: e.text ?? '' });
      continue;
    }
    flush();
    switch (e.kind) {
      case 'user':
        blocks.push({ kind: 'user', key: e.key, text: e.text ?? '' });
        break;
      case 'phase':
        blocks.push({ kind: 'phase', key: e.key, phase: e.phase ?? 'done', label: e.label ?? '' });
        break;
      case 'message':
        blocks.push({ kind: 'message', key: e.key, role: e.role ?? 'system', text: e.text ?? '' });
        break;
      case 'solve':
        if (e.solve) blocks.push({ kind: 'solve', key: e.key, solve: e.solve });
        break;
      case 'verdict':
        if (e.verdict) blocks.push({ kind: 'verdict', key: e.key, verdict: e.verdict });
        break;
      case 'error':
        blocks.push({ kind: 'error', key: e.key, text: e.text ?? '' });
        break;
      default:
        blocks.push({ kind: 'note', key: e.key, text: e.text ?? '' });
    }
  }
  flush();
  return blocks;
}

// ── small pieces ──────────────────────────────────────────────────────────────

function PhaseRow({ phase, label }: { phase: BuildPhase; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-3" role="separator">
      <div className="h-px flex-1" style={{ background: 'var(--fs-band-line)' }} />
      <span className="font-mono text-[10px] font-extrabold tracking-[0.18em]" style={{ color: PHASE_COLOR[phase] }}>
        {phase.toUpperCase()}
      </span>
      <span className="max-w-[45%] truncate text-[10px]" style={{ color: C.inkFaint }}>
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: 'var(--fs-band-line)' }} />
    </div>
  );
}

function AgentMessage({ role, text }: { role: 'architect' | 'engineer' | 'critic' | 'system'; text: string }) {
  return (
    <div className="bd-msg-in">
      <div className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: ROLE_COLOR[role] }}>
        {ROLE_LABEL[role] ?? 'AGENT'}
      </div>
      <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: C.ink }}>
        {text}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="bd-msg-in flex flex-col items-end">
      <div className="mb-1 font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.inkFaint }}>
        YOU
      </div>
      <div
        className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={{ background: C.band, color: C.ink }}
      >
        {text}
      </div>
    </div>
  );
}

function NoteLine({ text }: { text: string }) {
  return (
    <div className="bd-msg-in text-center text-[11.5px] leading-relaxed" style={{ color: C.inkFaint }}>
      {text}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <div
      className="bd-msg-in rounded-xl border px-3 py-2 text-[12.5px] leading-relaxed"
      style={{ background: 'var(--fs-band)', borderColor: C.warn, color: C.warn }}
      role="alert"
    >
      {text}
    </div>
  );
}

/** the engineer's work, quiet by default — a cluster of tool lines */
function ActivityCluster({ lines, live }: { lines: ToolLine[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  const failed = lines.some((l) => !l.ok);
  const collapsible = lines.length > 4;
  const shown = collapsible && !open ? lines.slice(-2) : lines;
  return (
    <div className="bd-msg-in rounded-xl border" style={{ borderColor: 'var(--fs-band-line)' }}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: 'var(--fs-band-line)' }}>
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: failed ? C.warn : C.gas, ...(live ? { animation: 'bd-pulse-kf 1.1s ease-in-out infinite' } : {}) }}
        />
        <span className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.inkSoft }}>
          ENGINEER
        </span>
        <span className="font-mono text-[10px]" style={{ color: C.inkFaint }}>
          {lines.length} action{lines.length === 1 ? '' : 's'}
          {failed ? ` · ${lines.filter((l) => !l.ok).length} flagged` : ''}
        </span>
        {collapsible && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="hover-band ml-auto rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ color: C.inkSoft }}
          >
            {open ? 'show less' : 'show all'}
          </button>
        )}
      </div>
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto px-3 py-1.5">
        {shown.map((l) => (
          <div key={l.key} className="flex items-baseline gap-2" title={l.text}>
            <span className="font-mono text-[10px] font-bold" style={{ color: l.ok ? C.inkFaint : C.warn }}>
              {l.tool}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px]" style={{ color: l.ok ? C.inkSoft : C.warn }}>
              {l.text}
            </span>
          </div>
        ))}
        {collapsible && !open && (
          <div className="font-mono text-[10px]" style={{ color: C.inkFaint }}>
            + {lines.length - 2} earlier action{lines.length - 2 === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  );
}

/** the solver's answer, as a compact result card */
function SolveCard({ solve }: { solve: SolveSummary }) {
  const k = solve.kpis;
  const rows = [
    { label: 'Production', value: `${k.productionTpd.toFixed(1)} t/d` },
    { label: 'Purity', value: `${(k.productPurityWt * 100).toFixed(2)} wt %` },
    { label: 'Per-pass', value: `${(k.perPassConv * 100).toFixed(1)} %` },
    { label: 'H2/N2', value: k.h2n2Ratio.toFixed(3) },
    { label: 'Loop inerts', value: `${(k.loopInerts * 100).toFixed(1)} %` },
    { label: 'Spec. energy', value: `${k.specificEnergyGJt.toFixed(2)} GJ/t` },
  ];
  return (
    <div className="bd-msg-in rounded-xl border px-3 py-2.5" style={{ background: C.paper, borderColor: 'var(--fs-band-line)' }}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.nh3 }}>
          PLANT ANSWER
        </span>
        <span
          className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold"
          style={{ color: solve.converged ? C.nh3 : C.warn, borderColor: solve.converged ? C.nh3 : C.warn }}
        >
          {solve.converged ? `converged · ${solve.iterations} it` : 'not converged'}
        </span>
        <span className="ml-auto font-mono text-[10px]" style={{ color: C.inkFaint }}>
          {solve.solveMs.toFixed(0)} ms
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>
              {r.label}
            </div>
            <div className="font-mono text-[12.5px] font-bold" style={{ color: C.ink }}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
      {solve.warnings.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5 border-t pt-1.5" style={{ borderColor: 'var(--fs-band-line)' }}>
          {solve.warnings.map((w, i) => (
            <div key={i} className="text-[11px] leading-snug" style={{ color: C.warn }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** the critic's verdict */
function VerdictCard({ verdict }: { verdict: CriticVerdict }) {
  const color = verdict.verdict === 'pass' ? C.nh3 : verdict.verdict === 'revise' ? C.warn : '#B3452F';
  return (
    <div
      className="bd-msg-in rounded-xl border px-3 py-2.5"
      style={{ background: C.paper, borderColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.inkSoft }}>
          CRITIC VERDICT
        </span>
        <span
          className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase"
          style={{ color, borderColor: color }}
        >
          {verdict.verdict}
        </span>
        <span className="ml-auto font-mono text-[13px] font-extrabold" style={{ color }}>
          {verdict.score}
          <span className="text-[9px] font-bold" style={{ color: C.inkFaint }}>
            /100
          </span>
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: C.ink }}>
        {verdict.summary}
      </p>
      {verdict.strengths.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5">
          {verdict.strengths.map((s, i) => (
            <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
              <span style={{ color: C.nh3 }}>+</span>
              {s}
            </li>
          ))}
        </ul>
      )}
      {verdict.issues.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {verdict.issues.map((s, i) => (
            <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
              <span style={{ color: C.warn }}>!</span>
              {s}
            </li>
          ))}
        </ul>
      )}
      {verdict.suggestions.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {verdict.suggestions.map((s, i) => (
            <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug" style={{ color: C.inkFaint }}>
              <span>→</span>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── the panel ─────────────────────────────────────────────────────────────────

export interface SessionPanelProps {
  entries: LogEntry[];
  status: 'idle' | 'running' | 'finished';
  phase: BuildPhase | null;
  brief: string;
  onBriefChange: (v: string) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSave: () => void;
  onZoomIn: () => void;
  onCollapse: () => void;
  saved: boolean;
  hasGraph: boolean;
  unitCount: number;
  streamCount: number;
  doneOk: boolean | null;
}

const CARD_ICONS = [Factory, FlaskConical, Zap];
const CARD_HUES = [C.feed, C.gas, C.nh3];

export function SessionPanel({
  entries,
  status,
  phase,
  brief,
  onBriefChange,
  onStart,
  onStop,
  onReset,
  onSave,
  onZoomIn,
  onCollapse,
  saved,
  hasGraph,
  unitCount,
  streamCount,
  doneOk,
}: SessionPanelProps) {
  const blocks = useMemo(() => deriveBlocks(entries), [entries]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pinnedRef = useRef(true);
  const [jump, setJump] = useState(false);
  const running = status === 'running';
  const idle = status === 'idle';

  // keep the transcript pinned to the latest — unless the reader scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [entries.length, status]);

  // composer autosize
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [brief, status]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    pinnedRef.current = pinned;
    setJump(!pinned);
  };

  const sessionTitle = idle
    ? 'Untitled session'
    : brief.trim().length > 0
      ? `${brief.trim().slice(0, 44)}${brief.trim().length > 44 ? '…' : ''}`
      : 'Agent-built plant';

  const sub = running
    ? `${PHASE_LABEL[phase ?? 'engineer']} · ${unitCount} unit${unitCount === 1 ? '' : 's'} · ${streamCount} stream${streamCount === 1 ? '' : 's'}`
    : status === 'finished'
      ? doneOk === true
        ? 'build passed the critic'
        : doneOk === false
          ? 'build finished with issues'
          : 'session restored from the library'
      : 'architect · engineer · solver · critic';

  return (
    <div className="flex h-full w-full flex-col" style={{ background: C.paper }}>
      {/* session header */}
      <header
        className="flex h-[54px] shrink-0 items-center gap-2.5 border-b px-3 sm:px-4"
        style={{ borderColor: 'var(--fs-band-line)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold leading-tight" style={{ color: idle ? C.inkFaint : C.ink }}>
            {sessionTitle}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] leading-tight" style={{ color: C.inkSoft }}>
            {running && <span className="bd-pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: phase ? PHASE_COLOR[phase] : C.gas }} />}
            <span className="truncate">{sub}</span>
          </div>
        </div>
        <button
          onClick={onCollapse}
          aria-label="Shrink the session panel"
          title="Shrink the session panel"
          className="hover-band flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
        >
          <ChevronLeft size={16} />
        </button>
      </header>

      {/* transcript / empty state */}
      {blocks.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-5">
          <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
            What would you like to build?
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
            Describe an ammonia plant in plain words. An architect plans it, an engineer wires it, the solver
            verifies it, and a critic scores it — the flowsheet assembles live on the canvas.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {PRESET_BRIEFS.map((p, i) => {
              const Icon = CARD_ICONS[i % CARD_ICONS.length];
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    onBriefChange(p.text);
                    taRef.current?.focus();
                  }}
                  className="card-lift group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left"
                  style={{ background: C.paper, borderColor: 'var(--fs-band-line)' }}
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                    style={{ borderColor: 'var(--fs-band-line)', color: CARD_HUES[i % CARD_HUES.length] }}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold" style={{ color: C.ink }}>
                      {p.label}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
                      {p.text}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: C.inkFaint }}
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-auto pt-5 text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>
            The engineer works through the engine&apos;s tool surface — every unit it places appears on the canvas
            the moment it is wired.
          </p>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-3 sm:px-5" style={{ background: C.canvas }}>
            <div className="flex flex-col gap-3 pb-2">
              {blocks.map((b, i) => {
                const live = running && i === blocks.length - 1;
                switch (b.kind) {
                  case 'user':
                    return <UserMessage key={b.key} text={b.text} />;
                  case 'phase':
                    return <PhaseRow key={b.key} phase={b.phase} label={b.label} />;
                  case 'message':
                    return <AgentMessage key={b.key} role={b.role} text={b.text} />;
                  case 'activity':
                    return <ActivityCluster key={b.key} lines={b.lines} live={live} />;
                  case 'solve':
                    return <SolveCard key={b.key} solve={b.solve} />;
                  case 'verdict':
                    return <VerdictCard key={b.key} verdict={b.verdict} />;
                  case 'error':
                    return <ErrorCard key={b.key} text={b.text} />;
                  default:
                    return <NoteLine key={b.key} text={b.text} />;
                }
              })}
              {running && (
                <div className="flex items-center gap-2 px-1">
                  <span className="bd-pulse inline-block h-2 w-2 rounded-full" style={{ background: C.gas }} />
                  <span className="text-[11px]" style={{ color: C.inkFaint }}>
                    working…
                  </span>
                </div>
              )}
            </div>
          </div>
          {jump && (
            <button
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
              }}
              className="hover-band absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-bold shadow-sm"
              style={{ background: C.paper, borderColor: 'var(--fs-band-line)', color: C.ink }}
            >
              ↓ latest
            </button>
          )}
        </div>
      )}

      {/* composer — three honest states */}
      <div className="shrink-0 border-t px-3 py-3 sm:px-4" style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}>
        {idle ? (
          <div
            className="rounded-2xl border transition-[box-shadow] focus-within:ring-2"
            style={{ borderColor: 'var(--fs-band-line)', background: C.canvas }}
          >
            <textarea
              ref={taRef}
              value={brief}
              onChange={(e) => onBriefChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (brief.trim()) onStart();
                }
              }}
              rows={2}
              placeholder="Describe the plant to build — units, targets, constraints…"
              aria-label="Design brief"
              className="w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] leading-relaxed outline-none placeholder:opacity-70"
              style={{ color: C.ink }}
            />
            <div className="flex items-center gap-2 px-2.5 pb-2.5">
              <span className="hidden text-[10px] sm:block" style={{ color: C.inkFaint }}>
                Enter to build · Shift+Enter for a new line
              </span>
              <button
                onClick={onStart}
                disabled={!brief.trim()}
                aria-label="Start the build"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl transition-opacity disabled:opacity-35"
                style={{ background: C.ink, color: C.paper }}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : running ? (
          <div className="flex items-center gap-3">
            <span className="bd-pulse inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: phase ? PHASE_COLOR[phase] : C.gas }} />
            <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: C.inkSoft }}>
              {PHASE_LABEL[phase ?? 'engineer']} — {unitCount} unit{unitCount === 1 ? '' : 's'} · {streamCount} stream{streamCount === 1 ? '' : 's'} placed
            </span>
            <button
              onClick={onStop}
              className="hover-band flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold"
              style={{ color: C.warn, borderColor: C.warn }}
            >
              <Square size={11} strokeWidth={3} />
              Stop
            </button>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onZoomIn}
                disabled={!hasGraph}
                className="hover-band flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-40"
                style={{ color: C.ink, borderColor: 'var(--fs-band-line)' }}
              >
                <ZoomIn size={13} />
                Zoom in
              </button>
              <button
                onClick={onSave}
                disabled={!hasGraph || saved}
                className="hover-band flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-60"
                style={{ color: saved ? C.nh3 : C.ink, borderColor: saved ? C.nh3 : 'var(--fs-band-line)' }}
              >
                <Save size={13} />
                {saved ? 'Saved ✓' : 'Save to library'}
              </button>
              <button
                onClick={onReset}
                className="hover-band ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold"
                style={{ background: C.ink, color: C.paper }}
              >
                <RotateCcw size={13} />
                New session
              </button>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: C.inkFaint }}>
              Inspect the finished flowsheet like the reference plant — hover streams for live values, click units
              for their specs. Editing a plant mid-conversation arrives in the next phase.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
