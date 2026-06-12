# `heimdall debloat` — retroactive whole-repo bloat removal (H-2ii)

`bin/heimdall-debloat` is the adoption hook for the H-2 bloat machinery. Where
the per-wave bloat gate (`bin/bloat-gate`) measures the NEW code in a single
diff, `debloat` points the *same deterministic engine* at an ENTIRE existing
repository and produces a scorecard plus, when it is safe, a gated refactor PR.

## The pipeline

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 1. SCORECARD (read-only, zero-risk)                                       │
  │    bloat-gate over empty-tree..HEAD  →  every tracked file scored as      │
  │    "new code"  →  BLOAT-REPORT.md (dead/dup/complexity/deps + LOC est).   │
  │    --report-only STOPS here. Runs on a cold repo with no setup.           │
  └─────────────────────────────────────────────────────────────────────────┘
                                   │ (refactor requested)
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 2. SAFETY ORACLE (absolute rule)                                          │
  │    A test command must EXIST and PASS on a clean checkout. No suite →     │
  │    REFUSE (exit 3) with the --generate-characterization-tests path.       │
  │    We never refactor code we cannot verify.                               │
  └─────────────────────────────────────────────────────────────────────────┘
                                   │ (oracle green)
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 3. REFACTOR WAVES (most → least mechanical), each GATED by:               │
  │      full suite stays green  +  bloat metric improves monotonically       │
  │      (a) dead-code deletion  (b) unused-dep removal                        │
  │      (c) duplication consolidation  (d) complexity reduction              │
  │    A wave that fails its gate is reverted with `git reset --hard`.        │
  └─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 4. OUTPUT = A PR, never a direct commit                                   │
  │    branch heimdall/debloat-{date}, one atomic commit per applied wave,    │
  │    auto-written PR body (before/after scorecard, per-wave map, "every     │
  │    test that passed before passes now").                                  │
  └─────────────────────────────────────────────────────────────────────────┘
```

## Why it reuses `bin/bloat-gate`

`bloat-gate` already implements the five deterministic axes (dead code,
duplication, complexity, dependency creep, LOC budget) with the honest-skip
contract: an absent tool reports `status:skipped` (named), never a faked pass.
`debloat` does not re-implement any of that — it drives the gate over the
whole-repo range (`<empty-tree>..HEAD`) so every tracked file is treated as new
code, then formats the structured `report.json` into a human scorecard. The
determinism and honesty guarantees are inherited end-to-end.

## Safety guarantees

- **`--report-only` makes zero source changes.** Its only artifact is
  `BLOAT-REPORT.md` (an untracked output file); the tracked tree is left clean.
- **No verifiable suite → no refactor.** A debloat that silently breaks
  production once would kill the feature forever, so the test-suite gate is
  absolute, not advisory.
- **Caps & exclusions.** Default −20% LOC per PR (lift with `--aggressive`);
  generated code and migrations are excluded via `.planning/bloat.json`
  `exclude_globs`.
- **Never auto-deletes the unprovable.** Public API surface, dynamic usage, and
  no-coverage regions are reported as manual-review candidates only.

## Usage

```sh
# zero-risk scorecard
bin/heimdall-debloat --report-only --repo /path/to/repo

# scaffold characterization tests when no suite exists
bin/heimdall-debloat --generate-characterization-tests --repo /path/to/repo

# gated refactor PR (requires a green test suite)
bin/heimdall-debloat --repo /path/to/repo --test-cmd 'npm test'
```

See `bin/heimdall-debloat --help` for the full flag set and exit codes.
