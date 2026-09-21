import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/task44-shots/';

const SHOTS = [
  'home-dark-hero.png',
  'home-light-hero.png',
  'light-cards.png',
  'light-orion-3d.png',
  'builder-dark.png',
  'builder-light.png',
  'reference-dark.png',
  'home-dark-mobile.png',
];

const PROMPT =
  'Screenshots of "Flowsheet", a chemical plant simulator web app, after a two-part fix. ' +
  '(1) The dark theme "Control Room" now uses a TRUE BLACK background (#000000, like an OLED screen / GitHub black) with steel blue-black panels floating on it, and ONE luminous green (#4CC38A) for actions. ' +
  '(2) Formerly-inverted buttons (they used to be dark in light mode / light in dark mode) are now GREEN ACTION BUTTONS in BOTH themes: "Build a plant with AI", "Hear Orion", the ASSEMBLED/CUTAWAY toggle active side, the START HERE badge. ' +
  'Image 1 = dark landing hero. Image 2 = light landing hero (the green Build button must NOT look dark/black anymore). Image 3 = light learning cards (START HERE badge + ORION chips). Image 4 = light Meet-Orion zone (Hear Orion button + ASSEMBLED/CUTAWAY toggle + 3D card). Image 5 = dark AI builder page. Image 6 = light AI builder page. Image 7 = dark reference ammonia plant flowsheet (flow dots have soft glow). Image 8 = dark mobile 390px. ' +
  'For EACH image answer tersely: (a) dark shots: does the background read as essentially PURE black (not gray, not blue-tinted)? (b) are the action buttons green and clearly readable in their theme (no dark-on-dark or black buttons in light mode)? (c) all text legible? (d) any surface, chip, border, panel that looks broken, washed out, or mismatched? (e) any overlap/clipping/layout defect? ' +
  'Plain text only, one numbered line per image, then a final line VERDICT: SHIP or FIX.';

async function main() {
  try {
    const zai = await ZAI.create();
    const content: any[] = [{ type: 'text', text: PROMPT }];
    for (const s of SHOTS) {
      const b64 = fs.readFileSync(DIR + s).toString('base64');
      content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } });
    }
    const messages: VisionMessage[] = [{ role: 'user', content }];
    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages,
      thinking: { type: 'disabled' },
    });
    console.log(response.choices[0]?.message?.content ?? 'NO CONTENT');
  } catch (e) {
    console.error('VLM check failed:', e);
    process.exit(1);
  }
}

main();
