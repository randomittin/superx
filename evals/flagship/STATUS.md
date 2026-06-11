# Flagship status

Keyed by oracle pass: ✅ pass · 🔄 in-progress · ❌ red (failing / descoped) · ⚠️ green but gate proven tautological / not yet falsifiable (green that cannot fail).

Status reflects the 4-arm spike (2026-06-11) that grounds the suite. Rows update as the
oracle-gate system (per `docs/superpowers/plans/2026-06-11-oracle-gate-plan.md`) lands.

## Per-target × per-arm (opus held constant; variable = process)

| Target | Oracle | Gate type | raw arm | superx arm | The delta |
|---|---|---|---|---|---|
| **exchange** (LOB matcher) | independent ref-matcher + LOB-replay diff + seeded interleave | `differential` | ⚠️ green-but-tautological | ✅ caught the race | superx caught a concurrency race (C2) at seed 1 idx 0 that ALL per-trade invariants passed; raw shipped a concurrency test that *cannot fail* |
| **emulator** (DMG CPU) | blargg verdict + gameboy-doctor trace diff | `trace-diff` + `verdict` | ✅ 10/11 byte-exact | ✅ 10/11 byte-exact | code ~equivalent; superx PREDICTED the 1 timer hole via coverage matrix, raw DISCOVERED it at end-of-build |
| emulator: 02-interrupts (timer) | gameboy-doctor trace diff | `trace-diff` | ❌ descoped | ❌ descoped (predicted) | the descoped DIV/TIMA/TMA/TAC subsystem; flagged on day zero by the coverage matrix |
| **ray-tracer** (CALIBRATION) | SSIM vs reference render | `image-similarity` | ✅ passes | ✅ passes | no delta — raw CC also passes; kept to keep the table honest |

⚠️ = green but **false-green** (a gate that cannot fail). The whole point of the oracle-gate
system is to convert ⚠️ into either ✅ (falsifiable + passing) or ❌ (falsifiable + failing).

## Falsifiability scores (target: 1.0)

| Domain | Gate | Mutants caught / total | Falsifiable? |
|---|---|---|---|
| exchange-lob | differential + interleave | pending `bin/falsify` | required 1.0 |
| emulator-gb | trace-diff + verdict | pending `bin/falsify` | required 1.0 |

A gate is not trusted green until its falsifiability score is 1.0. The `queue-jump` mutant
must make the exchange interleave gate go red (the regression guard against the raw-arm
tautology).

## Headline

The launch flagship is **exchange + emulator** — where the verification delta lives. The
ray-tracer is a calibration row, not a flagship win. superx's defensible claim is VERIFICATION
superiority (auto-wired external oracle, falsifiable gates, no-local-signal bug capture), NOT
generation superiority.
