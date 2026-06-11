# Heimdall conventions — process distillations

Lessons that survived an incident, written as enforceable rules. Each one exists
because skipping it produced (or nearly produced) a false-green. Append-only.

## R5 — no hand-derived reference byte is trusted until externally anchored

A reference value (a golden trace byte, an expected trade, any "this is the
correct answer" datum) is NOT trusted until it has been anchored to an EXTERNAL
source — Pan Docs, gameboy-doctor output, an independent reference matcher —
that is independent both of the author and of this repo's other fixtures.

**Why:** the R-1 H-flag defect. The emulator golden shipped `F:10` where `F:20`
was correct (post `AND A`: H is bit 5 = `0x20`, C is bit 4 = `0x10`; AND sets H
and clears C, so the golden had the two bits inverted). It survived every
in-repo check: self-verify 11/11, mutation-proof 9/9, corpus 100%. All of those
were authored by the same hand against the same wrong reference, so they shared
its blind spot by construction — a same-author cross-check can only confirm
internal consistency, never external correctness. The defect was caught only by
an external adversarial review that anchored the byte to Pan Docs.

**How to apply:** before pinning any reference datum, cite the external anchor
(`AND` flag rule "Z 0 1 0" in Pan Docs; a gameboy-doctor truth log; the
reference matcher's output). Same-family agreement counts (11/11, 9/9, 100%) are
necessary but NOT sufficient — they prove consistency, not correctness. Record
the anchor in the fixture's provenance. See [[R6]] for the complementary rule
that the checks themselves must be falsifiable.

## R6 — golden checks must be capable of failing

Every "must pass" check gets a corrupt-and-confirm test: deliberately break the
thing it validates and confirm the check goes RED. No X-vs-X comparisons — a
check that diffs a value against itself can never fail and therefore proves
nothing.

**Why:** a gate that diffs the golden against its own default truth (no explicit
independent reference) is comparing X to X — it is green by tautology, and "the
gate is not over-strict" has never actually been demonstrated. The same failure
mode at corpus level: if expectations are regenerated in the same breath as the
reference they pin, the corpus stays green through a reference change that should
have broken it. The R-1 corpus dip (9/9 → 7/9 → 9/9) is the positive proof: the
corpus genuinely went RED the instant the golden was corrected and before the
pins were replayed — that dip is what makes the recovered 100% trustworthy.

**How to apply:**
- Each oracle ships a `run.test.sh` whose cases include at least one
  corrupt-and-confirm: feed the gate a deliberately corrupted golden and assert
  it reports `status=fail` (e.g. `evals/oracles/emulator-gb/run.test.sh`).
- A reference fix MUST make the corpus dip RED before it recovers; record the dip
  publicly (CORPUS-STATUS.md dip-log). A corpus that never went red during a
  reference fix means the expectations were regenerated in the same breath as the
  reference — stop and investigate.
- Re-pin expected verdicts by REPLAYING the input through the gate's `run.sh` and
  capturing its structured output — never hand-write a pinpoint (SCHEMA.md law).

See [[R5]] for the complementary rule that the reference itself must be
externally anchored.
