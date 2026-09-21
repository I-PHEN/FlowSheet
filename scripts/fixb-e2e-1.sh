#!/bin/bash
# Fix Pack B E2E — stage 1: the builder UI on a CACHED build (paced replay)
# Proves: EventSource consumption, one-by-one assembly, collapsed thinking +
# now-line, the bare-symbol wide canvas. Dark theme, 1440x900.
set -u
cd /home/z/my-project
mkdir -p scripts/fixb-shots

agent-browser set viewport 1440 900 >/dev/null

echo "════ 1. open builder (dark) ════"
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5

echo "════ 2. fill the brief + start ════"
agent-browser eval "(() => {
  const ta = document.querySelector('textarea[aria-label=\"Design brief\"]');
  if (!ta) return 'NO TEXTAREA';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'Build a small methanol plant from natural gas');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'filled';
})()" >/dev/null
agent-browser find role button click --name "Start the build" >/dev/null
sleep 2

echo "════ 3. poll: units appear ONE BY ONE + now-line + collapsed card ════"
for i in $(seq 1 22); do
  agent-browser eval "(() => {
    const chip = Array.from(document.querySelectorAll('div')).find(d => /^LIVE FLOWSHEET/.test(d.textContent || '') && d.textContent.length < 60);
    const workBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('AGENT WORK'));
    const nowLine = workBtn ? (workBtn.querySelector('span:last-of-type') || {}).textContent : 'NO CARD';
    const openSections = document.querySelectorAll('[aria-expanded=\"true\"]').length;
    const panel = document.querySelector('aside[aria-label=\"Build session\"]');
    return JSON.stringify({
      t: $i,
      chip: chip ? chip.textContent.replace('LIVE FLOWSHEET · ','') : 'none',
      now: (nowLine || '').slice(0, 46),
      expanded: workBtn ? workBtn.getAttribute('aria-expanded') : '-',
      openSections,
      panelW: panel ? Math.round(panel.getBoundingClientRect().width) : 0,
    });
  })()"
  sleep 1.6
done
agent-browser screenshot scripts/fixb-shots/builder-midbuild.png >/dev/null; echo "shot midbuild"

echo "════ 4. wait for done (cached replay should be quick) ════"
for i in $(seq 1 30); do
  ST=$(agent-browser eval "(() => {
    const b = Array.from(document.querySelectorAll('button,span')).find(x => /BUILD OK|BUILD ISSUES/.test(x.textContent || ''));
    return b ? b.textContent : 'running';
  })()")
  echo "  [$i] $ST"
  if [ "$ST" != "running" ]; then break; fi
  sleep 2
done
agent-browser screenshot scripts/fixb-shots/builder-done.png >/dev/null; echo "shot done"
