import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/t66-shots/';

const SHOTS = [
  '01-hero-light-idle.png',
  '02-hero-light-midloop.png',
  '03-hero-light-howitworks.png',
  '04-hero-light-converged.png',
  '05-rail-meetorion-light.png',
  '06-hero-dark-midloop.png',
  '07-hero-mobile-light.png',
  '08-rail-mobile-light.png',
  '09-reference-light.png',
  '10-builder-light.png',
];

const PROMPT =
  'Screenshots of the landing page of "Flowsheet", an AI chemical plant simulator, after a hero redesign round with SIX intended changes. ' +
  'CHANGE 1 (headline): the setup line "Describe any chemical plant." is now SMALLER and medium weight; the payoff line "Watch AI engineer it — live." is now BIGGER, bolder, and GREEN — a clear visual hierarchy where the payoff dominates. ' +
  'CHANGE 2: the old three text pills (BUILT BY AI / TAUGHT BY ORION / EXPLORED IN 3D) are GONE from the hero; instead there is one quiet visual rail of three glyph stations on a hairline (visible when scrolled, images 5 and 8). ' +
  'CHANGE 3 (demo panel): the agent-log text feed is gone; under the diagram there is now a slim prompt bar (typed sentence + caret) and ONE quiet status line with a subtle shimmer, plus a "See how it works" toggle that expands the full log (image 3 shows it expanded). ' +
  'CHANGE 4: the flowsheet diagram is bigger and dominant — the demo card is mostly the white diagram stage, with only a thin window bar, the prompt bar, and the status line. ' +
  'CHANGE 5 (light mode): the PAGE background is a soft gray-blue; the demo card and other cards are WHITE and clearly float on it (not two same-neutrals). The diagram uses at most two chromatic stream colors (steel blue, sage green) plus neutral slate. ' +
  'CHANGE 6: generous vertical spacing between the hero, the rail, and the "Meet your guide" section (image 5). ' +
  'Images in order: 1 light hero idle, 2 light hero mid-build, 3 light hero with the how-it-works panel expanded, 4 light hero converged (result chips), 5 light scrolled to the rail + Meet your guide, 6 DARK hero mid-build (dark theme must stay healthy: true black, no light bleed), 7 mobile 414px light hero, 8 mobile scrolled to the rail, 9 the reference plant page light (gray-blue page, white sheet card), 10 the builder page light. ' +
  'For EACH image answer tersely: (a) is the headline hierarchy clear (small setup line, big bold green payoff)? (b) is the demo panel clean — diagram dominant, no log dump, one status line? (c) light shots: does the page read as a distinct gray-blue with white cards floating on it? (d) any overlap, clipping, cramped spacing, or broken element? ' +
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
