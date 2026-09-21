// quick: is the LLM API alive at all right now?
import ZAI from 'z-ai-web-dev-sdk';
const t0 = Date.now();
const zai = await ZAI.create();
const r = await zai.chat.completions.create({
  messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  thinking: { type: 'disabled' },
});
console.log('LLM reply:', JSON.stringify(r.choices[0]?.message?.content), `${Date.now() - t0}ms`);
