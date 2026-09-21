#!/usr/bin/env bash
# ============================================================================
# git-history-branches.sh — reword the UUID commits in the pre-reset lines
# and stage two history branches for push.
#
#   history/pre-reset-builds : the original Aug 29 -> Sep 15 development line
#                              (20 commits; 12 reworded, 8 kept verbatim)
#   history/v3-pre-reset     : the v3 push line (42814b3 "Plant families +
#                              agent-authored tours") rebased onto the
#                              already-reworded mode-housekeeping commit
#                              (0dac89d) so no UUID commit appears anywhere.
#
# Trees are preserved byte-for-byte (commit-tree of the original tree);
# only messages change. Tree identity is verified before refs are created.
# ============================================================================
set -euo pipefail
cd /home/z/my-project

MSG=$(mktemp -d /home/z/my-project/scripts/.branch-msgs.XXXX)
trap 'rm -rf "$MSG"' EXIT

# ------------------------------------------------------------- messages -----
cat > "$MSG/m-8939c05" <<'EOF'
Research phase: 31-page research & enhancement plan + verified engineering foundations

Synthesized four parallel research tracks (landscape scan, tech stack,
ammonia engineering, interactivity frontier) into the plan PDF: five
must-fix corrections to the source plan (approach 90-95%, VLE thermo,
two-zone secondary reformer, argon species, real validation sources),
the Gillespie-Beattie kinetics table, a 15-rung interactivity ladder,
stack picks, a 15-risk register, and a 27-week roadmap. Research
artifacts under research/.
EOF

cat > "$MSG/m-2cc58d0" <<'EOF'
Engine core + PFD workbench (phases 1+2): PR EOS, Rachford-Rice flash, 19 unit ops, Broyden recycle — 61/61 gate

Phase 1 — the deterministic engine, in TypeScript in-process (sub-100ms
re-solves for live slider interaction): species with SVA props and Cp
fits, PR EOS fugacity and residual enthalpy, PT flash via
Rachford-Rice, Gillespie-Beattie kinetics with the beta-I table,
nested SMR+WGS / methanator / NH3-bed solvers, 19 unit operations
including the dual-zone secondary reformer and the polytropic
compressor train, and a synthesis-loop tear solved damped-DS then
Broyden. Six engine bugs caught by the gate (ln(Z) vs ln(Z-B), duty
unit error, methanator equilibrium, isenthalpic letdown, atom-scaled
residual, Wegstein -> Broyden). Base case 796 t/d, 99.24 wt%, 28.6%
per-pass, 55-90 ms per solve.
Phase 2 — the dark control-room workbench: hand-drawn SVG PFD with
pan/zoom/hover/select, inspector with engineering sliders, stream
table, solver console, KPI bar, /api/solve. engine-tests 61/61 green;
browser E2E clean.
EOF

cat > "$MSG/m-8e8c21c" <<'EOF'
Product re-plan checkpoint: post-build critique and the pivot to a strictly-educational interface

Owner feedback on the first build: the flowsheet overloads the screen,
the product must be strictly educational, the home should feel like a
Google-Flow-style project library, and 3D waits. This checkpoint
carries the critique screenshots and the revised plan that set up the
interface rebuild.
EOF

cat > "$MSG/m-12c316b" <<'EOF'
Interface rebuild (phases A+B): flowsheet craft, library home, workspace shell

The clean, project-structured educational interface: Phase A reworks
the flowsheet rendering craft; Phase B adds the library home and the
workspace shell. Engine untouched by design.
EOF

cat > "$MSG/m-7b2ac66" <<'EOF'
Legacy console deleted + dark mode: one clean educational interface

Removed the old workbench console entirely (route, components, code)
and implemented dark mode for the clean educational interface. Engine
untouched.
EOF

cat > "$MSG/m-365f4f4" <<'EOF'
Operate mode (minimal): three live levers, reset, KPI deltas

Phase C per the owner's "minimal for now, only the important stuff"
directive: a minimal Operate mode — three live levers, reset, and KPI
deltas re-solved live on drag.
EOF

cat > "$MSG/m-ca3b15c" <<'EOF'
Flowsheet-as-data refactor (D1): graph + registry + executor + auto-tear + validator — Engine 2.0

The engine's wiring layer becomes data: a unit registry, the graph
spec, the executor, automatic tear detection, and the validator —
behind a hard identity gate proving the refactor changes no answers.
Physics untouched; the structure becomes the substrate the agent will
build on.
EOF

cat > "$MSG/m-0b1669f" <<'EOF'
The agent: multi-agent plant builder over Engine 2.0's tool surface, streamed live

First version of the builder agent — coordinating roles over the
engine's tools, streamed live to a builder interface so the owner
watches the plant get built unit by unit.
EOF

cat > "$MSG/m-5a16ee7" <<'EOF'
Builder verification sweep: end-to-end captures + file-mode cleanup

End-to-end verification captures of the agent builder (brief filled,
saved, home restore, band layout) with refinements from the findings;
file modes normalized across the engine modules (no content changes).
EOF

cat > "$MSG/m-2638480" <<'EOF'
Flow-inspired studio: two-zone builder interface (stage + session chat)

The builder interface rebuilt as a two-zone studio — the build stage
plus the session chat (SessionPanel, BuildCanvas rework) — per the plan
locked with the owner.
EOF

cat > "$MSG/m-d090b83" <<'EOF'
Research checkpoint: web-search notes for the sandbox-recovery replan

Search-result captures gathered while planning the recovery of the
newest project state after the rollback.
EOF

cat > "$MSG/m-a07cfa9" <<'EOF'
Sandbox rollback recovery: restore newest engine state, keep the 3D pipeline

Recovery checkpoint after a sandbox rollback: restored the newest
engine work (registry, species, units expansions) while preserving the
3D model pipeline.
EOF

# ------------------------------------------------------- rebuild engine -----
prev=""
rb() { # $1 = source commit, $2 = message file
  local src="$1" f="$2"
  local new
  new=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an "$src")" \
        GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$src")" \
        GIT_AUTHOR_DATE="$(git log -1 --format=%aD "$src")" \
        GIT_COMMITTER_NAME="$(git log -1 --format=%cn "$src")" \
        GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce "$src")" \
        GIT_COMMITTER_DATE="$(git log -1 --format=%cD "$src")" \
        git commit-tree "$(git rev-parse "$src^{tree}")" ${prev:+"-p" "$prev"} -F "$f")
  if [ -z "$prev" ]; then prev=$new; fi; prev=$new
  echo "  $src -> ${new:0:9}"
}
keep() { git log -1 --format=%B "$1" > "$MSG/k-$1"; rb "$1" "$MSG/k-$1"; }

echo "[1/2] Rebuilding the original development line (history/pre-reset-builds):"
prev=""
keep 2e2c4c4     # Initial commit
rb  8939c05 "$MSG/m-8939c05"
rb  2cc58d0 "$MSG/m-2cc58d0"
rb  8e8c21c "$MSG/m-8e8c21c"
rb  12c316b "$MSG/m-12c316b"
rb  7b2ac66 "$MSG/m-7b2ac66"
rb  365f4f4 "$MSG/m-365f4f4"
rb  ca3b15c "$MSG/m-ca3b15c"
rb  0b1669f "$MSG/m-0b1669f"
rb  5a16ee7 "$MSG/m-5a16ee7"
rb  2638480 "$MSG/m-2638480"
rb  d090b83 "$MSG/m-d090b83"
keep cffa765     # Restore Tasks 12-21
rb  a07cfa9 "$MSG/m-a07cfa9"
keep 6252ec9     # RESTORE Tasks 20-21
keep e381ebf     # worklog: Task R2
keep ef3382e     # RESTORE voice+music
keep c6bb256     # tool-results cache
keep 236dd99     # 3D Component Viewer MVP
keep cacae6e     # 3D fixes per user screenshots
TIP=$prev

echo "[2/2] Rebuilding the v3 line on the reworded base (history/v3-pre-reset):"
git log -1 --format=%B 42814b3 > "$MSG/m-42814b3"
V3=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an 42814b3)" \
     GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae 42814b3)" \
     GIT_AUTHOR_DATE="$(git log -1 --format=%aD 42814b3)" \
     GIT_COMMITTER_NAME="$(git log -1 --format=%cn 42814b3)" \
     GIT_COMMITTER_EMAIL="$(git log -1 --format=%ce 42814b3)" \
     GIT_COMMITTER_DATE="$(git log -1 --format=%cD 42814b3)" \
     git commit-tree "$(git rev-parse 42814b3^{tree})" -p 0dac89d -F "$MSG/m-42814b3")
echo "  42814b3 -> ${V3:0:9} (parent 0dac89d, the reworded mode-housekeeping commit)"

# --------------------------------------------------------- verification -----
OLD_TIP_TREE=$(git rev-parse 'history-backup^{tree}')
NEW_TIP_TREE=$(git rev-parse "$TIP^{tree}")
OLD_V3_TREE=$(git rev-parse '42814b3^{tree}')
NEW_V3_TREE=$(git rev-parse "$V3^{tree}")
[ "$OLD_TIP_TREE" = "$NEW_TIP_TREE" ] || { echo "FATAL: builds tip tree mismatch"; exit 1; }
[ "$OLD_V3_TREE"  = "$NEW_V3_TREE"  ] || { echo "FATAL: v3 tip tree mismatch";     exit 1; }
echo "[verify] tree identity holds for both lines."

git branch -f history/pre-reset-builds "$TIP"
git branch -f history/v3-pre-reset     "$V3"
echo "[done] branches created:"
echo "  history/pre-reset-builds -> ${TIP:0:9} (20 commits, 0 UUID messages)"
echo "  history/v3-pre-reset     -> ${V3:0:9} (parent chain into main's reworded base)"
echo
echo "=== sanity: any UUID-style messages left on either line? (expect 0) ==="
git log --format=%s history/pre-reset-builds | grep -cE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' || true
git log --format=%s history/v3-pre-reset     | grep -cE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' || true
