/**
 * Build orchestrator — the deterministic multi-agent pipeline.
 *
 * Sequence (fixed; the LLM only ever proposes, code disposes):
 *   1. ARCHITECT  — one role call: reads the brief, returns a JSON plan
 *      (guidance only — nothing is applied directly).
 *   2. ENGINEER   — agentic tool loop: each turn the model proposes a JSON
 *      action batch, the workspace executes deterministically, results
 *      (including validator messages) are fed back verbatim for
 *      self-correction. Graph snapshots are emitted after every mutation.
 *   3. SOLVER     — forced final validate + solve: the deterministic truth,
 *      regardless of what the engineer claimed.
 *   4. CRITIC     — one role call over measured facts + graph digest →
 *      verdict card.
 *   5. DONE       — success flag + final graph.
 *
 * Guardrails everywhere: turn/action budgets, clamps, plain-English
 * failures. The only throw path is the top-level catch → error event.
 */

import type { BuildEvent, CriticVerdict, EngineerStep, SolveSummary, ToolCall } from './protocol';
import { AgentWorkspace } from './workspace';
import { graphDigest } from './catalog';
import type { Llm } from './llm';
import { chatJson } from './llm';
import {
  architectSystem,
  architectUser,
  criticSystem,
  criticUser,
  engineerFinalNudge,
  engineerResults,
  engineerSystem,
  engineerUser,
} from './prompts';
import type { LlmMessage } from './llm';
import { validateGraph } from '../engine/validate';

const MAX_ENGINEER_TURNS = 24;
const MAX_ACTIONS_PER_TURN = 12;
const MAX_ACTIONS_TOTAL = 200;

interface OrchestratorOpts {
  llm: Llm;
  emit: (e: BuildEvent) => void;
}

export async function runAgentBuild(brief: string, { llm, emit }: OrchestratorOpts): Promise<void> {
  const trimmedBrief = brief.trim().slice(0, 2000);
  if (trimmedBrief.length < 10) {
    emit({ type: 'error', message: 'The design brief is too short — describe the plant you want in a sentence or two.' });
    emit({ type: 'done', success: false, graph: null, unitCount: 0, streamCount: 0 });
    return;
  }

  let seq = 0;
  const ws = new AgentWorkspace();
  const tool = (name: string, args: Record<string, unknown>) => {
    seq++;
    const res = ws.execute({ tool: name, args });
    emit({ type: 'tool', seq, name, args, ok: res.ok, summary: res.summary });
    if (ws.mutated) emit({ type: 'graph', graph: ws.snapshot() });
    if (name === 'solve' && res.ok) {
      const s = ws.solveSummary();
      if (s) emit({ type: 'solve', seq, solve: s });
    }
    return res;
  };

  try {
    // ---------------------------------------------------------- 1. architect
    emit({ type: 'phase', phase: 'architect', label: 'Architect — reading the brief and planning the flowsheet' });
    const plan = await chatJson(llm, [
      { role: 'assistant', content: architectSystem() },
      { role: 'user', content: architectUser(trimmedBrief) },
    ], 'architect');
    const units = Array.isArray(plan.units) ? plan.units : [];
    if (units.length === 0) throw new Error('the architect produced no unit plan');
    const approach = typeof plan.approach === 'string' ? plan.approach : '';
    const notes = Array.isArray(plan.notes) ? plan.notes.map(String).filter(Boolean) : [];
    emit({
      type: 'message',
      role: 'architect',
      text: `${approach}\n${notes.length > 0 ? `\nNotes: ${notes.join(' · ')}` : ''}\n\nPlan: ${units.length} units, ${Array.isArray(plan.streams) ? plan.streams.length : 0} streams.`,
    });
    const planJson = JSON.stringify(plan);

    // ---------------------------------------------------------- 2. engineer
    emit({ type: 'phase', phase: 'engineer', label: 'Engineer — building the plant with tools' });
    const convo: LlmMessage[] = [
      { role: 'assistant', content: engineerSystem() },
      { role: 'user', content: engineerUser(trimmedBrief, planJson) },
    ];

    let refusedDone = false;
    let refusedDoneCount = 0;
    /** system + brief/plan stay; the tail is trimmed so long builds do not
     *  grow each request into the API's token/minute quota */
    const trimmedConvo = (): LlmMessage[] => {
      if (convo.length <= 16) return convo;
      return [convo[0], convo[1], ...convo.slice(-12)];
    };
    for (let turn = 1; turn <= MAX_ENGINEER_TURNS; turn++) {
      const isLast = turn === MAX_ENGINEER_TURNS;
      let raw: Record<string, unknown>;
      try {
        raw = await chatJson(llm, trimmedConvo(), `engineer:${turn}`);
      } catch (turnErr) {
        // transient LLM failure (rate limit, outage): keep everything built
        // so far and fall through to the forced final solve — never throw
        // away built state because the model became unreachable
        emit({
          type: 'message',
          role: 'system',
          text: `Engineer session interrupted (${(turnErr as Error).message}) — verifying the plant as built so far.`,
        });
        break;
      }
      const thinking = typeof raw.thinking === 'string' ? raw.thinking : '';
      let actions = Array.isArray(raw.actions) ? raw.actions : [];
      const wantsDone = raw.done === true;

      // sanitize + cap the action batch
      actions = actions
        .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
        .map((a) => ({ tool: String((a as { tool?: unknown }).tool ?? ''), args: ((a as { args?: unknown }).args ?? {}) as Record<string, unknown> }))
        .filter((a) => a.tool.length > 0)
        .slice(0, MAX_ACTIONS_PER_TURN);
      if (ws.actionCount + actions.length > MAX_ACTIONS_TOTAL) {
        actions = actions.slice(0, Math.max(0, MAX_ACTIONS_TOTAL - ws.actionCount));
      }
      if (thinking) emit({ type: 'message', role: 'engineer', text: thinking });

      // empty turn: demand progress; premature done: refuse (empty canvas OR never solved)
      const solvedYet = ws.lastResult !== null;
      if (wantsDone && !solvedYet && !refusedDone && refusedDoneCount < 2) {
        refusedDone = true;
        refusedDoneCount++;
        convo.push({ role: 'assistant', content: JSON.stringify(raw).slice(0, 4000) });
        convo.push({
          role: 'user',
          content:
            ws.graph.units.length < 3
              ? 'REJECTED: you marked the build done with an empty or nearly-empty canvas. Continue building — place the units and streams from the plan, then validate and solve before declaring done.'
              : 'REJECTED: you declared the build done, but the plant has never solved successfully — run validate, fix every issue it reports, then solve, then read the product stream against the brief. Only then declare done.',
        });
        continue;
      }

      const results: { tool: string; ok: boolean; summary: string }[] = [];
      for (const a of actions) {
        const res = tool(a.tool, a.args);
        results.push({ tool: a.tool, ok: res.ok, summary: res.summary });
      }

      if (wantsDone || actions.length === 0 || isLast) {
        if (isLast && !wantsDone) {
          const state = { units: ws.graph.units.length, streams: ws.graph.streams.length, controllers: ws.graph.controllers.length, solved: ws.lastResult !== null };
          const issues = validateGraph(ws.graph).map((i) => i.message);
          convo.push({ role: 'assistant', content: JSON.stringify(raw).slice(0, 4000) });
          let final: Record<string, unknown>;
          try {
            final = await chatJson(llm, [...convo, { role: 'user', content: engineerFinalNudge(state, issues) }], 'engineer:final');
          } catch {
            final = {};
          }
          if (final.done === true && typeof final.doneReason === 'string') {
            emit({ type: 'message', role: 'engineer', text: `Done: ${final.doneReason}` });
          } else if (Array.isArray(final.actions) && final.actions.length > 0) {
            for (const a of final.actions.slice(0, MAX_ACTIONS_PER_TURN)) {
              const call = a as { tool?: unknown; args?: unknown };
              const res = tool(String(call.tool ?? ''), (call.args ?? {}) as Record<string, unknown>);
              results.push({ tool: String(call.tool ?? ''), ok: res.ok, summary: res.summary });
            }
          }
          break;
        }
        if (wantsDone) {
          const reason = typeof raw.doneReason === 'string' ? raw.doneReason : '';
          emit({ type: 'message', role: 'engineer', text: reason ? `Done: ${reason}` : 'Done.' });
          break;
        }
        // empty turn without done: nudge
        convo.push({ role: 'assistant', content: JSON.stringify(raw).slice(0, 4000) });
        convo.push({
          role: 'user',
          content:
            'Your last turn proposed no actions. Either propose tool actions (units, streams, specs, validate, solve) or set "done": true with a doneReason. Reply with the JSON turn now.',
        });
        continue;
      }

      convo.push({ role: 'assistant', content: JSON.stringify(raw).slice(0, 4000) });
      convo.push({
        role: 'user',
        content: engineerResults(results, {
          units: ws.graph.units.length,
          streams: ws.graph.streams.length,
          controllers: ws.graph.controllers.length,
          solved: ws.lastResult !== null,
        }),
      });
    }

    // ------------------------------------------------ 3. solver — the truth
    emit({ type: 'phase', phase: 'solver', label: 'Solver — final validation and simulation' });
    const finalValidate = tool('validate', {});
    let solvedOk = false;
    let solveSummary: SolveSummary | null = null;
    if (finalValidate.ok) {
      const finalSolve = tool('solve', {});
      solvedOk = finalSolve.ok;
      solveSummary = ws.solveSummary();
    } else if (ws.lastResult) {
      // validation regressed after the last successful solve (e.g. a late
      // mutation) — report the stale solve honestly
      solveSummary = ws.solveSummary();
      emit({ type: 'message', role: 'system', text: 'Note: the graph changed after its last successful solve — reported numbers are from the previous state.' });
    }

    // ---------------------------------------------------------- 4. critic
    emit({ type: 'phase', phase: 'critic', label: 'Critic — reviewing the plant against the brief' });
    const facts = solveSummary
      ? [
          `solved: yes (converged: ${solveSummary.converged}, ${solveSummary.iterations} loop iterations, ${solveSummary.solveMs.toFixed(0)} ms)`,
          `production: ${solveSummary.kpis.productionTpd.toFixed(1)} t/d liquid ammonia`,
          `product purity: ${(solveSummary.kpis.productPurityWt * 100).toFixed(2)} wt %`,
          `per-pass conversion: ${(solveSummary.kpis.perPassConv * 100).toFixed(1)} %`,
          `overall conversion: ${(solveSummary.kpis.overallConv * 100).toFixed(1)} %`,
          `make-up H2/N2: ${solveSummary.kpis.h2n2Ratio.toFixed(3)}`,
          `loop inerts: ${(solveSummary.kpis.loopInerts * 100).toFixed(1)} %`,
          `specific energy: ${solveSummary.kpis.specificEnergyGJt.toFixed(2)} GJ/t NH3`,
          `worst element-balance error: ${solveSummary.balanceWorstRelErr.toExponential(2)}`,
          solveSummary.warnings.length > 0 ? `warnings: ${solveSummary.warnings.join('; ')}` : 'warnings: none',
        ].join('\n')
      : 'solved: NO — the flowsheet did not pass validation or failed to solve';
    let verdict: CriticVerdict;
    try {
      const verdictRaw = await chatJson(llm, [
        { role: 'assistant', content: criticSystem() },
        { role: 'user', content: criticUser(trimmedBrief, facts, graphDigest(ws.graph)) },
      ], 'critic');
      verdict = sanitizeVerdict(verdictRaw, solvedOk);
    } catch (criticErr) {
      // the critic is an LLM call — if it is unavailable (rate limit, outage)
      // the build still deserves a verdict from the deterministic facts
      emit({ type: 'message', role: 'system', text: `Critic call unavailable (${(criticErr as Error).message}) — verdict computed from solver facts only.` });
      verdict = factsVerdict(solvedOk, solveSummary);
    }
    emit({ type: 'verdict', verdict });

    // ---------------------------------------------------------- 5. done
    const success = solvedOk && finalValidate.ok && verdict.verdict !== 'fail';
    emit({
      type: 'done',
      success,
      graph: ws.snapshot(),
      unitCount: ws.graph.units.length,
      streamCount: ws.graph.streams.length,
    });
  } catch (e) {
    emit({ type: 'error', message: (e as Error).message || 'unexpected agent failure' });
    emit({ type: 'done', success: false, graph: ws.snapshot(), unitCount: ws.graph.units.length, streamCount: ws.graph.streams.length });
  }
}

function sanitizeVerdict(raw: Record<string, unknown>, solved: boolean): CriticVerdict {
  const v = raw.verdict === 'pass' || raw.verdict === 'revise' || raw.verdict === 'fail' ? raw.verdict : solved ? 'revise' : 'fail';
  const scoreRaw = typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : v === 'pass' ? 80 : v === 'revise' ? 55 : 25;
  return {
    verdict: v,
    score: Math.max(0, Math.min(100, Math.round(scoreRaw))),
    summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : 'No summary provided.',
    strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String).filter((s) => s.trim()).slice(0, 6) : [],
    issues: Array.isArray(raw.issues) ? raw.issues.map(String).filter((s) => s.trim()).slice(0, 6) : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map(String).filter((s) => s.trim()).slice(0, 6) : [],
  };
}

/** deterministic verdict when the critic LLM is unavailable — solver facts only */
function factsVerdict(solved: boolean, s: SolveSummary | null): CriticVerdict {
  if (!solved || !s) {
    return {
      verdict: 'fail',
      score: 20,
      summary: 'The flowsheet did not solve (or failed validation). No numeric results to certify.',
      strengths: [],
      issues: ['plant did not produce a solved result'],
      suggestions: ['fix the validation issues shown in the log, then rebuild'],
    };
  }
  const clean = s.converged && s.balanceWorstRelErr < 1e-4 && s.warnings.length === 0;
  return {
    verdict: clean ? 'pass' : 'revise',
    score: clean ? 85 : 55,
    summary: clean
      ? `Solver-certified: converged in ${s.iterations} iterations, element balance closed to ${s.balanceWorstRelErr.toExponential(1)}, production ${s.kpis.productionTpd.toFixed(1)} t/d at ${(s.kpis.productPurityWt * 100).toFixed(1)} wt % purity.`
      : `Solver-certified numbers exist, but the run is not clean (converged: ${s.converged}${s.warnings.length > 0 ? `; warnings: ${s.warnings.slice(0, 2).join('; ')}` : ''}).`,
    strengths: clean ? ['converged and element-balanced', `production ${s.kpis.productionTpd.toFixed(1)} t/d`] : ['produces a solvable flowsheet'],
    issues: clean ? [] : [s.converged ? `warnings: ${s.warnings.slice(0, 2).join('; ')}` : 'synthesis loop did not converge'],
    suggestions: [],
  };
}
