#!/bin/bash
# Task 61-B E2E — run the cached methanol build replay, screenshot the routed result
set -u
cd /home/z/my-project
mkdir -p scripts/t61b-shots

agent-browser set viewport 1440 900 >/dev/null
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5

agent-browser eval "(() => {
  const ta = document.querySelector('textarea[aria-label=\"Design brief\"]');
  if (!ta) return 'NO TEXTAREA';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'Build a small methanol plant from natural gas');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'filled';
})()" >/dev/null
agent-browser find role button click --name "Start the build" >/dev/null
echo "build started"

# poll until done (cached replay is paced: ~15 units * 0.32s + LLM gaps)
for i in $(seq 1 40); do
  sleep 3
  STATE=$(agent-browser eval "(() => {
    const chip = [...document.querySelectorAll('span')].find(s => /BUILD OK|BUILD ISSUES/.test(s.textContent||''));
    return chip ? chip.textContent.trim() : 'running';
  })()")
  echo "poll $i: $STATE"
  if [ "$STATE" != "running" ]; then break; fi
done

sleep 2
agent-browser screenshot scripts/t61b-shots/01-methanol-routed.png >/dev/null
echo "shot 1 done"

# zoom out to full sheet for a routing overview
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>/fit|Fit/i.test(x.getAttribute('title')||'')); return b? 'has-fit':'no-fit'; })()"
agent-browser screenshot scripts/t61b-shots/02-full.png >/dev/null
echo "ALL DONE"
