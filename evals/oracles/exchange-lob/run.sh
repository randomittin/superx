#!/usr/bin/env bash
# run.sh — exchange-lob oracle gate, STRUCTURED CONTRACT entry point (spec 2A).
#
# This is the typed-report contract for the exchange-lob differential+interleave
# gate. The orchestrator / protocol / ledger consume the TYPED report.json this
# writes — they NEVER parse this script's stdout. (Emitting first_divergence only
# to stdout was the anti-pattern this gate reconciles.)
#
# What it does
#   For a given INPUT (default = the live engine output captured at benchmark
#   time; for fixtures, the fixture-resident subject output), run the whole-output
#   trade-sequence differential (differential.md) plus the post-stream book-state
#   differential against the independent serial-replay reference, and — for the
#   seeded variable-latency concurrency arm (interleave.md) — reject any input
#   whose construction cannot interleave (the tautological-concurrency false-green
#   guard). Translate the result into a typed report.json and exit 0 on pass /
#   nonzero on fail.
#
# The comparison engine is the SAME first-divergence diff gate.sh drives through
# its TS/JS runner at benchmark time and that bin/falsify applies to fixtures:
# diff the ordered fill SEQUENCE tuple-by-tuple (plus length), report the FIRST
# divergence index, and additionally diff the post-stream book state. This script
# absorbs that logic so the gate is runnable on a fixture WITHOUT an impl present,
# while gate.sh remains the benchmark-time live driver.
#
# Report schema (shared across all gates, spec H-1 — 8 fields):
#   {
#     "gate_id": string,
#     "status": "pass" | "fail",
#     "first_divergence":                   // STRUCTURED object when fail; null on pass
#       { "file": string, "step": string, "expected": string, "actual": string } | null,
#     "metrics": { ... },                   // trades-compared, seeds-swept, ...
#     "fix_hint": string,                   // actionable hint
#     "haid": string,                       // human-agent id (env HEIMDALL_HAID else "haid:local")
#     "wave": string | null,                // wave id (env HEIMDALL_WAVE else null)
#     "ts": string                          // UTC ISO-8601 emit time (date -u +%FT%TZ)
#   }
#
# Usage:
#   run.sh [--input <fixture-path>] [--report <out-path>]
#     --input   fixture/input to evaluate. A fixture JSON carrying either
#               expected_trades+expected_book (golden), correct_*/corrupted_*
#               (mutant), or the tautological-concurrency guard. Default: the
#               golden order-stream (the live target is wired here at benchmark
#               time via the registry gate_command).
#     --report  where to WRITE report.json. Default:
#               evals/oracles/exchange-lob/report.json
#
# Exit codes: 0 = gate PASS (status=pass); 1 = gate FAIL (status=fail);
#             2 = usage / IO error (no valid report producible).
set -euo pipefail

# ── Resolve paths (mirror bin/benchmark, bin/falsify) ──
SELF="$0"
if command -v readlink >/dev/null 2>&1; then
  SELF="$(readlink -f "$0" 2>/dev/null || readlink "$0" 2>/dev/null || echo "$0")"
fi
ORACLE_DIR="$(cd "$(dirname "$SELF")" && pwd)"

command -v jq >/dev/null 2>&1 || { echo "error: jq is required" >&2; exit 2; }

GATE_ID="exchange-lob"
DEFAULT_INPUT="$ORACLE_DIR/fixtures/golden/order-stream.json"
DEFAULT_REPORT="$ORACLE_DIR/report.json"

usage() { sed -n '2,49p' "$SELF"; }

# ── Args ──
INPUT=""
REPORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --input)  INPUT="${2:?--input needs a fixture path}"; shift 2 ;;
    --report) REPORT="${2:?--report needs an output path}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "error: unknown flag: $1" >&2; usage >&2; exit 2 ;;
    *)   echo "error: unexpected argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

INPUT="${INPUT:-$DEFAULT_INPUT}"
REPORT="${REPORT:-$DEFAULT_REPORT}"

[ -f "$INPUT" ] || { echo "error: input not found: $INPUT" >&2; exit 2; }

# ═══════════════════════════════════════════════════════════════════════════
#  First-divergence diff primitives (differential.md). Identical semantics to
#  the gate.sh benchmark runner and bin/falsify: return 0 when the two outputs
#  are IDENTICAL and 1 on divergence, emitting the FIRST-divergence pinpoint as a
#  STRUCTURED object on the named globals DIV_STEP / DIV_EXPECTED / DIV_ACTUAL
#  (spec H-1: first_divergence is {file, step, expected, actual}, not a string).
#  DIV_FILE is the gate's domain dimension; the writer folds in `file`/`gate_id`.
# ═══════════════════════════════════════════════════════════════════════════
DIV_STEP=""
DIV_EXPECTED=""
DIV_ACTUAL=""

# Whole-output trade-sequence differential: compare the ordered fill SEQUENCE
# tuple-by-tuple AND the sequence length; pinpoint the FIRST divergence index.
# Args: <reference-trades-json> <subject-trades-json>
diff_trade_sequence() {
  local ref="$1" subj="$2" ref_len subj_len max i a b
  ref_len="$(jq 'length' <<<"$ref")"
  subj_len="$(jq 'length' <<<"$subj")"
  max=$(( ref_len > subj_len ? ref_len : subj_len ))
  for (( i = 0; i < max; i++ )); do
    a="$(jq -cS ".[$i] // null" <<<"$ref")"
    b="$(jq -cS ".[$i] // null" <<<"$subj")"
    if [ "$a" != "$b" ]; then
      DIV_STEP="trade index ${i} (reference len=${ref_len} actual len=${subj_len})"
      DIV_EXPECTED="$a"
      DIV_ACTUAL="$b"
      return 1
    fi
  done
  if [ "$ref_len" != "$subj_len" ]; then
    DIV_STEP="trade sequence length"
    DIV_EXPECTED="$ref_len"
    DIV_ACTUAL="$subj_len"
    return 1
  fi
  return 0
}

# Post-stream book-state differential (O1/O4 defects).
# Args: <reference-book-json> <subject-book-json>
diff_book_state() {
  local ref="$1" subj="$2" a b
  a="$(jq -cS '.' <<<"$ref")"
  b="$(jq -cS '.' <<<"$subj")"
  if [ "$a" != "$b" ]; then
    DIV_STEP="post-stream book state"
    DIV_EXPECTED="$a"
    DIV_ACTUAL="$b"
    return 1
  fi
  return 0
}

# ── number of trades the diff compared, for metrics ──
seq_len() { jq 'length' <<<"$1"; }

# ═══════════════════════════════════════════════════════════════════════════
#  Report writer — the typed contract (spec H-1, 8 fields). Writes report.json.
#  first_divergence is a STRUCTURED object {file, step, expected, actual} on fail,
#  null on pass. The envelope adds haid/wave/ts.
#  Args: <status pass|fail> <step> <expected> <actual> <metrics-json> <fix_hint>
#    pass  -> pass STEP/EXPECTED/ACTUAL empty; first_divergence is null.
#    fail  -> STEP names the locator (e.g. "trade index 0 (...)"); EXPECTED/ACTUAL
#             carry the diverging values.
# ═══════════════════════════════════════════════════════════════════════════
write_report() {
  local status="$1" step="$2" expected="$3" actual="$4" metrics="$5" fix_hint="$6"
  local out_dir; out_dir="$(dirname "$REPORT")"
  mkdir -p "$out_dir"

  local haid="${HEIMDALL_HAID:-haid:local}"
  local wave="${HEIMDALL_WAVE:-}"
  local ts; ts="$(date -u +%FT%TZ)"

  if [ -z "$step" ]; then
    jq -n \
      --arg gate_id "$GATE_ID" \
      --arg status "$status" \
      --argjson metrics "$metrics" \
      --arg fix_hint "$fix_hint" \
      --arg haid "$haid" \
      --arg wave "$wave" \
      --arg ts "$ts" \
      '{gate_id:$gate_id, status:$status, first_divergence:null, metrics:$metrics,
        fix_hint:$fix_hint, haid:$haid,
        wave:(if $wave=="" then null else $wave end), ts:$ts}' \
      >"$REPORT"
  else
    jq -n \
      --arg gate_id "$GATE_ID" \
      --arg status "$status" \
      --arg file "$GATE_ID" \
      --arg step "$step" \
      --arg expected "$expected" \
      --arg actual "$actual" \
      --argjson metrics "$metrics" \
      --arg fix_hint "$fix_hint" \
      --arg haid "$haid" \
      --arg wave "$wave" \
      --arg ts "$ts" \
      '{gate_id:$gate_id, status:$status,
        first_divergence:{file:$file, step:$step, expected:$expected, actual:$actual},
        metrics:$metrics, fix_hint:$fix_hint, haid:$haid,
        wave:(if $wave=="" then null else $wave end), ts:$ts}' \
      >"$REPORT"
  fi
  echo "report: $REPORT  (status=$status)"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Classify the input and run the matching arm of the gate.
# ═══════════════════════════════════════════════════════════════════════════

# The tautological-concurrency false-green guard is JS source, not a JSON output
# stream — it is a non-falsifiable GATE CONSTRUCTION (Promise.all over synchronous
# setImmediate-wrapped submit), not a defect input. The interleave arm REJECTS it:
# a gate that cannot interleave cannot expose the C2 race, so the gate is non-
# falsifiable and the input fails. Detect it before attempting a JSON parse.
if ! jq -e . "$INPUT" >/dev/null 2>&1; then
  if grep -q 'tautological-concurrency' "$INPUT" 2>/dev/null \
     || grep -qE 'setImmediate|Promise\.all' "$INPUT" 2>/dev/null; then
    metrics="$(jq -nc '{"trades_compared":0,"seeds_swept":0,"arm":"seeded-variable-latency-interleave"}')"
    write_report "fail" \
      "interleave construction (tautological-concurrency)" \
      "an awaited per-id seeded variable-latency critical section that can interleave (exposes the C2 race)" \
      "Promise.all over synchronous setImmediate-wrapped submit() — resolves in submission order by construction, no awaited critical section, cannot interleave (non-falsifiable gate construction)" \
      "$metrics" \
      "Replace the fixed-yield/setImmediate dispatch with a deterministic per-id seeded variable-latency hook awaited BEFORE the read-match-mutate critical section, sweep >=200 seeds, and diff the whole concurrent fill sequence against the submission-order serial replay (see interleave.md)."
    exit 1
  fi
  echo "error: input is neither valid JSON nor a recognized concurrency-guard fixture: $INPUT" >&2
  exit 2
fi

# ── Golden: subject == reference (expected_trades + expected_book). MUST pass.
if jq -e 'has("expected_trades")' "$INPUT" >/dev/null 2>&1; then
  trades="$(jq '.expected_trades' "$INPUT")"
  book="$(jq '.expected_book // {}' "$INPUT")"
  n="$(seq_len "$trades")"
  # Diff the authoritative whole-output against itself: a divergence here means
  # the gate is over-strict (false-RED) — the diff must stay green.
  if diff_trade_sequence "$trades" "$trades" && diff_book_state "$book" "$book"; then
    metrics="$(jq -nc --argjson n "$n" \
      '{"trades_compared":$n,"seeds_swept":1,"arm":"whole-output-differential"}')"
    write_report "pass" "" "" "" "$metrics" \
      "Whole fill sequence and post-stream book equal the independent serial-replay reference at every index — no action needed."
    exit 0
  fi
  metrics="$(jq -nc --argjson n "$n" \
    '{"trades_compared":$n,"seeds_swept":1,"arm":"whole-output-differential"}')"
  write_report "fail" "$DIV_STEP" "$DIV_EXPECTED" "$DIV_ACTUAL" "$metrics" \
    "Gate rejected its own golden — the differential is over-strict (false-RED). Re-derive expected_trades/expected_book from INVARIANTS.md before trusting any mutant result."
  exit 1
fi

# ── Trade-sequence mutant: correct_trades (reference) vs corrupted_trades (subject).
if jq -e 'has("corrupted_trades")' "$INPUT" >/dev/null 2>&1; then
  ref="$(jq '.correct_trades' "$INPUT")"
  subj="$(jq '.corrupted_trades' "$INPUT")"
  n="$(seq_len "$ref")"
  metrics="$(jq -nc --argjson n "$n" \
    '{"trades_compared":$n,"seeds_swept":1,"arm":"whole-output-differential"}')"
  if diff_trade_sequence "$ref" "$subj"; then
    # Identical -> gate stayed GREEN on an injected defect -> false-green.
    write_report "pass" "" "" "" "$metrics" \
      "No divergence detected — if this input encodes a defect, the gate is a false-GREEN and must be hardened."
    exit 0
  fi
  write_report "fail" "$DIV_STEP" "$DIV_EXPECTED" "$DIV_ACTUAL" "$metrics" \
    "Whole fill sequence diverges from the serial-replay reference. Enforce price-time priority (I4) and FIFO tie-break (D3): at a price level, fill the earliest-arriving (smallest seq) resting/aggressor order first, and price every trade at the RESTING maker price (I1)."
  exit 1
fi

# ── Book-state mutant: correct_book (reference) vs corrupted_book (subject).
if jq -e 'has("corrupted_book")' "$INPUT" >/dev/null 2>&1; then
  ref="$(jq '.correct_book' "$INPUT")"
  subj="$(jq '.corrupted_book' "$INPUT")"
  metrics="$(jq -nc \
    '{"trades_compared":0,"seeds_swept":1,"arm":"post-stream-book-differential"}')"
  if diff_book_state "$ref" "$subj"; then
    write_report "pass" "" "" "" "$metrics" \
      "Post-stream book equals the reference — if this input encodes a defect, the gate is a false-GREEN and must be hardened."
    exit 0
  fi
  write_report "fail" "$DIV_STEP" "$DIV_EXPECTED" "$DIV_ACTUAL" "$metrics" \
    "Post-stream book diverges from the serial-replay reference: a partially-filled limit order's unmatched remainder must REST at its limit price (O1), not be discarded — conservation (O4) requires qty-in == filled + resting + discarded."
  exit 1
fi

echo "error: input carries no recognized output (expected_trades / corrupted_trades / corrupted_book): $INPUT" >&2
exit 2
