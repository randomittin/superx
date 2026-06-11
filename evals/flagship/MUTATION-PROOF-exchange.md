# Mutation Proof — the EXCHANGE oracle gate catches injected bugs

> I had an agent write its own verifier. Then I refused to trust the verifier until I
> mutation-tested it against a *real* implementation — not the gate's own hand-written
> fixtures. A gate that reads green is worthless; a gate that turns **red on a subtle bug it
> has never seen** is sign-off evidence. This is that test.

## The setup

The `exchange-lob` oracle gate (`evals/oracles/exchange-lob/run.sh`) is a **whole-output
differential**: it replays an order stream through an implementation and an independent
brute-force serial reference, then diffs the entire fill SEQUENCE tuple-by-tuple
(`takerId, makerId, price, qty`) plus the post-stream book state, and reports the **first
divergence index** on mismatch. The design lesson (from `INVARIANTS.md` / `differential.md`):
per-trade checks (I1 no-cross, I2 qty-balance, I3 net-zero, C1 no-double-fill) all stay GREEN
on a *reordered* sequence because every individual trade is internally valid — only an ordered
whole-output diff has the vocabulary for "wrong sequence."

The risk with a self-written gate is the opposite of a false-RED: a **false-GREEN** — a gate
that passes its own golden but is structurally blind to real defects. The only way to disprove
that is to feed it real defects and watch it fail with the *right* pinpoint.

### Method (no fixtures were trusted)

1. Wrote a faithful toy matching engine — `/tmp/mut-exchange/engine.js` — transcribed directly
   from `reference/spec.md` (brute-force O(n²) flat-array LOB). With `bugs={}` it IS the
   correct serial reference matcher.
2. **Independent confirmation it's correct:** its output on the golden stream equals the spec's
   authoritative `expected_trades` + `expected_book` byte-for-byte (3 trades: `3/2@99×3`,
   `4/2@99×4`, `7/2@99×3`; book bids `102×2 / 97×7 / 95×5`, ask `105×10`). The engine was not
   tuned to match the gate; it transcribes the same spec the gate's reference does.
3. Injected **one** subtle bug per variant via a single config flag, ran the engine **twice**
   per variant (clean = reference, flagged = subject), and fed the engine's **own real output**
   through `run.sh`. The gate diffs the engine's bugged bytes against the engine's clean bytes —
   no hand-authored "corrupted" fixture in the loop.

This is strictly harder than the gate's resident static mutants: those are author-written JSON;
these are emitted by a live engine that an adversary subtly broke.

## Results — every bug CAUGHT, every pinpoint CORRECT

> **Report format note (spec H-1).** `report.json.first_divergence` is now a STRUCTURED
> object `{file, step, expected, actual}` (alongside the `haid`/`wave`/`ts` envelope), not
> a flat string. The pinpoint column below is the human paraphrase; the gate emits, e.g.,
> `{"file":"exchange-lob","step":"trade index 0 (reference len=1 actual len=1)",`
> `"expected":"{\"makerId\":1,\"price\":99,\"qty\":5,\"takerId\":2}",`
> `"actual":"{\"makerId\":1,\"price\":105,\"qty\":5,\"takerId\":2}"}`. See
> `evals/oracles/REPORT-CONTRACT.md` §3.

| # | Variant | Dimension (invariant) | Gate verdict | Exit | First-divergence pinpoint (object: `step` / `expected` → `actual`) |
|---|---------|-----------------------|--------------|------|---------------------------|
| 0 | **correct impl** (golden stream) | — (must not false-RED) | **PASS** ✅ | `0` | `null` |
| 1 | crossed trade | I1 no-cross (fill at aggressor price, not resting maker price) | **CAUGHT** (fail) ✅ | `1` | trade index 0: expected `price 99` actual `price 105` (taker/maker 2/1, len 1=1) |
| 2 | price-time priority break (queue-jump) | I4 / D3 (later same-price taker fills first) | **CAUGHT** (fail) ✅ | `1` | trade index 0: expected `takerId 2` actual `takerId 3` (maker 1 @99, len 2=2) |
| 3 | FIFO→LIFO tie-break | D3 (most-recently-rested maker fills first) | **CAUGHT** (fail) ✅ | `1` | trade index 0: expected `makerId 1` actual `makerId 2` (taker 3 @99×3, len 2=2) |
| 4 | dropped resting remainder | O1 / O4 (limit remainder destroyed, not rested) | **CAUGHT** (fail) ✅ | `1` | post-stream book: expected bids `[id1@100×6]` actual bids `[]` |
| 5 | off-by-one fill quantity | qty corruption | **CAUGHT** (fail) ✅ | `1` | trade index 0: expected `qty 5` actual `qty 4` (**and** ref len 1 vs actual len 2) |

**MISSED bugs: none.** Every injected defect turned the gate RED, each at the correct index and
each with the correct expected/actual pinpoint isolating the exact field that diverged. The
correct implementation passed cleanly — no false-RED.

### Why each pinpoint is the *right* one (not just "a" failure)

- **Crossed trade (I1).** Same taker, same maker, same qty — the gate fingers the **price**
  field alone (99→105). I2/I3/C1 are all satisfied by the bugged trade; only the maker-price
  equality the diff encodes catches the maker/taker price swap.
- **Queue-jump (I4/D3).** Both trades are individually legal (price 99 = resting price,
  qty-balanced, net-zero). The gate fails at **index 0 on `takerId`** (2 vs 3) — it caught the
  *ordering*, the exact class of defect that the C2 concurrency race is the live analogue of.
- **LIFO tie-break (D3).** Distinct from queue-jump: here the *maker* ordering flips. The gate
  pins **index 0 `makerId`** (1 vs 2). Same price level, so per-trade I1 is blind; only the
  FIFO-of-equal-price-makers ordering distinguishes them.
- **Dropped remainder (O1/O4).** The single fill is perfectly valid — the defect lives in the
  POST-stream book, not in any trade. The gate's **book-state arm** catches the destroyed 6
  units (`[id1@100×6]` vs `[]`); the trade-sequence arm alone would have been blind.
- **Off-by-one qty.** The most instructive. Shaving the fill 5→4 leaves the aggressor with 1
  unit that re-matches, so the bugged sequence is **length 2** where the reference is length 1.
  The gate catches it at **index 0 on `qty`** (5 vs 4) *and* surfaces the length divergence
  (ref len 1, actual len 2) — first-divergence reporting points at the root corruption, not the
  cascade it spawns.

## Reproduce

```bash
# 1. build the toy engine's outputs (correct + 5 single-bug variants)
node /tmp/mut-exchange/drive.js          # writes /tmp/mut-exchange/outputs/*.json

# 2. correct impl must PASS (exit 0, first_divergence=null)
evals/oracles/exchange-lob/run.sh --input /tmp/mut-exchange/outputs/correct-golden.json --report /tmp/r.json
echo "exit=$?"; jq '{status, first_divergence}' /tmp/r.json

# 3. each bug must FAIL (exit 1) with the pinpoint above
for f in bug-crossed-trade bug-queue-jump bug-lifo-tiebreak bug-drop-remainder bug-off-by-one-qty; do
  evals/oracles/exchange-lob/run.sh --input /tmp/mut-exchange/outputs/$f.json --report /tmp/r.json >/dev/null 2>&1
  printf '%-22s exit=%s  ' "$f" "$?"; jq -c '.first_divergence' /tmp/r.json   # structured {file,step,expected,actual}
done
```

Observed exit codes: `correct→0`, all 5 bugs→`1`. (The `/tmp/mut-exchange/` engine is scratch,
not committed; the harness is reproducible from `engine.js` + `drive.js` shown in this repo's
history.)

## The takeaway for build-in-public

A self-written verifier is a liability until you've tried to fool it. I built a correct engine,
proved it correct against the spec independently, then had an adversary inject five "quietly
wrong" mutations — the kind that pass every per-trade unit assertion. The gate caught all five,
each with a surgical first-divergence pinpoint, and never cried wolf on the correct one. That —
not a green CI badge — is what earns the gate a sign-off.
