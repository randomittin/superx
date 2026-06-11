// Exchange LOB — LOCKED subject engine (the correct fix).
//
// Same matching core as racy.mjs (fixtures/engines/core.mjs) — the ONLY
// difference is serialization. The latency hook is still awaited (the engine
// still does its variable-latency pre-trade work), but the read-match-mutate
// critical section is serialized behind a FIFO mutex so that critical-section
// ENTRY order == submission order, regardless of which hook resolves first.
//
// The mutex is a promise chain: each submit() appends its critical section to a
// tail promise in CALL order. Because differential.run.mjs dispatches
// Promise.all(orders.map(o => submit(o, hook))) synchronously in submission
// order, the chain is built in submission order; the awaited latency happens
// concurrently, but matchAndMutate runs strictly in the enqueued (submission)
// order. This is the serialization C2 demands — concurrent output == serial
// submission-order replay, for every seed.
//
// Engine contract (consumed by differential.run.mjs):
//   createEngine() -> { trades, submit(order, latencyHook) }

import { createBook, matchAndMutate } from './core.mjs';

export function createEngine() {
  const book = createBook();
  // FIFO mutex: tail of the critical-section promise chain.
  let tail = Promise.resolve();

  return {
    trades: book.trades,
    submit(order, latencyHook) {
      // Reserve this submission's slot in the critical-section queue NOW, in call
      // (submission) order — before any await yields control. `prev` is the
      // critical section of the submission enqueued immediately before this one.
      const prev = tail;
      let release;
      tail = new Promise((resolve) => {
        release = resolve;
      });

      return (async () => {
        // The variable-latency pre-trade work still happens (and races), but it
        // does NOT decide critical-section order...
        if (latencyHook) await latencyHook(order);
        // ...because we wait for the prior submission's critical section to
        // finish before entering ours. Entry order == submission order.
        await prev;
        try {
          matchAndMutate(book, order);
        } finally {
          release();
        }
      })();
    },
  };
}

export default createEngine;
