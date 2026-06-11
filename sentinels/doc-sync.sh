#!/usr/bin/env bash
# doc-sync.sh — DOC-SYNC sentinel (spec H-3 contract kind: doc_sync).
#
# The spawn contract's `kind` enum includes `doc_sync`; this is its real
# implementation so the orchestrator never dispatches to a missing sentinel.
#
# Job: detect documentation that has drifted out of sync with the code — the
# common rot where a README/doc references a file path or a code symbol that no
# longer exists after a wave's edits. This is a deterministic, runnable check
# (design law 1: a diff, never advice), not an LLM "does this read well?".
#
# What it checks, for every Markdown doc under the repo (excluding node_modules,
# .git, and the changelog):
#   1. Inline-code file references like `src/foo.ts` or `bin/bar` that look like
#      repo-relative paths -> assert the path still exists.
#   2. Markdown links to local files [text](path) -> assert the target exists
#      (http(s)/mailto/anchor-only links are skipped).
#
# A dangling reference = documentation drift = fail, pinning the FIRST one.
#
# Inputs:
#   --repo  repo root (required).
#   --diff  git range; when given, only docs touched in that range are checked
#           (post-wave scope). Without it, all tracked Markdown docs are checked.
#   --report where to write report.json.
#
# Verdict (standard 8-field report.json):
#   pass    — every referenced local path/link target in scope exists.
#   fail    — a doc references a path that no longer exists (first one pinned).
#   skipped — no Markdown docs in scope to check.
#
# Usage:
#   doc-sync.sh --repo <root> [--diff <range>] [--report <out>]
set -euo pipefail

SELF="$0"
if command -v readlink >/dev/null 2>&1; then
  SELF="$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")"
fi
SENT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
# shellcheck source=lib/report.sh
. "$SENT_DIR/lib/report.sh"

GATE_ID="sentinel-doc-sync"

REPO=""
DIFF=""
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)   REPO="${2:?--repo needs a path}"; shift 2 ;;
    --diff)   DIFF="${2:?--diff needs a value}"; shift 2 ;;
    --report) REPORT="${2:?--report needs a path}"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$SELF"; exit 0 ;;
    *) echo "error: unknown arg: $1" >&2; exit 2 ;;
  esac
done

[ -n "$REPO" ] || { echo "error: --repo is required" >&2; exit 2; }
[ -d "$REPO" ] || { echo "error: --repo not a dir: $REPO" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 2; }
: "${REPORT:=$REPO/.planning/spawns/reports/doc-sync.report.json}"

# Collect the docs in scope.
docs=()
if [ -n "$DIFF" ] && git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in *.md|*.MD|*.markdown) [ -f "$REPO/$f" ] && docs+=("$REPO/$f") ;; esac
  done < <(git -C "$REPO" diff --name-only "$DIFF" 2>/dev/null || true)
else
  while IFS= read -r f; do docs+=("$f"); done < <(
    find "$REPO" -type f \( -name '*.md' -o -name '*.markdown' \) \
      -not -path '*/node_modules/*' -not -path '*/.git/*' \
      -not -name 'CHANGELOG.md' 2>/dev/null
  )
fi

if [ "${#docs[@]}" -eq 0 ]; then
  metrics="$(jq -nc --arg diff "${DIFF:-}" '{docs_in_scope:0,diff:(if $diff=="" then null else $diff end)}')"
  sentinel_report "$REPORT" "$GATE_ID" "skipped" "$metrics" \
    "No Markdown docs in scope to check for drift."
  exit 0
fi

refs_checked=0
FAIL_DOC=""; FAIL_REF=""

# Decide whether a captured token looks like a repo-relative path worth checking.
_looks_like_path() {
  case "$1" in
    http://*|https://*|mailto:*|\#*|"") return 1 ;;
    */*) return 0 ;;            # has a slash -> path-like
    *.sh|*.ts|*.js|*.json|*.md|*.py|*.go|*.rs) return 0 ;;  # known extensions
    *) return 1 ;;
  esac
}

check_doc() {
  local doc="$1"
  local docdir; docdir="$(dirname "$doc")"
  # 1) Markdown links: [text](target)
  local target
  while IFS= read -r target; do
    [ -n "$target" ] || continue
    target="${target%% *}"        # strip optional "title"
    _looks_like_path "$target" || continue
    refs_checked=$(( refs_checked + 1 ))
    if [ ! -e "$REPO/$target" ] && [ ! -e "$docdir/$target" ]; then
      [ -z "$FAIL_DOC" ] && { FAIL_DOC="${doc#"$REPO"/}"; FAIL_REF="$target"; }
    fi
  done < <(grep -oE '\]\([^)]+\)' "$doc" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//')

  # 2) Inline-code paths: `path/like/this` or `bin/foo`
  local tok
  while IFS= read -r tok; do
    [ -n "$tok" ] || continue
    _looks_like_path "$tok" || continue
    refs_checked=$(( refs_checked + 1 ))
    if [ ! -e "$REPO/$tok" ] && [ ! -e "$docdir/$tok" ]; then
      [ -z "$FAIL_DOC" ] && { FAIL_DOC="${doc#"$REPO"/}"; FAIL_REF="$tok"; }
    fi
  done < <(grep -oE '`[^`]+`' "$doc" 2>/dev/null | tr -d '`')
}

for d in "${docs[@]}"; do check_doc "$d"; done

metrics="$(jq -nc --argjson n "${#docs[@]}" --argjson r "$refs_checked" \
  '{docs_checked:$n, refs_checked:$r}')"

if [ -z "$FAIL_DOC" ]; then
  sentinel_report "$REPORT" "$GATE_ID" "pass" "$metrics" \
    "All $refs_checked local path/link references across ${#docs[@]} doc(s) resolve — docs in sync with the tree."
  exit 0
fi

sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
  "Documentation drift: $FAIL_DOC references '$FAIL_REF', which no longer exists. Update the doc or restore the path." \
  "$FAIL_DOC" "referenced path '$FAIL_REF' exists" "path '$FAIL_REF' not found in repo"
exit 1
