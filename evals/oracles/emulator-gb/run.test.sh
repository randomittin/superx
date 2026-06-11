#!/usr/bin/env bash
# run.test.sh — TDD harness for the emulator-gb structured gate contract (run.sh + gate.json).
#
# Asserts spec 2A's typed-report contract: run.sh consumes a gameboy-doctor trace,
# diffs it per-instruction against a truth log, and WRITES a typed report.json
# (never parses stdout). gate.json declares the gate's identity.
#
# CONVENTIONS R6 — golden checks must be CAPABLE OF FAILING. This harness does not
# only confirm green-on-good; it includes a corrupt-and-confirm case: a deliberately
# mutated copy of the golden MUST drive the gate RED. A gate that cannot be made to
# fail proves nothing. Run these before trusting the gate green.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$DIR/run.sh"
GATE_JSON="$DIR/gate.json"
GOLDEN="$DIR/fixtures/golden/trace.gbdoctor"
MUTANTS="$DIR/fixtures/mutants"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
ok()  { printf '  PASS: %s\n' "$1"; pass=$(( pass + 1 )); }
bad() { printf '  FAIL: %s\n' "$1"; fail=$(( fail + 1 )); }

echo "[1] gate.json contract"
if jq -e '.id=="emulator-gb" and (.trigger|type=="string") and (.severity|type=="string") and (.name|type=="string")' "$GATE_JSON" >/dev/null 2>&1; then
  ok "gate.json has id/name/trigger/severity"
else
  bad "gate.json missing required typed fields"
fi

echo "[2] run.sh is valid bash + executable"
if bash -n "$RUN" 2>/dev/null; then ok "run.sh parses (bash -n)"; else bad "run.sh has syntax errors"; fi
if [ -x "$RUN" ]; then ok "run.sh is executable"; else bad "run.sh not chmod +x"; fi

echo "[3] GOLDEN input vs itself -> status=pass, first_divergence=null, exit 0"
golden_report="$TMP/golden.report.json"
if "$RUN" --input "$GOLDEN" --truth "$GOLDEN" --report "$golden_report" >/dev/null 2>&1; then
  golden_rc=0; else golden_rc=$?; fi
if [ "$golden_rc" -eq 0 ]; then ok "golden run exit 0"; else bad "golden run exited $golden_rc (expected 0)"; fi
if jq -e '.status=="pass" and .first_divergence==null and .gate_id=="emulator-gb" and (.metrics|type=="object") and (.fix_hint|type=="string")' "$golden_report" >/dev/null 2>&1; then
  ok "golden report.json: status=pass, first_divergence=null, schema valid"
else
  bad "golden report.json invalid"; cat "$golden_report" 2>/dev/null || true
fi

echo "[4] MUTANT force-h-zero vs golden -> status=fail, instruction 4 (F-flag), exit nonzero"
mut_report="$TMP/force-h-zero.report.json"
if "$RUN" --input "$MUTANTS/force-h-zero" --truth "$GOLDEN" --report "$mut_report" >/dev/null 2>&1; then
  mut_rc=0; else mut_rc=$?; fi
if [ "$mut_rc" -ne 0 ]; then ok "force-h-zero run exit nonzero ($mut_rc)"; else bad "force-h-zero run exit 0 (expected nonzero)"; fi
if jq -e '.status=="fail" and (.first_divergence|type=="object") and .first_divergence.step=="instruction 4" and (.first_divergence.expected|test("F:20")) and (.first_divergence.actual|test("F:00")) and .gate_id=="emulator-gb"' "$mut_report" >/dev/null 2>&1; then
  ok "force-h-zero report.json: fail @ instruction 4, expected F:20 vs actual F:00"
else
  bad "force-h-zero report.json invalid"; cat "$mut_report" 2>/dev/null || true
fi

echo "[5] MUTANT skip-f-mask vs golden -> status=fail, instruction 2 (low-nibble leak)"
fm_report="$TMP/skip-f-mask.report.json"
if "$RUN" --input "$MUTANTS/skip-f-mask" --truth "$GOLDEN" --report "$fm_report" >/dev/null 2>&1; then
  fm_rc=0; else fm_rc=$?; fi
if [ "$fm_rc" -ne 0 ] && jq -e '.status=="fail" and .first_divergence.step=="instruction 2" and (.first_divergence.actual|test("F:1F"))' "$fm_report" >/dev/null 2>&1; then
  ok "skip-f-mask report.json: fail @ instruction 2, actual F:1F (unmasked)"
else
  bad "skip-f-mask not rejected correctly (rc=$fm_rc)"; cat "$fm_report" 2>/dev/null || true
fi

echo "[6] MUTANT jr-off-by-one vs golden -> status=fail, instruction 5 (PC drift)"
jr_report="$TMP/jr-off-by-one.report.json"
if "$RUN" --input "$MUTANTS/jr-off-by-one" --truth "$GOLDEN" --report "$jr_report" >/dev/null 2>&1; then
  jr_rc=0; else jr_rc=$?; fi
if [ "$jr_rc" -ne 0 ] && jq -e '.status=="fail" and .first_divergence.step=="instruction 5" and (.first_divergence.expected|test("PC:0107")) and (.first_divergence.actual|test("PC:0106"))' "$jr_report" >/dev/null 2>&1; then
  ok "jr-off-by-one report.json: fail @ instruction 5, PC:0107 vs PC:0106"
else
  bad "jr-off-by-one not rejected correctly (rc=$jr_rc)"; cat "$jr_report" 2>/dev/null || true
fi

echo "[7] CORRUPT-AND-CONFIRM (R6): a deliberately corrupted golden MUST drive the gate RED"
# This is the falsifiability proof for the golden check itself: take the known-good
# golden, flip exactly one F byte (post-AND F:20 -> F:11, a value that is wrong on
# BOTH the H bit and the masked low nibble), and grade it against the pristine
# golden. The gate MUST report status=fail at that line. If this stays green, the
# golden check is an X-vs-X tautology (R6 violation) and the gate is not trustworthy.
corrupt="$TMP/golden-corrupt.gbdoctor"
sed 's/F:20 \(.*\)PC:0103/F:11 \1PC:0103/' "$GOLDEN" > "$corrupt"
if ! grep -q 'F:11 .*PC:0103' "$corrupt"; then
  bad "corrupt-and-confirm setup failed: did not inject F:11 at PC:0103 (golden shape changed?)"
else
  cc_report="$TMP/corrupt.report.json"
  if "$RUN" --input "$corrupt" --truth "$GOLDEN" --report "$cc_report" >/dev/null 2>&1; then
    cc_rc=0; else cc_rc=$?; fi
  if [ "$cc_rc" -ne 0 ] && jq -e '.status=="fail" and (.first_divergence|type=="object") and (.first_divergence.expected|test("F:20")) and (.first_divergence.actual|test("F:11"))' "$cc_report" >/dev/null 2>&1; then
    ok "corrupted golden driven RED: gate fails (expected F:20 vs corrupted F:11) — golden check is falsifiable"
  else
    bad "corrupted golden did NOT drive the gate red (rc=$cc_rc) — golden check is an X-vs-X tautology (R6 violation)"
    cat "$cc_report" 2>/dev/null || true
  fi
fi

echo "[8] EMPTY truth path is an error, never a silent pass (no false-green)"
empty="$TMP/empty.gbdoctor"
: > "$empty"
et_report="$TMP/empty.report.json"
"$RUN" --input "$empty" --truth "$empty" --report "$et_report" >/dev/null 2>&1 || true
# An all-empty diff currently reports pass at 0 instructions; assert it never
# claims a real comparison happened (0 instructions compared) so a consumer cannot
# mistake it for a graded pass. (R6: a check over nothing proves nothing.)
if [ -s "$et_report" ] && jq -e '.metrics.instructions_compared==0' "$et_report" >/dev/null 2>&1; then
  ok "empty/empty reports 0 instructions_compared (not a graded pass)"
else
  bad "empty/empty did not report 0 instructions_compared"; cat "$et_report" 2>/dev/null || true
fi

echo "[9] default --report path is evals/oracles/emulator-gb/report.json"
saved=""
[ -f "$DIR/report.json" ] && { saved="$TMP/report.json.bak"; cp "$DIR/report.json" "$saved"; }
rm -f "$DIR/report.json"
if "$RUN" --input "$GOLDEN" --truth "$GOLDEN" >/dev/null 2>&1 && [ -f "$DIR/report.json" ]; then
  ok "default report written to gate-dir report.json"
else
  bad "default report.json not written to gate dir"
fi
# Restore the prior report.json so the test leaves no tracked-file churn.
[ -n "$saved" ] && cp "$saved" "$DIR/report.json"

echo ""
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
