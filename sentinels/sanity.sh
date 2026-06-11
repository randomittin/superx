#!/usr/bin/env bash
# sanity.sh — SANITY sentinel (spec H-3, trigger: post-wave).
#
# Job: build + test the wave output on a CLEAN CHECKOUT, not the dirty working
# tree the build lane sees. Catches the "works in my dirty tree" failure class:
# untracked files, uncommitted edits, or local state the build secretly depends
# on. The build lane cannot see this because it runs IN the dirty tree; a clean
# checkout of the committed state is the only honest reproduction.
#
# Mechanism: `git worktree add` a throwaway checkout of a target ref (default
# HEAD), run the project's test/build command there, tear it down. The verdict
# is byte-shaped as the standard 8-field report.json via lib/report.sh.
#
#   pass    — clean checkout built + tested green.
#   fail    — clean checkout failed where the dirty tree passed (or just failed).
#   skipped — no recognizable build/test command in the clean checkout (nothing
#             honest to run; an honest skipped is emitted, never a green verdict).
#
# Test command discovery (first match wins; all real, no invention):
#   - package.json with a "test" script   -> npm test  (and npm ci if lockfile)
#   - Makefile with a `test:` target       -> make test
#   - a top-level ./test or ./run-tests.sh -> execute it
#   Override with env HEIMDALL_SANITY_CMD="<command>" (run verbatim in checkout).
#
# Usage:
#   sanity.sh --repo <root> [--ref <git-ref>] [--report <out>]
#     --repo    repo root to checkout (required).
#     --ref     git ref/commit to check out clean. Default: HEAD.
#     --report  where to write report.json. Default: <repo>/.planning/spawns/reports/sanity.report.json
set -euo pipefail

SELF="$0"
if command -v readlink >/dev/null 2>&1; then
  SELF="$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")"
fi
SENT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
# shellcheck source=lib/report.sh
. "$SENT_DIR/lib/report.sh"

GATE_ID="sentinel-sanity"

REPO=""
REF="HEAD"
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)   REPO="${2:?--repo needs a path}"; shift 2 ;;
    --ref)    REF="${2:?--ref needs a value}"; shift 2 ;;
    --report) REPORT="${2:?--report needs a path}"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$SELF"; exit 0 ;;
    *) echo "error: unknown arg: $1" >&2; exit 2 ;;
  esac
done

[ -n "$REPO" ] || { echo "error: --repo is required" >&2; exit 2; }
[ -d "$REPO/.git" ] || git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 || {
  echo "error: not a git repo: $REPO" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 2; }
: "${REPORT:=$REPO/.planning/spawns/reports/sanity.report.json}"

# Resolve the ref to a concrete sha so the clean checkout is deterministic.
SHA="$(git -C "$REPO" rev-parse --verify "$REF" 2>/dev/null || true)"
[ -n "$SHA" ] || {
  sentinel_report "$REPORT" "$GATE_ID" "fail" '{"phase":"resolve-ref"}' \
    "Cannot resolve git ref '$REF' in $REPO — pass an existing commit." \
    "ref resolution" "a resolvable git ref" "unresolvable ref '$REF'"
  exit 1
}

# Discover the build/test command we will run in the clean checkout.
discover_cmd() {
  local dir="$1"
  if [ -n "${HEIMDALL_SANITY_CMD:-}" ]; then echo "$HEIMDALL_SANITY_CMD"; return 0; fi
  if [ -f "$dir/package.json" ] && jq -e '.scripts.test // empty' "$dir/package.json" >/dev/null 2>&1; then
    if [ -f "$dir/package-lock.json" ] || [ -f "$dir/npm-shrinkwrap.json" ]; then
      echo "npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1; npm test"
    else
      echo "npm install >/dev/null 2>&1; npm test"
    fi
    return 0
  fi
  if [ -f "$dir/Makefile" ] && grep -qE '^test:' "$dir/Makefile"; then echo "make test"; return 0; fi
  if [ -x "$dir/test" ]; then echo "./test"; return 0; fi
  if [ -x "$dir/run-tests.sh" ]; then echo "./run-tests.sh"; return 0; fi
  echo ""  # nothing discovered
}

# Make a clean throwaway worktree at SHA, isolated from the dirty tree.
WT="$(mktemp -d "${TMPDIR:-/tmp}/heimdall-sanity.$$.$RANDOM")" 2>/dev/null || WT="$(mktemp -d)"
cleanup() { git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"; }
trap cleanup EXIT

if ! git -C "$REPO" worktree add --detach --force "$WT" "$SHA" >/dev/null 2>&1; then
  sentinel_report "$REPORT" "$GATE_ID" "fail" "$(jq -nc --arg s "$SHA" '{phase:"worktree-add",sha:$s}')" \
    "git worktree add failed for $SHA — check git version and disk." \
    "clean checkout" "a clean worktree at $SHA" "git worktree add failed"
  exit 1
fi

CMD="$(discover_cmd "$WT")"
if [ -z "$CMD" ]; then
  metrics="$(jq -nc --arg sha "$SHA" '{sha:$sha,checkout:"clean",discovery:"no-test-command"}')"
  sentinel_report "$REPORT" "$GATE_ID" "skipped" "$metrics" \
    "No package.json test script, Makefile test target, or ./test found in the clean checkout — nothing to run. Set HEIMDALL_SANITY_CMD to wire one."
  exit 0
fi

# Run the discovered command in the clean checkout. Capture tail for the locator.
# errexit DISABLED around the run + log capture: the command's non-zero exit IS
# the verdict (recorded in $rc), and the tail pipeline must not abort the script
# under set -e/pipefail before report.json is written.
set +e
LOG="$(mktemp)"
rc=0
( cd "$WT" && eval "$CMD" ) >"$LOG" 2>&1 || rc=$?
TAIL="$(tail -c 500 "$LOG" | tr '\n' ' ' | tr -s ' ')"
rm -f "$LOG"
set -e

if [ "$rc" -eq 0 ]; then
  metrics="$(jq -nc --arg sha "$SHA" --arg cmd "$CMD" \
    '{sha:$sha,checkout:"clean",command:$cmd,exit_code:0}')"
  sentinel_report "$REPORT" "$GATE_ID" "pass" "$metrics" \
    "Clean checkout of $SHA built and tested green — wave output is reproducible outside the dirty tree."
  exit 0
fi

metrics="$(jq -nc --arg sha "$SHA" --arg cmd "$CMD" --argjson ec "$rc" \
  '{sha:$sha,checkout:"clean",command:$cmd,exit_code:$ec}')"
sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
  "Clean checkout of $SHA FAILED (exit $rc) running '$CMD'. The dirty working tree masked a dependency on uncommitted/untracked state. Commit what's missing or fix the test." \
  "clean-checkout build/test" "exit 0 (green)" "exit $rc: $TAIL"
exit 1
