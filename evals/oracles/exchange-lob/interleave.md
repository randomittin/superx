# Exchange LOB — Seeded Variable-Latency Interleave Scheduler

Companion to [differential.md](./differential.md). Specifies the deterministic, seeded,
variable-latency scheduler that scrambles concurrent submission arrival so the whole-output
differential (C2) can actually FAIL. This is the harness the spike proved necessary: the
naive fixed-yield concurrency test PASSED the buggy engine — only **seeded variable latency**
surfaced the race (see [SPIKE-FINDINGS.md](../../flagship/SPIKE-FINDINGS.md), Arm 2).

## The critical-section race being exercised

`submit(order)` is `async` and `await`s a pre-trade hook (`riskCheck`) BEFORE it touches the
book — before the read-match-mutate critical section:

```
async submit(order):
    await riskCheck(order)        # <-- await happens HERE, before the book is touched
    # ---- critical section: read book, match, mutate book, emit fills ----
    matchAndMutate(order)
```

When all submissions are dispatched with `Promise.all`, every `await riskCheck(...)` races.
Whichever hook resolves first reaches the critical section first — so post-await execution
order != submission order. Arrival / price-time priority is then decided by I/O-latency race,
not submission sequence. There is no serialization lock around read-match-mutate. THIS is the
defect the scheduler must expose.

## The deterministic seeded-latency hook

The scheduler replaces `riskCheck`'s timing with a **per-id, seed-derived delay** so that a
single integer `seed` fully determines the arrival scramble — making every failure
reproducible and shrinkable.

```
makeLatencyHook(seed):
    return async (order):
        # deterministic PRNG keyed by (seed, order.id) — same seed+id => same delay,
        # every run, no Math.random, no wall-clock dependence
        delayMs = seededDelay(seed, order.id)
        await sleep(delayMs)        # await BEFORE the critical section
        # returns; submit() then enters read-match-mutate
```

Properties the hook MUST have:

- **Deterministic.** `seededDelay(seed, id)` is a pure function of `(seed, id)`. No
  `Math.random()`, no `Date.now()`. A fixed seed reproduces the exact same interleave and the
  exact same first-divergence index every run — this is what let the spike shrink the failure
  to 7 orders and pin it to trade index 0.
- **Per-id variable.** Different ids under the same seed get DIFFERENT delays, so the arrival
  order is genuinely permuted. A uniform/constant delay (fixed-yield) does NOT permute arrival
  — Node resolves equal-delay timers in scheduling order, which collapses back to submission
  order and gives a false-green. Variability per id is non-negotiable.
- **Seed-scrambled.** Different seeds produce different per-id delay assignments, so each seed
  scrambles arrival order differently — sweeping seeds explores a large space of interleavings.

## The sweep

Sweep **N ≥ 200 seeds**. For EACH seed:

1. Build the latency hook from the seed and install it as the engine's pre-trade hook.
2. Take a batch of concurrent submissions (≥ 50 orders) over a single book.
3. **Concurrent arm:** `Promise.all(orders.map(o => engine.submit(o)))` — all awaits race
   through the seeded-latency hook, scrambling arrival into the critical section.
4. **Reference arm:** replay the SAME orders one at a time, strictly in **submission order**,
   with no concurrency and no latency hook (the canonical serialization per C2).
5. **Compare** the concurrent arm's whole fill SEQUENCE against the submission-order serial
   replay's whole fill sequence (the whole-output differential from differential.md).
6. On mismatch: report the seed, the **first-divergence index**, and both full sequences;
   fail the gate.

200 seeds × 50 concurrent submits is the spike-hardened floor. The buggy engine failed at
**seed 1, index 0** — but the floor exists because a smaller / less varied sweep can miss the
specific arrival permutation that triggers a given race.

## Why fixed-yield is rejected (the false-green)

The known false-green is
`Promise.all(orders.map(o => setImmediate(() => engine.submit(o))))` with a synchronous
`submit`: Node is single-threaded so dispatch resolves in arrival order by construction,
making the concurrent run provably equal to the serial run — a tautology, not a test. Equally,
a uniform fixed delay does not permute arrival. The scheduler MUST inject genuine awaited,
**per-id variable** latency between submission and the read-match-mutate critical section, or
it cannot fail and is rejected as a false-green.

## Acceptance

The interleave harness is valid only if: the latency hook is awaited BEFORE the critical
section, delays are a deterministic pure function of `(seed, id)`, delays vary per id, the
sweep covers ≥ 200 seeds × ≥ 50 concurrent submits, and each seed's concurrent whole-output is
compared against a submission-order serial replay. A run that used uniform/fixed-yield latency
is rejected.
