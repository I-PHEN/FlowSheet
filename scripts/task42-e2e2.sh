#!/bin/bash
# Task 42 E2E — part 2: phase screenshots (page-side wait to phase start,
# then hover-freeze from bash, shot, unfreeze)
set -u
cd /home/z/my-project
OUT=scripts

BOX=$(agent-browser eval "(() => { const r = document.querySelector('[aria-label^=Looping]').getBoundingClientRect(); return Math.round(r.x + r.width/2) + ' ' + Math.round(r.y + 20); })()" 2>/dev/null | tr -d '"')
echo "freeze point: $BOX"

waitphase() { # $1 = target seconds — wait until the demo clock crosses it
  agent-browser eval "(async () => {
    const target = $1;
    const read = () => {
      const s = document.querySelector('[aria-label^=Looping] span.ml-auto')?.textContent ?? '';
      const m = s.match(/^([0-9]+)\.([0-9])/);
      return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 10 : -1;
    };
    const t0 = performance.now();
    while (performance.now() - t0 < 20000) {
      const t = read();
      if (t >= target && t < target + 1.4) return 'in-phase ' + t.toFixed(1);
      if (t >= target + 1.4) return 'overshot ' + t.toFixed(1);
      await new Promise(r => setTimeout(r, 60));
    }
    return 'timeout';
  })()" 2>/dev/null | tr -d '"'
}

cap() { # $1 target, $2 name
  local r; r=$(waitphase "$1")
  agent-browser mouse move $BOX >/dev/null 2>&1
  sleep 0.35
  agent-browser screenshot $OUT/task42-hero-$2.png >/dev/null
  echo "$2: wait=[$r] frozen-at=[$(agent-browser eval "document.querySelector('[aria-label^=Looping] span.ml-auto')?.textContent" 2>/dev/null | tr -d '"')]"
  agent-browser mouse move 8 300 >/dev/null 2>&1
  sleep 0.25
}

cap 3.0 typing
cap 7.0 units
cap 10.4 wiring
cap 12.2 solving
cap 14.9 converged

echo "== project cards =="
agent-browser eval "(() => { const a = document.querySelector('a[href^=\"/plant/p/\"]'); if (a) { a.scrollIntoView({block:'center'}); return 'scrolled'; } return 'no-cards'; })()" 2>&1
sleep 1
agent-browser screenshot $OUT/task42-cards.png >/dev/null
echo "cards captured"

echo "== console errors =="
agent-browser errors 2>&1 | head -4
echo "PART2_DONE"
