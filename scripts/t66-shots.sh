#!/bin/bash
# Task 66 verification — the six hero fixes, both themes
set -u
cd /home/z/my-project
mkdir -p scripts/t66-shots

agent-browser set viewport 1440 900 >/dev/null

# ---------- LIGHT: the landing ----------
agent-browser open http://localhost:3000/ >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'light';
})()" >/dev/null
sleep 2
agent-browser screenshot scripts/t66-shots/01-hero-light-idle.png >/dev/null
sleep 4.5
agent-browser screenshot scripts/t66-shots/02-hero-light-midloop.png >/dev/null

# the how-it-works expandable
agent-browser eval "(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const b = btns.find((x) => (x.textContent || '').includes('See how it works'));
  if (b) b.click();
  return b ? 'clicked' : 'NOT FOUND';
})()" 
sleep 0.8
agent-browser screenshot scripts/t66-shots/03-hero-light-howitworks.png >/dev/null

# converged state (~15.5s from load): reload to resync the loop
agent-browser open http://localhost:3000/ >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 15.5
agent-browser screenshot scripts/t66-shots/04-hero-light-converged.png >/dev/null

# below the fold — rail + Meet your guide breathing room
agent-browser eval "window.scrollTo(0, 700)" >/dev/null
sleep 0.7
agent-browser screenshot scripts/t66-shots/05-rail-meetorion-light.png >/dev/null

# ---------- DARK: the landing ----------
agent-browser open http://localhost:3000/ >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "(() => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('fs.theme', 'dark');
  return 'dark';
})()" >/dev/null
sleep 3
agent-browser screenshot scripts/t66-shots/06-hero-dark-midloop.png >/dev/null

# ---------- MOBILE light ----------
agent-browser set viewport 414 896 >/dev/null
agent-browser open http://localhost:3000/ >/dev/null
agent-browser wait --load networkidle >/dev/null
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'light';
})()" >/dev/null
sleep 3
agent-browser screenshot scripts/t66-shots/07-hero-mobile-light.png >/dev/null
agent-browser eval "window.scrollTo(0, 1200)" >/dev/null
sleep 0.7
agent-browser screenshot scripts/t66-shots/08-rail-mobile-light.png >/dev/null
agent-browser set viewport 1440 900 >/dev/null

# ---------- LIGHT: the gray-blue desk on the other surfaces ----------
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser screenshot scripts/t66-shots/09-reference-light.png >/dev/null

agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser screenshot scripts/t66-shots/10-builder-light.png >/dev/null

echo "--- console errors across the pass ---"
agent-browser console --errors 2>/dev/null | tail -5
echo "done"
