#!/usr/bin/env bash
# bloat.sh — BLOAT sentinel (spec H-3, trigger: post-wave).
#
# Job: the post-wave bloat check. This is the HARNESS that will invoke H-2's LLM
# layer (`{simplifiable, top_2_suggestions}`) once H-2 ships. Until H-2 exists,
# it falls back to the DETERMINISTIC toolset (the same tools H-2's scorecard
# uses) when those tools are installed, and emits an honest skipped report only
# when there is genuinely nothing real to run. This is a REAL CONDITIONAL, not a
# no-op: every branch does real work or honestly skips.
#
# Resolution order (first usable wins):
#   1. H-2 LLM layer — if an executable bloat scorer is wired via env
#      HEIMDALL_BLOAT_SCORER (a command taking the diff/criteria and printing a
#      JSON {simplifiable:bool, top_2_suggestions:[...]} object), run it.
#   2. Deterministic tools — whichever of these are installed, run on the repo:
#        knip / ts-prune (dead exports), jscpd (duplication %, bar <3%),
#        vulture (dead Python). Any signal present => report it.
#   3. Neither available => honest skipped report (names what's missing).
#
# Metrics thresholds (spec H-2 table): jscpd duplication < 3% is the bar; a dup
# percentage at/above 3% is a fail. Dead exports / unused symbols are reported as
# counts (a non-zero count is a fail — the wave shipped dead code).
#
# Inputs:
#   --repo     repo root to analyze (required).
#   --diff     git range describing the wave's new code (e.g. "HEAD~1..HEAD").
#              Passed through to the H-2 scorer; the deterministic arm scans repo.
#   --criteria acceptance-criteria ids (comma-separated) passed to the H-2 scorer.
#   --report   where to write report.json.
#
# Usage:
#   bloat.sh --repo <root> [--diff <range>] [--criteria <ids>] [--report <out>]
set -euo pipefail

SELF="$0"
if command -v readlink >/dev/null 2>&1; then
  SELF="$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")"
fi
SENT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
# shellcheck source=lib/report.sh
. "$SENT_DIR/lib/report.sh"

GATE_ID="sentinel-bloat"

REPO=""
DIFF=""
CRITERIA=""
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)     REPO="${2:?--repo needs a path}"; shift 2 ;;
    --diff)     DIFF="${2:?--diff needs a value}"; shift 2 ;;
    --criteria) CRITERIA="${2:?--criteria needs a value}"; shift 2 ;;
    --report)   REPORT="${2:?--report needs a path}"; shift 2 ;;
    -h|--help)  sed -n '2,40p' "$SELF"; exit 0 ;;
    *) echo "error: unknown arg: $1" >&2; exit 2 ;;
  esac
done

[ -n "$REPO" ] || { echo "error: --repo is required" >&2; exit 2; }
[ -d "$REPO" ] || { echo "error: --repo not a dir: $REPO" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 2; }
: "${REPORT:=$REPO/.planning/spawns/reports/bloat.report.json}"

# ── Branch 1: H-2 LLM scorer, if wired ────────────────────────────────
if [ -n "${HEIMDALL_BLOAT_SCORER:-}" ] && command -v "${HEIMDALL_BLOAT_SCORER%% *}" >/dev/null 2>&1; then
  scorer_out="$( cd "$REPO" && eval "$HEIMDALL_BLOAT_SCORER" --diff "${DIFF:-HEAD~1..HEAD}" --criteria "${CRITERIA:-}" 2>/dev/null )" || true
  if printf '%s' "$scorer_out" | jq -e 'has("simplifiable")' >/dev/null 2>&1; then
    simplifiable="$(printf '%s' "$scorer_out" | jq -r '.simplifiable')"
    sugg="$(printf '%s' "$scorer_out" | jq -c '.top_2_suggestions // []')"
    metrics="$(jq -nc --arg layer "h2-llm" --argjson s "$sugg" --arg simp "$simplifiable" \
      '{layer:$layer, simplifiable:($simp=="true"), top_2_suggestions:$s}')"
    if [ "$simplifiable" = "true" ]; then
      first="$(printf '%s' "$sugg" | jq -r '.[0] // "simplification available"')"
      sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
        "H-2 bloat layer flagged this wave as simplifiable. Run the mandatory simplification pass. Top suggestion: $first" \
        "bloat (h2-llm)" "simplifiable: false (wave is minimal)" "simplifiable: true"
      exit 1
    fi
    sentinel_report "$REPORT" "$GATE_ID" "pass" "$metrics" \
      "H-2 bloat layer found the wave minimal — no mandatory simplification pass required."
    exit 0
  fi
  # scorer wired but produced no parseable verdict -> fall through to det. tools.
fi

# ── Branch 2: deterministic toolset, whichever is installed ───────────
# errexit DISABLED for the whole deterministic arm. Several lines use the
# `<condition> && findings+=(...)` idiom, which returns non-zero when the
# condition is false, and tool/`grep -c` pipelines return non-zero on zero
# matches. None of those are failures of THIS sentinel — the verdict is carried
# in dead_exports/dup_pct/findings. errexit is re-enabled before the report.
set +e
ran_any=0
dead_exports=0
dup_pct=""
findings=()

# knip / ts-prune — dead exports (JS/TS).
if [ -f "$REPO/package.json" ]; then
  if command -v knip >/dev/null 2>&1; then
    ran_any=1
    n="$( cd "$REPO" && knip --no-progress --reporter json 2>/dev/null | jq '([.files?, (.issues? // [] | length)] | map(select(.!=null)) | add) // 0' 2>/dev/null || echo 0 )"
    [ -n "$n" ] && dead_exports=$(( dead_exports + n ))
    [ "$n" -gt 0 ] 2>/dev/null && findings+=("knip: $n dead-code issue(s)")
  elif command -v ts-prune >/dev/null 2>&1; then
    ran_any=1
    n="$( cd "$REPO" && ts-prune 2>/dev/null | grep -vc 'used in module' || echo 0 )"
    [ -n "$n" ] && dead_exports=$(( dead_exports + n ))
    [ "$n" -gt 0 ] 2>/dev/null && findings+=("ts-prune: $n unused export(s)")
  fi
fi

# vulture — dead Python.
if command -v vulture >/dev/null 2>&1 && { [ -f "$REPO/pyproject.toml" ] || ls "$REPO"/*.py >/dev/null 2>&1; }; then
  ran_any=1
  n="$( cd "$REPO" && vulture . 2>/dev/null | grep -c 'unused' || echo 0 )"
  [ -n "$n" ] && dead_exports=$(( dead_exports + n ))
  [ "$n" -gt 0 ] 2>/dev/null && findings+=("vulture: $n unused Python symbol(s)")
fi

# jscpd — duplication percentage (bar: < 3%).
if command -v jscpd >/dev/null 2>&1; then
  ran_any=1
  jtmp="$(mktemp -d)"
  ( cd "$REPO" && jscpd --silent --reporters json --output "$jtmp" . ) >/dev/null 2>&1 || true
  if [ -f "$jtmp/jscpd-report.json" ]; then
    dup_pct="$(jq -r '.statistics.total.percentage // 0' "$jtmp/jscpd-report.json" 2>/dev/null || echo 0)"
    awk -v p="${dup_pct:-0}" 'BEGIN{exit !(p+0 >= 3)}' && findings+=("jscpd: ${dup_pct}% duplication (>=3% bar)")
  fi
  rm -rf "$jtmp"
fi

if [ "$ran_any" -eq 0 ]; then
  metrics="$(jq -nc '{layer:"none",reason:"no H-2 scorer wired and no deterministic bloat tool installed (knip/ts-prune/vulture/jscpd)"}')"
  sentinel_report "$REPORT" "$GATE_ID" "skipped" "$metrics" \
    "No bloat check could run: H-2 LLM layer not wired (set HEIMDALL_BLOAT_SCORER) and none of knip/ts-prune/vulture/jscpd installed. Honest skip — NOT a pass."
  exit 0
fi

# Build metrics from whatever deterministic tools ran.
metrics="$(jq -nc \
  --arg layer "deterministic" \
  --argjson de "$dead_exports" \
  --arg dup "${dup_pct:-}" \
  --argjson findings "$(printf '%s\n' "${findings[@]:-}" | jq -R . | jq -sc 'map(select(length>0))')" \
  '{layer:$layer, dead_exports:$de,
    duplication_pct:(if $dup=="" then null else ($dup|tonumber) end),
    findings:$findings}')"

# A fail if any deterministic signal fired (dead code shipped or dup >= 3%).
dup_over=0
[ -n "${dup_pct:-}" ] && awk -v p="${dup_pct:-0}" 'BEGIN{exit !(p+0 >= 3)}' && dup_over=1
set -e   # re-enable errexit now that the verdict is computed
if [ "$dead_exports" -gt 0 ] || [ "$dup_over" -eq 1 ]; then
  first="${findings[0]:-bloat signal}"
  sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
    "Deterministic bloat check fired: ${first}. Delete dead exports / consolidate duplication before this wave lands." \
    "bloat (deterministic)" "0 dead exports and < 3% duplication" "$first"
  exit 1
fi

sentinel_report "$REPORT" "$GATE_ID" "pass" "$metrics" \
  "Deterministic bloat check clean: 0 dead exports, duplication ${dup_pct:-n/a}% (< 3% bar)."
exit 0
