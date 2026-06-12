# Gate Review Packet — RJ, line-by-line (critical path)

**Why this exists:** superx wrote its own verifiers this session. A self-authored gate that is
quietly wrong = a publicly-wrong benchmark = repo-killing failure found by a stranger. The spec's
hard rule: RJ reviews the gate code personally before any public claim. This is that checklist.

Total surface: **~975 LOC gate logic + 175 LOC fixture data.** One sitting.

## Tier 1 — diff-truth logic (a bug here = false PASS/FAIL on the flagship)

| File | LOC | Scrutinize for |
|---|---|---|
| `evals/oracles/exchange-lob/run.sh` | 240 | the whole-output differential + book-state diff. Is "equal" actually exact (no rounding/order tolerance that hides a real divergence)? Does it emit `status=fail` on every genuine mismatch? |
| `evals/oracles/emulator-gb/run.sh` | 173 | per-instruction trace lockstep. Does it compare EVERY field (regs+flags+PC+PCMEM)? Off-by-one in divergence index? Does it stop at FIRST divergence correctly? |
| `bin/falsify` | 308 | the orchestrator. Does `--assert-score 1.0` truly require golden-pass AND all-mutants-killed? Can it report 1.0 if a mutant silently errored (run.sh crash misread as kill)? Tautological-concurrency handling. |
| `evals/oracles/exchange-lob/reference/spec.md` | 213 | the INDEPENDENT matcher. Is it actually independent of the impl's spec interpretation, or does it share a blind spot? This is the oracle's ground truth — if it's wrong, every "pass" is wrong. |
| `evals/oracles/*/gate.sh` (92+162) | 254 | the benchmark-time entry the run.sh wraps. Same diff logic — confirm run.sh and gate.sh agree. |

## Tier 2 — fixture honesty (a bug here = the gate proves nothing)

| File | Scrutinize for |
|---|---|
| `exchange-lob/fixtures/golden/order-stream.json` | is the "correct" expected output ACTUALLY correct? Hand-verify the 7-order trade sequence + conservation. If golden is wrong, golden-pass is meaningless. |
| `emulator-gb/fixtures/golden/trace.gbdoctor` | hand-verify a few flag derivations (DAA, half-carry) against Pan Docs. |
| `*/fixtures/mutants/manifest.json` | does each mutant's claimed defect match its actual corrupted data? A mutant that doesn't really inject the defect = a gate that "kills" nothing. |

## The one question per file
"If I shipped a flagship that was subtly WRONG in exactly this dimension, would this gate catch it — or print green?"

## Suggested method
1. `git show <sha>` each file (commits: c77d287 exchange, 9b1ec3e emulator, 53af6d6 falsify).
2. For each diff: construct one input you KNOW should fail, run `run.sh --input` it, confirm `status=fail` + correct `first_divergence`.
3. Hand-verify both golden fixtures independently (don't trust the agent's arithmetic).
4. Confirm the independent reference shares no code/spec lineage with what it checks.

Sign off here when done: `[ ] RJ reviewed — gates trustworthy for public claims`

---
SIGN-OFF
Scope: corrected contract post-R-1…R-12. Goldens confirmed by 3-model blind
consensus (gpt-5.5, gemini-3.5-thinking, claude-fable-5 fresh-context;
VERIFICATION.md at both golden paths; zero divergences; pre-R-1 value would have
failed consensus 3-0). Corpus and falsify alarm paths corrupt-and-confirmed by
hand on a clean checkout this sitting (steps 1-2 evidence below). C2 live-proven
(racy RED @ seed 1 / locked GREEN ×200). Known holes: emulator timer subsystem
descoped (COVERAGE.md); generalization proofs pending (STAGING 4b).

Evidence:

── STEP 0 EVIDENCE ──
command: git status; bin/corpus run; bin/falsify exchange-lob; bin/falsify emulator-gb
exit: 0 / 0 / 0
key lines:
  13/13 caught = 100%               (corpus, exit:0)
  SCORE: 6/6 = 1.0000 (golden passing) (incl. 2 guard, gate-invoked)   (exchange-lob, exit:0)
  SCORE: 3/3 = 1.0000 (golden passing)  (emulator-gb, exit:0)
  tree clean (only untracked .claude/ — local session config)
verdict: PASS

── STEP 1 EVIDENCE ──
command: corrupt evals/corpus/exchange-crossed-trade/expected.json (price 99→98, one byte) → bin/corpus run → restore → bin/corpus run
exit: 1 (corrupted) → 0 (restored)
key lines:
  MISS exchange-crossed-trade [exchange-lob: MISS wrong-divergence: got '...price\":99...' want '...price\":98...']
  12/13 caught = 92%   exit:1
  after restore: 13/13 caught = 100%   exit:0, tree clean
verdict: PASS

── STEP 2 EVIDENCE ──
command: corrupt evals/oracles/emulator-gb/fixtures/golden/trace.gbdoctor line 2 (A:02→A:03, one byte) → bin/falsify emulator-gb → restore → re-run
exit: 1 (corrupted) → 0 (restored)
key lines:
  golden report.json status='fail' (expected pass) — gate is over-strict (false-RED)
  GOLDEN FAILED: the gate rejects its own known-correct golden fixture.
  SCORE: 0/0 (golden precondition failed)   exit:1   (mutants not reached)
  after restore: SCORE: 3/3 = 1.0000 (golden passing)   exit:0, tree clean
verdict: PASS

── STEP 5 EVIDENCE ──
command: git status; bin/corpus run (final green before signature)
exit: 0
key lines:
  row: | 0.1 | 13 cases | 13/13 caught | 100% |
  tree clean; VERIFICATION.md placements already committed (c4ad97c), byte-identical to supplied source
verdict: PASS

Step 4 STATUS audit (read-only): C2 ✅ with live-proof citation (racy RED @ seed 1,
trade index 0; locked GREEN ×200); 02-interrupts timer row still ❌ descoped — PASS.
Stale-but-conservative notes: STATUS.md:26 "pending bin/falsify" (now 3/3),
STATUS.md:28 "11/11" (now 13/13) — understatements, not false-greens.

Signed: RJ   Date: 12/June/2026
