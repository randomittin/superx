// Exchange LOB — RACY subject engine (the spike's bug, resurrected).
//
// This is the await-before-critical-section defect from SPIKE-FINDINGS.md, Arm 2:
//
//   async submit(order):
//       await latencyHook(order)     // <-- await BEFORE the book is touched
//       matchAndMutate(book, order)  //     critical section: read-match-mutate
//
// Under Promise.all, every submission's `await latencyHook(...)` races. Whichever
// per-id seeded delay resolves FIRST reaches matchAndMutate first, so post-await
// execution order != submission order. There is NO serialization lock around the
// read-match-mutate critical section — arrival/price-time priority is decided by
// the latency race, not the submission sequence. That is exactly the C2 race.
//
// Engine contract (consumed by differential.run.mjs):
//   createEngine() -> { trades, submit(order, latencyHook) }
//     - trades: live array, appended in execution (post-await) order.
//     - submit: async; awaits latencyHook(order) THEN runs the critical section.

import { createBook, matchAndMutate } from './core.mjs';

export function createEngine() {
  const book = createBook();
  return {
    trades: book.trades,
    async submit(order, latencyHook) {
      // THE BUG: await the variable-latency hook BEFORE entering the critical
      // section. No lock serializes entry, so concurrent submissions enter
      // matchAndMutate in hook-resolution order, scrambling price-time priority.
      if (latencyHook) await latencyHook(order);
      matchAndMutate(book, order);
    },
  };
}

export default createEngine;
