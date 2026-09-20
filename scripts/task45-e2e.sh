#!/bin/bash
# Task 45 E2E — Charcoal + neutral action buttons (white-in-light / dark-in-dark)
set -u
cd /home/z/my-project
mkdir -p scripts/task45-shots

# probe: every action element's bg + text, body bg, and dark-surface neutrality
PROBE='(() => {
  const pick = (sel, txt, exact) => Array.from(document.querySelectorAll(sel))
    .find(e => exact ? e.textContent.trim() === txt : e.textContent.includes(txt));
  const cs = el => el ? getComputedStyle(el).backgroundColor + "|" + getComputedStyle(el).color : "NOT FOUND";
  const cta = document.querySelector("a[href=\"/plant/builder\"]");
  const hearOrion = pick("button", "Hear Orion", false);
  const assembled = pick("button", "ASSEMBLED", true);
  const startHere = pick("span", "START HERE", true);
  const card = document.querySelector(".card-lift, section .rounded-2xl");
  const isGreen = (bg) => { const m = bg.match(/rgb\((\d+), (\d+), (\d+)\)/); if(!m) return false;
    const [r,g,b] = [+m[1],+m[2],+m[3]]; return g > r + 30 && g > b + 30; };
  const btns = [cta, hearOrion, assembled, startHere].filter(Boolean);
  const greenBtns = btns.filter(e => isGreen(getComputedStyle(e).backgroundColor)).length;
  const paperVar = getComputedStyle(document.documentElement).getPropertyValue("--fs-paper").trim();
  return JSON.stringify({
    htmlClass: document.documentElement.className,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    paperVar: paperVar,
    heroCta: cs(cta),
    hearOrion: cs(hearOrion),
    assembledToggle: cs(assembled),
    startHereBadge: cs(startHere),
    greenButtons: greenBtns
  });
})()'

echo "════ DARK (default) ════"
agent-browser set viewport 1440 900 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser eval "$PROBE"
sleep 1
agent-browser screenshot scripts/task45-shots/home-dark-hero.png >/dev/null; echo "shot home-dark-hero"
agent-browser screenshot --full scripts/task45-shots/home-dark-full.png >/dev/null; echo "shot home-dark-full"

echo "════ LIGHT (white buttons) ════"
agent-browser eval "localStorage.setItem('theme','light')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser eval "$PROBE"
sleep 1
agent-browser screenshot scripts/task45-shots/home-light-hero.png >/dev/null; echo "shot home-light-hero"
agent-browser screenshot --full scripts/task45-shots/home-light-full.png >/dev/null; echo "shot home-light-full"
agent-browser eval "document.getElementById('learning-path').scrollIntoView()" >/dev/null
sleep 1.5
agent-browser screenshot scripts/task45-shots/light-cards.png >/dev/null; echo "shot light-cards"
agent-browser eval "(function(){const m=Array.from(document.querySelectorAll('section')).find(s=>s.textContent.includes('Meet your guide'));if(m)m.scrollIntoView();return 'ok'})()" >/dev/null
sleep 2
agent-browser screenshot scripts/task45-shots/light-orion-3d.png >/dev/null; echo "shot light-orion-3d"
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser screenshot scripts/task45-shots/builder-light.png >/dev/null; echo "shot builder-light"

echo "════ DARK round 2 ════"
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser screenshot scripts/task45-shots/builder-dark.png >/dev/null; echo "shot builder-dark"
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 4
agent-browser screenshot scripts/task45-shots/reference-dark.png >/dev/null; echo "shot reference-dark"
agent-browser open http://localhost:3000/plant/flash >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser screenshot scripts/task45-shots/flash-dark.png >/dev/null; echo "shot flash-dark"
agent-browser set viewport 390 844 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser screenshot scripts/task45-shots/home-dark-mobile.png >/dev/null; echo "shot home-dark-mobile"
agent-browser set viewport 1440 900 >/dev/null

echo "════ fixed-window law spot-check (8s, dark) ════"
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "(async () => {
  const heights = new Set(); const tops = new Set();
  const t0 = performance.now();
  while (performance.now() - t0 < 8000) {
    const d = document.querySelector('[aria-label^=Looping]');
    const o = Array.from(document.querySelectorAll('span')).find(s => s.textContent === 'Meet your guide');
    if (d) heights.add(Math.round(d.getBoundingClientRect().height));
    if (o) tops.add(Math.round(o.getBoundingClientRect().top + window.scrollY));
    await new Promise(r => setTimeout(r, 160));
  }
  return JSON.stringify({ demoHeights: Array.from(heights), orionTops: Array.from(tops) });
})()"

echo "════ console errors ════"
agent-browser errors 2>&1 | tail -3
echo "E2E_DONE"
