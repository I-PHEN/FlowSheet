#!/bin/bash
# Task 42 E2E — part 1: fixed-window law over one full loop (17.5s, page-side)
set -u
cd /home/z/my-project

agent-browser set viewport 1440 900 >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5

echo "== fixed-window law: 17.5s page-side sampler =="
agent-browser eval "(async () => {
  const out = { demoH: new Set(), orionTop: new Set(), samples: 0, t: [] };
  const t0 = performance.now();
  let last = -1;
  while (performance.now() - t0 < 17500) {
    const d = document.querySelector('[aria-label^=Looping]');
    const o = Array.from(document.querySelectorAll('span')).find(s => s.textContent === 'Meet your guide');
    if (d) out.demoH.add(Math.round(d.getBoundingClientRect().height));
    if (o) out.orionTop.add(Math.round(o.getBoundingClientRect().top + window.scrollY));
    out.samples++;
    last = d ? Math.round(d.getBoundingClientRect().height) : last;
    await new Promise(r => setTimeout(r, 150));
  }
  out.t.push(last);
  return JSON.stringify({ demoH: Array.from(out.demoH), orionTop: Array.from(out.orionTop), samples: out.samples });
})()" 2>&1
echo "PART1_DONE"
