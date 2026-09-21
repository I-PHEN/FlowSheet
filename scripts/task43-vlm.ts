import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/task43-shots/';

const DARK = [
  'home-dark-hero.png',
  'home-dark-full.png',
  'builder-dark.png',
  'reference-dark.png',
  'flash-dark.png',
  'home-dark-mobile.png',
];
const LIGHT = [
  'home-light-hero.png',
  'home-light-full.png',
  'builder-light.png',
  'reference-light.png',
];

const DARK_PROMPT =
  'Screenshots of "Flowsheet", a chemical plant simulator web app, in its NEW dark theme called "Control Room": cool blue-black background (#0B0E12), steel-blue surfaces, ONE luminous green (#4CC38A) reserved for brand moments (the ORION nameplate, the "TAUGHT BY ORION" chip, TOUR READY), muted sage/steel/amber for chemical streams on the flowsheet. ' +
  'Image 1 = landing hero (builder demo loop, converged). Image 2 = full landing page. Image 3 = the AI builder page. Image 4 = a reference ammonia plant flowsheet (note the animated flow dots, which have soft glow halos). Image 5 = the flash separation study workspace. Image 6 = mobile 390px landing. ' +
  'For EACH image answer tersely: (a) does it read as a professional, cohesive dark "control room" (like a DCS console) — or does anything clash? (b) is ALL text legible (no dim gray-on-dark strain)? (c) does the luminous green accent look intentional and complementary — not muddy, not neon? (d) any surface, chip, border or panel that looks broken, washed out, illegible, or leftover from an old theme? (e) any overlap/clipping/layout defect. ' +
  'Plain text only, one numbered line per image, then a final line VERDICT: SHIP or FIX.';

const LIGHT_PROMPT =
  'Screenshots of the same app in its NEW light theme "Cool Gray Studio": cool blue-gray canvas (#EEF1F4), near-white surfaces, deep green accent (#0D7546) for brand moments, muted chemistry hues on the flowsheet. This replaced an old warm beige palette that clashed with the green. ' +
  'Image 1 = landing hero. Image 2 = full landing page. Image 3 = the AI builder page. Image 4 = a reference ammonia plant flowsheet. ' +
  'For EACH image answer tersely: (a) does the palette read cool and cohesive — no warm/beige remnants, no clash between green and the neutrals? (b) all text legible? (c) any element that looks broken, muddy, or leftover from the old theme? (d) any overlap/clipping/layout defect. ' +
  'Plain text only, one numbered line per image, then a final line VERDICT: SHIP or FIX.';

async function review(zai: Awaited<ReturnType<typeof ZAI.create>>, label: string, shots: string[], prompt: string) {
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const s of shots) {
    const b64 = fs.readFileSync(DIR + s).toString('base64');
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } });
  }
  const messages: VisionMessage[] = [{ role: 'user', content }];
  const response = await zai.chat.completions.createVision({
    model: 'glm-4.6v',
    messages,
    thinking: { type: 'disabled' },
  });
  console.log(`\n════ ${label} ════`);
  console.log(response.choices[0]?.message?.content ?? 'NO CONTENT');
}

async function main() {
  try {
    const zai = await ZAI.create();
    await review(zai, 'DARK · Control Room (primary)', DARK, DARK_PROMPT);
    await review(zai, 'LIGHT · Cool Gray Studio (secondary)', LIGHT, LIGHT_PROMPT);
  } catch (e) {
    console.error('VLM check failed:', e);
    process.exit(1);
  }
}

main();
