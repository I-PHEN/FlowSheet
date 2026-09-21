#!/bin/bash
# Fix Pack A E2E — round 2: hero voice LIVE (analyser amplitude) + outro framing
set -u
cd /home/z/my-project

VB='(() => {
  const svgs = Array.from(document.querySelectorAll("svg"));
  const v = svgs.map(s => s.getAttribute("viewBox") || "").filter(x => x && !x.startsWith("0 0 24") && !x.startsWith("0 0 22 8")).pop();
  return v || "NONE";
})()'

agent-browser set viewport 1440 900 >/dev/null

echo "════ hero voice: state + real amplitude over time ════"
agent-browser eval "localStorage.setItem('theme','dark')" >/dev/null
agent-browser open http://localhost:3000 >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(function(){const m=Array.from(document.querySelectorAll('span')).find(s=>s.textContent==='Meet your guide');if(m)m.closest('section').scrollIntoView();return 'ok'})()" >/dev/null
sleep 1
agent-browser find role button click --name "Hear Orion" >/dev/null
agent-browser eval "(async () => {
  const n = window.__pfdAudio.narrator;
  const log = [];
  let amps = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 26000) {
    const a = n.amplitude();
    if (a != null) amps.push(Math.round(a * 100) / 100);
    const last = log[log.length - 1];
    if (!last || last.s !== n.state) log.push({ t: Math.round(performance.now() - t0), s: n.state });
    if (n.state === 'idle' && log.length > 1) break; // the line finished
    await new Promise(r => setTimeout(r, 400));
  }
  return JSON.stringify({ states: log, ampSamples: amps.slice(0, 14), ampCount: amps.length });
})()"
sleep 0.4
agent-browser screenshot scripts/fixa-shots/hero-dark-playing2.png >/dev/null; echo "shot hero-dark-playing2"

echo "════ outro framing on the reference tour ════"
agent-browser eval "localStorage.setItem('pfd.audio.prefs', JSON.stringify({voice:false, musicLevel:0}))" >/dev/null
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 3
agent-browser find text "Walk me through the plant" click >/dev/null
sleep 2
echo "stop 1 (overview):"
agent-browser eval "$VB"
agent-browser find role button click --name "Go to stop 14: Purge, then go around again" >/dev/null
sleep 2.5
echo "stop 14 (the outro — must be the FULL sheet):"
agent-browser eval "$VB"
agent-browser screenshot scripts/fixa-shots/tour-outro-wide2.png >/dev/null; echo "shot tour-outro-wide2"

echo "════ console errors ════"
agent-browser errors 2>&1 | tail -3
echo "ROUND2_DONE"
