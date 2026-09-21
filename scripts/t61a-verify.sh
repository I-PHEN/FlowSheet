#!/bin/bash
# Task 61-A verification — light mode after the drawing-office retune
set -u
cd /home/z/my-project
mkdir -p scripts/t61a-shots

agent-browser set viewport 1440 900 >/dev/null
agent-browser open http://localhost:3000/ >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'light';
})()"
sleep 1
agent-browser screenshot scripts/t61a-shots/01-landing.png >/dev/null
agent-browser eval "window.scrollTo(0, 900)" >/dev/null
sleep 0.6
agent-browser screenshot scripts/t61a-shots/02-landing-orion.png >/dev/null
echo "landing done"

agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'ok';
})()"
sleep 0.8
agent-browser screenshot scripts/t61a-shots/03-reference.png >/dev/null
echo "reference done"

agent-browser open http://localhost:3000/plant/builder >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('fs.theme', 'light');
  return 'ok';
})()"
sleep 0.8
agent-browser screenshot scripts/t61a-shots/04-builder.png >/dev/null
echo "builder done"

# the 3D unit viewer: from the reference plant page, click a unit then Explore in 3D?
# direct: /plant/reference/3d/<unit> — find the link format from the page
agent-browser open http://localhost:3000/plant/reference >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 1.5
agent-browser eval "(() => {
  document.documentElement.classList.remove('dark');
  const links = [...document.querySelectorAll('a[href*=\\\"/3d/\\\"]')].map(a => a.getAttribute('href'));
  return JSON.stringify(links.slice(0, 3));
})()"
echo "ALL DONE"
