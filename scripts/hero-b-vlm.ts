import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/';
const SHOTS = ['hero-B-6-hero-light.png', 'hero-B-1-section-light.png', 'hero-B-2-cutaway.png', 'hero-B-3-dark.png', 'hero-B-4-mobile.png'];

async function main() {
  try {
    const zai = await ZAI.create();
    const content: any[] = [
      {
        type: 'text',
        text:
          'Screenshots of the landing page of "Flowsheet", an AI chemical plant simulator. ' +
          'Image 1 = desktop hero: headline, three chips (BUILT BY AI → TAUGHT BY ORION → EXPLORED IN 3D), short paragraph, and a looping builder demo panel (stage with plant diagram + session rail with prompt box, role chips ARCHITECT/ENGINEER/CRITIC/DOCENT, a session feed, verdict chips). ' +
          'Image 2 = scrolled to "Meet your guide": one identity line then two cards side by side (voice card left, 3D exchanger card right). ' +
          'Image 3 = same but the 3D model is in CUTAWAY mode. Image 4 = dark mode. Image 5 = mobile 390px (the two cards stacked). ' +
          'For EACH image report: (a) broken layout, overlap, clipped or unreadable text; (b) is the builder demo balanced (not too much blank space)? (c) does the 3D card look like a real interactive viewer? (d) one concrete improvement if any. Terse, plain text.',
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
    console.error('VLM failed:', e);
    process.exit(1);
  }
}

main();
