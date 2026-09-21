import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import * as fs from 'fs';

const DIR = '/home/z/my-project/scripts/fixa-shots/';

const SHOTS = [
  'hero-dark-idle.png',
  'hero-live-ribbon.png',
  'hero-light-idle.png',
  'hero-dark-mobile.png',
  'tour-stop1-overview.png',
  'tour-stop3-closeup.png',
  'tour-outro-wide2.png',
  'tour-music-popover.png',
  'tour-mobile-card.png',
];

const PROMPT =
  'Screenshots of "Flowsheet", a chemical plant simulator web app, after "Fix Pack A" — four UI changes. ' +
  'CHANGE 1 (images 1-4): the landing page voice card was rebuilt as a DARK PLAYER CARD (near-black #0B0B0D in BOTH themes, like an embedded audio player): top row = title "Welcome to the plant" + REAL VOICE tag; then ONE mono status line; then a glowing white WAVEFORM ribbon on near-black; bottom transport = Orion avatar circle + ORION · YOUR GUIDE + NARRATED pill, and right side play/pause + replay + volume buttons + "· space" hint. ' +
  'CHANGE 2 (images 5, 6, 8): during guided tours the caption bar is now a BOUNDED, centered player CARD (max 880px wide, rounded corners, full border, clear gaps from the left/right screen edges) — NOT a full-width strip touching both edges. Image 5 = tour stop 1 where the camera shows the WHOLE flowsheet (overview). Image 6 = zoomed close-up stop. Image 8 = final stop, again whole flowsheet. ' +
  'CHANGE 3 (image 7): the music control opens a small volume popover with a slider (MUSIC + percentage). ' +
  'CHANGE 4 (image 9): same bounded tour card on a 390px mobile viewport (small side gaps, no edge-touching). ' +
  'For EACH image answer tersely: (a) voice card shots: does it read as a single elegant dark player with a visible waveform and clean transport — any clutter, misalignment, or unreadable text? (b) tour shots: is the caption card clearly INSET from the screen edges with rounded corners (not edge-to-edge)? (c) is the flowsheet legible behind/above the card? (d) any overlap, clipping, or broken element? ' +
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
