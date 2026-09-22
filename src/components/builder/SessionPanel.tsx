'use client';

/**
 * SessionPanel — the chat half of the builder studio.
 *
 * THE QUIET CHAT LAW: one run = THREE bubbles. The student's brief is a
 * chat message; ONE "agent work" card per run carries all the thinking
 * (each phase a collapsible section inside, collapsing to a one-line
 * summary when the run's outputs land, token ledger as a footnote in the
 * detail); ONE answer card merges the critic's verdict with the solver's
 * numbers; errors and true system notes stay as their own lines. THE ONE
 * CONVERSATION LAW: runs chain — build, tour, and edit share one transcript
 * (a run = one YOU bubble + one work card + one answer card, repeating),
 * and after a run the composer STAYS an input: the same box that built
 * the plant takes the next change — edit-with-AI is not a different
 * screen, it is this chat continuing. The empty state is the on-ramp:
 * family presets, an "I don't know what to build" region picker, and
 * surprise briefs.
 *
 * Pure presentation — every piece of state lives in the page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Factory,
  FlaskConical,
  HelpCircle,
  MapPin,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  ZoomIn,
  Zap,
} from 'lucide-react';
import type { BuildPhase, CriticVerdict, LogEntry, RunUsage, SolveSummary } from '@/lib/agent/protocol';
import { FAMILIES } from '@/lib/families';
import { REGIONS, SURPRISE_BRIEFS, type RegionEntry } from '@/lib/content/regions';
import { C } from '@/lib/design/tokens';

// ── the log model (page-owned, derived from BuildEvents) ─────────────────────
// LogEntry lives in the agent protocol — one type shared by the run hook,
// this panel, and the plant record's saved session.

export const PHASE_LABEL: Record<BuildPhase, string> = {
  architect: 'Architect planning',
  engineer: 'Engineer building',
  solver: 'Solver verifying',
  critic: 'Critic reviewing',
  docent: 'Docent writing tour',
  done: 'Done',
};

/** phase colors — the control-room discipline: steel = the crew at work,
 * accent = complete. Agent identity is carried by the LABEL, not a hue;
 * color on this rail means state, never personality. */
export const PHASE_COLOR: Record<BuildPhase, string> = {
  architect: C.gas,
  engineer: C.gas,
  solver: C.gas,
  critic: C.gas,
  docent: C.gas,
  done: C.ink,
};

const ROLE_LABEL: Record<string, string> = {
  architect: 'ARCHITECT',
  engineer: 'ENGINEER',
  critic: 'CRITIC',
  docent: 'DOCENT',
  system: 'SYSTEM',
};

const ROLE_COLOR: Record<string, string> = {
  architect: C.inkSoft,
  engineer: C.inkSoft,
  critic: C.inkSoft,
  docent: C.inkSoft,
  system: C.inkFaint,
};

// ── chat derivation — THE QUIET CHAT LAW: a run is exactly THREE bubbles
// (YOU → one quiet work card → one ANSWER card); everything else the
// pipeline reports folds inside them ───────────────────────────────────

type ToolLine = { key: number; tool: string; ok: boolean; seq: number; text: string; target: string; utype: string };
type ThinkLine = { key: number; role: 'architect' | 'engineer' | 'critic' | 'docent' | 'system'; text: string };
type SolveLine = { key: number; solve: SolveSummary };
type PhaseBody = { think: ThinkLine[]; tools: ToolLine[]; solves: SolveLine[] };

type PhaseSection = { phase: BuildPhase; body: PhaseBody; summary: string };

type Block =
  | { kind: 'user'; key: number; text: string }
  | { kind: 'workcard'; key: number; phases: PhaseSection[]; usage?: RunUsage }
  | { kind: 'answer'; key: number; solve?: SolveSummary; verdict?: CriticVerdict }
  | { kind: 'error'; key: number; text: string }
  | { kind: 'note'; key: number; text: string };

/** the one line that stands for a whole phase once it is over */
function phaseSummary(phase: BuildPhase, body: PhaseBody): string {
  const texts = body.think.map((t) => t.text).join('\n');
  if (phase === 'architect') {
    const m = texts.match(/Plan:\s*(\d+)\s*units?(?:,\s*(\d+)\s*streams?)?/);
    if (m) return `${m[1]}-unit plan${m[2] ? ` · ${m[2]} streams` : ''}`;
    return 'flowsheet plan ready';
  }
  if (phase === 'engineer') {
    const c = (tool: string) => body.tools.filter((l) => l.tool === tool && l.ok).length;
    const placed = c('add_unit');
    const removed = c('remove_unit');
    const wired = c('connect');
    const unwired = c('disconnect');
    const retuned = c('set_spec');
    const parts: string[] = [];
    if (placed) parts.push(`${placed} units placed`);
    if (removed) parts.push(`${removed} removed`);
    if (wired) parts.push(`${wired} streams wired`);
    if (unwired) parts.push(`${unwired} unwired`);
    if (retuned) parts.push(`${retuned} specs retuned`);
    const flagged = body.tools.filter((l) => !l.ok).length;
    const done = texts.match(/Done:\s*(.+)/);
    const base = parts.length > 0 ? parts.join(' · ') : `${body.tools.length} actions`;
    if (done) return `${base} — ${done[1].slice(0, 80)}`;
    return flagged > 0 ? `${base} · ${flagged} flagged` : base;
  }
  if (phase === 'docent') {
    const m = texts.match(/Tour written:\s*“(.+?)”\s*—\s*(\d+)\s+stops/);
    if (m) return `“${m[1]}” · ${m[2]} stops`;
    return 'guided tour ready';
  }
  if (phase === 'solver') {
    const solved = body.tools.some((l) => l.tool === 'solve' && l.ok);
    const flagged = body.tools.filter((l) => !l.ok).length;
    if (!solved) return flagged > 0 ? 'validation failed' : 'verified as built';
    return 'validated · re-solved';
  }
  if (phase === 'critic') return 'reviewed the build';
  return 'done';
}

function deriveBlocks(entries: LogEntry[]): Block[] {
  // Split into RUNS at user messages — each run is one agent session (a
  // build or an edit change). THE QUIET CHAT LAW: a run renders as exactly
  // THREE bubbles — the user's brief, ONE quiet work card (every phase,
  // every thought, every tool call lives inside it), and ONE answer card
  // (verdict + plant numbers merged). The token ledger is a footnote inside
  // the work card's detail; only errors and true system notes stay as
  // their own lines. Mid-run solves stay in their phase section as quiet
  // lines — the run's LAST solve is the one the answer card shows.
  const runs: LogEntry[][] = [];
  let cur: LogEntry[] = [];
  for (const e of entries) {
    if (e.kind === 'user') {
      if (cur.length > 0) runs.push(cur);
      cur = [e];
    } else {
      cur.push(e);
    }
  }
  if (cur.length > 0) runs.push(cur);

  const blocks: Block[] = [];
  for (const run of runs) {
    const pre: Block[] = []; // before any phase: system notes etc.
    const outputs: Block[] = []; // errors + notes after the work
    const phases: PhaseSection[] = [];
    let pending: { phase: BuildPhase; body: PhaseBody } | null = null;
    let sawPhase = false;
    const solveSections: Array<{ body: PhaseBody; entry: SolveLine }> = [];
    let runSolve: SolveSummary | null = null;
    let runVerdict: CriticVerdict | null = null;
    let runUsage: RunUsage | null = null;
    let answerKey = 0;

    const flushPhase = () => {
      if (!pending) return;
      const { phase, body } = pending;
      if (body.think.length > 0 || body.tools.length > 0 || body.solves.length > 0) {
        phases.push({ phase, body, summary: phaseSummary(phase, body) });
      }
      pending = null;
    };
    const toBlock = (e: LogEntry): Block | null => {
      switch (e.kind) {
        case 'user':
          return { kind: 'user', key: e.key, text: e.text ?? '' };
        case 'error':
          return { kind: 'error', key: e.key, text: e.text ?? '' };
        default:
          return { kind: 'note', key: e.key, text: e.text ?? '' };
      }
    };

    for (const e of run) {
      if (e.kind === 'phase') {
        flushPhase();
        pending = { phase: e.phase ?? 'done', body: { think: [], tools: [], solves: [] } };
        sawPhase = true;
        continue;
      }
      if (pending && e.kind === 'message') {
        pending.body.think.push({ key: e.key, role: e.role ?? 'system', text: e.text ?? '' });
        continue;
      }
      if (pending && e.kind === 'tool') {
        pending.body.tools.push({ key: e.key, tool: e.tool ?? '?', ok: e.ok !== false, seq: e.seq ?? 0, text: e.text ?? '', target: e.target ?? '', utype: e.utype ?? '' });
        continue;
      }
      if (e.kind === 'solve' && e.solve) {
        if (pending) {
          const line = { key: e.key, solve: e.solve };
          pending.body.solves.push(line);
          solveSections.push({ body: pending.body, entry: line });
        }
        runSolve = e.solve;
        answerKey = e.key;
        continue;
      }
      if (e.kind === 'verdict' && e.verdict) {
        runVerdict = e.verdict;
        answerKey = e.key;
        continue;
      }
      if (e.kind === 'usage' && e.usage) {
        runUsage = e.usage;
        continue;
      }
      // non-phase content: before the first phase it leads the run; after,
      // it is the run's output
      const b = toBlock(e);
      if (b) (sawPhase ? outputs : pre).push(b);
    }
    flushPhase();

    // the run's LAST solve moves OUT of its phase body — the answer card
    // owns it (earlier mid-run solves stay as quiet phase lines)
    if (solveSections.length > 0) {
      const last = solveSections[solveSections.length - 1];
      last.body.solves = last.body.solves.filter((l) => l.key !== last.entry.key);
    }

    blocks.push(...pre);
    if (phases.length > 0) {
      blocks.push({
        kind: 'workcard',
        key: phases[0].body.think[0]?.key ?? phases[0].body.tools[0]?.key ?? phases[0].body.solves[0]?.key ?? 0,
        phases,
        usage: runUsage ?? undefined,
      });
    }
    if (runSolve || runVerdict) {
      blocks.push({ kind: 'answer', key: answerKey, solve: runSolve ?? undefined, verdict: runVerdict ?? undefined });
    }
    blocks.push(...outputs);
  }
  return blocks;
}

// ── small pieces ──────────────────────────────────────────────────────────────

/** the live one-liner — what the agent is doing RIGHT NOW. The ChatGPT/
 *  Claude convention: one quiet line ("Placing R1 — primary reformer…"),
 *  all the thinking one click away. */
const TOOL_VERB: Record<string, string> = {
  add_unit: 'Placing',
  connect: 'Wiring',
  disconnect: 'Unwiring',
  remove_unit: 'Removing',
  set_spec: 'Tuning',
  add_controller: 'Controlling',
  remove_controller: 'Releasing control on',
  declare_product: 'Declaring the product',
  validate: 'Validating the flowsheet',
  solve: 'Solving the plant',
  read_stream: 'Reading',
  get_graph: 'Checking the graph',
};

const humanType = (t: string): string =>
  t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function nowLine(phase: BuildPhase, body: PhaseBody): string {
  const last = body.tools[body.tools.length - 1];
  if (last) {
    const verb = TOOL_VERB[last.tool];
    if (verb) {
      if (!last.target) return `${verb}…`;
      const what =
        last.tool === 'add_unit' && last.utype ? `${last.target} — ${humanType(last.utype)}` : last.target;
      return `${verb} ${what}…`;
    }
    return `${humanType(last.tool)}${last.target ? ` ${last.target}` : ''}…`;
  }
  switch (phase) {
    case 'architect':
      return 'Planning the flowsheet…';
    case 'engineer':
      return 'Building the plant…';
    case 'solver':
      return 'Verifying & solving…';
    case 'critic':
      return 'Reviewing against the brief…';
    case 'docent':
      return 'Writing your guided tour…';
    default:
      return 'Working…';
  }
}

/** one phase inside the work card — a mini collapsible section */
function PhaseSectionView({
  phase,
  body,
  summary,
  live,
  last,
}: {
  phase: BuildPhase;
  body: PhaseBody;
  summary: string;
  live: boolean;
  last: boolean;
}) {
  // QUIET BY DEFAULT: sections never auto-open — the live one-liner on the
  // card header carries the state; the detail is one click away, forever
  const [open, setOpen] = useState(false);
  const flagged = body.tools.filter((l) => !l.ok).length;
  return (
    <div
      className="rounded-lg border"
      style={{
        borderColor: live
          ? PHASE_COLOR[phase]
          : flagged > 0
            ? C.warn
            : 'var(--fs-band-line)',
        background: 'var(--fs-paper-60, transparent)',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: flagged > 0 ? C.warn : PHASE_COLOR[phase],
            ...(live ? { animation: 'bd-pulse-kf 1.1s ease-in-out infinite' } : {}),
          }}
        />
        <span className="shrink-0 font-mono text-[9px] font-extrabold tracking-[0.16em]" style={{ color: PHASE_COLOR[phase] }}>
          {phase.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: C.inkSoft }}>
          {summary}
        </span>
        {last && !live && (
          <span className="shrink-0 font-mono text-[9px]" style={{ color: C.inkFaint }}>
            ✓
          </span>
        )}
        <ChevronDown
          size={12}
          className="shrink-0 transition-transform"
          style={{ color: C.inkFaint, transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="border-t px-2.5 py-1.5" style={{ borderColor: 'var(--fs-band-line)' }}>
          <div className="max-h-60 overflow-y-auto pr-1">
            {body.think.map((t) => (
              <div key={t.key} className="mb-2 last:mb-0">
                <div className="font-mono text-[9px] font-extrabold tracking-[0.16em]" style={{ color: ROLE_COLOR[t.role] ?? C.inkFaint }}>
                  {ROLE_LABEL[t.role] ?? 'AGENT'}
                </div>
                <div
                  className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-relaxed"
                  style={{ color: t.role === 'system' ? C.warn : C.inkSoft }}
                >
                  {t.text}
                </div>
              </div>
            ))}
            {body.solves.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {body.solves.map((sl) => (
                  <div key={sl.key} className="font-mono text-[10px]" style={{ color: C.inkFaint }}>
                    ▸ mid-run solve — {sl.solve.converged ? 'converged' : 'did not converge'} · {sl.solve.solveMs.toFixed(0)} ms
                  </div>
                ))}
              </div>
            )}
            {body.tools.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 border-t pt-1.5" style={{ borderColor: 'var(--fs-band-line)' }}>
                {(live ? body.tools.slice(-3) : body.tools).map((l) => (
                  <div key={l.key} className="flex items-baseline gap-2" title={l.text}>
                    <span className="font-mono text-[10px] font-bold" style={{ color: l.ok ? C.inkFaint : C.warn }}>
                      {l.tool}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px]" style={{ color: l.ok ? C.inkSoft : C.warn }}>
                      {l.text}
                    </span>
                  </div>
                ))}
                {live && body.tools.length > 3 && (
                  <div className="font-mono text-[10px]" style={{ color: C.inkFaint }}>
                    + {body.tools.length - 3} earlier
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** ONE card for a whole agent run — all phases live inside it. Collapsed
 * to a single line by default (the live NOW line while it runs, the summary
 * line after); expandable forever after. The build is watched on the CANVAS
 * — the session stays quiet, like every modern agent chat. The run's token
 * ledger lives here too, as a footnote inside the detail. */
function WorkCard({ phases, usage, live }: { phases: PhaseSection[]; usage?: RunUsage; live: boolean }) {
  const [open, setOpen] = useState(false);
  const anyFlagged = phases.some((p) => p.body.tools.some((l) => !l.ok));
  const lastIdx = phases.length - 1;
  const liveIdx = live ? lastIdx : -1;
  const headline = phases
    .map((p) => p.summary)
    .join(' · ')
    .replace(/\n/g, ' ');
  const truncated = headline.length > 96 ? `${headline.slice(0, 95)}…` : headline;
  return (
    <div
      className="bd-msg-in rounded-xl border"
      style={{ borderColor: anyFlagged ? C.warn : 'var(--fs-band-line)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{
            background: anyFlagged ? C.warn : live ? PHASE_COLOR[phases[lastIdx].phase] : C.ink,
            ...(live ? { animation: 'bd-pulse-kf 1.1s ease-in-out infinite' } : {}),
          }}
        />
        <span className="shrink-0 font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.ink }}>
          AGENT WORK
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: C.inkSoft }} title={headline}>
          {live ? nowLine(phases[lastIdx].phase, phases[lastIdx].body) : truncated}
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform"
          style={{ color: C.inkFaint, transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 border-t px-2.5 py-2" style={{ borderColor: 'var(--fs-band-line)' }}>
          {phases.map((p, i) => (
            <PhaseSectionView
              key={`${p.phase}-${p.body.think[0]?.key ?? p.body.tools[0]?.key ?? i}`}
              phase={p.phase}
              body={p.body}
              summary={p.summary}
              live={i === liveIdx}
              last={i === lastIdx}
            />
          ))}
          {usage && <LedgerLine usage={usage} />}
        </div>
      )}
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

/** the run's token ledger — a quiet footnote INSIDE the work card's detail
 * (what this build actually cost and saved; roles on hover) */
const fmtTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function LedgerLine({ usage }: { usage: RunUsage }) {
  const parts = [
    `${fmtTokens(usage.promptTokens + usage.completionTokens)} tokens`,
    `${fmtTokens(usage.promptTokens)} in + ${fmtTokens(usage.completionTokens)} out`,
    `${usage.calls} call${usage.calls === 1 ? '' : 's'}`,
  ];
  if (usage.cacheHits > 0) {
    parts.push(`${usage.cacheHits} cached · ≈${fmtTokens(usage.cacheSavedTokens)} saved`);
  }
  const roles = usage.byRole
    .map((r) => `${r.role} ${fmtTokens(r.prompt + r.completion)}${r.hits > 0 ? ` (${r.hits} cached)` : ''}`)
    .join(' · ');
  return (
    <div
      className="border-t pt-1.5 font-mono text-[9.5px] leading-relaxed"
      style={{ borderColor: 'var(--fs-band-line)', color: C.inkFaint }}
      title={roles}
    >
      <span className="font-extrabold tracking-[0.14em]" style={{ color: C.inkSoft }}>
        TOKEN LEDGER
      </span>{' '}
      {parts.join(' · ')}
      {roles.length > 0 && <span className="block opacity-80">{roles}</span>}
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

/** THE run's answer — the critic's verdict and the solver's numbers on ONE
 * card (the quiet chat law): verdict pill + score up top, the summary as
 * the body, the plant's KPIs inline, warnings if any, and the full critique
 * (strengths · issues · suggestions) one click away. */
function AnswerCard({ solve, verdict }: { solve?: SolveSummary; verdict?: CriticVerdict }) {
  const [open, setOpen] = useState(false);
  const tone = !verdict
    ? C.ink
    : verdict.verdict === 'pass'
      ? C.nh3
      : verdict.verdict === 'revise'
        ? C.feed
        : C.warn;
  const k = solve?.kpis;
  const rows = !k
    ? []
    : k.familyKpis && k.familyKpis.length > 0
      ? k.familyKpis
      : [
          { label: 'Production', value: `${k.productionTpd.toFixed(1)} t/d` },
          { label: 'Purity', value: `${(k.productPurityWt * 100).toFixed(2)} wt %` },
        ];
  const bad = (!!solve && (!solve.converged || solve.warnings.length > 0)) || verdict?.verdict === 'fail';
  const detailCount =
    (verdict?.strengths.length ?? 0) + (verdict?.issues.length ?? 0) + (verdict?.suggestions.length ?? 0);
  return (
    <div
      className="bd-msg-in rounded-xl border px-3 py-2.5"
      style={{ borderColor: bad ? C.warn : tone, background: C.paper }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.ink }}>
          ANSWER
        </span>
        {verdict && (
          <>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold"
              style={{ background: tone, color: C.paper }}
            >
              {verdict.verdict.toUpperCase()}
            </span>
            <span className="font-mono text-[12px] font-extrabold" style={{ color: tone }}>
              {verdict.score}/100
            </span>
          </>
        )}
        {solve && (
          <span className={`${verdict ? '' : 'ml-auto'} font-mono text-[9.5px]`} style={{ color: C.inkFaint }}>
            {solve.converged ? 'converged' : 'did not converge'}
            {solve.iterations > 0 ? ` · ${solve.iterations} it` : ''}
            {solve.solveMs > 0 ? ` · ${solve.solveMs.toFixed(0)} ms` : ''}
          </span>
        )}
      </div>
      {verdict?.summary && (
        <p className="text-[12px] leading-relaxed" style={{ color: C.ink }}>
          {verdict.summary}
        </p>
      )}
      {rows.length > 0 && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <div
                className="truncate font-mono text-[9px] font-bold uppercase tracking-[0.08em]"
                style={{ color: C.inkFaint }}
              >
                {r.label}
              </div>
              <div className="truncate text-[12px] font-bold" style={{ color: C.ink }} title={r.value}>
                {r.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {solve && solve.warnings.length > 0 && (
        <div
          className="mt-2 border-t pt-1.5 text-[11px] leading-snug"
          style={{ borderColor: 'var(--fs-band-line)', color: C.warn }}
        >
          {solve.warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
      )}
      {verdict && detailCount > 0 && (
        <div className="mt-1.5">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 text-left"
          >
            <span className="font-mono text-[9.5px] font-extrabold tracking-[0.14em]" style={{ color: C.inkFaint }}>
              {open ? 'HIDE' : 'DETAILS'}
            </span>
            <span className="min-w-0 flex-1 truncate text-[10.5px]" style={{ color: C.inkFaint }}>
              {verdict.strengths.length} strengths · {verdict.issues.length} issues · {verdict.suggestions.length}{' '}
              suggestions
            </span>
            <ChevronDown
              size={12}
              className="shrink-0 transition-transform"
              style={{ color: C.inkFaint, transform: open ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {open && (
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--fs-band-line)' }}>
              {verdict.strengths.length > 0 && (
                <ul>
                  {verdict.strengths.map((s) => (
                    <li key={s} className="text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
                      + {s}
                    </li>
                  ))}
                </ul>
              )}
              {verdict.issues.length > 0 && (
                <ul className={verdict.strengths.length > 0 ? 'mt-1' : ''}>
                  {verdict.issues.map((s) => (
                    <li key={s} className="text-[11.5px] leading-snug" style={{ color: C.warn }}>
                      − {s}
                    </li>
                  ))}
                </ul>
              )}
              {verdict.suggestions.length > 0 && (
                <ul className="mt-1">
                  {verdict.suggestions.map((s) => (
                    <li key={s} className="text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
                      → {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── the on-ramp: presets by family, regions, surprise ────────────────────────

const CARD_HUES = [C.feed, C.gas, C.nh3, C.utility, C.warn];
const CARD_ICONS = [Factory, FlaskConical, Zap, Sparkles, Compass];

function PresetCard({
  label,
  text,
  iconIdx,
  onPick,
}: {
  label: string;
  text: string;
  iconIdx: number;
  onPick: () => void;
}) {
  const Icon = CARD_ICONS[iconIdx % CARD_ICONS.length];
  return (
    <button
      onClick={onPick}
      className="card-lift group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left"
      style={{ background: C.paper, borderColor: 'var(--fs-band-line)' }}
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: 'var(--fs-band-line)', color: CARD_HUES[iconIdx % CARD_HUES.length] }}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold" style={{ color: C.ink }}>
          {label}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
          {text}
        </span>
      </span>
      <ChevronRight
        size={15}
        className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: C.inkFaint }}
      />
    </button>
  );
}

/** the "I don't know" flow: pick a region → see what runs there → one-click brief */
function RegionPicker({ onPick }: { onPick: (brief: string) => void }) {
  const [region, setRegion] = useState<RegionEntry | null>(null);
  if (!region) {
    return (
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: C.inkFaint }}>
          <MapPin size={12} /> What&rsquo;s made near me?
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRegion(r)}
              className="hover-band rounded-lg border px-2.5 py-2 text-left text-[12px] font-bold"
              style={{ borderColor: 'var(--fs-band-line)', color: C.ink }}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border px-3 py-3" style={{ borderColor: 'var(--fs-band-line)', background: C.canvas }}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setRegion(null)}
          className="hover-band flex items-center gap-1 text-[11px] font-bold"
          style={{ color: C.inkSoft }}
        >
          <ChevronLeft size={13} /> all regions
        </button>
        <span className="ml-auto truncate text-[11.5px] font-bold" style={{ color: C.ink }}>
          {region.name} · {region.scope}
        </span>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
        {region.industries}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {region.here.map((h) => (
          <button
            key={h.family}
            onClick={() => onPick(h.brief)}
            className="card-lift rounded-lg border px-3 py-2 text-left"
            style={{ borderColor: 'var(--fs-band-line)', background: C.paper }}
          >
            <span className="font-mono text-[9px] font-extrabold tracking-[0.14em]" style={{ color: CARD_HUES[['ammonia', 'methanol', 'hydrogen', 'sulphur'].indexOf(h.family) % 4] }}>
              {h.family.toUpperCase()}
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: C.inkSoft }}>
              {h.why}
            </span>
            <span className="mt-1 block text-[12px] font-bold" style={{ color: C.ink }}>
              {h.brief}
            </span>
          </button>
        ))}
      </div>
      {region.coming.length > 0 && (
        <p className="mt-2 text-[10.5px] leading-snug" style={{ color: C.inkFaint }}>
          Not in the builder yet: {region.coming.join(' · ')}.
        </p>
      )}
    </div>
  );
}

// ── the panel ────────────────────────────────────────────────────────────────

export interface SessionPanelProps {
  entries: LogEntry[];
  status: 'idle' | 'running' | 'finished';
  phase: BuildPhase | null;
  brief: string;
  onBriefChange: (v: string) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  /** label for the reset button — the edit panel says "Done editing" */
  resetLabel?: string;
  onSave: () => void;
  onZoomIn: () => void;
  onCollapse: () => void;
  saved: boolean;
  hasGraph: boolean;
  unitCount: number;
  streamCount: number;
  doneOk: boolean | null;
  tourReady: boolean;
  onTakeTour: () => void;
  remixName: string | null;
}

const REMIX_EXAMPLES = [
  'Halve the feed — what happens to production?',
  'Run the plant as hot as it will go, safely',
  'Remove one unit the plant can live without, and prove it',
  'Push the product purity as high as it will go',
];

export function SessionPanel({
  entries,
  status,
  phase,
  brief,
  onBriefChange,
  onStart,
  onStop,
  onReset,
  resetLabel,
  onSave,
  onZoomIn,
  onCollapse,
  saved,
  hasGraph,
  unitCount,
  streamCount,
  doneOk,
  tourReady,
  onTakeTour,
  remixName,
}: SessionPanelProps) {
  const blocks = useMemo(() => deriveBlocks(entries), [entries]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pinnedRef = useRef(true);
  const [jump, setJump] = useState(false);
  // deterministic first brief — SSR-stable (Math.random in initial state
  // made server and client disagree); "Another" cycles at random
  const [surprise, setSurprise] = useState(0);
  const running = status === 'running';
  const idle = status === 'idle';
  const remixing = remixName !== null;

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

  const pickBrief = (text: string) => {
    onBriefChange(text);
    taRef.current?.focus();
  };

  const sessionTitle = (() => {
    // THE ONE CONVERSATION LAW: the session is titled by the brief that
    // started it (the first YOU bubble) — stable across every later change
    const first = entries.find((e) => e.kind === 'user')?.text ?? '';
    const t = first.trim() || brief.trim();
    if (t.length === 0) return idle ? 'Untitled session' : 'Agent-built plant';
    return `${t.slice(0, 44)}${t.length > 44 ? '…' : ''}`;
  })();

  const sub = running
    ? `${PHASE_LABEL[phase ?? 'engineer']} · ${unitCount} unit${unitCount === 1 ? '' : 's'} · ${streamCount} stream${streamCount === 1 ? '' : 's'}`
    : status === 'finished'
      ? doneOk === true
        ? 'build passed the critic'
        : doneOk === false
          ? 'build finished with issues'
          : 'session restored from the library'
      : blocks.length > 0
        ? 'the conversation continues — each change chains from the latest plant'
        : 'architect · engineer · solver · critic · docent';

  return (
    <div className="flex h-full w-full flex-col" style={{ background: C.paper }}>
      {/* session header */}
      <header
        className="flex h-[54px] shrink-0 items-center gap-2.5 border-b px-3 sm:px-4"
        style={{ borderColor: 'var(--fs-band-line)' }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold leading-tight" style={{ color: idle ? C.inkFaint : C.ink }}>
            {remixing ? `${remixName} · edit` : sessionTitle}
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
          {remixing ? (
            <>
              <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
                What would you like to change?
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
                The plant is on the canvas — ask for a change and the engineer will make the smallest edit that honors
                it, the solver will re-run every unit, and the critic will judge what the change did. Changes chain:
                each one starts from the latest plant.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {REMIX_EXAMPLES.map((text) => (
                  <button
                    key={text}
                    onClick={() => pickBrief(text)}
                    className="card-lift rounded-xl border px-3.5 py-2.5 text-left text-[12.5px] font-semibold"
                    style={{ borderColor: 'var(--fs-band-line)', color: C.ink }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-[17px] font-semibold leading-snug" style={{ color: C.ink }}>
                What would you like to build?
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: C.inkSoft }}>
                Describe a plant in plain words — ammonia, methanol, hydrogen, sulphur recovery, or something the
                recipes don&rsquo;t cover. An architect plans it, an engineer wires it, the solver verifies it, a
                critic scores it, and a docent writes its tour — the flowsheet assembles live on the canvas.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {FAMILIES.filter((f) => f.presets.length > 0).map((f, fi) => (
                  <PresetCard
                    key={f.id}
                    label={`${f.presets[0].label} — ${f.name.toLowerCase()}`}
                    text={f.presets[0].text}
                    iconIdx={fi}
                    onPick={() => pickBrief(f.presets[0].text)}
                  />
                ))}
              </div>
              <RegionPicker onPick={pickBrief} />
              <div className="mt-4 rounded-xl border px-3 py-3" style={{ borderColor: 'var(--fs-band-line)' }}>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: C.inkFaint }}>
                  <Sparkles size={12} /> Surprise me
                </div>
                {surprise !== null && (
                  <p className="text-[12px] leading-snug" style={{ color: C.inkSoft }}>
                    {SURPRISE_BRIEFS[surprise]}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => surprise !== null && pickBrief(SURPRISE_BRIEFS[surprise])}
                    className="hover-band rounded-full border px-3 py-1.5 text-[11.5px] font-bold"
                    style={{ borderColor: 'var(--fs-band-line)', color: C.ink }}
                  >
                    Build this one
                  </button>
                  <button
                    onClick={() =>
                      setSurprise((s) => {
                        let next = Math.floor(Math.random() * SURPRISE_BRIEFS.length);
                        if (next === s) next = (s + 1) % SURPRISE_BRIEFS.length;
                        return next;
                      })
                    }
                    className="hover-band rounded-full border px-3 py-1.5 text-[11.5px] font-bold"
                    style={{ borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
                  >
                    Another
                  </button>
                </div>
              </div>
              <p className="mt-auto pt-5 text-[11px] leading-relaxed" style={{ color: C.inkFaint }}>
                The engineer works through the engine&rsquo;s tool surface — every unit it places appears on the canvas
                the moment it is wired.
              </p>
            </>
          )}
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
                  case 'workcard':
                    return <WorkCard key={b.key} phases={b.phases} usage={b.usage} live={live} />;
                  case 'answer':
                    return <AnswerCard key={b.key} solve={b.solve} verdict={b.verdict} />;
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
              placeholder={remixing ? 'Describe the change — remove a unit, retune a spec, add equipment…' : 'Describe the plant to build — units, targets, constraints…'}
              aria-label="Design brief"
              className="w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] leading-relaxed outline-none placeholder:opacity-70"
              style={{ color: C.ink }}
            />
            <div className="flex items-center gap-2 px-2.5 pb-2.5">
              <span className="hidden text-[10px] sm:block" style={{ color: C.inkFaint }}>
                Enter to {remixing ? 'apply' : 'build'} · Shift+Enter for a new line
              </span>
              <button
                onClick={onStart}
                disabled={!brief.trim()}
                aria-label={remixing ? 'Apply the change' : 'Start the build'}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border transition-opacity disabled:opacity-35"
                style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
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
            {/* THE ONE CONVERSATION LAW: the composer STAYS an input after a
                run — the same box that built the plant takes the next change.
                Edit-with-AI is not a different screen; it is this chat. */}
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
                placeholder={
                  hasGraph
                    ? 'Change something — add, remove, retune… or ask why a unit is there'
                    : 'Describe the plant to build — units, targets, constraints…'
                }
                aria-label={hasGraph ? 'Next change' : 'Design brief'}
                className="w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] leading-relaxed outline-none placeholder:opacity-70"
                style={{ color: C.ink }}
              />
              <div className="flex items-center gap-2 px-2.5 pb-2.5">
                <span className="hidden text-[10px] sm:block" style={{ color: C.inkFaint }}>
                  Enter to {hasGraph ? 'apply' : 'build'} · Shift+Enter for a new line
                </span>
                <button
                  onClick={onStart}
                  disabled={!brief.trim()}
                  aria-label={hasGraph ? 'Apply the change' : 'Start the build'}
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border transition-opacity disabled:opacity-35"
                  style={{ background: C.accent, color: C.onAccent, borderColor: C.accentLine }}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            {/* the next moves — quiet pills; the input is the hero */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={onTakeTour}
                disabled={!tourReady}
                className="hover-band flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold disabled:opacity-40"
                style={{ color: C.ink, borderColor: 'var(--fs-band-line)' }}
                title="Play the docent's guided tour — voice and music, right here"
              >
                <Play size={12} strokeWidth={3} />
                Take the tour
              </button>
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
                className="hover-band ml-auto flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold"
                style={{ color: C.inkSoft, borderColor: 'var(--fs-band-line)' }}
                title="Close this conversation and start a fresh one"
              >
                <RotateCcw size={12} />
                {resetLabel ?? 'New session'}
              </button>
            </div>
            {hasGraph && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REMIX_EXAMPLES.slice(0, 2).map((text) => (
                  <button
                    key={text}
                    onClick={() => pickBrief(text)}
                    className="hover-band rounded-full border px-3 py-1 text-[11px] font-semibold"
                    style={{ borderColor: 'var(--fs-band-line)', color: C.inkSoft }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
