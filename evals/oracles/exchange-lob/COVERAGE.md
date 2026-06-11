# Exchange LOB — Oracle Coverage Matrix

Companion to [INVARIANTS.md](./INVARIANTS.md). Defines what the exchange-lob oracle gate
covers, what is deliberately out of scope, and the harness requirements that make C2
falsifiable. The headline lesson of the spike: a green oracle is worthless if it cannot fail.
This matrix exists to reject the tautological false-green.

## In-scope (the oracle MUST exercise and be able to fail on)

| Invariant | Coverage mechanism | Falsifiable by |
|---|---|---|
| I1 no-cross-trade | per-trade assertion over full stream | a maker-price/taker-price swap |
| I2 qty-balance | per-trade buyQty == sellQty | a fill that credits buyer != debits seller |
| I3 net-zero | running signed-qty sum across accounts | any unbalanced fill |
| I4 price-time-priority | reference-matcher diff (D2) | a price-level or FIFO ordering bug |
| O1 limit-rest | post-stream book state vs reference | remainder dropped instead of rested |
| O2 market-no-rest | post-stream book scan for resting markets | a market order left on book |
| O3 cancel-removes | cancel-then-assert-absent; cancel-absent no-op | cancel that fills or errors |
| O4 self-conservation | entering == filled + resting + discarded | any lost/created qty |
| D1 order-id-monotonic | id sequence check | non-increasing id |
| D2 trade-order-deterministic | whole-sequence diff vs brute-force reference | implementation divergence |
| D3 fifo-tiebreak | reference diff on same-price arrivals | LIFO/random tiebreak |
| C1 no-double-fill | per-resting-order filled <= original | over-fill |
| **C2 serialization** | **whole-output differential vs serial replay (= submission order) under seeded variable-latency** | **any interleaving that reorders whole-order matches** |

### C2 harness requirements (non-negotiable — this is what the spike proved)
- **Seeded variable-latency harness.** Each concurrent submission's async pre-trade hook
  (`riskCheck`) resolves after a per-order, seed-derived delay. Fixed-yield / uniform-latency
  interleaving PASSED the buggy engine — only variable latency surfaced the race. Sweep ≥200
  seeds × 50 concurrent submits.
- **Whole-output differential.** Compare the ENTIRE trade sequence (taker id, maker id, price,
  qty, in order) of the concurrent run against a serial replay of the submission order. C2 is
  NOT a set of per-trade assertions — per-trade checks (C1, I3, I1) all stay green under the
  race because each trade is individually valid; only the sequence is scrambled.
- **Reject the tautological false-green.** The known false-green pattern is
  `Promise.all(orders.map(o => setImmediate(() => engine.submit(o))))` where `submit` is
  synchronous: Node is single-threaded so dispatch resolves in arrival order by construction,
  making the concurrent run provably equal to the serial run. That check passes even if real
  interleaving is broken. The oracle MUST exercise genuine awaited interleaving (latency
  between read-match-mutate steps), or it is a tautology, not a test.

## Descoped (explicitly out of scope — documented so a fail here is not a surprise)

- **Oracle independence / shared-author spec errors.** Engine and reference written in the
  same pass share the same spec interpretation (trade-at-maker-price, market-remainder
  dropped, FIFO-by-arrival). The differential diff catches implementation divergence, NOT a
  shared misconception present in BOTH. A truly independent reference is out of scope for this
  gate; flagged so a spec-level error is not falsely claimed as oracle-covered.
- **Multi-symbol / cross-book matching.** Single order book, single instrument only.
- **Time-in-force beyond limit/market** (IOC, FOK, GTD, stop, iceberg) — not modeled.
- **Fees, rebates, tick-size / lot-size rounding, self-trade prevention** — not modeled.
- **Real OS-thread / multi-process concurrency.** C2 covers single-threaded async
  interleaving (the `await`-then-mutate race). True parallel mutation across threads is out of
  scope (the matching core is single-threaded by design).
- **Persistence / crash-recovery / replay durability** — not modeled.

## Acceptance gate
The exchange-lob oracle PASSES only when: every in-scope invariant assertion holds across the
seeded sweep, the whole-output differential (D2) matches the brute-force reference exactly, and
C2's variable-latency concurrent run equals the serial-replay reference for all seeds. A green
result that did not run the variable-latency C2 differential is rejected as a false-green.
