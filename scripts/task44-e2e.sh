#!/bin/bash
# Task 44/45 E2E — Charcoal + neutral action buttons:
#  1. programmatic proof: action buttons paint WHITE in light / CHARCOAL in
#     dark (computed styles), NO green button anywhere, dark surfaces neutral
#  2. screenshots: dark + light (hero, cards zone, builder, reference, mobile)
#  3. fixed-window law spot-check (demo height constant over 8s)
set -u
cd /home/z/my-project
mkdir -p scripts/task44-shots

PROBE='(() => {
  const pick = (sel, txt, exact) => Array.from(document.querySelectorAll(sel))
    .find(e => exact ? e.textContent.trim() === txt : e.textContent.includes(txt));
  const cs = el => el ? getComputedStyle(el).backgroundColor + " / " + getComputedStyle(el).color : "NOT FOUND";
  const cta = document.querySelector("a[href=\"/plant/builder\"]");
  const hearOrion = pick("button", "Hear Orion", false);
  const assembled = pick("button", "ASSEMBLED", true);
  const startHere = pick("span", "START HERE", true);
  return JSON.stringify({
    bodyBg: getComputedStyle(document.body).backgroundColor,
    heroCta: cs(cta),
    hearOrion: cs(hearOrion),
    assembledToggle: cs(assembled),
    startHereBadge: cs(startHere),
    htmlClass: document.documentElement.className
  });
})()'

shot () { # name, wait-secs
  sleep "${2:-2.5}"
  agent-browser screenshot "scripts/task44-shots/$1.png" >/dev/null
  echo "shot $1"
}

echo "════ DARK (default) ════"
agent-browser set viewport 1440 900 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "$PROBE"
shot home-dark-hero 1
agent-browser screenshot --full scripts/task44-shots/home-dark-full.png >/dev/null; echo "shot home-dark-full"

echo "════ LIGHT (the complaint) ════"
agent-browser eval "localStorage.setItem('theme','light')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "$PROBE"
shot home-light-hero 1
agent-browser screenshot --full scripts/task44-shots/home-light-full.png >/dev/null; echo "shot home-light-full"

echo "── light: the cards zone (START HERE, ORION chip, ASSEMBLED, Hear Orion) ──"
agent-browser eval "document.getElementById('learning-path').scrollIntoView()" >/dev/null
shot light-cards 1.5
agent-browser eval "(function(){const m=Array.from(document.querySelectorAll('section')).find(s=>s.textContent.includes('MEET YOUR GUIDE')||s.textContent.includes('Meet your guide'));if(m)m.scrollIntoView();return m?'scrolled':'no-section'})()"
shot light-orion-3d 2

echo "── light: builder page ──"
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
shot builder-light 2.5

echo "════ DARK round 2 (builder, reference, mobile) ════"
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
shot builder-dark 2.5
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
shot reference-dark 4
agent-browser set viewport 390 844 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
shot home-dark-mobile 2.5
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
