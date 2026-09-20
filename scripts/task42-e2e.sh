#!/bin/bash
# Task 42 E2E — real-symbols hero demo verification
# Phase capture via the demo's own clock (window-bar timer) + hover freeze,
# fixed-window law sampled over a full loop, thumbnails, mobile, dark.
set -u
cd /home/z/my-project
OUT=scripts
DEMO_SEL='[aria-label^=Looping]'

getclock() {
  agent-browser eval "document.querySelector('$DEMO_SEL span.ml-auto')?.textContent ?? 'none'" 2>/dev/null | tr -d '"' | tr -d '\n'
}

# clock in seconds (float) or empty
clocknum() {
  local c; c=$(getclock)
  [[ "$c" =~ ^([0-9]+)\. ]] && echo "${BASH_REMATCH[1]}" || echo ""
}

echo "== viewport + open =="
agent-browser set viewport 1440 900 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5

echo "== fixed-window law: 17.5s sample (one full loop + restart) =="
agent-browser eval "(async () => {
  const out = { demoH: new Set(), orionTop: new Set(), gridTop: new Set(), samples: 0 };
  const t0 = performance.now();
  while (performance.now() - t0 < 17500) {
    const d = document.querySelector('[aria-label^=Looping]');
    const o = Array.from(document.querySelectorAll('span')).find(s => s.textContent === 'Meet your guide');
    if (d) out.demoH.add(Math.round(d.getBoundingClientRect().height));
    if (o) out.orionTop.add(Math.round(o.getBoundingClientRect().top + window.scrollY));
    out.samples++;
    await new Promise(r => setTimeout(r, 200));
  }
  return JSON.stringify({ demoH: Array.from(out.demoH), orionTop: Array.from(out.orionTop), samples: out.samples });
})()" 2>&1

echo "== demo center for hover-freeze =="
read -r CX CY <<<'placeholder'
BOX=$(agent-browser eval "(() => { const r = document.querySelector('[aria-label^=Looping]').getBoundingClientRect(); return Math.round(r.x + r.width/2) + ' ' + Math.round(r.y + 20); })()" 2>/dev/null | tr -d '"')
echo "demo freeze point: $BOX"

capture() { # $1 = target seconds (float), $2 = name
  local target="$1" name="$2"
  # wait until clock >= target (loop wraps at 16.8)
  for i in $(seq 1 220); do
    local c; c=$(getclock)
    local n
    [[ "$c" =~ ^([0-9]+)(\.[0-9])?s ]] || { sleep 0.15; continue; }
    n="${BASH_REMATCH[1]}"
    if (( $(echo "$n >= $target" | bc -l) )); then
      # freeze + shot
      agent-browser mouse move $BOX >/dev/null 2>&1
      sleep 0.45
      agent-browser screenshot $OUT/task42-hero-$name.png >/dev/null
      echo "  captured $name at clock $(getclock)"
      agent-browser mouse move 8 300 >/dev/null 2>&1
      sleep 0.2
      return 0
    fi
    sleep 0.12
  done
  echo "  !! missed phase $name"
}

capture 3.0 typing
capture 7.0 units
capture 10.4 wiring
capture 12.2 solving
capture 14.9 converged

echo "== project cards (thumbnails with real symbols) =="
agent-browser eval "document.querySelectorAll('a[href^=\"/plant/p/\"]').length" 2>&1
agent-browser eval "(() => { const a = document.querySelector('a[href^=\"/plant/p/\"]'); a.scrollIntoView({block:'center'}); return 'scrolled'; })()" >/dev/null 2>&1
sleep 0.8
agent-browser screenshot $OUT/task42-cards.png >/dev/null
echo "  cards captured"

echo "== console errors =="
agent-browser errors 2>&1 | head -5
echo "E2E_DESKTOP_DONE"
