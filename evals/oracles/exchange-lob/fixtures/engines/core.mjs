// Exchange LOB — SHARED matching core for the subject engines (racy vs locked).
//
// This is the read-match-mutate critical section, factored out so that the ONLY
// difference between racy.mjs and locked.mjs is WHERE the awaited latency hook
// sits relative to this critical section — racy awaits BEFORE entering it (the
// spike's bug: SPIKE-FINDINGS.md root cause), locked serializes entry behind a
// queue so the await never reorders the critical section.
//
// The matching semantics here mirror INVARIANTS.md (I1/I2/I4, O1/O2/D3, C1):
// trade at the RESTING maker price, fill Q=min(remaining), price-time priority
// with FIFO (seq) tiebreak, limit remainder rests, market never rests. It is the
// SAME core in both engines on purpose — the differential isolates the
// serialization defect, not a matching-logic difference.
//
// IMPORTANT: this core is NOT the reference matcher. The reference
// (reference/matcher.mjs) is provenance-protected and independently authored; it
// is the serial-replay truth source the runner diffs against. This core is the
// subject side — deliberately given a correct matching body so the divergence the
// gate surfaces is purely the await-before-critical-section race in racy.mjs.

// A book shared across all concurrent submissions over a single run.
export function createBook() {
  return { resting: [], trades: [], nextSeq: 1 };
}

function selectBestMaker(book, aggressor) {
  const wantSide = aggressor.side === 'buy' ? 'sell' : 'buy';
  const isMarket = aggressor.price === null || aggressor.price === undefined;
  let best = null;
  for (const m of book.resting) {
    if (m.side !== wantSide) continue;
    if (m.remaining <= 0) continue;
    if (aggressor.side === 'buy') {
      if (!isMarket && m.price > aggressor.price) continue;
    } else {
      if (!isMarket && m.price < aggressor.price) continue;
    }
    if (best === null) {
      best = m;
      continue;
    }
    if (aggressor.side === 'buy') {
      if (m.price < best.price || (m.price === best.price && m.seq < best.seq)) best = m;
    } else {
      if (m.price > best.price || (m.price === best.price && m.seq < best.seq)) best = m;
    }
  }
  return best;
}

// The critical section: read the book, match the aggressor to exhaustion,
// mutate the book, append the produced trades. SYNCHRONOUS and atomic — there is
// no await INSIDE this body (mirrors the spike: matching itself is atomic, only
// ENTRY order is raced). Appends to book.trades in execution order.
export function matchAndMutate(book, order) {
  const aggressor = {
    id: order.id,
    seq: book.nextSeq++,
    account: order.account,
    side: order.side,
    price: order.kind === 'market' ? null : order.price,
    qty: order.qty,
    remaining: order.qty,
  };

  if (order.kind === 'cancel') {
    const targetId = order.targetId !== undefined ? order.targetId : order.id;
    const i = book.resting.findIndex((m) => m.id === targetId);
    if (i !== -1) book.resting.splice(i, 1);
    return;
  }

  while (aggressor.remaining > 0) {
    const maker = selectBestMaker(book, aggressor);
    if (maker === null) break;
    const Q = Math.min(aggressor.remaining, maker.remaining);
    aggressor.remaining -= Q;
    maker.remaining -= Q;
    book.trades.push({
      takerId: aggressor.id,
      makerId: maker.id,
      price: maker.price,
      qty: Q,
    });
    if (maker.remaining === 0) {
      const i = book.resting.indexOf(maker);
      if (i !== -1) book.resting.splice(i, 1);
    }
  }

  // O1 limit-rest / O2 market-no-rest.
  if (order.kind === 'limit' && aggressor.remaining > 0) {
    book.resting.push(aggressor);
  }
}
