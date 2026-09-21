#!/bin/bash
# Fix Pack B E2E — stage 2: camera breathing on the plant page (walk me through)
# The saved plant gets an automatic tour; poll the canvas viewBox to prove the
# wide → dive → WIDE(1.5s dwell) → dive rhythm is VISIBLE.
set -u
cd /home/z/my-project
mkdir -p scripts/fixb-shots

VB='(() => {
  const svgs = Array.from(document.querySelectorAll("svg"));
  const v = svgs.map(s => s.getAttribute("viewBox") || "").filter(x => x && !x.startsWith("0 0 24")).pop();
  return v || "NONE";
})()'

echo "════ 1. save the built plant ════"
agent-browser find role button click --name "Save to library" >/dev/null 2>&1 || agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('Save to library') || (x.textContent||'').includes('Saved ✓')); if (b) { b.click(); return 'clicked'; } return 'NO SAVE BUTTON'; })()"
sleep 2.5

echo "════ 2. open the project page ════"
agent-browser eval "(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label')||'').includes('Open the saved project'));
  return btn ? btn.title : 'none';
})()"
# the toast has an Open action; simpler: read the URL from the saved-project link
URL=$(agent-browser eval "(() => {
  const links = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
  const p = links.find(h => /^\/plant\/p\//.test(h));
  return p || 'NONE';
})()")
echo "project link: $URL"
if [ "$URL" = "NONE" ]; then
  # fall back: newest project on the home grid
  agent-browser open http://localhost:3000 >/dev/null
  agent-browser wait --load networkidle >/dev/null
  URL=$(agent-browser eval "(() => {
    const links = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
    return links.find(h => /^\/plant\/p\//.test(h)) || 'NONE';
  })()")
  echo "home fallback: $URL"
fi
agent-browser open "http://localhost:3000$URL" >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2
agent-browser screenshot scripts/fixb-shots/plant-page.png >/dev/null; echo "shot plant page"

echo "════ 3. start the walk-me-through tour ════"
agent-browser eval "(() => {
  const chips = Array.from(document.querySelectorAll('button')).filter(b => /walk|Walk/.test(b.textContent || ''));
  if (chips.length === 0) return 'NO WALK CHIP: ' + document.title;
  chips[0].click();
  return 'tour started: ' + (chips[0].textContent || '');
})()"
sleep 2.5

echo "════ 4. poll the viewBox — the breathing law ════"
for i in $(seq 1 40); do
  V=$(agent-browser eval "$VB")
  W=$(echo "$V" | python3 -c "
import sys
v = sys.stdin.read().strip().strip('\"')
try:
    parts = [float(x) for x in v.split()]
    print(f'{parts[2]:.0f}x{parts[3]:.0f}')
except Exception:
    print('parse:' + v[:24])
")
  echo "  [$i] viewBox w×h = $W"
  sleep 1.0
done
agent-browser screenshot scripts/fixb-shots/tour-mid.png >/dev/null; echo "shot tour mid"
