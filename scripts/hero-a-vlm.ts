import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/';
const SHOTS = ['hero-A-2-meetorion-light.png', 'hero-A-3-dark.png', 'hero-A-4-mobile.png'];

async function main() {
  try {
    const zai = await ZAI.create();
    const content: any[] = [
      {
        type: 'text',
        text:
          'These are screenshots of the landing page of "Flowsheet", an AI-native chemical plant simulator web app. ' +
          'Image 1 = desktop light mode, scrolled to a section titled "Meet your guide" with an ORION nameplate and a voice card. ' +
          'Image 2 = same area in dark mode. Image 3 = mobile 390px. ' +
          'The hero above (partially visible in some shots) has a headline, three small chips reading BUILT BY AI → TAUGHT BY ORION (green) → EXPLORED IN 3D, and a paragraph. ' +
          'For EACH image report: (a) any broken layout, overlapping/clipped/unreadable text, or contrast problems; ' +
          '(b) does the section look professional and restrained (no flashy effects)? ' +
          '(c) does the green ORION chip/plate read clearly? (d) one concrete improvement if any. ' +
          'Be terse and concrete. Plain text only.',
      },
    ];
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
