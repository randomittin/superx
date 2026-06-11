#!/usr/bin/env bash
# run.sh — emulator-gb oracle gate, structured-contract front end (spec 2A).
#
# Wraps the strong oracle of gate.sh (per-instruction gameboy-doctor trace diff,
# reporting the FIRST divergence) and emits a TYPED report.json. Consumers read
# report.json — never stdout. This is the spec-2A gate contract shared by all
# gates:
#
#   report.json = {
#     "gate_id":          string,                 # always "emulator-gb"
#     "status":           "pass" | "fail",
#     "first_divergence": string | null,          # the pinpoint, null on pass
#     "metrics":          { ... },                # e.g. instructions_compared
#     "fix_hint":         string                  # actionable next step
#   }
#
# The trace-diff algorithm here is byte-for-byte the one in gate.sh's trace_diff
# and bin/falsify's diff_trace: strip comment (`#`) and blank lines, compare the
# remaining gameboy-doctor lines in lockstep by 1-based instruction count, and
# report ONLY the earliest mismatch (every later line is downstream noise once
# the cores have drifted). A length mismatch is itself a divergence at the
# instruction where the shorter stream runs out.
#
# Usage:
#   run.sh [--input <fixture-path>] [--report <out-path>] [--truth <truth-log>]
#
#   --input  <path>   Trace to grade. A gameboy-doctor-format trace file
#                     (e.g. fixtures/golden/trace.gbdoctor or a mutant). When
#                     omitted, the LIVE target is graded: GB_TRACE_CMD is run
#                     (with GB_ROM=$GB_ROM) and its stdout captured as the trace
#                     — exactly the trace contract gate.sh expects.
#   --report <path>   Where to write report.json. Default:
#                     evals/oracles/emulator-gb/report.json (next to this script).
#   --truth  <path>   The reference truth log to diff against. Default: the
#                     shipped golden fixture (fixtures/golden/trace.gbdoctor).
#                     gameboy-doctor truth logs (per ASSETS.md) drop in here.
#
# Exit: 0 on pass (no divergence), nonzero on fail (divergence or harness error).
#
# Design: see trace-diff.md §1. Falsifiability fixtures: fixtures/. Coverage:
# COVERAGE.md. Pointer-only external assets: ASSETS.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE_ID="emulator-gb"
GOLDEN="$HERE/fixtures/golden/trace.gbdoctor"

INPUT=""
TRUTH="$GOLDEN"
REPORT="$HERE/report.json"

die() { printf 'run.sh: %s\n' "$*" >&2; exit 2; }

command -v jq >/dev/null 2>&1 || die "jq is required to emit report.json"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --input)  INPUT="${2:?--input needs a path}";   shift 2 ;;
    --report) REPORT="${2:?--report needs a path}"; shift 2 ;;
    --truth)  TRUTH="${2:?--truth needs a path}";   shift 2 ;;
    -h|--help) sed -n '2,52p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "unknown arg: $1 (see --help)" ;;
  esac
done

[ -f "$TRUTH" ] || die "truth log missing: $TRUTH (populate per ASSETS.md, or pass --truth)"

# ── Resolve the subject trace to a file on disk ──────────────────────────────
# Either an explicit --input fixture, or the live target's captured stdout.
SUBJECT=""
CLEANUP=""
cleanup() { [ -n "$CLEANUP" ] && rm -f "$CLEANUP"; return 0; }
trap cleanup EXIT

if [ -n "$INPUT" ]; then
  [ -f "$INPUT" ] || die "input trace missing: $INPUT"
  SUBJECT="$INPUT"
else
  # Live target: run GB_TRACE_CMD and capture its per-instruction trace stdout.
  TRACE_CMD="${GB_TRACE_CMD:-}"
  [ -n "$TRACE_CMD" ] || die "no --input given and GB_TRACE_CMD unset; nothing to grade. \
Pass --input <trace-file>, or set GB_TRACE_CMD (the emulator trace command) per gate.sh."
  SUBJECT="$(mktemp)"
  CLEANUP="$SUBJECT"
  if ! GB_ROM="${GB_ROM:-}" bash -c "$TRACE_CMD" >"$SUBJECT" 2>/dev/null; then
    die "GB_TRACE_CMD failed to produce a trace (exit nonzero)"
  fi
fi

# ── Load both streams, stripping comment (#) and blank lines ─────────────────
load_stream() {
  # $1 = file ; appends gameboy-doctor lines to the named array $2
  local f="$1" __arr="$2" line
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    eval "$__arr+=(\"\$line\")"
  done <"$f"
}

ref_lines=()
subj_lines=()
load_stream "$TRUTH"   ref_lines
load_stream "$SUBJECT" subj_lines

ref_len="${#ref_lines[@]}"
subj_len="${#subj_lines[@]}"
max=$(( ref_len > subj_len ? ref_len : subj_len ))

# ── Per-instruction lockstep diff: report FIRST divergence only ──────────────
status="pass"
first_div=""        # empty => null in JSON
div_index=0         # 1-based instruction number of the divergence
compared=0          # instructions compared up to and including the divergence
i=0
while [ "$i" -lt "$max" ]; do
  r="${ref_lines[i]:-<truth stream ended>}"
  s="${subj_lines[i]:-<trace stream ended>}"
  compared=$(( i + 1 ))
  if [ "$r" != "$s" ]; then
    status="fail"
    div_index=$(( i + 1 ))
    first_div="instruction ${div_index}: expected ${r} actual ${s}"
    break
  fi
  i=$(( i + 1 ))
done

# ── fix_hint: actionable, per the trace-diff.md triage table ─────────────────
if [ "$status" = "pass" ]; then
  fix_hint="No divergence over ${compared} instruction(s); trace matches the truth log line-for-line."
else
  fix_hint="First divergence at instruction ${div_index}. Compare the expected (truth) vs actual (mine) lines field-by-field: wrong F-only => flag-rule bug (see INVARIANTS.md); wrong result+F => arithmetic bug in that opcode; wrong PC/PCMEM with sane registers => control-flow/MMU drift. Fix the EARLIEST diverging instruction first; later lines are downstream noise."
fi

# ── Emit the typed report.json (atomic write) ────────────────────────────────
mkdir -p "$(dirname "$REPORT")"
tmp_report="$(mktemp)"
if [ -n "$first_div" ]; then
  jq -n \
    --arg gate_id "$GATE_ID" \
    --arg status "$status" \
    --arg first_divergence "$first_div" \
    --argjson instructions_compared "$compared" \
    --argjson truth_instructions "$ref_len" \
    --argjson subject_instructions "$subj_len" \
    --argjson divergence_index "$div_index" \
    --arg fix_hint "$fix_hint" \
    '{gate_id:$gate_id, status:$status, first_divergence:$first_divergence,
      metrics:{instructions_compared:$instructions_compared,
               truth_instructions:$truth_instructions,
               subject_instructions:$subject_instructions,
               divergence_index:$divergence_index},
      fix_hint:$fix_hint}' >"$tmp_report"
else
  jq -n \
    --arg gate_id "$GATE_ID" \
    --arg status "$status" \
    --argjson instructions_compared "$compared" \
    --argjson truth_instructions "$ref_len" \
    --argjson subject_instructions "$subj_len" \
    --arg fix_hint "$fix_hint" \
    '{gate_id:$gate_id, status:$status, first_divergence:null,
      metrics:{instructions_compared:$instructions_compared,
               truth_instructions:$truth_instructions,
               subject_instructions:$subject_instructions,
               divergence_index:0},
      fix_hint:$fix_hint}' >"$tmp_report"
fi
mv "$tmp_report" "$REPORT"

printf 'emulator-gb: %s (%d instructions compared) -> %s\n' "$status" "$compared" "$REPORT" >&2

[ "$status" = "pass" ] && exit 0 || exit 1
