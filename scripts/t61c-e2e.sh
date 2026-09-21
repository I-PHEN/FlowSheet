#!/bin/bash
# Task 61-C E2E — one home for a plant:
#  1. cached methanol replay on the builder → save → project page
#  2. Learn | Operate | Edit-with-AI chips present, no "Remix with AI" header link
#  3. Edit mode: session panel, run a real change, record updates IN PLACE
#  4. back to Learn works (no dead end)
#  5. /plant/builder?remix=<id> redirects to the project page
set -u
cd /home/z/my-project
mkdir -p scripts/t61c-shots

agent-browser set viewport 1440 900 >/dev/null

echo "════ 1. cached methanol replay + save ════"
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
for i in $(seq 1 30); do
  sleep 4
  STATE=$(agent-browser eval "(() => { const chip = [...document.querySelectorAll('span')].find(s => /BUILD OK|BUILD ISSUES/.test(s.textContent||'')); return chip ? 'done' : 'running'; })()" 2>/dev/null | tr -d '"')
  if [ "$STATE" = "done" ]; then echo "build done (poll $i)"; break; fi
done
# save via the SessionPanel footer button
agent-browser find role button click --name "Save to library" >/dev/null || agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>/Save to library/i.test(x.textContent)); if(b){b.click(); return 'clicked'} return 'NOT FOUND'; })()"
sleep 2
PLANT_ID=$(agent-browser eval "(() => {
  const a = document.querySelector('a[href^=\"/plant/p/\"]');
  return a ? a.getAttribute('href').split('/').pop() : 'NO_LINK';
})()" | tr -d '"')
echo "PLANT_ID=$PLANT_ID"
if [ "$PLANT_ID" = "NO_LINK" ]; then
  PLANT_ID=$(agent-browser eval "indexedDB.databases ? 'has-api' : 'no-api'" | tr -d '"')
  echo "fallback check: $PLANT_ID"
  PLANT_ID=$(agent-browser eval "(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('flowsheet'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return await new Promise((res) => {
      const t = db.transaction('plants','readonly').objectStore('plants').getAll();
      t.onsuccess = () => res(t.result.length ? t.result[t.result.length-1].id : 'EMPTY');
    });
  })()" | tr -d '"')
  echo "PLANT_ID(db)=$PLANT_ID"
fi
echo "$PLANT_ID" > scripts/t61c-plant-id.txt

echo "════ 2. project page: modes + no remix link ════"
agent-browser open "http://localhost:3000/plant/p/$PLANT_ID" >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 2.5
agent-browser eval "(() => {
  const tabs = [...document.querySelectorAll('[role=tab]')].map(t => t.textContent.trim());
  const remixLink = [...document.querySelectorAll('a')].some(a => /remix/i.test(a.textContent||''));
  const editBtn = [...document.querySelectorAll('button')].some(b => /Edit this plant with AI/i.test(b.textContent||''));
  return JSON.stringify({ tabs, remixLink, editBtn });
})()"
agent-browser screenshot scripts/t61c-shots/01-project-learn.png >/dev/null

echo "════ 3. edit mode + run a real change ════"
agent-browser find role tab click --name "Edit with AI" >/dev/null || agent-browser eval "(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>/Edit/.test(x.textContent)); t && t.click(); return 'edit-clicked'; })()"
sleep 1.5
agent-browser screenshot scripts/t61c-shots/02-edit-panel.png >/dev/null
agent-browser eval "(() => {
  const ta = document.querySelector('textarea[aria-label=\"Design brief\"]');
  if (!ta) return 'NO TEXTAREA';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'Raise the syngas compressor discharge pressure to 120 bar');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'filled';
})()" >/dev/null
agent-browser find role button click --name "Apply the change" >/dev/null || agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Apply the change'); b && b.click(); return 'applied'; })()"
echo "edit run started"
for i in $(seq 1 40); do
  sleep 4
  STATE=$(agent-browser eval "(() => { const chip=[...document.querySelectorAll('span')].find(s=>/BUILD OK|BUILD ISSUES/.test(s.textContent||'')); const toast=[...document.querySelectorAll('[data-sonner-toast]')].some(t=>/Plant updated/i.test(t.textContent||'')); return chip||toast ? 'done' : 'running'; })()" 2>/dev/null | tr -d '"')
  if [ "$STATE" = "done" ]; then echo "edit done (poll $i)"; break; fi
done
sleep 2
agent-browser screenshot scripts/t61c-shots/03-edit-done.png >/dev/null
agent-browser eval "(() => {
  const toast = [...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent);
  return JSON.stringify(toast);
})()"

echo "════ 4. back to Learn (no dead end) ════"
agent-browser find role tab click --name "Learn" >/dev/null || agent-browser eval "(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>/^Learn/.test(x.textContent)); t && t.click(); return 'learn'; })()"
sleep 1.5
agent-browser screenshot scripts/t61c-shots/04-back-to-learn.png >/dev/null
agent-browser eval "(() => {
  const panel = document.querySelector('aside')?.textContent || '';
  return JSON.stringify({ hasTour: /GUIDED TOUR/i.test(panel), hasBrief: /THE BRIEF/i.test(panel) });
})()"

echo "════ 5. ?remix=<id> redirects to the project page ════"
agent-browser open "http://localhost:3000/plant/builder?remix=$PLANT_ID" >/dev/null
agent-browser wait --load networkidle >/dev/null
sleep 3
agent-browser eval "location.pathname"
agent-browser screenshot scripts/t61c-shots/05-redirect.png >/dev/null
echo "ALL DONE"
