# Corpus Catch-Rate — Time Series

Published catch-rate of the Heimdall case corpus, per version. This is a
plotted line, not an adjective: each row is the fraction of accumulated
scored failure cases the gates actually caught at that version. Generated
by `bin/corpus run` — every number is a real gate run over real cases.

| Version | Cases | Caught | Catch-rate |
| --- | ---: | ---: | ---: |
| 0.1 | 11 cases | 11/11 caught | 100% |

<!-- DIP-LOG: append-only incident record; preserved across runs -->
## Dip log — corpus RED events during reference fixes

A genuine reference fix MUST make the corpus go RED before it recovers. If the
corpus stays green while a golden reference is corrected, the expectations were
regenerated in the same breath as the reference — a tautology, not a check. Each
row below is a real, observed dip: what broke, why, and the recovery.

| Date | Event | Dip | Recovery | Root cause |
| --- | --- | ---: | ---: | --- |
| 2026-06-12 | R-1 H-flag golden correction | 9/9 → 7/9 (78%) | 7/9 → 9/9 (100%) | Golden `trace.gbdoctor` L4/L5 (post `AND A` + JR) shipped `F:10`; correct is `F:20`. H is bit 5 = `0x20`, C is bit 4 = `0x10`; `AND` sets H=1 and clears C, so the H bit must be on and the C bit off. The golden had the two inverted. |

**What dipped (R-1, 2026-06-12):** the instant `fixtures/golden/trace.gbdoctor`
L4/L5 were corrected `F:10 → F:20`, `bin/corpus run` dropped to 7/9 (exit 1):
`emulator-half-carry` MISS (gate now expected `F:20`, pin still said `F:10` —
wrong-divergence) and `emulator-jr-off-by-one` MISS (its input still carried the
stale `F:10` at instruction 4, so the gate diverged at instruction 4 against the
corrected golden instead of at instruction 5 where its real JR defect lives — the
injected defect was masked by the earlier reference mismatch). `emulator-daa`
stayed CATCH throughout (self-contained truth, independent of the resident
golden) and `emulator-f-mask` stayed CATCH (its injected defect at instruction 2
precedes L4, so the earlier divergence still fired).

**How it recovered:** the corpus inputs were regenerated to match the corrected
golden, then every emulator expected.json was RE-PINNED by REPLAYING the input
through `evals/oracles/emulator-gb/run.sh` and capturing the structured
`first_divergence` it emitted (SCHEMA.md law: pinpoints are captured, never
hand-written). After re-pinning: 9/9 = 100% (exit 0), `bin/falsify emulator-gb
--assert-score 1.0` green (3/3 mutants killed). The dip is the proof the corpus
can fail; the recovery is the proof the fix is real.
