---
name: bench
description: Reproduce the public benchmark table on your own machine (spec S-5). Runs a fixed suite of coding tasks under two arms — raw Claude Code vs Heimdall — and PRODUCES real numbers (tokens, wall time, tests passing, cost) by actually running them. Never hardcodes results. Safe by default (dry mode: validates the suite + prints the capture plan, zero API spend). Use when someone asks "are your benchmark numbers real?" or wants to reproduce the table.
disable-model-invocation: true
---

# /hmd:bench — reproduce the public benchmark table

Runs `bin/heimdall-bench` — the documented entry door over the measurement
harness (`bin/benchmark`). It does NOT invent numbers: it produces them by
running a fixed suite of representative coding tasks under two arms (raw Claude
Code vs Claude Code driven through Heimdall) and emitting the exact table format
the published `evals/` table uses. The number in any Heimdall claim is one a
stranger can reproduce here.

## When to use

- Someone challenges a benchmark number — point them at `heimdall bench` so they
  reproduce it on their own machine instead of trusting the README.
- Before a launch, to regenerate the table on a pinned model (the flagship).
- To see, with zero API spend, exactly what a real run measures.

## Instructions

1. **Always start dry (the default).** Validates the suite and prints the
   capture plan with NO API calls and NO agents spawned:

   ```
   heimdall-bench
   heimdall-bench --dry          # explicit, identical
   ```

   This lists every task, its category, and its `verify[]` steps, then prints
   the exact arm commands a live run would issue and what each metric is parsed
   from. A cold stranger can run this without burning a token.

2. **Run live only when the user opts in.** A `--live` run invokes the `claude`
   CLI for every task × arm and spends real API tokens. Pin the model for a
   reproducible, publishable table:

   ```
   heimdall-bench --live --model <model-id>
   ```

   It writes `evals/benchmark/results.jsonl` (one machine-readable line per
   task × arm) and `evals/benchmark/results.md` (the published-format markdown
   table). Numbers come from the CLI's own usage accounting and from actually
   running each task's `verify[]` — nothing is hand-tuned.

3. **Reprint the last live table** without re-running:

   ```
   heimdall-bench --table
   ```

4. **Honesty principle.** Publish everything measured, including tasks where
   Heimdall *loses* on tokens, wall time, or cost. A pricier arm that ships
   `7/7` beats a cheaper arm that ships `3/7`; hiding the trade-off would make
   the whole table untrustworthy.

## Flags

- `--dry` — validate the suite + print the capture plan, zero API. **(default)**
- `--live` — actually invoke Claude and measure (spends API tokens).
- `--model <id>` — model id passed through to the Claude CLI (pin the flagship).
- `--task <id>` — run a single task by id (default: the whole suite).
- `--arm raw|heimdall|both` — which arm(s) to run (default: `both`).
- `--interventions N` — record N human interventions for a manual run (default 0).
- `--table` — print the published-format table from the last live run.
- `-h`, `--help` — show usage.

## Prerequisites

- **Dry mode (default):** `bash` + `jq` only — runs on any fresh machine, no API.
- **`--live` mode:** additionally the `claude` CLI with valid auth.

## What the orchestrator should do

`heimdall-bench` is a shell tool meant to be run directly. When a user asks to
"run the benchmark", "prove the numbers", or "reproduce the table", run it and
surface its output verbatim. Default to dry; only pass `--live` when the user
explicitly accepts the token spend.

## Related

- Script: `bin/heimdall-bench` (entry) → `bin/benchmark` (measurement harness)
- Suite + format docs: `evals/benchmark/README.md`
- Task definitions: `evals/benchmark/tasks/`
