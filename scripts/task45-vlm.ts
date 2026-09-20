import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/task45-shots/';

const SHOTS = [
  'home-dark-hero.png',
  'home-dark-full.png',
  'home-light-hero.png',
  'light-cards.png',
  'light-orion-3d.png',
  'builder-dark.png',
  'builder-light.png',
  'reference-dark.png',
  'flash-dark.png',
  'home-dark-mobile.png',
];

const PROMPT =
  'Screenshots of "Flowsheet", a chemical plant simulator web app, after a rework with THREE strict rules. ' +
  'RULE 1: action buttons are NEUTRAL — WHITE with dark text in light mode, DARK CHARCOAL with light text in dark mode. Absolutely NO green buttons/badges/toggles anywhere in the UI chrome. ' +
  'RULE 2: the dark theme is professional CHARCOAL — true-black background with NEUTRAL gray panels (no blue tint), like GitHub/Linear dark. ' +
  'RULE 3: card frames/borders are clear, lighter hairlines, neutral. ' +
  '(Green is still allowed ONLY as small chemistry accents on the flowsheet canvas itself: product streams and flow dots.) ' +
  'Image 1 = dark landing hero. Image 2 = dark full landing. Image 3 = light landing hero (Build button must be WHITE). Image 4 = light learning cards (START HERE badge white, not dark, not green). Image 5 = light Meet-Orion zone (white Hear Orion button, white ASSEMBLED active toggle). Image 6 = dark AI builder. Image 7 = light AI builder. Image 8 = dark reference plant flowsheet. Image 9 = dark flash workspace. Image 10 = dark mobile. ' +
  'For EACH image answer tersely: (a) any GREEN button/badge/chrome element that violates rule 1? (b) dark shots: do panels read as NEUTRAL charcoal gray (no blue tint)? (c) are action buttons white-in-light / dark-charcoal-in-dark with readable text? (d) do card frames read as clear, neutral hairlines? (e) any overlap/clipping/broken element? ' +
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
