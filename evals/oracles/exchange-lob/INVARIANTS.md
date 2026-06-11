# Exchange LOB — Load-Bearing Invariants (re-read before EACH wave)

Limit-order-book matching engine (TypeScript). This ledger is written BEFORE coding so the
implementation transcribes the spec rather than guessing. Every invariant below is a gate the
oracle must be able to FAIL on — a check that cannot fail is a tautology, not a test.

## Matching invariants
- **I1 no-cross-trade**: a trade price P satisfies: P is the price of the RESTING order
  (the order already on the book). Aggressor crosses INTO resting price. Trade only when
  bid_price >= ask_price at the moment of match.
- **I2 qty-balance**: every trade has buyQty == sellQty (a single fill quantity Q; buyer +Q,
  seller -Q).
- **I3 net-zero**: sum of signed filled qty across ALL accounts == 0 at all times.
- **I4 price-time-priority**: at a given price level, orders fill in arrival (FIFO) order.
  Across price levels, best price fills first (highest bid / lowest ask).

## Order-semantics invariants
- **O1 limit-rest**: a limit order's unmatched remainder rests on the book at its limit price.
- **O2 market-no-rest**: a market order never rests; unmatched remainder is discarded
  (cancelled). Market never sits on book.
- **O3 cancel-removes**: cancel removes the identified resting order; cancelling an absent /
  already-filled order is a no-op.
- **O4 self-conservation**: total qty entering == filled qty + resting qty + discarded qty.

## Determinism invariants (for reference diff)
- **D1 order-id-monotonic**: order ids strictly increasing in submission order.
- **D2 trade-order-deterministic**: given identical input stream, the SEQUENCE of trades
  (taker id, maker id, price, qty) is identical run-to-run AND identical to reference matcher.
- **D3 fifo-tiebreak**: when two resting orders share a price, the earlier order id matches first.

## Concurrency invariants
- **C1 no-double-fill**: a resting order's total filled qty never exceeds its original qty.
- **C2 serialization**: concurrent submission must produce a result equivalent to SOME serial
  order; for the spike we fix the serial order = submission order and require equality.

  C2 is the load-bearing invariant the differential oracle caught that every per-trade check
  missed. Per-trade checks (C1 no-double-fill, I3 net-zero, I1 no-cross) all stayed GREEN under
  the race because each individual trade was internally valid — only the whole-output trade
  SEQUENCE was scrambled. C2 must be checked as a whole-output differential against a serial
  replay of the submission order, NOT as a set of per-trade assertions.

---

## C2 spike evidence — the FIRST failing oracle check (exchange-superx, Wave 4)

Wave 4 (concurrency) was the first failing oracle check. The oracle was hardened to 200 seeds,
50 concurrent submits each, with a deterministic variable-latency async pre-trade hook
(`riskCheck`) awaited BEFORE matching:
- C1 no-double-fill ........ PASS (200 seeds)
- net-zero + no-cross ...... PASS (200 seeds)
- **C2 concurrent == serial replay .... FAIL @ seed 1, index 0**

### Minimal reproducing order sequence (shrunk to 7 orders)
```
{kind:limit,  id:1, account:A, side:sell, price:105, qty:10}
{kind:limit,  id:2, account:D, side:sell, price:99,  qty:10}
{kind:limit,  id:3, account:C, side:buy,  price:99,  qty:3}
{kind:market, id:4, account:C, side:buy,             qty:4}
{kind:limit,  id:5, account:B, side:buy,  price:95,  qty:5}
{kind:limit,  id:6, account:D, side:buy,  price:97,  qty:7}
{kind:limit,  id:7, account:D, side:buy,  price:102, qty:5}
```

### First point of divergence (trade index 0)
```
expected (serial replay, CORRECT): takerId=3  makerId=2  price=99 qty=3
actual   (concurrent engine):      takerId=7  makerId=2  price=99 qty=5

concurrent: [7/2@99x5, 3/2@99x3, 4/2@99x2, 4/1@105x2]   (4 trades)
reference:  [3/2@99x3, 4/2@99x4, 7/2@99x3]              (3 trades)
```
Order 7 (submitted LAST of the three buyers) jumped the queue and took maker 2's liquidity
FIRST, because its awaited `riskCheck` latency resolved before order 3's.

### Root cause (traced, not guessed)
`submit()` is `async` and `await`s `riskCheck(s)` BEFORE touching the book. `Promise.all`
lets all 50 awaits race; whichever resolves first reaches the book first. Execution order
after the await != submission order → arrival/price-time priority is decided by I/O-latency
race, not submission sequence. No serialization lock around read-match-mutate.

### Why the per-trade checks all passed
Matching itself is atomic (no `await` INSIDE the match loop) → C1 (no-double-fill) and
net-zero still hold. Only the ORDER of whole-order matches is scrambled. **Only the
whole-output differential oracle (C2) caught it.** A unit test asserting "trades are valid"
would have shipped this bug. The naive fixed-yield concurrency test passed too — only
**seeded variable-latency** interleaving surfaced it.

CLASSIFICATION: concurrency race + silent-divergence (no exception, every individual trade
internally valid). The cross-cutting, whole-sequence invariant (C2) was in this ledger up
front, yet invisible to every per-trade check.
