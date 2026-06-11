# Checkpoint — 2026-06-11

## TL;DR
Launch-prep + flagship strategy for superx. Killed pixel dashboard → terminal-native art; shipped stack-pack system + 4 packs, demo on-ramp, benchmark harness; ran a 4-arm spike that reframed the product thesis (delta = VERIFICATION not generation); committed the oracle-gate spec + flagship eval suite. Next: BUILD the oracle-gate system.

## Completed (committed, main)
- [x] Terminal-native art: pixel dashboard killed, HUD + summary card (3c34212, merge 744fd38)
- [x] Stack-pack infra: stack-detect/stack-pack/template/SessionStart wire (3115b0a, merge 2a4150c)
- [x] 4 stack packs: RN, Next.js, Spring Boot, FastAPI (a2ef507)
- [x] superx-demo on-ramp (6ede9c6, merge 75ff73a)
- [x] Benchmark harness, 5 seeded tasks (8e88375, merge b3a7bf2)
- [x] Benchmark path-traversal fix — seed_files key validation (ec9a626)
- [x] 4-arm spike (exchange+emulator × superx+raw) — evidence captured
- [x] Oracle-gate SPEC + evals/flagship/ suite, self-reviewed, 8 findings fixed (4d2ce3f)

## In Progress
- (none — clean stopping point)

## Not Started — NEXT BUILD: oracle-gate system (multi-wave)
- [ ] `bin/falsify` — runs gate vs per-gate fixtures: golden (must PASS) + mutants incl tautological-concurrency (must REJECT). Exact reject string: `REJECTED: mutant survived`. `--assert-score 1.0` = caught 100% mutants + passed golden.
- [ ] Oracle library + auto-wire into waves (planner auto-selects canonical external oracle per domain)
- [ ] Differential / whole-output gate type (first-class) — proven superior to local property checks
- [ ] Seeded variable-latency interleaving / chaos harness
- [ ] Coverage matrix (declare scope gaps upfront)
- [ ] evals/oracles/exchange-lob/ + emulator gate dirs with golden+mutant fixtures
- [ ] Integrate into agents/superx.md waves + verifier agent

## Resume Instructions
Plan is at `docs/superpowers/plans/2026-06-11-oracle-gate-plan.md` (LOCAL — gitignored). Spec at `docs/superpowers/specs/2026-06-11-oracle-gate-system.md` (committed). Read both, then spawn wave-executor / parallel coders per the plan's waves. Every gate acceptance check must be PROVEN able to fail (run pass-case + fail-case). Start Wave 1 (oracle dirs + fixtures + invariant ledgers).

## Key Context / Decisions
- THESIS REFRAME (spike-proven): Opus one-shots the CODE (raw built 512-opcode GB CPU byte-exact, correct exchange). Delta is VERIFICATION: superx (a) auto-wires the external oracle, (b) makes gates falsifiable, (c) catches no-local-signal bugs (races, subsystem gaps). Headline danger = false-green oracles. Defensible claim: "superx ships VERIFIED" — NOT "writes code raw CC can't."
- FLAGSHIP demos = exchange matching engine + GB emulator (cpu_instrs) — where the delta lives. Ray tracer = calibration row only (raw CC also passes → never the headline). RN/Kotlin emulator port = phase-2 dogfood.
- Demo selection rule: every demo MUST have an external oracle (blargg/gameboy-doctor, independent reference-matcher + LOB-replay).
- Stack PACKS not stack agents (combinatorial explosion). Packs = community contribution surface.
- Agent namespacing: spawn as `superx:<name>`, never bare.
- Architect write-scope: only `.planning/*` + `docs/superpowers/specs/*` — assign evals/ creation to coder/docs-writer.
- docs-writer + architect agents have NO Bash → can't commit; orchestrator batch-commits their files.
- `docs/superpowers/plans/` is gitignored by repo convention — plans stay LOCAL, specs are committed.

## Tech Stack & Patterns
- superx = Claude Code plugin: bash bins in bin/, agents/*.md, hooks/hooks.json, skills/, commands/
- Spike artifacts were TS/JS in /tmp/spike-* (ephemeral, may be gone)
- Hooks: PreToolUse anti-fake-code scan blocks unfinished-work markers; PostToolUse auto-commit at >=5 files; SessionStart stack-detect; SessionEnd summary-card + verify-edits

## Project Settings
- Parallelism: max 10 parallel agents; disjoint-dir tasks parallelize, same-file serializes; worktree isolation for code-heavy parallel builds
- Model routing: opus = all code/architecture/review; sonnet = docs/packs/research; haiku = lint/format
- Governance: hierarchical
- Autonomy: level 2 (checkpoint — pause at milestones)
- Commit: auto-commit ON, conventional commits, --no-verify, stage specific files
- No test/lint/build command yet (plugin is bash scripts; validate via `bash -n`, `jq .`, running the bins)
- Avoid dirs: .claude/worktrees, /tmp spike dirs, node_modules
- User prefs: caveman mode (terse); AI wall-clock not calendar weeks; never fake/skeleton code; honest framing over hype; bias hard to parallel
