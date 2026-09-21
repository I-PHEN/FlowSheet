import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const IMG = '/home/z/my-project/upload/pasted_image_1789877109692.png';

async function main() {
  try {
    const zai = await ZAI.create();
    const b64 = fs.readFileSync(IMG).toString('base64');
    const content: any[] = [
      {
        type: 'text',
        text:
          'This is a screenshot from the user of a landing-page hero animation of "Flowsheet", a chemical plant simulator. ' +
          'It shows a looping "AI plant builder" demo that assembles a methanol plant flowsheet as SVG. ' +
          'Describe exactly what the unit/equipment shapes look like in the flowsheet area (shape, whether they all look the same, any text inside them), ' +
          'what the stream lines look like, and what phase the loop is in. Be terse and concrete. Plain text only.',
      },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    ];
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
