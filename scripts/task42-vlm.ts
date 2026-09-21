import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/';
const SHOTS = [
  'task42-hero-typing.png',
  'task42-hero-units.png',
  'task42-hero-wiring.png',
  'task42-hero-converged.png',
  'task42-saved-card.png',
  'task42-mobile-converged.png',
  'task42-dark-converged.png',
];

async function main() {
  try {
    const zai = await ZAI.create();
    const content: any[] = [
      {
        type: 'text',
        text:
          'Screenshots of the landing page of "Flowsheet", a chemical plant simulator. The hero has a looping "AI PLANT BUILDER" demo that builds a methanol plant as SVG. ' +
          'The equipment must render as REAL P&ID symbols (a firebox furnace with stack + flames, a tall 3-bed converter with quench stubs, a shell-and-tube exchanger, a vertical separator drum with boot, a bed reactor), each with its equipment tag (D-101, R-102…) and name below it — NOT uniform rectangles. ' +
          'Image 1 = typing phase. Image 2 = units placed. Image 3 = streams wiring. Image 4 = converged with KPI chips. Image 5 = a saved-plant card thumbnail (methanol, 15 units). Image 6 = mobile 390px converged. Image 7 = dark mode converged. ' +
          'For EACH image answer tersely: (a) are the unit symbols distinct real P&ID silhouettes (furnace/converter/exchanger/drum/reactor distinguishable)? (b) are equipment tags + names legible and clear of lines/other units? (c) any overlapping, clipped, or colliding elements? (d) any layout problem. ' +
          'Plain text only, one line per image.',
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
