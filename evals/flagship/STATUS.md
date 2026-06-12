# Flagship status

Keyed by oracle pass: ✅ pass · 🔄 in-progress · ❌ red (failing / descoped) · ⚠️ green but gate proven tautological / not yet falsifiable (green that cannot fail).

Status reflects the 4-arm spike (2026-06-11) that grounds the suite. Rows update as the
oracle-gate system (per `docs/superpowers/plans/2026-06-11-oracle-gate-plan.md`) lands.

## Per-target × per-arm (opus held constant; variable = process)

| Target | Oracle | Gate type | raw arm | superx arm | The delta |
|---|---|---|---|---|---|
| **exchange** (LOB matcher) | independent ref-matcher + LOB-replay diff + seeded interleave | `differential` | ⚠️ green-but-tautological | ✅ caught the race | superx caught a concurrency race (C2) at seed 1 idx 0 that ALL per-trade invariants passed; raw shipped a concurrency test that *cannot fail* |
| exchange: **C2 live differential arm** (seeded variable-latency interleave) | `differential.run.mjs` + independent ref-matcher | `differential` | ⚠️ guard-only (cannot fail) | ✅ **runnable + falsifiable** (R-3.2) | The live arm now EXISTS: racy engine (await-before-critical-section) goes RED at **seed 1, trade index 0**; locked engine (FIFO-mutex serialization) is GREEN across all 200 seeds. Proven by corpus `exchange-c2-racy` (caught fail) + `exchange-c2-locked` (no false-RED). Was ❌ not-implemented (guard-only) until this make-it-fail proof passed. |
| **emulator** (DMG CPU) | blargg verdict + gameboy-doctor trace diff | `trace-diff` + `verdict` | ✅ 10/11 byte-exact | ✅ 10/11 byte-exact | code ~equivalent; superx PREDICTED the 1 timer hole via coverage matrix, raw DISCOVERED it at end-of-build |
| emulator: 02-interrupts (timer) | gameboy-doctor trace diff | `trace-diff` | ❌ descoped | ❌ descoped (predicted) | the descoped DIV/TIMA/TMA/TAC subsystem; flagged on day zero by the coverage matrix |
| **ray-tracer** (CALIBRATION) | SSIM vs reference render | `image-similarity` | ✅ passes | ✅ passes | no delta — raw CC also passes; kept to keep the table honest |

⚠️ = green but **false-green** (a gate that cannot fail). The whole point of the oracle-gate
system is to convert ⚠️ into either ✅ (falsifiable + passing) or ❌ (falsifiable + failing).

## Falsifiability scores (target: 1.0)

| Domain | Gate | Mutants caught / total | Falsifiable? |
|---|---|---|---|
| exchange-lob | differential + interleave | **6/6** (`bin/falsify exchange-lob` = 1.0, incl. 2 tautology guards); C2 live arm: racy RED @ seed 1 idx 0, locked GREEN ×200 | ✅ 1.0 |
| emulator-gb | trace-diff + verdict | **3/3** (`bin/falsify emulator-gb` = 1.0) | ✅ 1.0 |

Corpus: **13/13 caught (100%)** at v0.1 (`bin/corpus run`), incl. the two live-style C2 cases
`exchange-c2-racy` (caught fail @ trade index 0) and `exchange-c2-locked` (expected pass, no
false-RED).

A gate is not trusted green until its falsifiability score is 1.0. The `queue-jump` mutant
must make the exchange interleave gate go red (the regression guard against the raw-arm
tautology); the **C2 live arm** is now the runnable proof of that — the racy engine going RED at
seed 1 index 0 while the locked engine stays GREEN across 200 seeds is the falsifiability
demonstration the row above cites.

## Headline

The launch flagship is **exchange + emulator** — where the verification delta lives. The
ray-tracer is a calibration row, not a flagship win. superx's defensible claim is VERIFICATION
superiority (auto-wired external oracle, falsifiable gates, no-local-signal bug capture), NOT
generation superiority.
