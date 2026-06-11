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
if jq -e '.status=="fail" and (.first_divergence|type=="object") and .first_divergence.file and .first_divergence.step and (.first_divergence|has("expected")) and (.first_divergence|has("actual")) and .gate_id=="exchange-lob" and (.metrics|type=="object") and (.fix_hint|type=="string")' "$mut_report" >/dev/null 2>&1; then
  ok "mutant report.json: status=fail, non-null first_divergence pinpoint, schema valid"
else
  bad "mutant report.json invalid"; cat "$mut_report" 2>/dev/null || true
fi

echo "[5] book-state mutant drop-resting-remainder -> status=fail with book pinpoint"
book_report="$TMP/book.report.json"
if "$RUN" --input "$FIX/mutants/drop-resting-remainder" --report "$book_report" >/dev/null 2>&1; then
  book_rc=0; else book_rc=$?; fi
if [ "$book_rc" -ne 0 ] && jq -e '.status=="fail" and (.first_divergence|type=="object") and .first_divergence.file and .first_divergence.step and (.first_divergence|has("expected")) and (.first_divergence|has("actual"))' "$book_report" >/dev/null 2>&1; then
  ok "book-state mutant fails with non-null first_divergence"
else
  bad "book-state mutant not rejected correctly (rc=$book_rc)"; cat "$book_report" 2>/dev/null || true
fi

echo "[6] tautological-concurrency guard -> status=fail (non-falsifiable construction)"
taut_report="$TMP/taut.report.json"
if "$RUN" --input "$FIX/mutants/tautological-concurrency" --report "$taut_report" >/dev/null 2>&1; then
  taut_rc=0; else taut_rc=$?; fi
if [ "$taut_rc" -ne 0 ] && jq -e '.status=="fail" and (.first_divergence|type=="object") and .first_divergence.file and .first_divergence.step and (.first_divergence|has("expected")) and (.first_divergence|has("actual"))' "$taut_report" >/dev/null 2>&1; then
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

# ── R-9: registry-lint. Every oracle's registry gate_command should expose --help
# cleanly (exit 0). A gate_command whose flags disagree with its script exits 2
# (the C2 live-arm defect this remediation fixes); a clean --help is the canary
# that the registered invocation parses at all. We resolve each oracle's
# gate_command from registry.json, take the leading script token, run `<script>
# --help` from the plugin root, and check exit 0.
#
# Scope (R-3.2): exchange-lob's --help cleanliness is HARD-asserted (the arm this
# task owns). Other oracles' gaps are surfaced as WARN — fixing emulator-gb's and
# raytracer-calib's gate_command --help is R-9 work for THOSE oracles, out of this
# task's scope. The lint still PRINTS them so the gaps are visible, not glossed.
echo "[8] R-9 registry-lint: gate_command --help cleanliness (exchange-lob HARD; others WARN)"
PLUGIN_DIR="$(cd "$DIR/../../.." && pwd)"
REGISTRY="$PLUGIN_DIR/evals/oracles/registry.json"
if [ ! -f "$REGISTRY" ]; then
  bad "registry.json not found at $REGISTRY"
elif ! command -v jq >/dev/null 2>&1; then
  bad "jq required for registry-lint"
else
  while IFS=$'\t' read -r oracle gc; do
    [ -n "$gc" ] || continue
    # gate_command is a shell string: "<script> [flags...]". Leading token = script.
    # shellcheck disable=SC2086
    set -- $gc
    script="$1"
    help_path="$PLUGIN_DIR/$script"
    help_rc=0
    if [ ! -f "$help_path" ]; then
      help_rc=127
    else
      ( cd "$PLUGIN_DIR" && bash "$script" --help >/dev/null 2>&1 ) || help_rc=$?
    fi
    if [ "$oracle" = "exchange-lob" ]; then
      if [ "$help_rc" -eq 0 ]; then ok "--help clean (exit 0): $script"; else bad "--help NOT clean (exit $help_rc): $script"; fi
    else
      if [ "$help_rc" -eq 0 ]; then
        ok "--help clean (exit 0): $script"
      else
        printf '  WARN: --help not clean (exit %s): %s [R-9 backlog for %s, out of R-3.2 scope]\n' "$help_rc" "$script" "$oracle"
      fi
    fi
  done < <(jq -r '.oracles | to_entries[] | "\(.key)\t\(.value.gate_command)"' "$REGISTRY")
fi

echo "[9] exchange-lob registered gate_command exits 0|1 (never 2 — the C2 live arm exists)"
EXCH_GC="$(jq -r '.oracles."exchange-lob".gate_command' "$REGISTRY")"
# Trim the sweep to a few seeds for the test (the runner honours SEEDS env via gate.sh).
gc_rc=0
( cd "$PLUGIN_DIR" && SEEDS=5 bash $EXCH_GC >/dev/null 2>&1 ) || gc_rc=$?
if [ "$gc_rc" -eq 0 ] || [ "$gc_rc" -eq 1 ]; then
  ok "registered gate_command exited $gc_rc (0=pass/1=fail, never 2)"
else
  bad "registered gate_command exited $gc_rc (expected 0 or 1, never 2)"
fi

echo "[10] C2 live arm: racy engine RED, locked engine GREEN (make-it-fail proof)"
RUNNER="$DIR/differential.run.mjs"
ENG="$DIR/fixtures/engines"
if command -v node >/dev/null 2>&1; then
  locked_rc=0
  node "$RUNNER" --engine "$ENG/locked.mjs" --seeds 50 >/dev/null 2>&1 || locked_rc=$?
  racy_rc=0
  node "$RUNNER" --engine "$ENG/racy.mjs" --seeds 50 >/dev/null 2>&1 || racy_rc=$?
  if [ "$locked_rc" -eq 0 ]; then ok "locked engine GREEN (exit 0)"; else bad "locked engine not green (exit $locked_rc)"; fi
  if [ "$racy_rc" -eq 1 ]; then ok "racy engine RED (exit 1 — divergence found)"; else bad "racy engine did not go red (exit $racy_rc)"; fi
else
  bad "node required for C2 live-arm proof"
fi

echo "[11] CORRUPT-AND-CONFIRM (R6): a corrupted golden expected side MUST drive the gate RED"
# Conventions R6: every "must pass" check gets a corrupt-and-confirm test — the
# golden check must be CAPABLE of failing (no X-vs-X tautology). run.sh replays the
# golden order stream through the independent reference matcher and diffs the
# PRODUCED trades/book against the fixture's expected_trades/expected_book. We
# corrupt exactly ONE byte of the expected side (flip the first expected trade
# price 99 -> 98) and grade it: the produced reference still says 99, so the gate
# MUST report status=fail at trade index 0. If it stays green the golden check is a
# self-comparison (R-2 false-RED defect) and the gate is not trustworthy.
GOLDEN_OS="$FIX/golden/order-stream.json"
corrupt_os="$TMP/golden-corrupt.json"
jq '.expected_trades[0].price = 98' "$GOLDEN_OS" > "$corrupt_os"
if [ "$(jq '.expected_trades[0].price' "$corrupt_os")" != "98" ]; then
  bad "corrupt-and-confirm setup failed: did not inject price 98 into expected_trades[0]"
else
  cc_report="$TMP/golden-corrupt.report.json"
  if "$RUN" --input "$corrupt_os" --report "$cc_report" >/dev/null 2>&1; then
    cc_rc=0; else cc_rc=$?; fi
  if [ "$cc_rc" -ne 0 ] && jq -e '.status=="fail" and (.first_divergence|type=="object") and (.first_divergence.step|test("trade index 0")) and (.first_divergence.expected|test("price.:98")) and (.first_divergence.actual|test("price.:99"))' "$cc_report" >/dev/null 2>&1; then
    ok "corrupted golden expected side driven RED: gate fails @ trade index 0 (expected price 98 vs produced 99) — golden check is falsifiable (R-2)"
  else
    bad "corrupted golden did NOT drive the gate red (rc=$cc_rc) — golden check is an X-vs-X self-comparison (R-2/R6 violation)"
    cat "$cc_report" 2>/dev/null || true
  fi
fi
# Confirm-green half: the PRISTINE golden still passes (restore = re-run the
# untouched fixture). A corrupt-and-confirm test that left the golden red would be
# meaningless; the byte we flipped lives only in $TMP, the tracked fixture is intact.
echo "[12] RESTORE-GREEN (R6): the pristine golden still passes (the corruption was scratch-only)"
restore_report="$TMP/golden-restore.report.json"
if "$RUN" --input "$GOLDEN_OS" --report "$restore_report" >/dev/null 2>&1    && jq -e '.status=="pass" and .first_divergence==null' "$restore_report" >/dev/null 2>&1; then
  ok "pristine golden GREEN again (status=pass) — corruption did not touch the tracked fixture"
else
  bad "pristine golden did not pass after corrupt-and-confirm"; cat "$restore_report" 2>/dev/null || true
fi

echo ""
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
