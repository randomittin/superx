# Oracle-Gate Report Contract (spec 2A)

The structured, TYPED seam every oracle gate exposes. The orchestrator, the
benchmark protocol, the ledger, and `bin/falsify` consume gate results **only**
through this contract. They read `report.json`; **they never parse `run.sh`
stdout.** Emitting the divergence pinpoint only to stdout was the anti-pattern
this contract exists to kill: stdout is for humans, `report.json` is for machines.

A gate lives at `evals/oracles/<domain>/` and ships three contract artifacts:

| Artifact      | Role                                                              |
|---------------|-------------------------------------------------------------------|
| `gate.json`   | Static gate descriptor (identity, trigger, severity).             |
| `run.sh`      | The structured entry point. Runs the diff, writes `report.json`.  |
| `report.json` | The typed result `run.sh` writes. The SINGLE thing consumers read.|

`run.sh` is the **single source of diff-truth** for its domain. No consumer
re-implements the diff. `bin/falsify` is a pure orchestrator over this seam: it
invokes `run.sh --input <fixture> --report <tmp>` and reads `report.json`.

---

## 1. `gate.json` — the static gate descriptor

A small JSON object identifying the gate. Fields:

| Field      | Type   | Meaning                                                        |
|------------|--------|----------------------------------------------------------------|
| `id`       | string | Stable gate id. MUST equal the `<domain>` dir name and the `gate_id` written into `report.json`. |
| `name`     | string | Human-readable gate name.                                      |
| `trigger`  | enum   | When the gate runs. One of: `per-wave`, `per-commit`, `pre-merge`, `manual`. |
| `severity` | enum   | Build impact of a `fail`. One of: `hard` (blocks the build), `soft` (advisory / non-blocking). |

A `hard` + `per-wave` P0 gate must additionally be falsifiable: `bin/falsify
<id> --assert-score 1.0` must pass.

Example (`exchange-lob/gate.json`):

```json
{
  "id": "exchange-lob",
  "name": "Exchange LOB whole-output differential gate",
  "trigger": "per-wave",
  "severity": "hard"
}
```

---

## 2. `run.sh` — the structured entry point (I/O contract)

```
run.sh [--input <path>] [--report <out-path>] [domain-specific flags...]
```

| Flag       | Required | Meaning                                                        |
|------------|----------|----------------------------------------------------------------|
| `--input`  | no(1)    | The subject to grade: a fixture (golden/mutant) or, at benchmark time, the live target's captured output. Defaults to the domain's golden fixture (and/or a live-target command wired via the registry / `GB_TRACE_CMD`). |
| `--report` | no       | Where to WRITE `report.json`. Defaults to `evals/oracles/<domain>/report.json`. |
| `-h`,`--help` | no    | Print usage, exit 0.                                           |

(1) Optional only because each gate has a sensible default input (its golden, or
a benchmark-time live-target hook). Consumers should pass `--input` explicitly.

**Exit codes (uniform across gates):**

| Exit | Meaning                                                                 |
|------|------------------------------------------------------------------------|
| `0`  | Gate PASS. `report.json` written with `status: "pass"`.                |
| `1`  | Gate FAIL. `report.json` written with `status: "fail"`.                |
| `2`  | Usage / IO error. No valid `report.json` producible (bad args, missing input, missing `jq`). |

**Invariant:** for exit `0` and exit `1`, `run.sh` MUST have written a valid
`report.json` whose `status` matches the exit code. The exit code is a
convenience mirror of `report.json.status`; the typed field is authoritative.
On exit `2`, consumers must treat the result as "no usable report" — not as a
pass or a fail.

---

## 3. `report.json` — the typed result (schema)

A single JSON object. Schema shared by ALL gates:

| Field              | Type             | Meaning                                                          |
|--------------------|------------------|------------------------------------------------------------------|
| `gate_id`          | string           | Echoes `gate.json.id`. Identifies which gate produced this report.|
| `status`           | enum             | `"pass"` or `"fail"`. The authoritative result. The ONLY field a pass/fail decision reads. |
| `first_divergence` | string \| null   | The pinpoint of the first divergence when `status == "fail"`; `null` when `status == "pass"`. A human-readable, machine-stored locator (e.g. `"trade index 0: expected ... actual ..."`, `"instruction 4: expected ... actual ..."`). Read this field — do NOT scrape it from stdout. |
| `metrics`          | object           | DOMAIN-SPECIFIC, open-keyed (see section 4). Diagnostic counters.|
| `fix_hint`         | string           | Actionable next step for whoever must fix the divergence.        |

**Example — pass** (`exchange-lob` golden):

```json
{
  "gate_id": "exchange-lob",
  "status": "pass",
  "first_divergence": null,
  "metrics": { "trades_compared": 3, "seeds_swept": 1, "arm": "whole-output-differential" },
  "fix_hint": "Whole fill sequence and post-stream book equal the independent serial-replay reference at every index — no action needed."
}
```

**Example — fail** (`emulator-gb` mutant):

```json
{
  "gate_id": "emulator-gb",
  "status": "fail",
  "first_divergence": "instruction 4: expected A:01 F:10 ... actual A:01 F:00 ...",
  "metrics": { "instructions_compared": 4, "truth_instructions": 5, "subject_instructions": 5, "divergence_index": 4 },
  "fix_hint": "First divergence at instruction 4. Compare expected (truth) vs actual (mine) field-by-field..."
}
```

---

## 4. `metrics` is DOMAIN-SPECIFIC and open-keyed

**Rule: consumers MUST NOT assume any fixed set of metric keys.** `metrics` is an
open-keyed object whose contents vary by gate. Treat unknown keys as opaque
diagnostics; read a specific key only when you know the gate that produced it
(`gate_id`). The fixed, gate-agnostic fields are `gate_id`, `status`,
`first_divergence`, and `fix_hint` — `metrics` is explicitly NOT fixed.

Current per-domain keys (illustrative, not exhaustive — gates may add more):

| Domain         | `metrics` keys                                                                              |
|----------------|----------------------------------------------------------------------------------------------|
| `exchange-lob` | `trades_compared`, `seeds_swept`, `arm` (`whole-output-differential` \| `post-stream-book-differential` \| `seeded-variable-latency-interleave`) |
| `emulator-gb`  | `instructions_compared`, `truth_instructions`, `subject_instructions`, `divergence_index`    |

A consumer that needs, say, `trades_compared` must first confirm
`gate_id == "exchange-lob"`. There is no cross-gate metric guaranteed to exist.

---

## 5. The consumer rule (normative)

1. Invoke `run.sh --input <subject> --report <path>`.
2. Read the result from `report.json` at `<path>` — **never** from `run.sh` stdout.
3. Branch on `report.json.status` (`pass`/`fail`). Use `first_divergence` for the
   failure locator. Use `metrics` only with knowledge of `gate_id`.
4. Treat a missing/unparseable `report.json` (e.g. `run.sh` exit 2) as an error,
   not as a pass or a fail.

`bin/falsify` is the reference consumer: it drives golden + every mutant through
`run.sh` and reads `report.json.status` / `report.json.first_divergence`, with
zero diff logic of its own.
