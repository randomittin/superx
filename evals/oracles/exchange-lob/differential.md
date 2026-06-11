# Exchange LOB — Whole-Output Differential Gate

Companion to [INVARIANTS.md](./INVARIANTS.md) and [COVERAGE.md](./COVERAGE.md). Designs the
differential oracle that caught **C2 serialization** — the first failing oracle check in the
spike (see [SPIKE-FINDINGS.md](../../flagship/SPIKE-FINDINGS.md), Arm 2). This is the
load-bearing gate: it is the ONLY check that exposed the concurrency race, because every
per-trade assertion stayed green under it.

## The shape of the gate

Run two matchers over the **same input stream** and diff their **entire output**:

1. **Engine run** — the real async engine: submit all orders concurrently
   (`Promise.all`), each submission awaiting a per-id seeded-latency hook BEFORE the
   read-match-mutate critical section (see [interleave.md](./interleave.md) for the scheduler).
2. **Serial replay (reference)** — replay the SAME orders one at a time, strictly in
   submission order, no concurrency. By C2 this is the canonical correct serialization: the
   concurrent result must equal SOME serial order, and the spike fixes that order =
   submission order and requires equality.

The output compared is the full **fill SEQUENCE** — the ordered list of trades, each a tuple:

```
(takerId, makerId, price, qty)
```

The gate diffs `engineFills[i]` against `referenceFills[i]` for every index `i`, and ALSO
compares the sequence lengths. On the first index where they differ (or where one sequence
runs out), it reports the **FIRST-divergence index** and STOPS — exactly like the spike's
trade-index-0 report:

```
expected (serial replay, CORRECT): takerId=3  makerId=2  price=99 qty=3
actual   (concurrent engine):      takerId=7  makerId=2  price=99 qty=5

concurrent: [7/2@99x5, 3/2@99x3, 4/2@99x2, 4/1@105x2]   (4 trades)
reference:  [3/2@99x3, 4/2@99x4, 7/2@99x3]              (3 trades)
```

First-divergence indexing matters: the full sequences can differ in length and in many
positions downstream of the root cause. Reporting the FIRST divergence points the reader at
the root reorder (order 7 jumping the queue), not the cascade of consequences after it.

## Why whole-output > per-trade (the C2 lesson)

Per-trade checks could NOT catch this bug, and the spike proved it empirically:

- **C1 no-double-fill** ... PASS (200 seeds) — matching is atomic (no `await` INSIDE the
  match loop), so no resting order ever over-fills.
- **I3 net-zero** ......... PASS (200 seeds) — every individual fill credits buyer +Q and
  debits seller -Q; the running signed sum stays 0.
- **I1 no-cross** ......... PASS (200 seeds) — every trade still prints at a valid resting
  price; no crossed trade is ever emitted.
- **C2 whole-output == serial replay** ... **FAIL @ seed 1, index 0.**

Each individual trade was internally valid. The bug was that the *order* of whole-order
matches was scrambled by an I/O-latency race: order 7 (submitted last of three buyers) took
maker 2's liquidity first because its awaited `riskCheck` resolved before order 3's. No single
trade is "wrong" in isolation — only the SEQUENCE diverges. A set of per-trade assertions has
no vocabulary for "wrong sequence"; only a **whole-output differential against a serial
replay** does. A unit test asserting "every trade is valid" would have shipped this bug.

This is why C2 is specified in INVARIANTS.md as a whole-output differential and NOT as a bag
of per-trade predicates. The gate must compare the ENTIRE fill sequence, in order, and fail on
**first divergence**.

## Relationship to D2 (deterministic reference diff)

The same whole-output mechanism backs **D2 trade-order-deterministic**: over a single
deterministic 10k-order stream, the engine's fill sequence must equal a brute-force reference
matcher's fill sequence exactly. D2 is the no-concurrency baseline (proves the matching core
is correct); C2 layers the seeded variable-latency scheduler on top of the same diff to prove
the *serialization* is correct. Both use identical first-divergence reporting.

## What this gate does NOT cover

- **Shared-author spec errors.** Engine and serial-replay reference share the same spec
  interpretation; the diff catches implementation divergence, not a misconception present in
  BOTH. Documented as descoped in COVERAGE.md.
- **Real OS-thread parallelism.** C2 covers single-threaded async `await`-then-mutate
  interleaving only; the matching core is single-threaded by design.

## Acceptance

The differential gate PASSES only when, for every seed in the sweep, the concurrent engine's
whole fill sequence equals the submission-order serial replay's fill sequence — same length,
same tuple at every index. Any mismatch fails the gate, prints the first-divergence index and
both sequences, and exits nonzero. A green result that did not run the variable-latency
concurrent arm is rejected as a false-green.
