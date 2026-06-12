# Contributing to Heimdall

**Nothing ships unproven** — including your contribution. Heimdall is a
verification layer; the bar for adding to it is the same bar it holds your code
to. Every gate you add must be **falsifiable** (proven able to go red before it
is trusted green), and nothing here may compare a value against itself.

There are three contribution doors. Pick the one that matches what you know.

---

## The doors

### 1. Stack packs — teach Heimdall a framework

A stack pack is framework knowledge layered onto a role agent (coder /
architect / reviewer): the build/test/lint commands, directory conventions, and
the failure patterns that bite in that stack. It is the fastest way to make
Heimdall fluent in a stack you already know.

- **Where:** `skills/stacks/<stack-id>/PACK.md`
- **How:** copy [`STACK_PACK_TEMPLATE.md`](STACK_PACK_TEMPLATE.md) and replace
  every section with real, stack-specific content. Read the template's rules
  first — every command must be copy-paste runnable in a clean checkout, and
  every acceptance criterion must be a command a reviewer can run and read the
  exit code of.
- **Before you start:** confirm `bin/stack-detect` already emits your
  `<stack-id>`. If it does not, the pack will never load — extend the detector
  first.
- **Label:** `new stack pack`

### 2. Oracle packs — add a falsifiable external gate for a domain

An oracle pack is the hard, high-value door: a gate that grades a domain
against its **canonical external reference**, plus the proof the gate can fail.
This is where Heimdall earns its keep — it catches the bug class that emits no
local signal (ordering races, whole-sequence invariants, missing subsystems
that sail through a green unit-test suite).

A pack lives at `evals/oracles/<domain>/` and ships the contract artifacts:

| Artifact         | Role                                                                 |
|------------------|----------------------------------------------------------------------|
| `gate.json`      | Static descriptor: `id` (= dir name), `name`, `trigger`, `severity`. |
| `run.sh`         | The single source of diff-truth. Runs the diff, writes `report.json`.|
| `report.json`    | The 8-field typed result consumers read (never `run.sh` stdout).     |
| `run.test.sh`    | Corrupt-and-confirm tests: at least one deliberately broken golden the gate MUST report `status=fail` (R6). |
| `fixtures/`      | `golden/` (the reference) + `mutants/` (one single-defect mutant per file). |
| `report.json` schema and the consumer rule | see [`evals/oracles/REPORT-CONTRACT.md`](evals/oracles/REPORT-CONTRACT.md). |

A `hard` + `per-wave` P0 gate MUST be falsifiable:
`bin/falsify <id> --assert-score 1.0` must pass — the golden is green AND every
mutant is killed. A mutant that stays green = the gate is non-falsifiable for
that defect; harden it until the score is 1.0.

- **Read first:** [`evals/oracles/REPORT-CONTRACT.md`](evals/oracles/REPORT-CONTRACT.md)
  (the typed seam) and an existing pack — `evals/oracles/exchange-lob/` is the
  reference implementation.
- **Label:** `new oracle pack`

### 3. Corpus cases — pin a real failure so it can never ship twice

A corpus case is a deterministic, self-contained reproduction of a defect plus
the exact `first_divergence` the gate-under-test must report. The published
catch-rate time series is drawn straight from this directory; every case you add
hardens the curve.

- **Where:** `evals/corpus/<id>/` (`case.json`, `input.*`, `expected.json`;
  field-sourced cases also carry `fix.json`), then append an entry to
  `evals/corpus/INDEX.json`.
- **How:** follow [`evals/corpus/SCHEMA.md`](evals/corpus/SCHEMA.md) exactly.
  The case must be replayable bit-for-bit — seeded state, no wall-clock, no
  PRNG without a recorded seed, no network. Capture `expected.json` by
  **replaying the input through the gate's `run.sh`** — never hand-write a
  pinpoint.
- **Label:** `corpus case`

---

## Dev setup

```bash
git clone https://github.com/randomittin/heimdall.git
cd heimdall
```

Prerequisites: **Git**, **`jq`** (`brew install jq`), and **bash**. Oracle work
that runs the JS reference matchers also needs **Node**. To get a real verdict
from the security gate, install **gitleaks** (see [SECURITY.md](SECURITY.md)).

## Run the alarm suite

Before you open a PR, prove your change against the suite that proves Heimdall:

```bash
bin/falsify <domain>                          # falsifiability score for one oracle (P0 must be 1.0)
bin/falsify exchange-lob --assert-score 1.0   # exit 0 ONLY IF golden green AND every mutant killed
bin/corpus run                                # replay the whole corpus; print the per-version catch-rate
evals/oracles/<domain>/run.test.sh            # the gate's own corrupt-and-confirm tests
bin/heimdall-selfscan                         # gitleaks over Heimdall's OWN full history (clean = exit 0)
```

The same gates run as a push gate in this repo: `git push` re-triggers
`bin/falsify <domain> --assert-score 1.0` for every applicable oracle and a full
`bin/corpus run`. A non-falsifiable gate or a corpus regression blocks the push.

`bin/heimdall-selfscan` is part of the pre-push verifier surface: it runs
gitleaks over this repo's ENTIRE git history (`--log-opts=--all`), not just the
staged diff that `bin/secret-scan` checks at commit time. Agents commit with
`--no-verify`, which bypasses the pre-commit secret-scan, so the full-history
self-scan is the real backstop against a secret entering the repo. A finding
anywhere in history — or a missing gitleaks — blocks the push (exit 2). There is
no allowlist and no `.gitleaksignore`: the history must scan clean natively. The
tool that proves your code holds itself to the same bar — it scans its own
history before every push.

## The two rules that are non-negotiable

These come from `.planning/conventions.md` (R5/R6) — lessons that survived an
incident, written as enforceable rules:

- **Every gate must be falsifiable (R6).** Every "must pass" check ships a
  corrupt-and-confirm test: deliberately break the thing it validates and confirm
  the check goes RED. A check that has never been shown to fail proves nothing.
  A reference fix MUST make the corpus dip RED before it recovers — record the
  dip publicly; a corpus that never went red means the expectations were
  regenerated in the same breath as the reference.
- **No X-vs-X (R5/R6).** A reference value is not trusted until it is anchored to
  an EXTERNAL source independent of both the author and this repo's other
  fixtures. Same-family agreement (11/11, 9/9, 100%) proves consistency, never
  correctness. A gate that diffs a value against its own default truth is green
  by tautology — cite the external anchor in the fixture's provenance.

## PR expectations

- One focused change per PR. A pack, a gate, or a batch of corpus cases — not a
  grab-bag.
- The alarm suite is green locally before you push (`bin/falsify` at the required
  score for any gate you touch; `bin/corpus run` clean).
- New gates ship their `run.test.sh` corrupt-and-confirm cases in the same PR.
- New references cite their external anchor in the fixture provenance.
- Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`,
  `chore:`, `refactor:`).
- Real, working code only — no incomplete-and-marked-for-later code, no fake
  data. The repo's content scan enforces this on every Write/Edit.
- Security: never commit a credential. The secret-scan gate will catch it, but
  the goal is that it never has anything to catch — see [SECURITY.md](SECURITY.md).

By contributing you agree your work is licensed under the repo's
[MIT License](LICENSE). All participation is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md).
