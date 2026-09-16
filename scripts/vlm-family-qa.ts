/** VLM QA of the family UI screenshots (createVision pattern from the VLM skill) */
import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import { readFileSync } from 'fs';

async function main() {
  const zai = await ZAI.create();
  const shots: Array<[string, string]> = [
    ['/tmp/meoh-viewer.png', 'the project viewer for a methanol plant: header with a METHANOL·CH3OH badge, family KPI numbers (crude MeOH t/d, purity, per-pass conversion), critic verdict, guided-tour section'],
    ['/tmp/meoh-tour-live.png', 'the guided tour RUNNING: a tour step panel with title and narration text, step progress, voice/music/replay controls, flowsheet canvas with a unit spotlighted'],
    ['/tmp/meoh-dark.png', 'the same project viewer in DARK MODE: readable panels, no washed-out text, dark canvas'],
  ];
  for (const [path, expect] of shots) {
    const b64 = readFileSync(path).toString('base64');
    const messages: VisionMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Rate this web app screenshot 0-10 for visual quality and correctness. Expected: ${expect}. Answer in 2-3 short lines: score, what looks right, any defect (text overflow, unreadable contrast, broken layout).` },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ];
    try {
      const res = await zai.chat.completions.createVision({ model: 'glm-4.6v', messages, thinking: { type: 'disabled' } });
      console.log(`\n=== ${path} ===\n${res.choices?.[0]?.message?.content ?? '(no reply)'}`);
    } catch (e) {
      console.log(`\n=== ${path} === VLM unavailable: ${(e as Error).message}`);
    }
  }
}
void main();
