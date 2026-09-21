import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/';
const SHOTS = ['hero-C-1-hero.png', 'hero-C-2-midbuild.png', 'hero-C-3-converged.png', 'hero-C-4-dark.png', 'hero-C-5-mobile.png'];

async function main() {
  try {
    const zai = await ZAI.create();
    const content: any[] = [
      {
        type: 'text',
        text:
          'Screenshots of the landing page of "Flowsheet", an AI chemical plant simulator. The hero has a looping builder demo: full-width plant diagram stage on top, console strip below (prompt box left, role chips + event feed right). ' +
          'Image 1 = just loaded (typing phase, stage shows dot grid). Image 2 = mid-build (units placed). Image 3 = converged (KPI chips top-right, stamp bottom-right). Image 4 = the Meet your guide section in dark mode (voice card + 3D exchanger card). Image 5 = mobile 390px hero. ' +
          'For EACH: (a) broken layout, overlap, clipped text, contrast problems; (b) does the demo look alive and balanced (no big blank voids)? (c) professional and restrained? (d) one concrete improvement if any. Terse, plain text.',
      },
    ];
    for (const s of SHOTS) {
      const b64 = fs.readFileSync(DIR + s).toString('base64');
      content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } });
    }
    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [{ role: 'user', content } as VisionMessage],
      thinking: { type: 'disabled' },
    });
    console.log(response.choices[0]?.message?.content ?? 'NO CONTENT');
  } catch (e) {
    console.error('VLM failed:', e);
    process.exit(1);
  }
}

main();
