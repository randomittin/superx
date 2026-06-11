# Reference Matcher Specification — brute-force, obviously correct

Derived **solely** from `evals/oracles/exchange-lob/INVARIANTS.md`. This document specifies a
limit-order-book matcher whose only design goal is **obvious correctness**, not performance.
It is the reference side of the differential oracle (see `README.md`).

> Design rule: prefer the **brute-force O(n²)** linear-scan formulation over any clever data
> structure. Every step must be verifiable by eye against an invariant. This matcher is a truth
> source, not a hot path. It pulls in nothing from the production code.

## Data model

A resting order on the book:

```
RestingOrder = {
  id:      integer,        // submission-order id, strictly increasing (D1)
  seq:     integer,        // arrival sequence number, strictly increasing — FIFO key (I4, D3)
  account: string,
  side:    "buy" | "sell",
  price:   number,         // limit price; market orders never become RestingOrders (O2)
  qty:     number,         // ORIGINAL submitted qty (never mutated)
  remaining: number,       // qty not yet filled; starts == qty, only decreases (C1)
}
```

A trade (the unit the differential gate compares):

```
Trade = { takerId, makerId, price, qty }
```

State held by the reference:

```
book:    RestingOrder[]   // a single FLAT array of all resting orders, both sides
trades:  Trade[]          // ordered list of every trade, in the order produced
nextSeq: integer          // monotonic counter, +1 per accepted order (D1, D3)
```

A flat array is chosen deliberately: no price ladder, no heap, no per-account index. Every
lookup is a full linear scan. This is O(n²) over the stream and that is acceptable and intended.

## Processing model — strictly serial (C2)

The reference processes the input as a **single serial stream in submission order**. There is no
concurrency, no `await`, no latency, no lock — the absence of all of those is what makes it the
correct serial replay that **C2** demands. The production engine's concurrent output must equal
this serial replay; the reference *is* that replay.

```
for each event in inputStream (in submission order):
    if event.kind == "limit":  processLimit(event)
    if event.kind == "market": processMarket(event)
    if event.kind == "cancel": processCancel(event)
```

Each event is fully processed (matched to exhaustion, then any remainder rested) before the next
event is read. No interleaving. This single property discharges **C2**: given identical input,
the produced trade sequence is a deterministic serial replay, run-to-run identical (**D2**).

## Matching procedure (shared by limit and market)

`matchAggressor(aggressor)` repeatedly fills the aggressor against the best eligible resting
order on the opposite side until the aggressor is exhausted or no eligible maker remains.

### Selecting the best maker — brute-force scan (I4, D3)

To pick the resting order that fills next, **linearly scan the entire `book`** and keep the best
candidate on the opposite side, where "best" is defined exactly by **I4 price-time-priority**:

- If aggressor is a **buy**, eligible makers are `sell` orders with `price <= aggressor.price`
  (for a market buy, no price ceiling — any sell is eligible). Among eligible makers, **best =
  lowest sell price**; ties broken by **smallest `seq`** (earliest arrival → **I4 / D3 FIFO**).
- If aggressor is a **sell**, eligible makers are `buy` orders with `price >= aggressor.price`
  (for a market sell, no price floor). Among eligible makers, **best = highest buy price**; ties
  broken by **smallest `seq`**.

The scan returns the single best maker, or "none". Because it is a full scan that compares
(price, then seq), price-time priority is enforced by construction — there is no ladder that
could desync from arrival order.

### Eligibility / cross condition (I1)

A trade may occur only when the books cross: `bestBuyPrice >= bestSellPrice` at the moment of
match. In `matchAggressor` this is exactly the eligibility predicate above (a maker is only
eligible if it crosses the aggressor's price), so **I1 no-cross-trade** holds: if no maker
crosses, no trade is produced.

### Trade price (I1)

When a maker is selected, the **trade price is the RESTING (maker) order's price** — the
aggressor crosses *into* the resting price. This is **I1**: `price = maker.price`, never the
aggressor's price.

### Fill quantity (I2, C1)

```
Q = min(aggressor.remaining, maker.remaining)
```

This single quantity `Q` is the fill for both sides (**I2 qty-balance**: buyQty == sellQty == Q).
Apply it:

```
aggressor.remaining -= Q
maker.remaining     -= Q
```

Both `remaining` values only ever decrease and are floored at the fill, so neither order can be
filled beyond its original `qty` → **C1 no-double-fill**. Record the trade with taker = the
aggressor (the incoming order), maker = the resting order:

```
trades.push({ takerId: aggressor.id, makerId: maker.id, price: maker.price, qty: Q })
```

After the fill, if `maker.remaining == 0`, remove the maker from `book`. Loop: re-scan for the
next best maker and repeat until `aggressor.remaining == 0` or no eligible maker remains.

### Net-zero (I3)

Every recorded trade moves exactly `+Q` to the buyer's signed balance and `-Q` to the seller's.
Since each trade is symmetric and the only mutation of signed balances is via trades, the sum of
signed filled qty across all accounts is `0` after every trade → **I3 net-zero**. The reference
need not track balances to be correct; net-zero falls out of the symmetric `Q` per trade, and
the oracle may assert it as `sum(buyer +Q) + sum(seller -Q) == 0`.

## Order kinds

### Limit order (O1)

```
processLimit(o):
    aggressor = newRestingOrder(o, remaining = o.qty)   // assign id, seq = nextSeq++
    matchAggressor(aggressor)
    if aggressor.remaining > 0:
        append aggressor to book          // O1: unmatched remainder rests at its limit price
```

The unmatched remainder rests at the order's own limit price (**O1 limit-rest**), carrying its
`seq` so future FIFO tie-breaks are correct (**D3**).

### Market order (O2)

```
processMarket(o):
    aggressor = transient order (remaining = o.qty, no price bound)  // seq assigned for determinism
    matchAggressor(aggressor)
    // do NOT append to book under any circumstance
    // unmatched remainder is discarded / cancelled
```

A market order is never added to `book` (**O2 market-no-rest**); whatever it cannot fill against
existing liquidity is discarded.

### Cancel (O3)

```
processCancel(c):
    find the resting order in book with id == c.targetId
    if found:    remove it from book
    if not found: no-op   // already filled, already cancelled, or never rested
```

**O3 cancel-removes**: removes the identified resting order if present; cancelling an absent or
already-filled order is a no-op (no error, no trade).

## Conservation check (O4)

For each individual submitted order the reference can assert, after the whole stream is
processed, **O4 self-conservation**:

```
originalQty == filledQty + restingQty + discardedQty
```

where for a given order: `filledQty` = sum of `Q` across trades naming it (as taker or maker),
`restingQty` = its `remaining` if it still sits on `book` else 0, `discardedQty` = unmatched
remainder of a market order (always 0 for a fully-resting limit order, since a limit's remainder
rests rather than being discarded). Because the only operations on an order's quantity are fills
(which subtract from `remaining`) and resting/discarding the leftover, the three buckets sum to
the original by construction.

## Determinism (D1, D2, D3)

- **D1 order-id-monotonic**: ids are taken from the submission stream and `seq` is assigned from
  a strictly increasing counter (`nextSeq++`) at acceptance, so both increase in submission
  order.
- **D2 trade-order-deterministic**: the reference is a pure serial fold over the input with no
  source of nondeterminism (no async, no clock, no RNG). Identical input → identical `trades`
  sequence, run-to-run, and that sequence is the reference the impl is diffed against.
- **D3 fifo-tiebreak**: the maker-selection scan breaks price ties by smallest `seq`, so the
  earlier-arriving resting order at a shared price always fills first.

## Concurrency equivalence (C2) — the load-bearing property

The reference deliberately has **no concurrency**. It is the serial replay of the submission
order. The differential gate requires the concurrent production engine's whole trade sequence to
**equal** this reference sequence element-by-element. The ledger's C2 spike shows why this is the
only check that catches a latency-race reorder: per-trade checks (C1, I3, I1) all pass on a
scrambled sequence because each trade is internally valid; only ordered equality against this
serial reference exposes that order 7 jumped ahead of order 3. The reference's job is to define
"correct order" unambiguously — it does so by being the obvious serial fold.

## Why this is obviously correct

The matcher is a brute-force O(n²) linear scan with no clever data structures: every fill picks
the single globally-best eligible maker by a full scan over a flat list, fills the symmetric
`min` quantity at the resting price, and rests or discards the remainder per order kind. Each of
the thirteen ledger invariants maps to one explicit, eye-verifiable step above. There is no
index that can desynchronize from the book, no heap whose ordering could be wrong, and no
concurrency that could reorder events. That is the point: correctness you can read.
