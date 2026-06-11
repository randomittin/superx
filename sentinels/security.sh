#!/usr/bin/env bash
# security.sh — SECURITY sentinel (spec H-3, trigger: pre-push).
#
# Job: two real checks before code leaves the machine —
#   1. SECRET SCAN: gitleaks (preferred) or trufflehog over the repo / commit
#      range. A hit = a leaked credential about to be pushed = hard fail.
#   2. DEPENDENCY AUDIT: `npm audit` (Node) or `pip-audit` (Python) for known-
#      vulnerable dependencies. High/critical advisories = fail.
#
# DEGRADE GRACEFULLY, NEVER FAKE: if NO secret scanner is installed, the secret
# arm reports skipped (naming the missing tool) — it does not claim "clean".
# Likewise the audit arm skips honestly when neither npm nor pip-audit applies.
# A skipped arm is reported as skipped; a pass is only emitted when a real tool
# actually ran and found nothing. The overall verdict is the WORST arm:
#   any fail -> fail ; else any real pass -> pass ; else (all skipped) -> skipped.
#
# Inputs:
#   --repo   repo root to scan (required).
#   --range  git commit range for the secret scan (e.g. "origin/main..HEAD").
#            Default: scan the whole repo history-less working tree + index.
#   --report where to write report.json.
#
# Verdict (standard 8-field report.json). metrics carries a per-arm breakdown so
# the consumer can see exactly what ran vs what was skipped for lack of a tool.
#
# Usage:
#   security.sh --repo <root> [--range <gitrange>] [--report <out>]
set -euo pipefail

SELF="$0"
if command -v readlink >/dev/null 2>&1; then
  SELF="$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")"
fi
SENT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
# shellcheck source=lib/report.sh
. "$SENT_DIR/lib/report.sh"

GATE_ID="sentinel-security"

REPO=""
RANGE=""
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)   REPO="${2:?--repo needs a path}"; shift 2 ;;
    --range)  RANGE="${2:?--range needs a value}"; shift 2 ;;
    --report) REPORT="${2:?--report needs a path}"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$SELF"; exit 0 ;;
    *) echo "error: unknown arg: $1" >&2; exit 2 ;;
  esac
done

[ -n "$REPO" ] || { echo "error: --repo is required" >&2; exit 2; }
[ -d "$REPO" ] || { echo "error: --repo not a dir: $REPO" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 2; }
: "${REPORT:=$REPO/.planning/spawns/reports/security.report.json}"

# ── Arm 1: secret scan ────────────────────────────────────────────────
# Returns via globals: SECRET_STATUS (pass|fail|skipped), SECRET_TOOL,
# SECRET_COUNT, SECRET_FIRST (a human locator for the first finding).
SECRET_STATUS="skipped"; SECRET_TOOL="none"; SECRET_COUNT=0; SECRET_FIRST=""
secret_scan() {
  local tmp; tmp="$(mktemp)"
  if command -v gitleaks >/dev/null 2>&1; then
    SECRET_TOOL="gitleaks"
    local args=(detect --source "$REPO" --no-banner --report-format json --report-path "$tmp")
    [ -n "$RANGE" ] && args+=(--log-opts "$RANGE")
    # gitleaks exit: 0 = no leaks, 1 = leaks found, >1 = error.
    local rc=0
    gitleaks "${args[@]}" >/dev/null 2>&1 || rc=$?
    if [ "$rc" -eq 0 ]; then
      SECRET_STATUS="pass"; SECRET_COUNT=0
    elif [ "$rc" -eq 1 ]; then
      SECRET_STATUS="fail"
      SECRET_COUNT="$(jq 'length' "$tmp" 2>/dev/null || echo 1)"
      SECRET_FIRST="$(jq -r 'if length>0 then "\(.[0].RuleID // .[0].rule) in \(.[0].File // .[0].file):\(.[0].StartLine // .[0].line)" else "finding" end' "$tmp" 2>/dev/null || echo "secret finding")"
    else
      # tool error -> honest skip, not a false pass
      SECRET_STATUS="skipped"; SECRET_TOOL="gitleaks(error rc=$rc)"
    fi
  elif command -v trufflehog >/dev/null 2>&1; then
    SECRET_TOOL="trufflehog"
    local rc=0
    trufflehog filesystem "$REPO" --json --no-update >"$tmp" 2>/dev/null || rc=$?
    # trufflehog emits one JSON object per finding (NDJSON). Count non-empty lines.
    local n; n="$(grep -c . "$tmp" 2>/dev/null || echo 0)"
    if [ "$n" -gt 0 ]; then
      SECRET_STATUS="fail"; SECRET_COUNT="$n"
      SECRET_FIRST="$(head -1 "$tmp" | jq -r '.DetectorName // "secret"' 2>/dev/null || echo "secret finding")"
    else
      SECRET_STATUS="pass"; SECRET_COUNT=0
    fi
  else
    SECRET_STATUS="skipped"; SECRET_TOOL="none(install gitleaks or trufflehog)"
  fi
  rm -f "$tmp"
}

# ── Arm 2: dependency audit ───────────────────────────────────────────
# Globals: AUDIT_STATUS (pass|fail|skipped), AUDIT_TOOL, AUDIT_HIGH (count of
# high+critical advisories), AUDIT_FIRST.
AUDIT_STATUS="skipped"; AUDIT_TOOL="none"; AUDIT_HIGH=0; AUDIT_FIRST=""
dep_audit() {
  local tmp; tmp="$(mktemp)"
  if [ -f "$REPO/package.json" ] && command -v npm >/dev/null 2>&1; then
    AUDIT_TOOL="npm-audit"
    ( cd "$REPO" && npm audit --json ) >"$tmp" 2>/dev/null || true
    if [ -s "$tmp" ] && jq -e . "$tmp" >/dev/null 2>&1; then
      # npm v7+ shape: .metadata.vulnerabilities.{high,critical}
      AUDIT_HIGH="$(jq -r '((.metadata.vulnerabilities.high // 0) + (.metadata.vulnerabilities.critical // 0))' "$tmp" 2>/dev/null || echo 0)"
      if [ "${AUDIT_HIGH:-0}" -gt 0 ]; then
        AUDIT_STATUS="fail"
        AUDIT_FIRST="$(jq -r '[.vulnerabilities // {} | to_entries[] | select(.value.severity=="high" or .value.severity=="critical")][0].key // "high/critical advisory"' "$tmp" 2>/dev/null || echo "advisory")"
      else
        AUDIT_STATUS="pass"
      fi
    else
      AUDIT_STATUS="skipped"; AUDIT_TOOL="npm-audit(no parseable output — offline?)"
    fi
  elif command -v pip-audit >/dev/null 2>&1 && { [ -f "$REPO/requirements.txt" ] || [ -f "$REPO/pyproject.toml" ]; }; then
    AUDIT_TOOL="pip-audit"
    local rc=0
    ( cd "$REPO" && pip-audit -f json ) >"$tmp" 2>/dev/null || rc=$?
    if [ -s "$tmp" ] && jq -e . "$tmp" >/dev/null 2>&1; then
      AUDIT_HIGH="$(jq '[.dependencies[]? | select((.vulns | length) > 0)] | length' "$tmp" 2>/dev/null || echo 0)"
      if [ "${AUDIT_HIGH:-0}" -gt 0 ]; then
        AUDIT_STATUS="fail"
        AUDIT_FIRST="$(jq -r '[.dependencies[]? | select((.vulns|length)>0)][0].name // "vulnerable package"' "$tmp" 2>/dev/null || echo "package")"
      else
        AUDIT_STATUS="pass"
      fi
    else
      AUDIT_STATUS="skipped"; AUDIT_TOOL="pip-audit(no parseable output)"
    fi
  else
    AUDIT_STATUS="skipped"; AUDIT_TOOL="none(no package.json/requirements.txt, or auditor absent)"
  fi
  rm -f "$tmp"
}

secret_scan
dep_audit

# Worst-arm aggregation: fail dominates; a real pass beats all-skipped.
overall="skipped"
if [ "$SECRET_STATUS" = "fail" ] || [ "$AUDIT_STATUS" = "fail" ]; then
  overall="fail"
elif [ "$SECRET_STATUS" = "pass" ] || [ "$AUDIT_STATUS" = "pass" ]; then
  overall="pass"
fi

metrics="$(jq -nc \
  --arg ss "$SECRET_STATUS" --arg st "$SECRET_TOOL" --argjson sc "${SECRET_COUNT:-0}" \
  --arg as "$AUDIT_STATUS"  --arg at "$AUDIT_TOOL"  --argjson ah "${AUDIT_HIGH:-0}" \
  '{secret_scan:{status:$ss, tool:$st, findings:$sc},
    dependency_audit:{status:$as, tool:$at, high_critical:$ah}}')"

case "$overall" in
  fail)
    # Pin the first failing arm as the divergence.
    if [ "$SECRET_STATUS" = "fail" ]; then
      sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
        "Secret scan ($SECRET_TOOL) found $SECRET_COUNT leaked credential(s). Do NOT push. Remove the secret, rotate it, and rewrite history if it was ever committed." \
        "secret-scan" "no secrets in the push" "$SECRET_COUNT finding(s); first: $SECRET_FIRST"
    else
      sentinel_report "$REPORT" "$GATE_ID" "fail" "$metrics" \
        "Dependency audit ($AUDIT_TOOL) found $AUDIT_HIGH high/critical advisory(ies). Upgrade or pin the affected dependency before pushing." \
        "dependency-audit" "no high/critical advisories" "$AUDIT_HIGH advisory(ies); first: $AUDIT_FIRST"
    fi
    exit 1 ;;
  pass)
    sentinel_report "$REPORT" "$GATE_ID" "pass" "$metrics" \
      "Security clean: secret scan ($SECRET_TOOL/$SECRET_STATUS), dependency audit ($AUDIT_TOOL/$AUDIT_STATUS). Safe to push on these checks."
    exit 0 ;;
  *)
    sentinel_report "$REPORT" "$GATE_ID" "skipped" "$metrics" \
      "Security sentinel could not run any real check: no secret scanner (gitleaks/trufflehog) and no applicable dependency auditor. Install gitleaks and/or wire npm/pip-audit to get a real verdict — NOT treated as a pass."
    exit 0 ;;
esac
