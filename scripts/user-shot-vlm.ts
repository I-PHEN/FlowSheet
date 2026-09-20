import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

async function main() {
  try {
    const zai = await ZAI.create();
    const b64 = fs.readFileSync('/home/z/my-project/upload/pasted_image_1789871563156.png').toString('base64');
    const messages: VisionMessage[] = [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'This is a screenshot of a web app landing page (Flowsheet, an AI chemical plant simulator). The owner complains: (1) too much text, (2) the looping builder animation in the hero "keeps expanding", shifting content below downward. Describe precisely: (a) what sections/cards/text blocks are visible top to bottom; (b) where large text blocks are (quote first words); (c) anything that looks like the builder demo panel and its caption/status area; (d) any visible spacing/alignment oddities. Terse, plain text.',
        },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    }];
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
