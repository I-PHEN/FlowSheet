#!/bin/bash
# Fix Pack A E2E — bounded cinema card · breathing camera · music level · hero voice player
set -u
cd /home/z/my-project
mkdir -p scripts/fixa-shots

VB='(() => {
  const svgs = Array.from(document.querySelectorAll("svg"));
  const v = svgs.map(s => s.getAttribute("viewBox") || "").filter(x => x && !x.startsWith("0 0 24") && !x.startsWith("0 0 22 8")).pop();
  return v || "NONE";
})'
CARD='(() => {
  const card = document.querySelector("[aria-label^=\"Guided tour\"]");
  if (!card) return "NO CARD";
  const r = card.getBoundingClientRect();
  const title = (card.querySelector("div.font-bold") || {}).textContent || "";
  return JSON.stringify({
    left: Math.round(r.left), rightInset: Math.round(innerWidth - r.right),
    width: Math.round(r.width), maxW: 880, title
  });
})()'

agent-browser set viewport 1440 900 >/dev/null

echo "════ 1. HOME — hero voice player, DARK (default) ════"
agent-browser open http://localhost:3000 >/dev/null
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(function(){const m=Array.from(document.querySelectorAll('span')).find(s=>s.textContent==='Meet your guide');if(m)m.closest('section').scrollIntoView();return 'ok'})()" >/dev/null
sleep 1.5
agent-browser eval "(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').includes('Hear Orion'));
  const card = btn ? btn.closest('div.rounded-2xl') : null;
  const ribbon = card ? card.querySelector('canvas') : null;
  const plate = card ? card.textContent.includes('ORION · YOUR GUIDE') : false;
  return JSON.stringify({
    cardBg: card ? getComputedStyle(card).backgroundColor : 'NOT FOUND',
    ribbon: !!ribbon, ribbonW: ribbon ? ribbon.clientWidth : 0,
    nameplate: plate,
    status: card ? (card.textContent.match(/press play[^A-Z]*/)||['?'])[0].slice(0,42) : '?'
  });
})()"
agent-browser screenshot scripts/fixa-shots/hero-dark-idle.png >/dev/null; echo "shot hero-dark-idle"

echo "════ 2. PLAY — the real-voice ribbon, live ════"
agent-browser find role button click --name "Hear Orion" >/dev/null
sleep 4
agent-browser eval "(() => {
  const n = window.__pfdAudio.narrator;
  let amp = null;
  for (let i = 0; i < 8; i++) { const a = n.amplitude(); if (a != null) { amp = a; break; } }
  return JSON.stringify({ state: n.state, amplitude: amp, progress: n.progress() });
})()"
sleep 1
agent-browser screenshot scripts/fixa-shots/hero-dark-playing.png >/dev/null; echo "shot hero-dark-playing"
agent-browser find role button click --name "Stop" >/dev/null 2>&1 || agent-browser eval "window.__pfdAudio.narrator.stop()" >/dev/null
sleep 0.5

echo "════ 3. HOME — LIGHT (a player object on a light page) ════"
agent-browser eval "localStorage.setItem('theme','light')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(function(){const m=Array.from(document.querySelectorAll('span')).find(s=>s.textContent==='Meet your guide');if(m)m.closest('section').scrollIntoView();return 'ok'})()" >/dev/null
sleep 1.5
agent-browser eval "(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').includes('Hear Orion'));
  const card = btn ? btn.closest('div.rounded-2xl') : null;
  return JSON.stringify({ cardBg: card ? getComputedStyle(card).backgroundColor : 'NOT FOUND' });
})()"
agent-browser screenshot scripts/fixa-shots/hero-light-idle.png >/dev/null; echo "shot hero-light-idle"

echo "════ 4. HOME — mobile 390 ════"
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser set viewport 390 844 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(function(){const m=Array.from(document.querySelectorAll('span')).find(s=>s.textContent==='Meet your guide');if(m)m.closest('section').scrollIntoView();return 'ok'})()" >/dev/null
sleep 1.5
agent-browser screenshot scripts/fixa-shots/hero-dark-mobile.png >/dev/null; echo "shot hero-dark-mobile"
agent-browser set viewport 1440 900 >/dev/null

echo "════ 5. REFERENCE PLANT — tour opens on the whole sheet ════"
agent-browser eval "localStorage.setItem('theme','dark'); localStorage.setItem('pfd.audio.prefs', JSON.stringify({voice:false, musicLevel:0.55}))" >/dev/null
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 3
agent-browser find text "Walk me through the plant" click >/dev/null
sleep 2.2
echo "stop 1 (the overview — must be the FULL sheet):"
agent-browser eval "$VB"
agent-browser eval "$CARD"
agent-browser screenshot scripts/fixa-shots/tour-stop1-overview.png >/dev/null; echo "shot tour-stop1-overview"

echo "════ 6. THE BREATHING POLL — wide → dive → PULL BACK → dive ════"
echo "window 1 (stop 1 dwell → the dive into M1):"
agent-browser eval "(async () => {
  const seen = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 17000) {
    const svgs = Array.from(document.querySelectorAll('svg'));
    const v = svgs.map(s => s.getAttribute('viewBox')||'').filter(x => x && !x.startsWith('0 0 24') && !x.startsWith('0 0 22 8')).pop();
    if (v && (seen.length === 0 || seen[seen.length-1] !== v)) seen.push(Math.round(performance.now()-t0) + 'ms ' + v);
    await new Promise(r => setTimeout(r, 220));
  }
  return JSON.stringify(seen);
})()"
echo "window 2 (M1 dwell → the pull-back → the dive into R1):"
agent-browser eval "(async () => {
  const seen = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 22000) {
    const svgs = Array.from(document.querySelectorAll('svg'));
    const v = svgs.map(s => s.getAttribute('viewBox')||'').filter(x => x && !x.startsWith('0 0 24') && !x.startsWith('0 0 22 8')).pop();
    if (v && (seen.length === 0 || seen[seen.length-1] !== v)) seen.push(Math.round(performance.now()-t0) + 'ms ' + v);
    await new Promise(r => setTimeout(r, 220));
  }
  return JSON.stringify(seen);
})()"

echo "════ 7. a mid-tour close-up (user jump → framing law) ════"
agent-browser find role button click --name "Go to stop 3: Splitting methane" >/dev/null
sleep 2
agent-browser eval "$VB"
agent-browser eval "$CARD"
agent-browser screenshot scripts/fixa-shots/tour-stop3-closeup.png >/dev/null; echo "shot tour-stop3-closeup"

echo "════ 8. the outro lands wide ════"
agent-browser find role button click --name "Go to stop 14: Purge, then go around again" >/dev/null
sleep 2
agent-browser eval "$VB"
agent-browser screenshot scripts/fixa-shots/tour-outro-wide.png >/dev/null; echo "shot tour-outro-wide"

echo "════ 9. music popover + level wiring ════"
agent-browser find role button click --name "Music level 55%" >/dev/null
sleep 0.6
agent-browser eval "(() => {
  const inp = document.querySelector('input[aria-label=\"Music volume\"]');
  if (!inp) return 'NO INPUT';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, '30');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'set 30';
})()"
sleep 0.8
agent-browser eval "JSON.stringify({ level: window.__pfdAudio.tourMusic.level(), state: window.__pfdAudio.tourMusic.state, pref: JSON.parse(localStorage.getItem('pfd.audio.prefs')).musicLevel })"
agent-browser screenshot scripts/fixa-shots/tour-music-popover.png >/dev/null; echo "shot tour-music-popover"
agent-browser eval "document.activeElement.blur(); (function(){const p=Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||'').startsWith('Music level')); if(p)p.click(); return 'closed'})()" >/dev/null

echo "════ 10. mobile tour card (390px — insets hold) ════"
agent-browser set viewport 390 844 >/dev/null
sleep 1.5
agent-browser eval "$CARD"
agent-browser screenshot scripts/fixa-shots/tour-mobile-card.png >/dev/null; echo "shot tour-mobile-card"
agent-browser set viewport 1440 900 >/dev/null

echo "════ console errors ════"
agent-browser errors 2>&1 | tail -4
echo "FIXA_E2E_DONE"
