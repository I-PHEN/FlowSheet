/**
 * LLM adapter — role calls over z-ai-web-dev-sdk, made robust.
 *
 * The z-ai SDK gives plain chat completions (no native function calling),
 * so the agent protocol is strict-JSON-in / JSON-out. This module:
 *   - wraps ZAI.create() lazily (server-side only — never import from
 *     client components)
 *   - extracts JSON from replies that may be wrapped in code fences or
 *     prose (balanced-brace scan, string-aware)
 *   - retries once with the parse error fed back when extraction fails
 *
 * The `Llm` interface is intentionally tiny so tests inject scripted
 * models and the orchestrator never touches the SDK directly.
 */

import ZAI from 'z-ai-web-dev-sdk';

export interface LlmMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface Llm {
  /** one completion; `label` is for logs only */
  chat(messages: LlmMessage[], label?: string): Promise<string>;
}

export class ZaiLlm implements Llm {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  private async client() {
    if (!this.zai) this.zai = await ZAI.create();
    return this.zai;
  }

  async chat(messages: LlmMessage[], label = 'llm'): Promise<string> {
    const client = await this.client();
    let lastMsg = '';
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          thinking: { type: 'disabled' },
        });
        const content = completion.choices[0]?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) return content;
        throw new Error('empty completion');
      } catch (e) {
        lastMsg = (e as Error).message ?? String(e);
        const rateLimited = /429|too many requests/i.test(lastMsg);
        if (attempt === 5) {
          console.error(`[agent:llm] ${label} failed after ${attempt} attempts: ${lastMsg}`);
          throw new Error(`LLM call "${label}" failed: ${lastMsg}`);
        }
        // rate limits need real cooldown (quota windows can be minutes);
        // other errors recover fast
        await new Promise((r) => setTimeout(r, rateLimited ? 8000 * 2 ** (attempt - 1) : 800 * attempt));
      }
    }
    throw new Error('unreachable');
  }
}

/**
 * Extract the first balanced JSON object from LLM output. Handles code
 * fences, leading prose, and braces inside strings. If the reply is a
 * TRUNCATED object (max-token cutoff mid-turn — the classic agentic
 * failure), attempts to close the dangling braces/brackets and parse the
 * salvageable prefix: partial action batches are safe (every action is
 * individually validated downstream).
 */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let s = text.trim();
  // strip code fences: ```json ... ``` or ``` ... ```
  const fence = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const candidate = s.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          return null;
        } catch {
          return null;
        }
      }
    }
  }
  // no balanced object — try repairing a truncated one
  const stack: string[] = [];
  inStr = false;
  esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }
  if (stack.length === 0) return null;
  const attempts: string[] = [];
  const base = s.slice(start).replace(/[,\s]+$/, '');
  attempts.push(base + (inStr ? '"' : ''));
  attempts.push(base.replace(/,\s*"[^"]*"?\s*:?\s*$/, '') + (inStr ? '"' : ''));
  for (let a of attempts) {
    // rebuild the closer against THIS candidate's actual state
    const st: string[] = [];
    let str = false;
    let e2 = false;
    for (let i = 0; i < a.length; i++) {
      const c = a[i];
      if (str) {
        if (e2) e2 = false;
        else if (c === '\\') e2 = true;
        else if (c === '"') str = false;
        continue;
      }
      if (c === '"') str = true;
      else if (c === '{' || c === '[') st.push(c);
      else if (c === '}' || c === ']') st.pop();
    }
    if (str) a += '"';
    while (st.length > 0) a += st.pop() === '{' ? '}' : ']';
    try {
      const parsed = JSON.parse(a);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // next attempt
    }
  }
  return null;
}

/**
 * One role call with strict JSON reply: chat → extract → parse; on failure,
 * up to two repair turns (raw reply + parse error fed back), then give up
 * by throwing (the orchestrator turns that into a clean degraded event).
 */
export async function chatJson(llm: Llm, messages: LlmMessage[], label = 'role'): Promise<Record<string, unknown>> {
  let raw = await llm.chat(messages, label);
  let parsed = extractJson(raw);
  if (parsed) return parsed;
  for (let repair = 1; repair <= 2; repair++) {
    const repairMsg = await llm.chat(
      [
        ...messages,
        { role: 'assistant', content: raw.slice(0, 4000) },
        {
          role: 'user',
          content:
            repair === 1
              ? 'That reply was not a valid JSON object (truncated or wrapped in prose). Reply again with ONLY the complete JSON object — no fences, no prose. Keep the exact schema requested. Shorten values if needed to finish the object.'
              : 'Still not valid JSON. Reply with a MINIMAL valid JSON object now: {"thinking": "one sentence", "actions": [], "done": false}. You may continue the work in the next turn.',
        },
      ],
      `${label}:repair${repair}`,
    );
    parsed = extractJson(repairMsg);
    if (parsed) return parsed;
    raw = repairMsg;
  }
  throw new Error(`role "${label}" did not produce JSON after repair`);
}
