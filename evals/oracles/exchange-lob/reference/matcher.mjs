#!/usr/bin/env node
// Exchange LOB — REFERENCE matcher (brute-force, obviously correct).
//
// PROVENANCE: built clean-context from ONLY two inputs:
//   - evals/oracles/exchange-lob/INVARIANTS.md  (the I1-I4 / O1-O4 / D1-D3 / C1-C2 ledger)
//   - evals/oracles/exchange-lob/reference/spec.md
// No engine/impl/fixture/harness code was read. This is the truth source the
// differential oracle diffs the production engine against; it shares NO lineage
// with the thing it judges (remediation R-3.1).
//
// File is plain JavaScript (.mjs) on purpose: zero extra deps, runs under bare
// `node matcher.mjs` with no tsc/ts-node toolchain. The spec data model is small
// enough that types add nothing a reviewer cannot see by eye.
//
// Design rule (spec): brute-force O(n^2) linear scan, flat array, no ladder/heap/
// index. Obvious correctness over speed. Strictly serial fold over the order
// stream == the C2 serial-replay arm. No async, no clock, no RNG -> D2 determinism.

// ----------------------------------------------------------------------------
// State (spec "State held by the reference")
// ----------------------------------------------------------------------------
//   book:    RestingOrder[]  -- single FLAT array, both sides
//   trades:  Trade[]         -- in production order
//   nextSeq: monotonic counter, +1 per accepted order  (D1, D3)
//
// RestingOrder = { id, seq, account, side, price, qty, remaining }
// Trade        = { takerId, makerId, price, qty }

function createState() {
  return { book: [], trades: [], nextSeq: 1 };
}

// ----------------------------------------------------------------------------
// Maker selection — brute-force full scan (I4 price-time-priority, D3 FIFO tiebreak)
// ----------------------------------------------------------------------------
// Linearly scan the ENTIRE book, keep the single best eligible maker on the
// opposite side. "Best" is defined EXACTLY by I4:
//   - aggressor buy  -> eligible = sell makers with price <= aggressor.price
//                       (market buy: no price ceiling). best = LOWEST sell price,
//                       ties broken by SMALLEST seq (earliest arrival).
//   - aggressor sell -> eligible = buy makers with price >= aggressor.price
//                       (market sell: no price floor). best = HIGHEST buy price,
//                       ties broken by SMALLEST seq.
// Returns the best maker object (a live reference into book) or null.
//
// Because eligibility already encodes the cross condition (a maker is only
// eligible if it crosses the aggressor's price), I1 no-cross-trade holds: no
// crossing maker -> null -> no trade.
function selectBestMaker(state, aggressor) {
  const wantSide = aggressor.side === 'buy' ? 'sell' : 'buy';
  const isMarket = aggressor.price === null || aggressor.price === undefined;
  let best = null;
  for (const m of state.book) {
    if (m.side !== wantSide) continue;
    if (m.remaining <= 0) continue;
    // eligibility / cross condition (I1)
    if (aggressor.side === 'buy') {
      if (!isMarket && m.price > aggressor.price) continue; // ask above buy limit -> no cross
    } else {
      if (!isMarket && m.price < aggressor.price) continue; // bid below sell limit -> no cross
    }
    if (best === null) {
      best = m;
      continue;
    }
    // price preference: buy aggressor wants lowest ask; sell aggressor wants highest bid
    if (aggressor.side === 'buy') {
      if (m.price < best.price || (m.price === best.price && m.seq < best.seq)) best = m;
    } else {
      if (m.price > best.price || (m.price === best.price && m.seq < best.seq)) best = m;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
// matchAggressor — fill against best eligible maker until exhausted / none left
// ----------------------------------------------------------------------------
// Trade price = RESTING (maker) price (I1). Fill Q = min(aggressor.remaining,
// maker.remaining) (I2 symmetric, C1 cannot exceed original). Filled maker
// (remaining == 0) is removed from book. Net-zero (I3) falls out of symmetric Q.
function matchAggressor(state, aggressor) {
  while (aggressor.remaining > 0) {
    const maker = selectBestMaker(state, aggressor);
    if (maker === null) break;
    const Q = Math.min(aggressor.remaining, maker.remaining);
    aggressor.remaining -= Q;
    maker.remaining -= Q;
    state.trades.push({
      takerId: aggressor.id,
      makerId: maker.id,
      price: maker.price, // I1: resting price, never aggressor's
      qty: Q,
    });
    if (maker.remaining === 0) {
      const i = state.book.indexOf(maker);
      if (i !== -1) state.book.splice(i, 1);
    }
  }
}

// ----------------------------------------------------------------------------
// Order kinds
// ----------------------------------------------------------------------------

// Limit (O1): match to exhaustion, then unmatched remainder RESTS at its own
// limit price, carrying seq for future FIFO tiebreaks (D3).
function processLimit(state, o) {
  const aggressor = {
    id: o.id,
    seq: state.nextSeq++,
    account: o.account,
    side: o.side,
    price: o.price,
    qty: o.qty,
    remaining: o.qty,
  };
  matchAggressor(state, aggressor);
  if (aggressor.remaining > 0) state.book.push(aggressor);
}

// Market (O2): transient, no price bound, NEVER rests. Unmatched remainder is
// discarded. seq still assigned for determinism.
function processMarket(state, o) {
  const aggressor = {
    id: o.id,
    seq: state.nextSeq++,
    account: o.account,
    side: o.side,
    price: null, // no price bound
    qty: o.qty,
    remaining: o.qty,
  };
  matchAggressor(state, aggressor);
  // intentionally NOT pushed to book under any circumstance (O2)
}

// Cancel (O3): remove resting order with id == targetId; absent -> no-op.
function processCancel(state, c) {
  const targetId = c.targetId !== undefined ? c.targetId : c.id;
  const i = state.book.findIndex((m) => m.id === targetId);
  if (i !== -1) state.book.splice(i, 1);
}

// ----------------------------------------------------------------------------
// Serial fold over the input stream (C2 serial replay, D2 determinism)
// ----------------------------------------------------------------------------
// Each event fully processed before the next is read. No interleaving.
function run(orders) {
  const state = createState();
  for (const event of orders) {
    const kind = event.kind || event.type;
    if (kind === 'limit') processLimit(state, event);
    else if (kind === 'market') processMarket(state, event);
    else if (kind === 'cancel') processCancel(state, event);
    else throw new Error(`unknown order kind: ${JSON.stringify(kind)}`);
  }
  return formatOutput(state);
}

// Output contract:
//   { trades:[{takerId,makerId,price,qty}...],
//     book:{ bids:[...], asks:[...] } }
// Book rendered deterministically: bids by price DESC then seq ASC (best bid
// first), asks by price ASC then seq ASC (best ask first). Each resting order
// reported with id, account, price, qty (original), remaining.
function formatOutput(state) {
  const render = (o) => ({
    id: o.id,
    account: o.account,
    price: o.price,
    qty: o.qty,
    remaining: o.remaining,
  });
  const bids = state.book
    .filter((o) => o.side === 'buy')
    .sort((a, b) => (b.price - a.price) || (a.seq - b.seq))
    .map(render);
  const asks = state.book
    .filter((o) => o.side === 'sell')
    .sort((a, b) => (a.price - b.price) || (a.seq - b.seq))
    .map(render);
  return { trades: state.trades, book: { bids, asks } };
}

// ----------------------------------------------------------------------------
// SELF-TEST — hand-derived example (run with `node matcher.mjs --selftest`)
// ----------------------------------------------------------------------------
// Stream (kind/id/side/price/qty per the ledger order semantics):
//   1: limit sell price=100 qty=5  (acct A)
//   2: limit sell price=100 qty=5  (acct B)   same price, later seq -> FIFO after #1 (D3)
//   3: limit sell price=101 qty=5  (acct C)
//   4: limit buy  price=100 qty=8  (acct D)   crosses into sells <=100
//   5: market buy            qty=4 (acct E)   no price bound (O2)
//   6: limit buy  price=99  qty=3  (acct F)   no cross (best ask now 101) -> rests
//
// HAND DERIVATION (by eye, against the ledger):
//   #1 sell@100x5 -> no buys -> rests.           book=[s1@100 r5]
//   #2 sell@100x5 -> no buys -> rests.           book=[s1@100 r5, s2@100 r5]
//   #3 sell@101x5 -> no buys -> rests.           book=[s1, s2, s3@101 r5]
//   #4 buy@100x8: eligible sells price<=100 = {s1@100,s2@100}; s3@101 EXCLUDED (no cross, I1).
//                 best = lowest price 100, tie -> smallest seq -> s1 (D3 FIFO).
//                 Q=min(8,5)=5 @100 -> trade{4,1,100,5}; s1 r0 -> removed; aggr r3.
//                 re-scan: s2@100 only eligible. Q=min(3,5)=3 @100 -> trade{4,2,100,3}; s2 r2; aggr r0.
//                 book=[s2@100 r2, s3@101 r5]
//   #5 market buy x4: no price bound; eligible {s2@100,s3@101}; best lowest = s2@100.
//                 Q=min(4,2)=2 @100 -> trade{5,2,100,2}; s2 r0 -> removed; aggr r2.
//                 re-scan: s3@101. Q=min(2,5)=2 @101 -> trade{5,3,101,2}; s3 r3; aggr r0.
//                 market NEVER rests (O2). book=[s3@101 r3]
//   #6 buy@99x3: eligible sells price<=99 = {} (s3@101 no cross). no trade -> rests.
//                 book=[s3@101 r3, b6@99 r3]
//
// EXPECTED trades (in production order):
//   {takerId:4, makerId:1, price:100, qty:5}
//   {takerId:4, makerId:2, price:100, qty:3}
//   {takerId:5, makerId:2, price:100, qty:2}
//   {takerId:5, makerId:3, price:101, qty:2}
// EXPECTED book: asks=[s3@101 r3], bids=[b6@99 r3]
//
// Conservation spot-check (O4):
//   order 1: qty5 = filled5 + rest0 + disc0  OK
//   order 2: qty5 = filled(3+2) + rest0 + disc0  OK
//   order 3: qty5 = filled2 + rest3 + disc0  OK
//   order 4: qty8 = filled(5+3) + rest0 + disc0  OK
//   order 5: qty4 = filled(2+2) + rest0 + disc0  OK   (market, nothing discarded here)
//   order 6: qty3 = filled0 + rest3 + disc0  OK
// Net-zero (I3): buys +(5+3+2+2)=+12 ; sells -(5+3+2+2)=-12 ; sum 0  OK
const SELFTEST_STREAM = [
  { kind: 'limit', id: 1, account: 'A', side: 'sell', price: 100, qty: 5 },
  { kind: 'limit', id: 2, account: 'B', side: 'sell', price: 100, qty: 5 },
  { kind: 'limit', id: 3, account: 'C', side: 'sell', price: 101, qty: 5 },
  { kind: 'limit', id: 4, account: 'D', side: 'buy', price: 100, qty: 8 },
  { kind: 'market', id: 5, account: 'E', side: 'buy', qty: 4 },
  { kind: 'limit', id: 6, account: 'F', side: 'buy', price: 99, qty: 3 },
];

const SELFTEST_EXPECTED = {
  trades: [
    { takerId: 4, makerId: 1, price: 100, qty: 5 },
    { takerId: 4, makerId: 2, price: 100, qty: 3 },
    { takerId: 5, makerId: 2, price: 100, qty: 2 },
    { takerId: 5, makerId: 3, price: 101, qty: 2 },
  ],
  book: {
    bids: [{ id: 6, account: 'F', price: 99, qty: 3, remaining: 3 }],
    asks: [{ id: 3, account: 'C', price: 101, qty: 5, remaining: 3 }],
  },
};

function selftest() {
  const got = run(SELFTEST_STREAM);
  const a = JSON.stringify(got);
  const b = JSON.stringify(SELFTEST_EXPECTED);
  if (a !== b) {
    process.stderr.write('SELFTEST FAIL\n  expected: ' + b + '\n  got:      ' + a + '\n');
    process.exit(1);
  }
  process.stdout.write('SELFTEST PASS\n');
  process.stdout.write(JSON.stringify(got, null, 2) + '\n');
}

// ----------------------------------------------------------------------------
// CLI — reads JSON order stream on stdin or --input <file>; emits result JSON.
// ----------------------------------------------------------------------------
async function readInputFile(path) {
  const fs = await import('node:fs');
  return fs.readFileSync(path, 'utf8');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) {
    selftest();
    return;
  }
  const inputIdx = argv.indexOf('--input');
  let raw;
  if (inputIdx !== -1) {
    const path = argv[inputIdx + 1];
    if (!path) {
      process.stderr.write('--input requires a file path\n');
      process.exit(2);
    }
    raw = await readInputFile(path);
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  }
  const parsed = JSON.parse(raw);
  const orders = Array.isArray(parsed) ? parsed : parsed.orders;
  if (!Array.isArray(orders)) {
    process.stderr.write('input must be a JSON array of orders, or {orders:[...]}\n');
    process.exit(2);
  }
  const result = run(orders);
  process.stdout.write(JSON.stringify(result) + '\n');
}

// Run main only when executed directly (not when imported for testing).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exit(1);
  });
}

export { run, processLimit, processMarket, processCancel, matchAggressor, selectBestMaker };
