#!/usr/bin/env bash
# ============================================================================
# git-pull-builders-room.sh — remove the Builder's Room material from the
# public repo history (it enters at exactly one commit: 653772e), while
# KEEPING the owner's local copy on disk (untracked + gitignored).
#
# Rebuilds the last three commits (653772e, f5dfb9f, 6c6ff76) with trees
# minus the 16 builders-room paths; 653772e's message is adjusted to stay
# honest (the tutor was built, but is intentionally not published); the two
# worklog commits keep their messages verbatim. A final commit adds
# .gitignore guards + the task-39 worklog entry.
#
# Safety: local branch backup/builders-room-20260920 preserves the old line
# (with the file) before anything moves. Nothing is pushed by this script.
# ============================================================================
set -euo pipefail
cd /home/z/my-project

IDX=$(mktemp -u /home/z/my-project/scripts/.pull-idx.XXXX)
trap 'rm -f "$IDX"' EXIT
export GIT_INDEX_FILE="$IDX"

DROP=(download/Flowsheet_The_Builders_Room.html scripts/builders-room)

# ------------------------------------------------------------- messages -----
M=$(mktemp -d /home/z/my-project/scripts/.pull-msgs.XXXX)
# (leave for the outer trap? simpler: remove at end via explicit call)

cat > "$M/m-653" <<'EOF'
Builder's Room: owner's offline architecture tutor (delivered privately, kept out of the repo); the app ships product-only (tasks 35-36)

Built the owner's standalone study tool: one self-contained offline HTML
file (zero dependencies, no connection to the app) with ten modules
teaching the machine conceptually — Follow One Build (ten-stage replay of
an agent build: brief, router, architect, engineer turns, cage refusals,
forced solve, critic, docent, cinema), Engine (four moves + convergence
race), Agent (six roles, the 12-tool cage, token economy), Wire (SSE
full-snapshot law with kill/reconnect/gap-replay), Sheet (BFS bands,
corridor-and-lane router), Cinema (voice-clock sync law), Rest (3D
instancing, IndexedDB, derived operate), and the Pitch Room (60-second
script, numbers, judge Q&A drill). The artifact is the owner's private
material and is intentionally NOT published in this repository — it
lives offline with the owner. The in-app /learn study surface built in
task 35 was removed per the owner's call: the product ships as the
product, study material lives outside it. Worklog through task 36.
EOF

# ------------------------------------------------------- safety backup -----
git branch -f backup/builders-room-20260920 6c6ff76
echo "[backup] old line (with the file) -> backup/builders-room-20260920 (local only)"

# ------------------------------------------------------- tree surgery -------
strip_tree() { # $1 = commit -> echoes a tree id without the dropped paths
  git read-tree "$1"
  git rm --cached -rq --ignore-unmatch "${DROP[@]}" 1>/dev/null
  git write-tree
}

reb() { # $1 = source commit, $2 = parent, $3 = message file (or '-' = verbatim)
  local src="$2" msgf="$3" new
  if [ "$msgf" = "-" ]; then
    git log -1 --format=%B "$1" > "$M/verbatim-$1"; msgf="$M/verbatim-$1"
  fi
  new=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an "$1")" \
        GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$1")" \
        GIT_AUTHOR_DATE="$(git log -1 --format=%aD "$1")" \
        GIT_COMMITTER_NAME="$(git log -1 --format=%cn "$1")" \
        GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce "$1")" \
        GIT_COMMITTER_DATE="$(git log -1 --format=%cD "$1")" \
        git commit-tree "$(strip_tree "$1")" -p "$src" -F "$msgf")
  echo "$new"
}

C1=$(reb 653772e 28a9c5a "$M/m-653");  echo "  653772e -> ${C1:0:9} (tutor built, artifact withheld)"
C2=$(reb f5dfb9f "$C1" -);             echo "  f5dfb9f -> ${C2:0:9}"
C3=$(reb 6c6ff76 "$C2" -);             echo "  6c6ff76 -> ${C3:0:9}"

unset GIT_INDEX_FILE

# ----------------------------------------------------- final guard commit ---
git update-ref refs/heads/main "$C3"
git reset -q --mixed main   # sync the index to the new tip; disk untouched

grep -qF 'Flowsheet_The_Builders_Room' .gitignore || cat >> .gitignore <<'EOF'

# Owner's private study material — never publish
download/Flowsheet_The_Builders_Room.html
scripts/builders-room/
EOF

git add .gitignore
git commit -q -F - <<'EOF'
Keep the Builder's Room private: tutor artifacts stay out of the repo (owner's study material) + worklog (task 39)

The offline tutor and its build scaffolding are the owner's private
material: gitignored here so no future commit re-adds them, and the
public history carries no copy. The owner's offline file is unaffected.
EOF

# --------------------------------------------------------- verification -----
echo; echo "=== any commit on new main touching the dropped paths? (expect empty) ==="
git log --oneline main -- "${DROP[@]}" | cat
echo "=== diff old tip -> new tip (expect: 16 deletions + .gitignore) ==="
git diff --stat backup/builders-room-20260920 main | tail -4
echo "=== local owner copy still on disk? ==="
ls -la download/Flowsheet_The_Builders_Room.html | awk '{print $5, $9}'
echo "=== working tree status (expect clean / files now ignored) ==="
git status --porcelain
rm -rf "$M"
echo; echo "NEW TIP: $(git rev-parse --short main)"; git log --format='%h %s' main | head -4
