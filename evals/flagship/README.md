# Heimdall flagship eval suite

The flagship suite demonstrates Heimdall's **defensible** claim:

> **Heimdall ships VERIFIED** — it brings and wires the canonical *external* oracle for the
> domain, makes every gate falsifiable (proven able to go red before trusted green), and
> catches the bug class that emits *no local signal* — ordering races, whole-sequence
> invariants, and missing subsystems that sail through a naive green test suite.

It is **NOT** the claim "Heimdall writes code raw Claude Code can't." The grounding spike
(`SPIKE-FINDINGS.md`) disproves that: with opus held constant, raw and Heimdall produced
~equivalently correct code (raw even emitted a 512-opcode CPU core byte-exact). **The delta
is verification, not generation.** This README, and the suite, say that honestly — same
honesty principle as `../benchmark/README.md`.

## Where the delta lives — and where it doesn't

| Target | Flagship? | Oracle | Why it is (or isn't) flagship |
|---|---|---|---|
| **exchange** (limit-order-book matching engine) | **YES** | independent reference-matcher + LOB-replay differential diff (+ seeded variable-latency interleave) | The concurrency race had NO local signal — every per-trade invariant passed; only the whole-output differential oracle + seeded interleaving caught it. This is the delta. |
| **emulator** (Game Boy DMG LR35902 CPU) | **YES** | blargg cpu_instrs verdict + gameboy-doctor per-instruction trace diff | Both arms passed ONLY because the external oracle was provided. A naive user without it ships "seems to work." Heimdall auto-wires it. The descoped timer hole is *predicted* by the coverage matrix, not discovered. |
| **ray-tracer** | **NO — CALIBRATION ROW ONLY** | SSIM vs a reference render | Raw CC ALSO passes this. It is kept in the table on purpose: a row where Heimdall shows no delta keeps the whole table honest. It is not where the value lives, and we do not present it as a flagship win. |

**The launch flagship is exchange + emulator.** The ray-tracer row exists to prove we publish
rows where Heimdall does not win — credibility is the differentiator.

## Per-target oracle definitions

### exchange — differential + seeded-interleave
- **Reference:** an independent O(n²) obviously-correct brute-force matcher, authored by a
  DIFFERENT agent from the impl, from the INVARIANTS ledger alone (no impl coupling). See
  `../oracles/exchange-lob/reference/`.
- **Gate:** run impl + reference over an identical deterministic seeded order stream; assert
  the ENTIRE trade sequence matches exactly; on mismatch, report the first divergence index
  (the spike caught it at trade index 0). Plus a seeded variable-latency interleave sweep
  across N seeds for the concurrency path. See `../oracles/exchange-lob/{differential,interleave}.md`.
- **Gate type:** `differential` (whole-output) — ranked above local property checks.

### emulator — trace-diff + verdict
- **Truth source:** gameboy-doctor per-instruction truth logs + blargg cpu_instrs ROMs
  (external assets, referenced by pointer in `../oracles/emulator-gb/ASSETS.md`, not copied).
- **Gate:** emit the gameboy-doctor line (`A:.. F:.. ... PC:.. PCMEM:..`) before each fetch,
  diff vs the truth log, report the FIRST divergence by instruction count + expected/actual
  line (the spike pinpointed instr 151,346); plus the blargg serial verdict (FF01/FF02
  capture). See `../oracles/emulator-gb/trace-diff.md`.
- **Gate type:** `trace-diff` + `verdict`.
- **Coverage matrix** declares the DIV/TIMA/TMA/TAC timer subsystem DESCOPED → test
  02-interrupts is an *expected* red, flagged on day zero.

### ray-tracer — image-similarity (calibration)
- **Gate:** render a fixed scene, compute SSIM vs a committed reference image, assert
  similarity above threshold. Gate type `image-similarity`. Present for calibration honesty.

## Status table

The live status table is in `STATUS.md`, keyed by oracle pass (✅ pass / 🔄 in-progress /
❌ red / ⚠️ green but gate proven tautological / not yet falsifiable — green that cannot
fail). Descoped subsystems render as a documented ❌ with a "descoped" annotation — the
coverage matrix predicted them. The ⚠️ rows are the false-green targets the oracle-gate
system converts to ✅ (falsifiable + passing) or ❌ (falsifiable + failing).

## Falsifiability — the structural kill for false-green

Every flagship gate must PROVE it can go red before it is trusted green. `bin/falsify
<domain>` injects each mutant from `../oracles/<domain>/mutants/` and asserts the gate fails
on every one. Required falsifiability score: **1.0**. The `queue-jump` mutant specifically
proves the exchange seeded-interleave gate is not the raw-arm tautology. A gate that stays
green under a mutant is REJECTED.

## How this relates to the benchmark harness

The flagship suite consumes the SAME oracle registry (`../oracles/registry.json`) that the
in-loop wave gates read — **one build, two uses.** `bin/benchmark` measures token/wall/cost
receipts; the flagship oracles grade *correctness* with falsifiable, independent, whole-output
gates. Both read one registry; neither lets the implementation grade itself.
