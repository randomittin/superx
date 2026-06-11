#!/usr/bin/env bash
# spec-drift.sh — SPEC-DRIFT sentinel (spec H-3, trigger: per-wave).
#
# Job: re-check a wave's output against the ORIGINAL spec + INVARIANTS, not the
# drifted intermediate state the wave evolved through. The failure class this
# catches: a wave that satisfies the last reviewer's mental model but has quietly
# diverged from the original acceptance criteria / invariants over many edits.
#
# The check is RUNNABLE and deterministic (design law 1: a number, a diff, or a
# blocked commit — never advice). It does NOT ask an LLM "did this drift?". It
# runs the original acceptance criteria as commands and asserts each invariant.
#
# Inputs (the minimal-context brief — refs, never restated plans):
#   --spec       path to the ORIGINAL spec file (read-only reference, pinned).
#   --invariants path to INVARIANTS.md. Each invariant is a checkable assertion.
#   --criteria   path to a criteria file: one acceptance check PER LINE, format
#                  <id>\t<shell-command>
#                Lines starting with # are comments. The command's exit 0 = met.
#   --repo       repo root the criteria/invariants commands run in.
#
# At least one of --criteria / --invariants must be provided (something real to
# check). With neither, the sentinel emits an honest skipped report — it will
# not manufacture a verdict from nothing.
#
# INVARIANTS.md format (one invariant per non-comment, non-blank line):
#   <id>\t<shell-command-that-must-exit-0>
#   e.g.   INV1\ttest -f dist/bundle.js
#          INV2\tgrep -q "export default" src/index.ts
#
# Verdict (standard 8-field report.json):
#   pass    — every criterion command and every invariant assertion exited 0.
#   fail    — at least one criterion/invariant FAILED -> first_divergence pins
#             the FIRST failing id (the original-spec dimension that drifted).
#   skipped — neither criteria nor invariants supplied / found.
#
# Usage:
#   spec-drift.sh --repo <root> [--spec <f>] [--criteria <f>] [--invariants <f>] [--report <out>]
set -euo pipefail

SELF="$0"
if command -v readlink >/dev/null 2>&1; then
  SELF="$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")"
fi
SENT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
# shellcheck source=lib/report.sh
. "$SENT_DIR/lib/report.sh"

GATE_ID="sentinel-spec-drift"

REPO="$(pwd)"
SPEC=""
CRITERIA=""
INVARIANTS=""
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)       REPO="${2:?--repo needs a path}"; shift 2 ;;
    --spec)       SPEC="${2:?--spec needs a path}"; shift 2 ;;
    --criteria)   CRITERIA="${2:?--criteria needs a path}"; shift 2 ;;
    --invariants) INVARIANTS="${2:?--invariants needs a path}"; shift 2 ;;
    --report)     REPORT="${2:?--report needs a path}"; shift 2 ;;
    -h|--help)    sed -n '2,40p' "$SELF"; exit 0 ;;
    *) echo "error: unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 2; }
[ -d "$REPO" ] || { echo "error: --repo not a dir: $REPO" >&2; exit 2; }
: "${REPORT:=$REPO/.planning/spawns/reports/spec-drift.report.json}"

# Nothing real to check against -> honest skip (no manufactured verdict).
if { [ -z "$CRITERIA" ] || [ ! -f "$CRITERIA" ]; } && { [ -z "$INVARIANTS" ] || [ ! -f "$INVARIANTS" ]; }; then
  metrics="$(jq -nc --arg spec "${SPEC:-}" '{spec:(if $spec=="" then null else $spec end),criteria_file:null,invariants_file:null,reason:"no-checks-supplied"}')"
  sentinel_report "$REPORT" "$GATE_ID" "skipped" "$metrics" \
    "No criteria file and no INVARIANTS file found to check against — pass --criteria and/or --invariants pointing at the ORIGINAL spec's runnable checks."
  exit 0
fi

# Run one tab-separated "<id>\t<command>" check line in the repo. Returns the
# command's exit code; sets globals FAIL_ID/FAIL_CMD/FAIL_OUT on first failure.
checks_run=0
checks_passed=0
FAIL_ID=""; FAIL_CMD=""; FAIL_OUT=""

run_check_file() {
  local file="$1" kind="$2"
  [ -f "$file" ] || return 0
  local line id cmd out rc
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    # Split on the FIRST tab; tolerate spaces-as-separator if no tab present.
    if printf '%s' "$line" | grep -q $'\t'; then
      id="${line%%$'\t'*}"; cmd="${line#*$'\t'}"
    else
      id="${line%% *}"; cmd="${line#* }"
    fi
    [ -n "$cmd" ] && [ "$cmd" != "$id" ] || { id="$kind"; cmd="$line"; }
    checks_run=$(( checks_run + 1 ))
    out="$( cd "$REPO" && eval "$cmd" 2>&1 )" && rc=0 || rc=$?
    if [ "$rc" -eq 0 ]; then
      checks_passed=$(( checks_passed + 1 ))
    elif [ -z "$FAIL_ID" ]; then
      FAIL_ID="$kind:$id"
      FAIL_CMD="$cmd"
      FAIL_OUT="$(printf '%s' "$out" | tr '\n' ' ' | tr -s ' ' | cut -c1-300)"
    fi
  done < "$file"
}

# Criteria first (acceptance), then invariants — both against the ORIGINAL refs.
# errexit DISABLED here: a failing criterion/invariant command (its non-zero exit
# IS the signal recorded into FAIL_ID), and the `[ -n ... ] && run_check_file`
# short-circuit when a path is empty, must NOT abort the script before the report
# is written. The verdict is carried in FAIL_ID/checks_*, never in exit codes.
set +e
[ -n "$CRITERIA" ]   && run_check_file "$CRITERIA" "criterion"
[ -n "$INVARIANTS" ] && run_check_file "$INVARIANTS" "invariant"
set -e

if [ "$checks_run" -eq 0 ]; then
  metrics="$(jq -nc '{checks_run:0,reason:"files-present-but-no-check-lines"}')"
  sentinel_report "$REPORT" "$GATE_ID" "skipped" "$metrics" \
    "Criteria/invariants files contained no runnable check lines (all comments/blank)."
  exit 0
fi

metrics="$(jq -nc \
  --argjson run "$checks_run" --argjson passed "$checks_passed" \
  --arg spec "${SPEC:-}" --arg cf "${CRITERIA:-}" --arg inv "${INVARIANTS:-}" \
  '{checks_run:$run, checks_passed:$passed, checks_failed:($run-$passed),
    spec:(if $spec=="" then null else $spec end),
    criteria_file:(if $cf=="" then null else $cf end),
    invariants_file:(if $inv=="" then null else $inv end)}')"

if [ -z "$FAIL_ID" ]; then
  sentinel_report "$REPORT" "$GATE_ID" "pass" "$metrics" \
    "All $checks_passed/$checks_run original-spec criteria + invariants still hold — wave output has not drifted from the original spec."
  exit 0
fi

sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
  "Wave output drifted from the ORIGINAL spec: $FAIL_ID failed. Re-check the wave against the original criterion/invariant, not the current intermediate state. Failing check: $FAIL_CMD" \
  "$FAIL_ID" "command '$FAIL_CMD' exits 0 (original spec satisfied)" "non-zero exit; output: $FAIL_OUT"
exit 1
