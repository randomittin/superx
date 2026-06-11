#!/usr/bin/env bash
# run.test.sh — TDD harness for the exchange-lob structured gate contract (run.sh + gate.json).
#
# Asserts spec 2A's typed-report contract: run.sh consumes a fixture, runs the
# differential/interleave comparison, and WRITES a typed report.json (never parses
# stdout). gate.json declares the gate's identity. These are the acceptance gates;
# run them before trusting the gate green.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$DIR/run.sh"
GATE_JSON="$DIR/gate.json"
FIX="$DIR/fixtures"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
ok()   { printf '  PASS: %s\n' "$1"; pass=$(( pass + 1 )); }
bad()  { printf '  FAIL: %s\n' "$1"; fail=$(( fail + 1 )); }

echo "[1] gate.json contract"
if jq -e '.id=="exchange-lob" and (.trigger|type=="string") and (.severity|type=="string") and (.name|type=="string")' "$GATE_JSON" >/dev/null 2>&1; then
  ok "gate.json has id/name/trigger/severity"
else
  bad "gate.json missing required typed fields"
fi

echo "[2] run.sh is valid bash + executable"
if bash -n "$RUN" 2>/dev/null; then ok "run.sh parses (bash -n)"; else bad "run.sh has syntax errors"; fi
if [ -x "$RUN" ]; then ok "run.sh is executable"; else bad "run.sh not chmod +x"; fi

echo "[3] GOLDEN input -> status=pass, first_divergence=null, exit 0"
golden_report="$TMP/golden.report.json"
if "$RUN" --input "$FIX/golden/order-stream.json" --report "$golden_report" >/dev/null 2>&1; then
  golden_rc=0; else golden_rc=$?; fi
if [ "$golden_rc" -eq 0 ]; then ok "golden run exit 0"; else bad "golden run exited $golden_rc (expected 0)"; fi
if jq -e '.status=="pass" and .first_divergence==null and .gate_id=="exchange-lob" and (.metrics|type=="object") and (.fix_hint|type=="string")' "$golden_report" >/dev/null 2>&1; then
  ok "golden report.json: status=pass, first_divergence=null, schema valid"
else
  bad "golden report.json invalid"; cat "$golden_report" 2>/dev/null || true
fi

echo "[4] MUTANT queue-jump -> status=fail, non-null first_divergence, exit nonzero"
mut_report="$TMP/mutant.report.json"
if "$RUN" --input "$FIX/mutants/queue-jump" --report "$mut_report" >/dev/null 2>&1; then
  mut_rc=0; else mut_rc=$?; fi
if [ "$mut_rc" -ne 0 ]; then ok "mutant run exit nonzero ($mut_rc)"; else bad "mutant run exit 0 (expected nonzero)"; fi
if jq -e '.status=="fail" and (.first_divergence|type=="string") and (.first_divergence|length>0) and .gate_id=="exchange-lob" and (.metrics|type=="object") and (.fix_hint|type=="string")' "$mut_report" >/dev/null 2>&1; then
  ok "mutant report.json: status=fail, non-null first_divergence pinpoint, schema valid"
else
  bad "mutant report.json invalid"; cat "$mut_report" 2>/dev/null || true
fi

echo "[5] book-state mutant drop-resting-remainder -> status=fail with book pinpoint"
book_report="$TMP/book.report.json"
if "$RUN" --input "$FIX/mutants/drop-resting-remainder" --report "$book_report" >/dev/null 2>&1; then
  book_rc=0; else book_rc=$?; fi
if [ "$book_rc" -ne 0 ] && jq -e '.status=="fail" and (.first_divergence|type=="string")' "$book_report" >/dev/null 2>&1; then
  ok "book-state mutant fails with non-null first_divergence"
else
  bad "book-state mutant not rejected correctly (rc=$book_rc)"; cat "$book_report" 2>/dev/null || true
fi

echo "[6] tautological-concurrency guard -> status=fail (non-falsifiable construction)"
taut_report="$TMP/taut.report.json"
if "$RUN" --input "$FIX/mutants/tautological-concurrency" --report "$taut_report" >/dev/null 2>&1; then
  taut_rc=0; else taut_rc=$?; fi
if [ "$taut_rc" -ne 0 ] && jq -e '.status=="fail" and (.first_divergence|type=="string")' "$taut_report" >/dev/null 2>&1; then
  ok "tautological-concurrency guard rejected as fail"
else
  bad "tautological-concurrency guard not rejected (rc=$taut_rc)"; cat "$taut_report" 2>/dev/null || true
fi

echo "[7] default --report path is evals/oracles/exchange-lob/report.json"
rm -f "$DIR/report.json"
if "$RUN" --input "$FIX/golden/order-stream.json" >/dev/null 2>&1 && [ -f "$DIR/report.json" ]; then
  ok "default report written to gate-dir report.json"
else
  bad "default report.json not written to gate dir"
fi

echo ""
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
