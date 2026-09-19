/**
 * LIVE probe (costs ~a few hundred tokens ONCE): verifies that
 *   1. the SDK reports usage on completions and ZaiLlm meters it, and
 *   2. CachedLlm serves the identical second call from disk (zero tokens).
 * Run: bun scripts/probe-usage.ts
 */
import { CachedLlm, TokenMeter, ZaiLlm } from '../src/lib/agent/llm';
import path from 'path';
import fs from 'fs';

const dir = path.join(process.cwd(), 'scripts', '.probe-cache');
fs.rmSync(dir, { recursive: true, force: true });
process.env.AGENT_LLM_CACHE = '1';
process.env.AGENT_LLM_CACHE_DIR = dir;

const msgs = [
  { role: 'user' as const, content: 'Reply with exactly this JSON and nothing else: {"ok": true, "note": "probe"}' },
];

const meter = new TokenMeter();
const llm = new CachedLlm(new ZaiLlm(meter), meter);

console.log('call 1 (real, should be metered):');
const a = await llm.chat(msgs, 'router');
console.log('  reply:', a.slice(0, 120).replace(/\n/g, ' '));
console.log('  meter:', JSON.stringify(meter.snapshot()));

console.log('call 2 (identical, should be a cache hit):');
const b = await llm.chat(msgs, 'router');
console.log('  reply identical:', a === b);
const snap = meter.snapshot();
console.log('  meter:', JSON.stringify(snap));

const ok =
  snap.promptTokens > 0 &&
  snap.completionTokens > 0 &&
  snap.calls === 1 &&
  snap.cacheHits === 1 &&
  snap.cacheSavedTokens > 0;
console.log(ok ? '\nPROBE PASS — usage captured + cache hit recorded' : '\nPROBE FAIL');
fs.rmSync(dir, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
