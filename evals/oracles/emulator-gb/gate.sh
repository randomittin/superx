#!/usr/bin/env bash
# gate.sh — emulator-gb oracle gate harness.
#
# Strong oracle : per-instruction gameboy-doctor trace diff (reports FIRST divergence).
# Secondary     : blargg serial verdict (FF01/FF02 capture) -> PASS / Failed #n.
#
# Assets are referenced by POINTER (see ASSETS.md); this script reads them from a local
# cache dir ($GB_ORACLE_CACHE) the operator populates. Nothing large is vendored in-repo.
#
# Usage:
#   GB_TRACE_CMD="node emu.js --trace"  GB_SERIAL_CMD="node emu.js --serial" \
#   bash gate.sh                         # gate all gating ROMs
#   bash gate.sh 06-ld\ r,r              # gate a single ROM (matches roms/<name>.gb + truth/<N>.log)
#
# Design: see trace-diff.md.  Coverage / gating verdicts: see COVERAGE.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${GB_ORACLE_CACHE:-$HERE/.gb-oracle-cache}"
ROM_DIR="$CACHE/roms"
TRUTH_DIR="$CACHE/truth"

# The trace command must emit, on stdout, one gameboy-doctor-format line per instruction:
#   A:.. F:.. B:.. C:.. D:.. E:.. H:.. L:.. SP:.... PC:.... PCMEM:b0,b1,b2,b3
# It receives the ROM path as $GB_ROM.  The serial command must emit the captured FF01
# serial byte-stream on stdout.  Both are supplied by the emulator under test.
TRACE_CMD="${GB_TRACE_CMD:-}"
SERIAL_CMD="${GB_SERIAL_CMD:-}"

# ROMs that GATE (02-interrupts is descoped / NOT gating -- see COVERAGE.md).
GATING_ROMS=(
  "01-special"
  "03-op sp,hl"
  "04-op r,imm"
  "05-op rp"
  "06-ld r,r"
  "07-jr,jp,call,ret,rst"
  "08-misc instrs"
  "09-op r,r"
  "10-bit ops"
  "11-op a,(hl)"
)

# Map a ROM name to its truth-log basename (NN.log). gameboy-doctor numbers 1..11.
truth_index_for() {
  case "$1" in
    "01-special")            echo 1 ;;
    "02-interrupts")         echo 2 ;;
    "03-op sp,hl")           echo 3 ;;
    "04-op r,imm")           echo 4 ;;
    "05-op rp")              echo 5 ;;
    "06-ld r,r")             echo 6 ;;
    "07-jr,jp,call,ret,rst") echo 7 ;;
    "08-misc instrs")        echo 8 ;;
    "09-op r,r")             echo 9 ;;
    "10-bit ops")            echo 10 ;;
    "11-op a,(hl)")          echo 11 ;;
    *)                       echo "" ;;
  esac
}

die() { printf 'gate: %s\n' "$*" >&2; exit 2; }

[ -n "$TRACE_CMD" ]  || die "GB_TRACE_CMD unset (emulator trace command). See header."
[ -n "$SERIAL_CMD" ] || die "GB_SERIAL_CMD unset (emulator serial command). See header."
[ -d "$ROM_DIR" ]    || die "rom dir missing: $ROM_DIR -- populate per ASSETS.md."
[ -d "$TRUTH_DIR" ]  || die "truth dir missing: $TRUTH_DIR -- populate per ASSETS.md."

# --- Strong oracle: per-instruction trace diff, report FIRST divergence -----------------
# Streams the emulator trace and the truth log in lockstep; on the earliest mismatching
# instruction, prints expected vs actual and returns non-zero. Length mismatch counts as a
# divergence at the instruction where the shorter stream ends.
trace_diff() {
  local rom_name="$1" rom_path="$2" truth_log="$3"
  local mine_fifo truth_fifo
  mine_fifo="$(mktemp -u)"; truth_fifo="$(mktemp -u)"
  mkfifo "$mine_fifo" "$truth_fifo"

  GB_ROM="$rom_path" bash -c "$TRACE_CMD" >"$mine_fifo" &
  local trace_pid=$!
  cat "$truth_log" >"$truth_fifo" &
  local cat_pid=$!

  local n=0 mine truth mine_ok truth_ok diverged=0 first_n=0 exp="" act=""
  exec 3<"$mine_fifo" 4<"$truth_fifo"
  while :; do
    mine_ok=1; truth_ok=1
    IFS= read -r mine <&3 || mine_ok=0
    IFS= read -r truth <&4 || truth_ok=0
    [ "$mine_ok" -eq 0 ] && [ "$truth_ok" -eq 0 ] && break
    n=$((n + 1))
    if [ "$mine_ok" -eq 0 ] || [ "$truth_ok" -eq 0 ] || [ "$mine" != "$truth" ]; then
      diverged=1; first_n="$n"
      exp="${truth:-<truth stream ended>}"
      act="${mine:-<trace stream ended>}"
      break
    fi
  done
  exec 3<&- 4<&-

  kill "$trace_pid" "$cat_pid" 2>/dev/null || true
  wait "$trace_pid" 2>/dev/null || true
  wait "$cat_pid" 2>/dev/null || true
  rm -f "$mine_fifo" "$truth_fifo"

  if [ "$diverged" -eq 1 ]; then
    printf 'TRACE %s: FIRST DIVERGENCE at instruction %d\n' "$rom_name" "$first_n"
    printf '  expected (truth): %s\n' "$exp"
    printf '  actual   (mine):  %s\n' "$act"
    return 1
  fi
  printf 'TRACE %s: NO divergence over %d instructions\n' "$rom_name" "$n"
  return 0
}

# --- Secondary oracle: blargg serial verdict (FF01/FF02 capture) ------------------------
# The verdict is the LAST non-empty token of the serial stream: a blargg ROM
# prints its title then terminates with `Passed` or `Failed #n`. A stream that
# merely CONTAINS "Passed" earlier (e.g. a sub-test line) but terminates in
# "Failed" is a FAIL — so we (1) check Failed before Passed and (2) classify the
# trailing verdict token, never a substring buried mid-stream. (R-11: greping
# Passed-before-Failed false-greened any stream carrying both strings.)
serial_verdict() {
  local rom_name="$1" rom_path="$2" out tail
  out="$(GB_ROM="$rom_path" bash -c "$SERIAL_CMD" || true)"
  # Last non-empty, CR-stripped line — the terminating verdict token.
  tail="$(printf '%s' "$out" | tr -d '\r' | grep -v '^[[:space:]]*$' | tail -1)"
  if printf '%s' "$tail" | grep -qi 'Failed'; then
    printf 'SERIAL %s: FAIL (%s)\n' "$rom_name" "$tail"
    return 1
  fi
  if printf '%s' "$tail" | grep -q 'Passed'; then
    printf 'SERIAL %s: PASS\n' "$rom_name"; return 0
  fi
  printf 'SERIAL %s: TIMEOUT (no Passed/Failed verdict captured)\n' "$rom_name"
  return 1
}

gate_one() {
  local rom_name="$1" idx rom_path truth_log rc=0
  idx="$(truth_index_for "$rom_name")"
  [ -n "$idx" ] || die "unknown ROM: $rom_name"
  rom_path="$ROM_DIR/$rom_name.gb"
  truth_log="$(printf '%s/%02d.log' "$TRUTH_DIR" "$idx")"
  [ -f "$rom_path" ]   || die "rom missing: $rom_path -- see ASSETS.md."
  [ -f "$truth_log" ]  || die "truth log missing: $truth_log -- see ASSETS.md."

  serial_verdict "$rom_name" "$rom_path" || rc=1
  trace_diff "$rom_name" "$rom_path" "$truth_log" || rc=1
  return "$rc"
}

main() {
  local fails=0
  if [ "$#" -ge 1 ]; then
    gate_one "$1" || fails=1
  else
    for rom in "${GATING_ROMS[@]}"; do
      printf '== %s ==\n' "$rom"
      gate_one "$rom" || fails=1
    done
  fi
  if [ "$fails" -ne 0 ]; then
    printf '\nGATE: RED\n'; exit 1
  fi
  printf '\nGATE: GREEN\n'; exit 0
}

main "$@"
