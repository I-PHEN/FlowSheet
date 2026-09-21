#!/usr/bin/env bash
# ============================================================================
# git-history-rebuild.sh — rebuild a fully descriptive, linear history
#
# WHY: local main = [root] -> [UUID squash of tasks ~28-35] -> [UUID tasks 35-36]
#      remote main = [root] -> [UUID housekeeping] -> [9 descriptive commits]
#                    -> [UUID x2] -> [task 32] -> [task 33] -> [empty merge]
#      The user asked for descriptive commit messages before pushing.
#
# WHAT THIS DOES:
#   Phase 1 — rebuild the remote's good chain with commit-tree, rewording the
#             three UUID commits (3be6d69, 0209490, d760fee) and keeping the
#             eight already-descriptive ones verbatim (same trees, same dates).
#   Phase 2 — slice the local squash delta into three honest commits:
#             (13) task 34 cinema dock + voice sync + nameplate
#             (14) recovered pre-reset features + housekeeping
#             (15) Builder's Room (tree = current main tree, verbatim)
#   Phase 3 — verify TREE IDENTITY (new main tree == old main tree) and move
#             the branch. Nothing is committed unless the identity holds.
#
# SAFETY: backup/pre-push-20260920 holds the old main for the entire session.
# ============================================================================
set -euo pipefail
cd /home/z/my-project

MSG=$(mktemp -d /home/z/my-project/scripts/.rebuild-msgs.XXXX)
trap 'rm -rf "$MSG"' EXIT

# ---------------------------------------------------------------- messages --
cat > "$MSG/m-3be" <<'EOF'
chore: normalize file modes across the tree (no content changes)

274 permission-bit changes (mixed 644/755 inherited from the pre-reset
working tree), zero insertions or deletions. Housekeeping only — keeps
the working tree fully clean before the recovery work lands.
EOF

cat > "$MSG/m-020" <<'EOF'
Flow animation: material dots riding every stream, speed from the solver (task 30)

New FlowLayer (LUT + rAF dot law — 102 dots animating through the 22-unit
reference plant) and flowAnim (the shared animation law); Canvas and
BuildCanvas wired so prebuilts, the builder, and saved plants all animate;
dot colors in the design tokens. flow-anim-tests gate (53 checks) plus
smoke captures on the reference in light and dark.
EOF

cat > "$MSG/m-d76" <<'EOF'
Learn merge: one cinema law across every surface (task 31)

tourDirector (the tour state machine), camera.ts (fly-to with pts and
stopAnim), tour.ts registry keyed by ROLE, tourAudio script primitive.
CinemaBar + TourIndex mounted on all four surfaces — reference, flash,
distillation, and saved AI plants; workspaces rewired and renamed,
TutorPanel's TourRunner retired. learn-merge-tests gate (43 checks) with
lm1-lm11 verification captures.
EOF

cat > "$MSG/m-t34" <<'EOF'
Cinema dock + narrator-clock caption sync + Orion nameplate (task 34)

The bar is now the bottom edge of the stage: full-width, caption above,
scrubber dots, transport last — pause sits at the very bottom, clear of
the plant. Captions are driven by the voice's real audio clock instead
of an estimate: spoken-weighted word mapping (V-103 = 3 spoken words,
°C = 2), title spoken-share offset, freeze on pause, re-stream from word
one on resume, reading-pace handover if the voice dies mid-line. streamFor
recalibrated to 600 ms/word as the fallback; useStreamedText retired in
favour of useSyncedCaption. Orion gets a nameplate — the Belt (three
four-point stars, Alnitak-Alnilam-Mintaka) plus the ammonia-green ORION
plate reading YOUR GUIDE on his introduction stop, recurring at every
launch point with zero animation. cinema-polish gate grows to 93 checks;
operate-parity nameplate check updated.
EOF

cat > "$MSG/m-rec" <<'EOF'
Recovered pre-reset features + housekeeping: Teaching Blueprint, SavedPlants, assets, gates, mode cleanup

blueprint.ts — the Teaching Blueprint: the canonical educational
flowsheet as DATA. The Engineer may only place BLUEPRINT slots and wire
BLUEPRINT edges, fixing the v1 failure where the LLM invented its own
topology (HX7, S99, "SMR_102"); structure is deterministic, intelligence
goes into interpreting the brief and setting the knobs. SavedPlants —
the local library strip on the home page (localStorage records, critic
verdict chips, ?load=slug restore) plus home header responsive polish.
3D shell-and-tube GLB asset and remix reference captures; ammonia
baseline and family verification updated; new gates and probes
(make-demo-record, test-remove-unit, vlm-family-qa, family-baseline,
measure-prompts, probe-usage). tool-results/ untracked (gitignored);
file-mode normalization across touched modules.
EOF

cat > "$MSG/m-br" <<'EOF'
Builder's Room: owner's standalone offline architecture tutor; the app ships product-only (tasks 35-36)

download/Flowsheet_The_Builders_Room.html — one self-contained offline
file (zero dependencies, no connection to the app, double-click to open):
ten modules teaching the machine conceptually with zero code dumps —
Follow One Build (ten-stage replay: brief, router, architect, engineer
turns, cage refusals, forced solve, critic, docent, cinema), Engine
(four moves + convergence race), Agent (six roles, the 12-tool cage with
real refusals, token economy), Wire (SSE full-snapshot law with
kill/reconnect/gap-replay), Sheet (BFS bands, corridor-and-lane router),
Cinema (voice-clock sync law), Rest (3D instancing, IndexedDB, derived
operate), and the Pitch Room (60-second script, twelve numbers, judge
Q&A drill). The in-app /learn study surface (task 35) was removed per
the owner's call: the product ships as the product, study material
lives outside it. Worklog through task 36.
EOF

# ------------------------------------------------------- phase 0: safety ---
git branch -f backup/pre-push-20260920 main
echo "[backup] old main -> backup/pre-push-20260920"

# ------------------------------------------- phase 1: preserved chain -------
prev=$(git rev-parse fa23d93)

rb() { # $1 = source commit (tree + authorship preserved), $2 = message file
  local src="$1" f="$2"
  prev=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an "$src")" \
         GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$src")" \
         GIT_AUTHOR_DATE="$(git log -1 --format=%aD "$src")" \
         GIT_COMMITTER_NAME="$(git log -1 --format=%cn "$src")" \
         GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce "$src")" \
         GIT_COMMITTER_DATE="$(git log -1 --format=%cD "$src")" \
         git commit-tree "$(git rev-parse "$src^{tree}")" -p "$prev" -F "$f")
  echo "  rebuilt $src -> $prev"
}

keep() { git log -1 --format=%B "$1" > "$MSG/k-$1"; rb "$1" "$MSG/k-$1"; }

echo "[phase 1] rebuilding preserved chain (reworded where marked):"
rb  3be6d69 "$MSG/m-3be"   # reworded: was UUID
keep b68aa45
keep e4448b7
keep 9b8d245
keep c663661
keep c1a4825
keep b055f43
rb  0209490 "$MSG/m-020"   # reworded: was UUID (task 30)
rb  d760fee "$MSG/m-d76"   # reworded: was UUID (task 31)
keep ca340aa
keep 0ef4332
T33=$prev
echo "[phase 1] rebuilt task-33 commit: $T33"

# --------------------------------------------- phase 2: new commits --------
echo "[phase 2] slicing the local squash into honest commits:"
git worktree add --detach .tmp-rebuild "$T33" 1>/dev/null
W=.tmp-rebuild

# --- commit 13: task 34 (cinema dock + sync + nameplate) ---
git -C "$W" checkout main -- \
  src/components/learn/CinemaBar.tsx \
  src/components/learn/OrionMark.tsx \
  src/components/learn/TourIndex.tsx \
  src/lib/audio/narration.ts \
  src/lib/ui/tourDirector.ts \
  src/lib/ui/useSyncedCaption.ts \
  src/components/workspace/TutorPanel.tsx \
  src/components/flash/FlashWorkspace.tsx \
  src/components/distillation/DistillationWorkspace.tsx \
  src/app/plant/p \
  scripts/cinema-polish-tests.ts \
  scripts/operate-parity-tests.ts
git -C "$W" rm -q src/lib/ui/useStreamedText.ts
GIT_AUTHOR_DATE='2026-09-19T12:00:00+00:00' \
GIT_COMMITTER_DATE='2026-09-19T12:00:00+00:00' \
  git -C "$W" commit -q -F "$MSG/m-t34"
echo "  commit 13 (task 34): $(git -C "$W" rev-parse --short HEAD)"

# --- commit 14: recovered pre-reset features + housekeeping ---
git -C "$W" checkout main -- \
  src scripts public .zscripts \
  download/remix-dark.png download/remix-studio.png
git -C "$W" rm -rq --cached scripts/builders-room
git -C "$W" rm -rq --ignore-unmatch tool-results
GIT_AUTHOR_DATE='2026-09-19T20:00:00+00:00' \
GIT_COMMITTER_DATE='2026-09-19T20:00:00+00:00' \
  git -C "$W" commit -q -F "$MSG/m-rec"
echo "  commit 14 (recovered): $(git -C "$W" rev-parse --short HEAD)"
C14=$(git -C "$W" rev-parse HEAD)

# --- commit 15: Builder's Room — tree = current main, verbatim ---
C15=$(GIT_AUTHOR_DATE='2026-09-19T22:31:00+00:00' \
      GIT_COMMITTER_DATE='2026-09-19T22:31:00+00:00' \
      git commit-tree 'main^{tree}' -p "$C14" -F "$MSG/m-br")
echo "  commit 15 (Builder's Room): $(git rev-parse --short "$C15")"

git worktree remove --force "$W"

# ------------------------------------------- phase 3: verify + move ---------
OLD_TREE=$(git rev-parse 'main^{tree}')
NEW_TREE=$(git rev-parse "$C15^{tree}")
if [ "$OLD_TREE" != "$NEW_TREE" ]; then
  echo "FATAL: tree mismatch — old $OLD_TREE new $NEW_TREE. main NOT moved."
  exit 1
fi
git update-ref refs/heads/main "$C15"
echo "[phase 3] TREE IDENTITY VERIFIED ($NEW_TREE) — main moved."

rm -f scripts/.delta-t33-head.txt scripts/.delta-remote-head.txt
echo
echo "=== NEW HISTORY (main) ==="
git log --format='%h  %ad  %s' --date=format:'%m-%d %H:%M' main
echo
echo "=== working tree status (expect only this script untracked) ==="
git status --porcelain
