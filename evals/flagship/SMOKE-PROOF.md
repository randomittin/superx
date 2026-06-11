# E2E Smoke Proof — Live Gate Wiring on the H-1.1 8-Field Contract

**Gate:** `exchange-lob` (the flagship differential oracle).
**What this proves:** the RED verdict and the **structured** `first_divergence`
`{file, step, expected, actual}` pinpoint actually arrive through the **typed
`report.json`** from a **live invocation** of the contract entry point
(`run.sh --input … --report …`) — not from a hand-fed fixture and not from
stdout scraping.

> **Validated the live gate WIRING on the H-1.1 8-field contract, not just diff
> logic.** The mutation proofs (`MUTATION-PROOF-exchange.md`) validated the
> diff *logic* against authored fixtures. This smoke validates the *invocation
> path*: a real known-bad build, produced by a live matching engine, pushed
> through the actual gate, with RED arriving via the new 8-field `report.json`
> carrying the correct structured `first_divergence`.

---

## Subjects — real matching engines, run LIVE (not fixture replay)

Built in `/tmp/smoke-exchange/` (scratch, outside the repo tree):

| File                   | Role                                                                                  |
|------------------------|----------------------------------------------------------------------------------------|
| `matcher-core.mjs`     | Real price-time-priority LOB matcher (spec.md): flat book, best-price-then-FIFO maker scan, resting-maker price (I1), symmetric min-qty fill (I2/C1), limit-rest (O1). One `tiebreak` knob. |
| `engine-good.mjs`      | **GOOD build** — `tiebreak: "fifo"` (correct).                                         |
| `engine-bad.mjs`       | **BAD build** — `tiebreak: "lifo"`: the **ONE injected defect**, a queue-jump where a later same-price resting order matches before the earlier one (violates I4 price-time priority / D3 FIFO). |
| `serial-reference.mjs` | **Independent** serial-replay reference (truth side) — a from-scratch matcher sharing **no code** with `matcher-core.mjs`. |

The defect is the static analogue of the C2 latency race documented in
`SPIKE-FINDINGS.md` (trade-index-0: a later order jumps the queue). Every
individual BAD trade stays valid under I1/I2/I3/C1 — only the whole-output
**sequence** diverges, which is precisely what the differential gate must catch.

### Order stream (`orders.json`)

Two sells rest at the **same** price level (`id1` then `id2`, `id1` arrives
first), then a single large buyer (`id3`) sweeps both:

```json
[
  { "kind": "limit", "id": 1, "account": "A", "side": "sell", "price": 99, "qty": 4 },
  { "kind": "limit", "id": 2, "account": "B", "side": "sell", "price": 99, "qty": 5 },
  { "kind": "limit", "id": 3, "account": "C", "side": "buy",  "price": 99, "qty": 9 }
]
```

### Live engine outputs (captured at smoke time)

| Build              | Live fill sequence (trades)                                  |
|--------------------|-------------------------------------------------------------|
| reference (truth)  | `[3/1@99x4, 3/2@99x5]` — earlier maker `id1` fills first     |
| GOOD (fifo)        | `[3/1@99x4, 3/2@99x5]` — matches the reference exactly       |
| BAD (lifo)         | `[3/2@99x5, 3/1@99x4]` — later maker `id2` jumps the queue   |

First divergence is at **trade index 0**: reference/GOOD `makerId 1`, BAD
`makerId 2`.

---

## The invocation path (live, exactly as `bin/falsify` / the benchmark drive it)

`smoke.sh` captures the **live** engine outputs, folds each into the
`run.sh --input` contract shape, and pushes them through the real gate:

- **GOOD** → golden form: `expected_trades` = the GOOD engine's own live output.
- **BAD**  → mutant form: `correct_trades` = the independent reference (truth),
  `corrupted_trades` = the **BAD engine's live output**.

The verdict is read from `report.json` (the typed seam) — never from stdout.

---

## GOOD build → GREEN (no false-RED)

`run.sh` exit code: **0**. `out/good.report.json`:

```json
{
  "gate_id": "exchange-lob",
  "status": "pass",
  "first_divergence": null,
  "metrics": {
    "trades_compared": 2,
    "seeds_swept": 1,
    "arm": "whole-output-differential"
  },
  "fix_hint": "Whole fill sequence and post-stream book equal the independent serial-replay reference at every index — no action needed.",
  "haid": "haid:local",
  "wave": null,
  "ts": "2026-06-11T11:56:05Z"
}
```

- exit `0` ✔  ·  `status == "pass"` ✔  ·  `first_divergence == null` ✔ — no false-RED.

---

## BAD build → RED (catches the injected defect, structured pinpoint)

`run.sh` exit code: **1** (nonzero). Full `out/bad.report.json`:

```json
{
  "gate_id": "exchange-lob",
  "status": "fail",
  "first_divergence": {
    "file": "exchange-lob",
    "step": "trade index 0 (reference len=2 actual len=2)",
    "expected": "{\"makerId\":1,\"price\":99,\"qty\":4,\"takerId\":3}",
    "actual": "{\"makerId\":2,\"price\":99,\"qty\":5,\"takerId\":3}"
  },
  "metrics": {
    "trades_compared": 2,
    "seeds_swept": 1,
    "arm": "whole-output-differential"
  },
  "fix_hint": "Whole fill sequence diverges from the serial-replay reference. Enforce price-time priority (I4) and FIFO tie-break (D3): at a price level, fill the earliest-arriving (smallest seq) resting/aggressor order first, and price every trade at the RESTING maker price (I1).",
  "haid": "haid:local",
  "wave": null,
  "ts": "2026-06-11T11:56:05Z"
}
```

### All 8 contract fields present

`gate_id`, `status`, `first_divergence`, `metrics`, `fix_hint`, `haid`, `wave`,
`ts` — all present. Acceptance check:

```bash
jq -e 'has("haid") and has("wave") and has("ts")
       and (.first_divergence|type=="object")
       and .first_divergence.file and .first_divergence.step
       and .first_divergence.expected and .first_divergence.actual' \
  out/bad.report.json
# -> true   (exit 0)
```

### Structured pinpoint matches the injected defect

`first_divergence` is the typed **object** (not a string), and it pins the exact
queue-jump:

- `step` = `"trade index 0 (…)"` — the first reordered fill.
- `expected.makerId == 1` — the FIFO truth (earlier-arriving sell fills first).
- `actual.makerId == 2` — the LIFO queue-jump the BAD build emitted.

This is the exact defect injected by flipping the `tiebreak` knob from `fifo` to
`lifo` in `matcher-core.mjs` — confirmed end-to-end through the live report.

### Envelope fields are live, not hardcoded

Re-running the same BAD input with `HEIMDALL_HAID=haid:smoke-007
HEIMDALL_WAVE=wave-42` flows those values into the report, proving `haid`/`wave`/`ts`
are populated live by the gate:

```json
{ "haid": "haid:smoke-007", "wave": "wave-42", "ts": "2026-06-11T11:56:14Z" }
```

---

## Assertion roll-up (`smoke.sh`, all live)

```
PASS: GOOD build exit 0
PASS: GOOD report status==pass
PASS: GOOD report first_divergence==null
PASS: BAD build exit nonzero
PASS: BAD report status==fail
PASS: BAD first_divergence is OBJECT
PASS: BAD first_divergence.file present
PASS: BAD first_divergence.step present
PASS: BAD first_divergence.expected present
PASS: BAD first_divergence.actual present
PASS: BAD report has all 8 fields (haid/wave/ts + struct div)
PASS: BAD pinpoint expected names makerId 1 (FIFO truth)
PASS: BAD pinpoint actual names makerId 2 (LIFO queue-jump)
PASS: BAD pinpoint step is trade index 0

SMOKE RESULT: ALL ASSERTIONS PASSED — live gate wiring validated on the 8-field contract.
```

## Conclusion

The exchange-lob gate's live invocation path is wired correctly to the H-1.1
8-field `report.json` contract. A real GOOD build passes cleanly (no false-RED);
a real BAD build with a single injected queue-jump defect is rejected with the
correct verdict, and the structured `first_divergence` object carries the exact
`{file, step, expected, actual}` pinpoint of the defect — all delivered through
`report.json`, not stdout. This validates the **wiring**, complementing the
mutation proofs that validated the **diff logic**.
