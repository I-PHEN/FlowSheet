'use client';

/**
 * BuildPanels — the right-hand column of the builder: the live transcript
 * (phases, agent reasoning, tool calls with their results), the plant KPI
 * block after each solve, and the critic's verdict card.
 */

import { useEffect, useRef } from 'react';
import type { BuildPhase, CriticVerdict, SolveSummary } from '@/lib/agent/protocol';
import { C } from '@/lib/design/tokens';

export interface LogEntry {
  key: number;
  kind: 'phase' | 'message' | 'tool' | 'solve' | 'error' | 'note';
  phase?: BuildPhase;
  label?: string;
  role?: 'architect' | 'engineer' | 'critic' | 'system';
  text?: string;
  tool?: string;
  ok?: boolean;
  seq?: number;
}

const ROLE_LABEL: Record<string, string> = {
  architect: 'ARCHITECT',
  engineer: 'ENGINEER',
  critic: 'CRITIC',
  system: 'SYSTEM',
};

const ROLE_COLOR: Record<string, string> = {
  architect: C.inkSoft,
  engineer: C.inkSoft,
  critic: C.inkSoft,
  system: C.inkFaint,
};

export function BuildLog({ entries, running }: { entries: LogEntry[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ background: C.canvas }}>
      <div className="flex flex-col gap-2.5">
        {entries.map((e) => {
          if (e.kind === 'phase') {
            return (
              <div key={e.key} className="mt-2 flex items-center gap-3 first:mt-0">
                <span className="font-mono text-[10.5px] font-extrabold tracking-[0.18em]" style={{ color: C.inkSoft }}>
                  {String(e.phase ?? '').toUpperCase()}
                </span>
                <div className="h-px flex-1" style={{ background: 'var(--fs-band-line)' }} />
                <span className="text-[10.5px]" style={{ color: C.inkFaint }}>
                  {e.label}
                </span>
              </div>
            );
          }
          if (e.kind === 'message' || e.kind === 'note') {
            const role = e.role ?? 'system';
            return (
              <div key={e.key} className="rounded-xl border px-3 py-2" style={{ background: C.paper, borderColor: 'var(--fs-band-line)' }}>
                <div className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: ROLE_COLOR[role] }}>
                  {ROLE_LABEL[role] ?? 'AGENT'}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: C.ink }}>
                  {e.text}
                </div>
              </div>
            );
          }
          if (e.kind === 'tool') {
            return (
              <button
                key={e.key}
                onClick={() => {
                  const full = e.text ?? e.tool ?? '';
                  if (full.length > 260) void navigator.clipboard?.writeText(full);
                }}
                className="group w-full rounded-lg border px-3 py-1.5 text-left"
                style={{ background: e.ok === false ? 'var(--fs-band)' : 'transparent', borderColor: 'var(--fs-band-line)' }}
                title={e.ok === false ? 'failed tool call — click to copy the full message' : undefined}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: e.ok === false ? C.warn : C.nh3 }}
                  />
                  <span className="font-mono text-[10px] font-bold" style={{ color: C.inkSoft }}>
                    #{e.seq}
                  </span>
                  <span className="font-mono text-[11px] font-extrabold" style={{ color: C.ink }}>
                    {e.tool}
                  </span>
                  <span className="ml-auto truncate text-[10.5px]" style={{ color: e.ok === false ? C.warn : C.inkSoft }}>
                    {e.text}
                  </span>
                </div>
              </button>
            );
          }
          if (e.kind === 'solve') {
            return (
              <div key={e.key} className="rounded-xl border px-3 py-2" style={{ background: C.paper, borderColor: 'var(--fs-band-line)' }}>
                <div className="font-mono text-[9.5px] font-extrabold tracking-[0.16em]" style={{ color: C.nh3 }}>
                  SOLVER
                </div>
                <div className="mt-1 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed" style={{ color: C.ink }}>
                  {e.text}
                </div>
              </div>
            );
          }
          return (
            <div key={e.key} className="rounded-xl border px-3 py-2 text-[12.5px]" style={{ background: 'var(--fs-band)', borderColor: C.warn, color: C.warn }}>
              {e.text}
            </div>
          );
        })}
        {running && (
          <div className="flex items-center gap-2 px-1 py-1">
            <span className="bd-pulse inline-block h-2 w-2 rounded-full" style={{ background: C.gas }} />
            <span className="text-[11px]" style={{ color: C.inkFaint }}>
              working…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function KpiPanel({ solve }: { solve: SolveSummary }) {
  const k = solve.kpis;
  const rows: { label: string; value: string; hint?: string }[] = [
    { label: 'Production', value: `${k.productionTpd.toFixed(1)} t/d`, hint: 'liquid ammonia' },
    { label: 'Purity', value: `${(k.productPurityWt * 100).toFixed(2)} wt %`, hint: 'product' },
    { label: 'Per-pass conv.', value: `${(k.perPassConv * 100).toFixed(1)} %`, hint: 'converter' },
    { label: 'H2/N2', value: k.h2n2Ratio.toFixed(3), hint: 'make-up' },
    { label: 'Loop inerts', value: `${(k.loopInerts * 100).toFixed(1)} %` },
    { label: 'Spec. energy', value: `${k.specificEnergyGJt.toFixed(2)} GJ/t`, hint: 'feed + fuel + power' },
  ];
  return (
    <div className="border-t px-4 py-3" style={{ background: C.paper }}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-extrabold tracking-[0.16em]" style={{ color: C.inkSoft }}>
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
      <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>
              {r.label}
            </div>
            <div className="font-mono text-[13.5px] font-bold" style={{ color: C.ink }}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
      {solve.warnings.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1">
          {solve.warnings.map((w, i) => (
            <div key={i} className="text-[11.5px] leading-snug" style={{ color: C.warn }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VerdictCard({ verdict }: { verdict: CriticVerdict }) {
  const color = verdict.verdict === 'pass' ? C.nh3 : verdict.verdict === 'revise' ? C.warn : C.fail;
  return (
    <div className="border-t px-4 py-3" style={{ background: C.paper }}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-extrabold tracking-[0.16em]" style={{ color: C.inkSoft }}>
          CRITIC VERDICT
        </span>
        <span className="rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-extrabold uppercase" style={{ color, borderColor: color }}>
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
