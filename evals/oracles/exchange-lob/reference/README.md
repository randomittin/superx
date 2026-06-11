# Exchange LOB — Independent Reference Matcher

## What this is

A specification (`spec.md`) for a **brute-force, obviously-correct** limit-order-book
matching engine. It is the *reference* side of a differential oracle: the system-under-test
(the production engine) is run against the same input stream as this reference, and the two
whole-output trade sequences are compared trade-for-trade. Any divergence fails the gate.

The reference is not optimized. It is designed to be read and verified by eye against the
invariants ledger. Where the production engine chooses clever data structures (heaps, price
ladders, intrusive linked lists) for speed, the reference uses flat arrays and linear scans so
that its correctness is self-evident. **Obvious correctness beats performance here** — the
reference is a truth source, not a hot path.

## Why it is independent

Independence is the entire reason this directory exists. A reference that was written by the
same author, from the same prose, while reading the same implementation, would encode the same
spec misconception as the implementation — and a differential oracle comparing two copies of the
same mistake stays GREEN while shipping the bug. To break that shared-fate coupling, this
reference is independent along three axes:

1. **Source independence.** This spec was authored *solely* from
   `evals/oracles/exchange-lob/INVARIANTS.md` (the invariants ledger). The author did not read
   the production engine source, the differential/interleave harness docs, or `gate.sh`. The
   only input was the ledger's enumerated invariants (I1–I4, O1–O4, D1–D3, C1–C2).

2. **Structural independence.** This reference lives in its own directory
   (`evals/oracles/exchange-lob/reference/`) and **pulls in nothing** from the production code.
   It loads no engine module and no impl module, shares no types, and shares no helpers. If it
   shared a module with the production side, a bug in that shared module would corrupt both
   sides identically and the diff would miss it. The acceptance gate enforces this by scanning
   this directory for any code-level dependency on an engine or impl module and failing if one
   is found.

3. **Algorithmic independence.** The reference uses a deliberately different algorithm — a
   brute-force O(n²) linear scan over a flat resting-order list — rather than the impl's
   optimized structures. Two independent algorithms agreeing on every trade is strong evidence
   both are correct; two copies of one algorithm agreeing proves nothing.

## How the differential gate diffs against it

For each seeded input stream the harness produces:

- a list of orders (submission order = canonical serial order, per **C2**), and
- for the concurrency wave, an interleaving schedule with variable async latency.

Both the production engine and this reference consume the **same submission-ordered stream**.
Each emits an ordered list of trades, where a trade is the tuple
`(takerId, makerId, price, qty)`. The gate compares the two lists **element-by-element, in
order**:

- Length mismatch → FAIL (one side made or missed a fill).
- First index where the tuples differ → FAIL, report `expected` (reference) vs `actual` (impl)
  at that index, exactly as the ledger's C2 spike evidence does.

The comparison is **whole-output and ordered**, not a per-trade validity check. The ledger's C2
spike is the proof this matters: under a latency race every individual trade stayed internally
valid (C1, I3, I1 all GREEN), yet the *sequence* was scrambled (order 7 jumped the queue ahead
of order 3). Only an ordered whole-sequence differential against a serial replay catches that.
The reference defines the correct serial replay; the gate is the equality check.

## Invariant coverage

The reference is constructed so that each ledger invariant is structurally guaranteed by the
algorithm (see `spec.md` for the per-invariant derivation): I1 no-cross, I2 qty-balance,
I3 net-zero, I4 price-time-priority, O1 limit-rest, O2 market-no-rest, O3 cancel-removes,
O4 self-conservation, D1 id-monotonic, D2 trade-order-deterministic, D3 fifo-tiebreak,
C1 no-double-fill, C2 serial-replay-equivalence.

## Files

- `README.md` — this file: what the reference is, why it is independent, how the gate uses it.
- `spec.md` — the brute-force O(n²) matcher specification derived purely from the ledger.
- `matcher.mjs` — the runnable reference matcher (plain JS, zero deps, `node`-runnable).

## Provenance (R-3.1 — independent reference matcher build)

- **Build date**: 2026-06-12
- **Agent context**: clean-context — `INVARIANTS.md` + `spec.md` only.
- **HAID**: `haid:local/r3-reference`
- **Files read during this build**: exactly two —
  `evals/oracles/exchange-lob/INVARIANTS.md` and
  `evals/oracles/exchange-lob/reference/spec.md`.
- **Explicitly NOT read**: no engine/impl code, no `differential.md`,
  `interleave.md`, `gate.sh`, `run.sh`, `fixtures/`, corpus cases, mutation/smoke
  proofs, or `/tmp` artifacts. The matcher's value is that it shares NO lineage
  with the things it judges; this provenance records that independence.

`matcher.mjs` is plain JavaScript (`.mjs`) on purpose: it runs under bare `node`
with zero extra dependencies (no `tsc`/`ts-node` toolchain), which keeps the
truth source maximally simple to audit. It pulls in nothing from the production
side — the structural-independence grep over this directory (for any production
import) stays green by construction.

### Self-test (hand-derived against the ledger)

`node matcher.mjs --selftest` runs an inline 6-order stream whose expected output
was derived BY HAND from the ledger rules (the full derivation is in the file's
`SELFTEST` comment block) and asserts byte-equality with the matcher's output.
