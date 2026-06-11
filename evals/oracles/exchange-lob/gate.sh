#!/usr/bin/env bash
# Exchange LOB — runnable C2 gate harness.
#
# Drives the seeded variable-latency sweep (interleave.md) + whole-output differential
# (differential.md): for each seed, run the async engine with a per-id seeded-latency hook
# awaited BEFORE the read-match-mutate critical section, then diff the ENTIRE concurrent fill
# sequence against a submission-order serial replay. On the first mismatch it prints the
# FIRST-divergence index (like the spike's trade-index-0) and exits nonzero.
#
# Re-read INVARIANTS.md (C2) and COVERAGE.md before changing this gate. A green result that did
# not run the variable-latency C2 differential is a false-green and is rejected.
set -euo pipefail

# --- config (spike-hardened floor: 200 seeds x 50 concurrent submits) ----------------------
SEEDS="${SEEDS:-200}"
SUBMITS="${SUBMITS:-50}"
SEED_START="${SEED_START:-1}"

# --- locate the oracle dir + engine runner --------------------------------------------------
ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ORACLE_DIR"

# The differential runner: drives concurrent engine + serial replay for one seed and emits the
# first-divergence report on mismatch. Resolved in priority order; first match wins.
RUNNER=""
for candidate in \
  "$ORACLE_DIR/differential.run.ts" \
  "$ORACLE_DIR/differential.ts" \
  "$ORACLE_DIR/dist/differential.run.js" \
  "$ORACLE_DIR/differential.run.js"; do
  if [ -f "$candidate" ]; then
    RUNNER="$candidate"
    break
  fi
done

if [ -z "$RUNNER" ]; then
  echo "FAIL: no differential runner found in $ORACLE_DIR" >&2
  echo "       expected one of: differential.run.ts | differential.ts | dist/differential.run.js" >&2
  echo "       (the runner implements the engine + serial replay + whole-output diff per a seed)" >&2
  exit 2
fi

# Pick an executor for the runner by extension.
case "$RUNNER" in
  *.ts)
    if command -v tsx >/dev/null 2>&1; then
      EXEC=(tsx "$RUNNER")
    elif command -v npx >/dev/null 2>&1; then
      EXEC=(npx --yes tsx "$RUNNER")
    else
      echo "FAIL: runner is TypeScript ($RUNNER) but neither tsx nor npx is available" >&2
      exit 2
    fi
    ;;
  *.js)
    if command -v node >/dev/null 2>&1; then
      EXEC=(node "$RUNNER")
    else
      echo "FAIL: runner is JS ($RUNNER) but node is not available" >&2
      exit 2
    fi
    ;;
  *)
    echo "FAIL: cannot determine executor for runner $RUNNER" >&2
    exit 2
    ;;
esac

# --- the sweep ------------------------------------------------------------------------------
# Each seed: the runner builds a per-id seeded-latency hook from the seed, dispatches $SUBMITS
# concurrent submissions through it (awaiting BEFORE the critical section), then compares the
# whole concurrent fill sequence to a submission-order serial replay. The runner exits 0 on
# match and nonzero on divergence, printing the first-divergence index + both sequences.
seed_end=$(( SEED_START + SEEDS - 1 ))
passed=0
echo "exchange-lob C2 gate: seeds ${SEED_START}..${seed_end} (${SEEDS}) x ${SUBMITS} concurrent submits"
echo "runner: $RUNNER"

for (( seed = SEED_START; seed <= seed_end; seed++ )); do
  if ! "${EXEC[@]}" --seed "$seed" --submits "$SUBMITS"; then
    echo "" >&2
    echo "C2 FAIL @ seed ${seed}: concurrent whole-output diverged from submission-order serial replay" >&2
    echo "(see first-divergence index + both fill sequences above)" >&2
    exit 1
  fi
  passed=$(( passed + 1 ))
done

echo ""
echo "C2 PASS: ${passed}/${SEEDS} seeds — concurrent whole-output == serial replay for every seed"
exit 0
