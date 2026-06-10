---
name: demo
description: The first-five-minutes wow. Scaffolds a fully-specified canned task (a real Todo REST API + single-page frontend + tests + README) into a fresh project dir and hands you the exact command to watch superx build it end-to-end. Safe by default (dry mode) — never auto-executes without --run. Use when demoing superx to someone new, or when you want a zero-thought way to see superx build a real full-stack app.
---

# /superx:demo — watch superx build a real app in one command

## What this command does

Runs `bin/superx-demo` — a standalone, zero-model-cost shell script that gives a
stranger evaluating superx the first-five-minutes wow: ONE command, then they
watch superx build a small but real full-stack app, without having to invent a
good prompt themselves.

It does NOT touch `bin/superx`, the dashboard, hooks, or skills — it is a thin
on-ramp that:

1. Prints a tight branded banner (truecolor with plain fallback, matching
   `install.sh` color detection — rendered in shell, no model tokens).
2. Scaffolds a fresh project dir (default `./superx-demo-app`, or the first
   positional arg).
3. Writes a fully-specified canned task to `<dir>/.superx-demo-task.md` and a
   ready-to-run plan seed to `<dir>/.planning/PLAN.md`.
4. Prints the exact paste-ready command to hand superx so the magic starts.

## How to invoke

From a terminal (this is a shell tool, not a model loop):

```
superx-demo [dir] [--dry|--run] [--force]
```

Examples:

```
superx-demo                     # scaffold ./superx-demo-app (safe, dry)
superx-demo /tmp/demo           # custom target dir
superx-demo --run               # scaffold AND launch superx on the task
superx-demo ./demo --force      # overwrite an existing scaffold
```

## Flags

- `[dir]` — target project directory (default: `./superx-demo-app`).
- `--dry` — **(default)** scaffold the dir + print the exact prompt and the
  paste-ready command. Executes nothing — safe to run blind.
- `--run` — scaffold AND launch superx on the task via the documented entrypoint
  (`superx "<prompt>"`). Requires `superx` on PATH; if absent, it warns and
  falls back to dry output.
- `--force` — overwrite the target dir if it already exists (idempotency guard:
  without it, an existing dir warns instead of clobbering).
- `-h`, `--help` — print usage.

## Safe by default

Dry mode is the default and never runs destructive or expensive work — it only
writes files and prints the command you should paste. Auto-execution requires the
explicit `--run` flag. This keeps `superx-demo` safe to run sight-unseen during a
demo.

## The canned task

The scaffolded task (`<dir>/.superx-demo-task.md`) is a real, fully-specified
build — not a vague "make an app". It is scoped to ~5 files with runnable
acceptance criteria baked in, so the result is verifiable and impressive:

**A Todo full-stack app:**

- **Backend** — Python 3 + FastAPI + Uvicorn (`app.py`), Pydantic models,
  in-memory store. Five real endpoints:
  - `GET /api/todos`, `POST /api/todos` (422 on empty title),
    `PATCH /api/todos/{id}` (404 on unknown), `DELETE /api/todos/{id}` (204 / 404),
    `GET /` (serves the HTML page).
- **Frontend** — one self-contained `index.html` (vanilla JS + fetch, no build
  step): list / add / toggle-complete / delete.
- **Tests** — `pytest` + FastAPI `TestClient` (`test_app.py`) covering every
  acceptance criterion.
- **Docs** — `README.md` with exact install / run / test commands.

**Runnable acceptance criteria** (these ship in the task file):

1. `pip install -r requirements.txt` succeeds.
2. `pytest -q` → all tests pass, exit 0.
3. `uvicorn app:app` boots and `GET /` returns the HTML page.
4. `curl -s localhost:8000/api/todos` returns valid JSON.
5. README documents the exact commands.
6. Every endpoint fully implemented — no unfinished markers, no fake data.

A matching plan seed (`<dir>/.planning/PLAN.md`) lays out three waves
(backend core → frontend + tests → docs + verify) so superx starts with momentum.

## What the orchestrator should do

`superx-demo` is a shell tool meant to be run directly. When a user asks to "demo
superx" or "show me what superx can do", run it and surface its output verbatim,
then point them at the printed paste-ready command. Default to dry mode; only pass
`--run` if the user explicitly wants superx launched immediately.

## When NOT to use

- The user already has a specific real task in mind → just run
  `superx "<their task>"`; the demo on-ramp adds nothing.
- You want to bootstrap a React Native visual-parity workflow → use
  `/superx:designmatch` instead.

## Related

- Script: `bin/superx-demo`
- Real entrypoint the demo hands off to: `bin/superx` (`superx "<task>"`)
- Installer / color-detection reference: `install.sh`
