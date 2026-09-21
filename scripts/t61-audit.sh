#!/bin/bash
# Task 61 audit — light mode reality check across the key surfaces.
# Shots: landing, saved AI plant (PFD + tour bar), 3D unit viewer, builder.
set -u
cd /home/z/my-project
mkdir -p scripts/t61-shots

agent-browser set viewport 1440 900 >/dev/null

# Force LIGHT theme first (theme toggle is on the landing header)
agent-browser open http://localhost:3000/ >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'light';
  localStorage.setItem('fs.theme', 'light');
  return document.documentElement.className || 'forced-light';
})()"
sleep 0.5
agent-browser screenshot scripts/t61-shots/01-landing-light.png >/dev/null
echo "shot 01 done"

# Saved AI-built plant from the worklog (may exist in this profile's IndexedDB)
agent-browser open http://localhost:3000/plant/p/pmubmgmsqoaonqj >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return location.pathname + ' | ' + (document.body.innerText.slice(0,120).replace(/\n/g,' '));
})()"
sleep 0.8
agent-browser screenshot scripts/t61-shots/02-saved-plant-light.png >/dev/null
echo "shot 02 done"

# Scroll the plant page to see tour/operate/remix controls
agent-browser eval "window.scrollTo(0, 400)" >/dev/null
sleep 0.5
agent-browser screenshot scripts/t61-shots/03-saved-plant-mid.png >/dev/null
echo "shot 03 done"

# What mode chips/buttons exist on the plant page (remix/tour/learn/operate)?
agent-browser eval "(() => {
  const btns = [...document.querySelectorAll('button, a')].map(b => (b.textContent||'').trim()).filter(t => t && t.length < 40);
  return JSON.stringify(btns.slice(0, 40));
})()"

# The reference plant (SMR) — the PFD from screenshot 2
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'ok';
})()"
sleep 0.8
agent-browser screenshot scripts/t61-shots/04-reference-plant-light.png >/dev/null
echo "shot 04 done"

# Builder page, light
agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'ok';
})()"
sleep 0.8
agent-browser screenshot scripts/t61-shots/05-builder-light.png >/dev/null
echo "shot 05 done"

echo "ALL SHOTS DONE"
