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
