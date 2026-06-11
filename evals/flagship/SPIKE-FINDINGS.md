# Spike Findings — 4-arm oracle-gate spike (2026-06-11)

These are the **load-bearing traces** from the 4-arm spike that grounds the oracle-gate
system. The source artifacts lived in ephemeral `/tmp/spike-*` dirs and are preserved here
verbatim. The model was **opus in all four arms** — the only variable is PROCESS.

Arms:
- `exchange-raw` / `exchange-superx` — limit-order-book matching engine (TypeScript)
- `emulator-raw` / `emulator-superx` — LR35902 (Game Boy DMG) CPU core (TypeScript)

---

## Headline synthesis

1. **Original thesis partly WRONG.** "Silent bugs accumulate over long autonomous runs;
   raw CC breaks" did NOT reproduce. Opus one-shots the *code*: raw and superx produced
   ~equivalently correct code; raw even emitted 512 opcodes byte-exact.
2. **The real delta is VERIFICATION, not generation.** superx (a) knows + auto-wires the
   canonical external oracle, (b) builds oracles that can actually FAIL, (c) catches the
   no-local-signal bug class.
3. **Headline danger = FALSE-GREEN oracles** (the raw-exchange tautological concurrency test).

---

## Arm 1 — exchange-raw (no scaffolding)

One-pass build. Logically correct matching engine first try, 0 logic bugs, 200-seed sweep
clean. Compiled on the 3rd invocation (two env/config breakages, zero logic edits).

First end-to-end oracle run (10k deterministic stream, seed 42):
```
orders=10000 engineFills=7590 refFills=7590
INVARIANTS: PASS
REF-DIFF:   PASS
CONCURRENCY: PASS
```
Adversarial follow-up: 200-seed sweep × 2000 orders, failures=0; 5 edge cases all ok.

**But it shipped a FALSE-GREEN oracle (the core lesson):**
- The "50 concurrent submissions" check is modeled as
  `Promise.all(orders.map(o => setImmediate(() => engine.submit(o))))`. Node is
  single-threaded and `submit` is synchronous, so dispatch resolves in **arrival order by
  construction** — the concurrent run is provably equal to the serial run. The check is a
  **tautology, not a test**. It would pass even if real interleaving were broken.
- **Shared-author blind spot:** engine and reference were written by the same author in the
  same pass, sharing the same spec interpretation (trade-at-maker-price, market-remainder
  dropped, FIFO-by-arrival). A *specification* error would be present in BOTH and the diff
  would still say PASS. The diff catches implementation divergence, not shared misconception.

Distinct logic bugs caught by the end oracle: **0.** Latent weaknesses found only by
post-hoc human review: **1** (the tautological concurrency check). The danger of the raw
arm here is a *false-green* oracle, not a red one.

---

## Arm 2 — exchange-superx (wave discipline + differential oracle + seeded-latency harness)

Same engine quality. Single-threaded matching core proven correct at Wave 3:
- reference-matcher diff over 10k-order stream (seed 12345): engine == brute-force EXACTLY
- invariants no-cross / qty-balance / net-zero on 10k stream: PASS
- fast-check: 500 random streams, engine == reference AND invariants hold: PASS

**Wave 4 (concurrency) — FIRST FAILING ORACLE CHECK.** Oracle hardened to 200 seeds, 50
concurrent submits each, with a deterministic variable-latency async pre-trade hook
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
internally valid). The cross-cutting, whole-sequence invariant (C2) was in INVARIANTS.md up
front, yet invisible to every per-trade check.

---

## Arm 3 — emulator-raw (no scaffolding)

One straight build pass of the full LR35902 core. Oracle run ONCE at the end.

| Test | Serial verdict | Trace vs gameboy-doctor |
|------|----------------|--------------------------|
| 01 special | PASSED | MATCH (1,256,633 lines) |
| 02 interrupts | FAILED | DIVERGES @ line 151,347 |
| 03 op sp,hl | PASSED | MATCH (1,066,160 lines) |
| 04 op r,imm | PASSED | MATCH (1,260,504 lines) |
| 05 op rp | PASSED | MATCH (1,761,126 lines) |
| 06 ld r,r | PASSED | MATCH (241,011 lines) |
| 07 jr,jp,call,ret,rst | PASSED | MATCH (prefix) |
| 08 misc instrs | PASSED | MATCH (221,630 lines) |
| 09 op r,r | PASSED | MATCH (4,418,120 lines) |
| 10 bit ops | PASSED | MATCH (6,712,461 lines) |
| 11 op a,(hl) | PASSED | MATCH (7,427,500 lines) |

**10/11 byte-identical** across tens of millions of lines. **0 opcode/flag bugs** — DAA,
CB-prefix, 16-bit half-carry all correct first build. The 1 fail = descoped timer/interrupt
subsystem (no DIV/TIMA/TMA/TAC), surfaced ONLY at end-of-build oracle time with NO local
signal during the build.

KEY BASELINE SIGNAL: a one-shot 512-opcode core can be ~99% correct yet ship a single
high-leverage subsystem hole that no per-line local check would catch — only the *provided*
external oracle exposed it.

---

## Arm 4 — emulator-superx (invariant ledger + unit-flag-gate + per-instruction trace oracle)

ALSO 10/11, byte-exact, 0 opcode bugs, same single timer gap (descoped).

Pre-oracle gate: 58 flag-semantics unit tests encoding the INVARIANTS ledger (all pass).

### The single divergence — test 02-interrupts, instruction 151,346
```
expected (truth): A:05 F:10 B:01 C:00 D:C7 E:BA H:90 L:00 SP:DFFB PC:0051 PCMEM:C9,00,00,00
actual   (mine):  A:04 F:10 B:01 C:00 D:C7 E:BA H:90 L:00 SP:DFFB PC:0050 PCMEM:3C,C9,00,00
```
Reference is exactly ONE instruction ahead (already executed `INC A` at 0x0050). NOT a wrong
flag/arithmetic — the `INC A` math is correct. The traces run DIFFERENT loop-iteration
counts because the test polls a hardware timer the MMU does not tick.

Root cause: MMU has no DIV/TIMA/TMA/TAC timer; the CPU step loop never raises a timer
interrupt (IF bit 2). CLASSIFICATION: `incomplete` — a known, bounded, **descoped**
peripheral. Predicted by the wave plan, not discovered.

The flag-semantics ledger (DAA, ADD SP,e low-byte half-carry, INC/DEC C-preservation)
written BEFORE coding made the impl transcribe-not-guess; the trace oracle pinpointed the
divergence to exact PC+opcode.

---

## What each upgrade is proven by (cross-reference)

| Upgrade | Proving arm | The trace above that proves it |
|---|---|---|
| Oracle library + auto-wiring | emulator (both) | both passed ONLY because gameboy-doctor + blargg were provided |
| Falsifiable-gate via mutation | exchange-raw | the tautological `Promise.all`-over-sync concurrency test |
| Differential / whole-output oracle | exchange-superx | C2 FAIL @ seed 1 idx 0; per-trade checks all PASS |
| Oracle independence | exchange-raw | shared-author engine+reference blind spot |
| Invariant ledger before coding | emulator-superx | DAA + half-carry nailed first build via ledger |
| Seeded interleaving harness | exchange-superx | fixed-yield passed; variable-latency caught the race |
| Coverage matrix | emulator (both) | the descoped timer subsystem (test 02) |
