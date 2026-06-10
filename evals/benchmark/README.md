# superx benchmark harness

Honest receipts: **superx** vs **raw Claude Code**, measured on a fixed suite of
representative coding tasks. The harness lives in [`bin/benchmark`](../../bin/benchmark)
and the task definitions in [`tasks/`](./tasks/).

## The honesty principle

This harness exists to produce numbers we can stand behind, not marketing.

- **Publish everything we measure** — including tasks where superx *loses* on
  tokens, wall time, or cost. A slower/pricier arm that produces more passing
  tests is a real trade-off; hiding it would make the whole table untrustworthy.
- **Real mechanisms, no fabricated numbers.** Tokens come from the Claude CLI's
  own usage accounting; wall time is measured with a monotonic-ish nanosecond
  clock; "tests passing" is the result of actually running each task's
  verification commands. Nothing is hand-tuned.
- **Same task, same prompt, same workspace seed for both arms.** The only
  difference between arms is *how Claude is driven* (raw vs the superx
  agent + plugin + goal preamble), so any delta is attributable to superx.

If superx is not worth it on a task, the table should say so. That credibility
is the differentiator.

## What the suite measures

Five fixed tasks, each chosen to exercise a different superx strength:

| ID | Category | Why it is here |
| --- | --- | --- |
| `01-multifile-feature` | multi-file feature | parallel decomposition across new files sharing one contract |
| `02-bugfix-with-tests` | bug fix with tests | root-cause a real failing test in seeded buggy code without breaking green ones |
| `03-lint-refactor-batch` | lint/refactor batch | broad mechanical cleanup where many small edits must all land |
| `04-fullstack-scaffold` | small full-stack scaffold | server + client + integration test that must agree on a contract |
| `05-docs-and-tests` | docs + tests for existing module | comprehend existing code, then produce accurate docs and meaningful coverage |

Each task is a self-contained JSON file with a real prompt, a `setup` block that
scaffolds a throwaway workspace, optional `seed_files` (e.g. the buggy code for
the bugfix task), and a `verify` array of runnable acceptance commands. Tasks
02, 03, and 05 ship seeded source so the bug / messy code / undocumented module
is identical on every run.

## Running it

The harness defaults to **`--dry`** — running it with no flags validates the
suite and prints the capture plan **without hitting the API or spawning any
agents**. This makes it safe to run in CI or during development.

```sh
# Validate the suite + show exactly what a live run WOULD measure. No API calls.
bin/benchmark --dry          # (also the default: `bin/benchmark`)

# Dry-run a single task.
bin/benchmark --task 03-lint-refactor-batch --dry

# LIVE run (spends API tokens). Runs both arms on all tasks and measures for real.
bin/benchmark --live

# Live, one task, one arm.
bin/benchmark --task 02-bugfix-with-tests --arm superx --live

# Live, recording that a human stepped in twice during this manual run.
bin/benchmark --task 01-multifile-feature --arm raw --live --interventions 2

# Pass a specific model through to the Claude CLI.
bin/benchmark --live --model claude-opus-4-8
```

### Flags

| Flag | Meaning |
| --- | --- |
| `--task <id>` | run a single task by id (default: all 5) |
| `--arm raw\|superx\|both` | which arm(s) to run (default: `both`) |
| `--dry` | validate + print plan, capture nothing (**default**) |
| `--live` | actually invoke Claude and measure |
| `--interventions N` | human-intervention count to record for this run (default `0`) |
| `--model <id>` | model id passed through to the Claude CLI |

## How capture works (real mechanisms)

For every task × arm in a `--live` run:

1. A fresh scratch workspace is created under `$TMPDIR`, its `seed_files` are
   written, its `setup` steps run, and it is committed to a throwaway git repo
   (so `git diff`-based verify steps work). Workspaces are deleted on exit.
2. The arm's Claude command is built:
   - **raw**: `claude -p <prompt> --output-format json --permission-mode acceptEdits`
   - **superx**: the same, plus `--agent superx --plugin-dir <repo>` and the
     prompt wrapped in superx's `/goal …` preamble.
3. Wall-clock time is measured with `date +%s%N` immediately around the
   invocation (nanoseconds → seconds, 2 d.p.).
4. Token usage and cost are parsed from the CLI's JSON result:
   - tokens (input) = `.usage.input_tokens + .usage.cache_read_input_tokens + .usage.cache_creation_input_tokens`
   - tokens (output) = `.usage.output_tokens`
   - cost = `.total_cost_usd`, turns = `.num_turns`, error flag = `.is_error`
5. The task's `verify[]` commands are run in the workspace; `passed/total` is
   recorded. This is the "tests passing" metric — it is the genuine pass count,
   not a self-report from the model.
6. Human interventions default to `0` for automated runs. For a manual
   side-by-side comparison, drive one arm/task at a time and pass
   `--interventions N` to record how many times a human had to step in (correct
   the agent, unstick it, answer a question). The field exists precisely so
   manual runs are comparable to automated ones.

## Outputs

A `--live` run writes three things:

### 1. stdout table

```
TASK                        ARM         TOKENS   WALL(s)      TESTS    TURNS   HUMAN  COST($)
--------------------------  -------  ----------  --------  ---------  -------  ------  -------
01-multifile-feature        raw           41230     92.41        5/7        8       0  0.182
01-multifile-feature        superx        58910    141.07        7/7       14       0  0.274
```

### 2. `results.jsonl` — machine-readable, one line per task × arm

Schema (one JSON object per line):

| Field | Type | Meaning |
| --- | --- | --- |
| `ts` | string (ISO-8601 UTC) | when this record was written |
| `task` | string | task id (matches a file in `tasks/`) |
| `arm` | string | `raw` or `superx` |
| `mode` | string | always `live` for emitted records |
| `tokens.input` | int | input + cache-read + cache-creation tokens |
| `tokens.output` | int | output tokens |
| `tokens.total` | int | `input + output` |
| `wall_seconds` | number | wall-clock seconds for the Claude invocation |
| `cost_usd` | number | `.total_cost_usd` from the CLI |
| `turns` | int | `.num_turns` from the CLI |
| `tests.passed` | int | how many `verify[]` commands passed |
| `tests.total` | int | how many `verify[]` commands ran |
| `human_interventions` | int | value of `--interventions` for this run |
| `claude_error` | bool | `.is_error` — true if the CLI itself reported a failure |

Example line:

```json
{"ts":"2026-06-11T12:00:00Z","task":"02-bugfix-with-tests","arm":"superx","mode":"live","tokens":{"input":38110,"output":9044,"total":47154},"wall_seconds":78.22,"cost_usd":0.211,"turns":11,"tests":{"passed":4,"total":4},"human_interventions":0,"claude_error":false}
```

### 3. `results.md` — markdown table fragment

A ready-to-paste fragment for the launch `BENCHMARKS.md`. It is **overwritten on
every `--live` run**. The version committed in this directory contains
illustrative example rows only (all zeros) to show the format — those are not
real measurements and must not be published.

## Interpreting results

- **Tokens / cost**: superx typically spends *more* on a given task (it plans,
  spawns sub-agents, runs quality gates). The interesting question is whether
  that buys a better `tests.passed/total` and fewer `human_interventions`.
- **Wall time**: parallel decomposition can make superx faster on multi-file
  tasks and slower on trivial ones (orchestration overhead). Expect the sign of
  the delta to flip across task categories — and report it honestly.
- **Tests passing** is the quality axis. A cheaper arm that ships `3/7` is not
  beating a pricier arm that ships `7/7`.
- **Human interventions** only carries signal for manually-driven runs; it is
  `0` for fully automated runs by construction.

## Adding a task

Drop a new `NN-name.json` in `tasks/` with these fields:

- `id`, `title`, `category`, `strength`, `language` — metadata.
- `prompt` — the real instruction handed to both arms.
- `setup` — array of shell steps to scaffold the workspace. Use the literal
  string `"__SEED__"` as a sentinel step to mark where seed files are written
  (they are written before any setup step regardless).
- `seed_files` (optional) — object mapping relative path → file contents,
  written into the workspace before setup runs.
- `verify` — array of shell commands run in the finished workspace; each
  exit-0 counts as one passing test.

`bin/benchmark --dry` validates every task file (required fields + `verify` is an
array) before doing anything, so a malformed task fails fast.
