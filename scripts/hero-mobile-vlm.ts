import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/';

async function main() {
  try {
    const zai = await ZAI.create();
    const content: any[] = [
      {
        type: 'text',
        text:
          'Two mobile screenshots (390px) of the same looping builder demo panel, taken seconds apart. ' +
          'Image 1 = early phase (prompt still typing, no units placed yet — stage shows only a faint dot grid). ' +
          'Image 2 = mid-build (units being placed on the sheet). ' +
          'Question 1: In EACH image, describe exactly what you see inside the demo panel from top to bottom (window bar, diagram stage, console strip). ' +
          'Question 2: In image 1, is the empty dot-grid stage clearly an intentional drafting sheet, or does it read as a broken/collapsed element? ' +
          'Question 3: Any clipping, overlap, or layout break in either? Terse, plain text.',
      },
    ];
    for (const s of ['hero-C-6-mobile-typing.png', 'hero-C-7-mobile-build.png']) {
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
