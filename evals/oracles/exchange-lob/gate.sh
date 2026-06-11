#!/usr/bin/env bash
# Exchange LOB — runnable C2 gate harness (LIVE differential arm driver).
#
# Drives the seeded variable-latency sweep (interleave.md) + whole-output
# differential (differential.md) via differential.run.mjs: for each seed, run the
# async SUBJECT engine with a per-id seeded-latency hook awaited BEFORE the
# read-match-mutate critical section, then diff the ENTIRE concurrent fill
# sequence against a submission-order serial replay through the independent
# reference matcher (reference/matcher.mjs). On the first mismatch the runner
# prints the FIRST-divergence index (like the spike's trade-index-0) and exits
# nonzero.
#
# This is the benchmark-time LIVE driver. The registry gate_command is:
#     evals/oracles/exchange-lob/gate.sh --differential --seeds 200
# which sweeps 200 seeds against the default engine. At benchmark time the
# flagship subject engine is wired in via --engine; with no --engine the gate
# runs its in-repo correct reference engine (fixtures/engines/locked.mjs) so the
# registered command is runnable and GREEN out of the box (exit 0), and NEVER
# exits 2 for "no runner" (R-3 / R-9).
#
# Re-read INVARIANTS.md (C2) and COVERAGE.md before changing this gate. A green
# result that did not run the variable-latency C2 differential is a false-green
# and is rejected. (Fixture-replay mode lives in run.sh --input; this script is
# the live arm only.)
set -euo pipefail

ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ORACLE_DIR"

# --- config (spike-hardened floor: 200 seeds x >=7 concurrent submits) ----------------------
DIFFERENTIAL=0
SEEDS="${SEEDS:-200}"
SUBMITS="${SUBMITS:-0}"          # 0 = use the full default repro stream
SEED_START="${SEED_START:-1}"
ENGINE="${ENGINE:-}"
ORDERS="${ORDERS:-}"

RUNNER="$ORACLE_DIR/differential.run.mjs"
DEFAULT_ENGINE="$ORACLE_DIR/fixtures/engines/locked.mjs"

usage() {
  cat <<'EOF'
exchange-lob gate.sh — C2 live differential arm driver

Usage:
  gate.sh --differential [--seeds N] [--engine <path>] [--orders <stream.json>]
          [--submits M] [--start S]
  gate.sh --help

  --differential   Run the seeded variable-latency whole-output differential
                   (interleave.md + differential.md). Currently the only mode.
  --seeds N        Seeds to sweep (default 200; the spike-hardened floor).
  --engine <path>  Subject engine module (createEngine -> {trades, submit}).
                   Default: fixtures/engines/locked.mjs (the in-repo correct
                   engine), so the registered gate_command is runnable + GREEN.
  --orders <path>  Order-stream JSON (array or {orders:[...]}). Default: the
                   shrunk 7-order C2 repro from SPIKE-FINDINGS.md.
  --submits M      Cap the stream to the first M orders (default: all).
  --start S        First seed (default 1).

Exit: 0 = all seeds green (concurrent == serial replay), 1 = divergence found,
      2 = usage / IO error. NEVER exits 2 for a missing runner.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --differential) DIFFERENTIAL=1; shift ;;
    --seeds)        SEEDS="${2:?--seeds needs a value}"; shift 2 ;;
    --submits)      SUBMITS="${2:?--submits needs a value}"; shift 2 ;;
    --start)        SEED_START="${2:?--start needs a value}"; shift 2 ;;
    --engine)       ENGINE="${2:?--engine needs a path}"; shift 2 ;;
    --orders)       ORDERS="${2:?--orders needs a path}"; shift 2 ;;
    -h|--help)      usage; exit 0 ;;
    --*)            echo "error: unknown flag: $1" >&2; usage >&2; exit 2 ;;
    *)              echo "error: unexpected argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$DIFFERENTIAL" -ne 1 ]; then
  echo "error: --differential is required (the only supported mode)" >&2
  usage >&2
  exit 2
fi

command -v node >/dev/null 2>&1 || { echo "error: node is required to run $RUNNER" >&2; exit 2; }
[ -f "$RUNNER" ] || { echo "error: differential runner missing: $RUNNER" >&2; exit 2; }

ENGINE="${ENGINE:-$DEFAULT_ENGINE}"
[ -f "$ENGINE" ] || { echo "error: engine not found: $ENGINE" >&2; exit 2; }

# --- build the runner invocation ------------------------------------------------------------
cmd=(node "$RUNNER" --engine "$ENGINE" --seeds "$SEEDS" --start "$SEED_START")
[ -n "$ORDERS" ] && cmd+=(--orders "$ORDERS")
if [ "${SUBMITS:-0}" -gt 0 ] 2>/dev/null; then cmd+=(--submits "$SUBMITS"); fi

# --- drive the live arm: the runner sweeps seeds, diffs, pinpoints first divergence ---------
exec "${cmd[@]}"
