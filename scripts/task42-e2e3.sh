#!/bin/bash
# Task 42 E2E — part 3: typing retake, seed saved plant, cards, mobile, dark
set -u
cd /home/z/my-project
OUT=scripts

BOX=$(agent-browser eval "(() => { const r = document.querySelector('[aria-label^=Looping]').getBoundingClientRect(); return Math.round(r.x + r.width/2) + ' ' + Math.round(r.y + 20); })()" 2>/dev/null | tr -d '"')

echo "== typing retake =="
agent-browser eval "(async () => {
  const read = () => {
    const s = document.querySelector('[aria-label^=Looping] span.ml-auto')?.textContent ?? '';
    const m = s.match(/^([0-9]+)\.([0-9])/);
    return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 10 : -1;
  };
  const t0 = performance.now();
  while (performance.now() - t0 < 22000) {
    const t = read();
    if (t >= 3.0 && t < 4.2) return 'in-phase ' + t.toFixed(1);
    await new Promise(r => setTimeout(r, 60));
  }
  return 'timeout';
})()" 2>/dev/null | tr -d '"'
agent-browser mouse move $BOX >/dev/null 2>&1
sleep 0.35
agent-browser screenshot $OUT/task42-hero-typing.png >/dev/null
echo "typing retaken at [$(agent-browser eval "document.querySelector('[aria-label^=Looping] span.ml-auto')?.textContent" 2>/dev/null | tr -d '"')]"
agent-browser mouse move 8 300 >/dev/null 2>&1

echo "== seed saved methanol plant =="
agent-browser eval "$(cat scripts/seed-meoh.js)" 2>&1 | head -2
sleep 1
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2

echo "== projects grid with symbolic thumbnail =="
agent-browser eval "(() => { const n = document.querySelector('h2'); const grid = document.querySelector('a[href=\"/plant/p/p3meohdemo\"]'); if (grid) { grid.scrollIntoView({block:'center'}); return 'found saved card'; } return 'CARD MISSING'; })()" 2>&1
sleep 1
agent-browser screenshot $OUT/task42-saved-card.png >/dev/null
echo "saved card captured"

echo "== learning path cards =="
agent-browser eval "(() => { document.getElementById('learning-path')?.scrollIntoView({block:'start'}); return 'ok'; })()" >/dev/null 2>&1
sleep 1
agent-browser screenshot $OUT/task42-learning-cards.png >/dev/null
echo "learning cards captured"

echo "== mobile 390x844 =="
agent-browser set viewport 390 844 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(async () => {
  const read = () => {
    const s = document.querySelector('[aria-label^=Looping] span.ml-auto')?.textContent ?? '';
    const m = s.match(/^([0-9]+)\.([0-9])/);
    return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 10 : -1;
  };
  const t0 = performance.now();
  while (performance.now() - t0 < 22000) {
    const t = read();
    if (t >= 14.9 && t < 15.8) return 'in-phase ' + t.toFixed(1);
    await new Promise(r => setTimeout(r, 60));
  }
  return 'timeout';
})()" 2>/dev/null | tr -d '"'
agent-browser screenshot $OUT/task42-mobile-converged.png >/dev/null
agent-browser eval "(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, demoW: Math.round(document.querySelector('[aria-label^=Looping]').getBoundingClientRect().width) }))()" 2>&1
echo "mobile captured"

echo "== dark mode desktop =="
agent-browser set viewport 1440 900 >/dev/null
agent-browser set media dark >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(async () => {
  const read = () => {
    const s = document.querySelector('[aria-label^=Looping] span.ml-auto')?.textContent ?? '';
    const m = s.match(/^([0-9]+)\.([0-9])/);
    return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 10 : -1;
  };
  const t0 = performance.now();
  while (performance.now() - t0 < 22000) {
    const t = read();
    if (t >= 14.9 && t < 15.8) return 'in-phase ' + t.toFixed(1);
    await new Promise(r => setTimeout(r, 60));
  }
  return 'timeout';
})()" 2>/dev/null | tr -d '"'
agent-browser screenshot $OUT/task42-dark-converged.png >/dev/null
echo "dark captured"

echo "== errors =="
agent-browser errors 2>&1 | head -4
echo "PART3_DONE"
