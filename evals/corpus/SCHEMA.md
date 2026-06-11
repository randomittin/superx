# Case Corpus — schema & contract (H-8)

The corpus is the data flywheel: gate machinery is copyable, accumulated *scored
failure data* is not. Each case is a deterministic, self-contained reproduction of a
defect plus the exact `first_divergence` the gate-under-test MUST report. The published
time series — *corpus catch-rate per Heimdall version* — is drawn from this directory.

This file is the normative contract for what a case dir is, how it is graded, and how
the runner (`bin/corpus`, separate task) consumes it. It pairs with the oracle report
contract in `evals/oracles/REPORT-CONTRACT.md` — a case *feeds* a gate's `run.sh` and
asserts the gate's `report.json`.

---

## 1. Case directory layout

A case lives at `evals/corpus/{id}/` and ships exactly these artifacts:

| Artifact        | Required | Role                                                                            |
|-----------------|----------|---------------------------------------------------------------------------------|
| `case.json`     | yes      | Case descriptor (identity, provenance, gates-under-test, difficulty, seed).     |
| `input.*`       | yes      | The seeded, self-contained repro the gate grades. Extension matches the gate's `--input` contract (`.json` for `exchange-lob`, `.gbdoctor` for `emulator-gb`). |
| `expected.json` | yes      | The expected gate verdict: `status` + the exact `first_divergence` string/locator the gate must emit. |
| `fix.json`      | field    | (field-sourced cases only) the fix commit ref + the commit that closed the gap. N/A for mutation seeds. |

The case is **self-contained**: `input.*` embeds (or references a *resident* repo
fixture) everything needed to reproduce the divergence. A case MUST NOT depend on
`/tmp` scratch, network, or any state outside `evals/`.

### `case.json` schema

```json
{
  "id":               "string  — stable case id; equals the dir name",
  "source":           "mutation | field | user",
  "gates_under_test": ["exchange-lob"],
  "difficulty":       "trivial | easy | moderate | hard",
  "added_in_version": "0.1",
  "seed":             "string|number — the deterministic seed pinning this repro",
  "repro":            { "input": "input.json", "expected": "expected.json" },
  "defect":           "one-line human description of the injected/observed defect",
  "invariants":       ["I1"]
}
```

`id`, `source`, `gates_under_test` (array), `added_in_version`, and `seed` are the
fixed, runner-read fields. `difficulty`, `defect`, `invariants`, `repro` are
diagnostic/manifest sugar.

### `expected.json` schema

```json
{
  "status":                   "fail",   // one of: "fail" (caught defect) | "pass" (known-good) | "error" (ungradable input — R-6)
  "first_divergence": {                  // spec H-1 STRUCTURED object (not a string)
    "file":     "exchange-lob",
    "step":     "trade index 0 (reference len=1 actual len=1)",
    "expected": "{\"makerId\":1,\"price\":99,\"qty\":5,\"takerId\":2}",
    "actual":   "{\"makerId\":1,\"price\":105,\"qty\":5,\"takerId\":2}"
  },
  "first_divergence_summary": "trade index 0: expected price 99 actual price 105",
  "gate":                     "exchange-lob"  // which gate-under-test this verdict belongs to
}
```

`status` + `first_divergence` mirror the oracle `report.json` fields the runner asserts
against. For a mutation case, `status` is always `"fail"` (the gate must catch it) and
`first_divergence` is the non-null `{file, step, expected, actual}` object the gate emits
(REPORT-CONTRACT.md §3).

### `status` enum

`status` is one of three values — the verdict the case asserts the gate emits:

| `status` | Meaning                                                                                          | `first_divergence` |
|----------|--------------------------------------------------------------------------------------------------|--------------------|
| `"fail"` | The gate CAUGHT a defect (the mutation-case norm). Pinned `first_divergence` object is asserted. | non-null object    |
| `"pass"` | The gate stayed green on a known-good case (a false-RED guard, e.g. `exchange-c2-locked`).        | `null`             |
| `"error"`| The input is UNGRADABLE — a check over nothing proves nothing (R-6 empty-stream). The gate refused to grade and the runner exited 2 (IO error — NOT pass, NOT fail). | `null` or a diagnostic locator object; the runner asserts only `status` for error cases. |

- **`"error"` (R-6).** An empty trade stream (exchange) or an empty instruction
  trace (emulator) cannot be graded: a lockstep diff over zero elements finds no
  divergence and would false-GREEN at zero work. Both gates' `run.sh` require
  `ref_len >= 1` AND `subj_len >= 1`; otherwise they write `status:"error"` and exit
  2. An expected-error corpus case (`source: "mutation"`, `status: "error"`) is a
  CATCH iff the gate emits `status == "error"`. Because there is no defect to
  pinpoint, an error case does NOT pin a `first_divergence` and the runner does NOT
  assert one for it (the byte-equality pin applies only to `"fail"` cases). The
  seeded `error` cases are `exchange-empty-stream` and `emulator-empty-trace`.

- **`first_divergence` is the EXACT object the gate's `run.sh` emits** into
  `report.json.first_divergence` — the runner asserts **byte-equality** after
  canonicalizing both sides through `jq -cS` (sorted keys), so the compare is
  key-order-independent. It is captured by replaying the case through the gate, never
  hand-paraphrased; a drift means either a gate regression or a stale case (both are
  signal). This is the determinism law applied to the verdict: same case + same gate
  version → byte-identical pinpoint object.
- **`first_divergence_summary`** is the human-readable, field-level paraphrase (the form
  the MUTATION-PROOF tables use). Diagnostic only — the runner does NOT assert on it.

A correct/golden artifact is NOT a case — the corpus stores caught defects, not the
absence of one.

---

## 2. The determinism law

> Every case ships seeded state. Non-reproducible ≠ a case.

- The repro is fully determined by `input.*` + the gate's `run.sh`. Running the same
  case through the same gate version yields a byte-identical `report.json` every time.
- `seed` in `case.json` pins any stochastic dimension (seed sweep, interleave schedule).
  For static fixtures the seed is the fixture identity itself (`"static"` or the
  resident fixture name) — it still names a single reproducible state.
- No wall-clock, no PRNG without a recorded seed, no external fetch. A case that cannot
  be replayed bit-for-bit is rejected at intake.

---

## 3. Intake sources

| `source`   | Origin                                                                                       | Approval                |
|------------|----------------------------------------------------------------------------------------------|-------------------------|
| `mutation` | The flagship mutation proofs — each injected single-defect mutant that a gate caught.        | Seeded now (v0.1).      |
| `field`    | A real gate-failure captured in the field: repro + divergence + the fix commit that closed it. | Human-approved in; carries `fix.json`. |
| `user`     | Community / external submissions, alongside stack packs.                                      | Human-approved in.      |

The v0.1 seed is the 9 mutation proofs (5 exchange + 4 emulator). Field and user cases
accumulate the corpus over time; the version-stamped catch-rate curve only impresses
when long, so the series starts now at 9.

### 3.1 Live-style cases (engine-captured C2 — R-3.2)

The first two **live-style** `mutation` cases are `exchange-c2-racy` and `exchange-c2-locked`.
They differ from the hand-authored mutation seeds only in PROVENANCE: their `input.*` carries a
real trade sequence **captured by running a subject engine through the C2 seeded
variable-latency differential arm** (`evals/oracles/exchange-lob/differential.run.mjs`), not a
hand-edited reorder. The on-disk shape is unchanged — `bin/corpus`/`run.sh` grade them through
the existing seams — so no runner change is required:

- **`exchange-c2-racy`** (expected `fail`): the racy engine (`fixtures/engines/racy.mjs`) awaits
  the per-id latency hook BEFORE the read-match-mutate critical section. Its `corrupted_trades`
  is the engine's actual concurrent output at the pinned `live_provenance.seed`; `correct_trades`
  is the reference serial replay. `run.sh` diffs them and rejects at the first-divergence index —
  the same pinpoint the live arm reports. This is the make-it-fail proof, frozen as a case.
- **`exchange-c2-locked`** (expected `pass`): the locked engine (`fixtures/engines/locked.mjs`)
  serializes the critical section behind a FIFO mutex; its concurrent whole-output equals the
  serial replay across all swept seeds. The case ships `expected_trades`/`expected_book` (the
  serial replay) and asserts the gate stays GREEN — a **false-RED guard** (a known-good fix the
  gate must not reject). `bin/corpus` already scores an expected-`pass` case as a CATCH iff the
  gate stays green; such a known-good case is admitted ONLY as the paired discriminator for a
  live make-it-fail case, never on its own.

Both cases pin `live_provenance` (arm, engine path, seed, submits, first-divergence index) in
`input.json` so the live-vs-fixture equivalence is auditable and the capture is reproducible.

---

## 4. How the runner consumes a case

`bin/corpus` (separate task) is a pure orchestrator over this seam — it owns no diff
logic, exactly as `bin/falsify` is a pure orchestrator over `run.sh`:

1. Read `INDEX.json` → the manifest of `{id, source, gates_under_test, difficulty}`.
2. For each case, for each `gate` in `gates_under_test`:
   - Invoke `evals/oracles/<gate>/run.sh --input evals/corpus/<id>/<input.*> --report <tmp>`.
   - **Truth resolution (`emulator-gb`):** the case `input` is a mutant trace graded
     against a reference. If `case.json.repro.truth` is present, pass it as `--truth`
     (resolve the path relative to the case dir — e.g. `emulator-daa` ships its own
     `truth.gbdoctor`; the resident-backed cases point at
     `../../oracles/emulator-gb/fixtures/golden/trace.gbdoctor`). `exchange-lob` needs no
     `--truth` — its run.sh derives the serial-replay reference from the input's
     `orders`/`correct_*` fields.
   - Read `<tmp>` per `REPORT-CONTRACT.md` (`status`, `first_divergence`) — never parse
     `run.sh` stdout.
3. Assert the gate's `report.json.status` == `expected.json.status` AND
   `report.json.first_divergence` == `expected.json.first_divergence` (byte-equality on
   the canonical `jq -cS` form of the structured `{file, step, expected, actual}` object).
   - **catch** = both match. For an expected-`fail` case: the gate went `fail` at the
     pinned pinpoint. For an expected-`pass` case: the gate stayed green. For an
     expected-`error` case (R-6): the gate emitted `status == "error"` (the input was
     correctly refused as ungradable — error ≠ catch-of-a-defect, but for an
     expected-error case a matching `error` status IS the catch). No `first_divergence`
     is asserted for an error case.
   - **miss** = the status does not match the expectation (e.g. an expected-`error`
     case where the gate `pass`ed or `fail`ed — the empty-stream false-green slipped
     through), or, for an expected-`fail` case, the pinpoint diverges — the gate is a
     false-green for this case and the run is RED.
4. Aggregate: per-case catch/miss, per-gate catch-rate, **corpus catch-rate for this
   Heimdall version** (the published time series). `heimdall bench` draws from this.

### CI inversion

The full corpus runs on every change to Heimdall itself: gates are regression-tested by
the failures they once caught. A case that flips from catch→miss is a regression in the
gate, not in the case.

### Rule distillation

3+ cases sharing a root pattern graduate into a convention / stack-pack rule (the
designmatch checklist move, automated). Cases *catch*; rules *prevent*.

---

## 5. `INDEX.json` — the manifest

```json
{
  "version": "0.1",
  "cases": [
    { "id": "exchange-crossed-trade", "source": "mutation",
      "gates_under_test": ["exchange-lob"], "difficulty": "moderate" }
  ]
}
```

`version` is the Heimdall corpus version the catch-rate series is stamped with. `cases`
is the ordered list the runner iterates. Adding a case = append an entry + ship its dir.
