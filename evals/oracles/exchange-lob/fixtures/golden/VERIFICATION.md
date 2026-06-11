# VERIFICATION.md — Golden Fixture Provenance (Blind Cross-Family Consensus)

Place a copy of this file at BOTH:
- `evals/oracles/emulator-gb/fixtures/golden/VERIFICATION.md`
- `evals/oracles/exchange-lob/fixtures/golden/VERIFICATION.md`

(Identical content; each golden's provenance must travel with the fixture it certifies.)

---

## Verification record

```yaml
verification:
  method: 3-model blind derivation — single-shot prompt (BLIND-VERIFICATION.md),
          rules + inputs only; no expected outputs shown to any model
  models:
    - gpt-5.5            # rival family, primary witness
    - gemini-3.5-thinking # rival family, primary witness
    - claude-fable-5      # builder's family, fresh context, high effort —
                          # tiebreaker weight only (shares builder family)
  date: 2026-06-12
  protocol_file: BLIND-VERIFICATION.md (prompt preserved verbatim for re-runs)

  task_a: # emulator-gb golden — fixtures/golden/trace.gbdoctor
    divergences_adjudicated: 0
    result: unanimous 3/3, byte-identical traces, all 5 lines
    notes: >
      All three models independently derived F:20 at PC:0103 and PC:0107
      (AND A → Z=0 N=0 H=1 C=0 → 0x20), confirming the R-1 correction.
      Counterfactual check: the pre-R-1 golden value (F:10) would have
      FAILED this consensus 3-0 — the protocol independently confirms
      both the original defect and its fix.
    model_flagged_ambiguity: >
      GPT-5.5 noted the program listing's address gap: JR 0x18,0x02 occupies
      0x0103-0x0104, so target = 0x0105 + 2 = 0x0107, leaving bytes
      0x0105-0x0106 unlisted. Resolved by the prompt's explicit
      "all memory outside these bytes is 0x00" — hence PCMEM at PC:0107 =
      00,00,00,00. No trace impact; recorded as evidence the derivations
      were attentive rather than pattern-matched. Future fixture programs
      should enumerate skipped-over bytes explicitly.

  task_b: # exchange-lob golden — fixtures/golden/order-stream.json
    divergences_adjudicated: 0
    result: unanimous 3/3 on the full trade sequence (3 trades:
            t3/m2@99x3, t4/m2@99x4, t7/m2@99x3) and final book state
            (bids 7@102x2, 6@97x7, 5@95x5; asks 1@105x10) —
            field-identical to expected_trades + expected_book
    notes: >
      Confirms I1 (trades at resting price 99), O1 (id7 remainder x2 rests
      at 102), O2 (market id4 fully filled, never rests), I4/D3 ordering,
      and O4 conservation, all by independent derivation from rules-as-written.

  adjudication_anchor: Pan Docs (Task A) / matching rules as written (Task B).
                       Not invoked — zero divergences. Majority vote is NOT
                       the adjudicator; the external source is.
  verdict: GOLDENS CONFIRMED

  history:
    - 2026-06-12: pre-R-1 golden carried F:10 at L4/L5 (H/C bits inverted).
      Survived same-author verification at every layer (self-verify 11/11,
      mutation proofs 9/9, corpus 100%). Caught by adversarial cross-family
      review anchored to the Pan Docs; corrected in the R-1 commit with the
      corpus dip on public record (CORPUS-STATUS.md: 9/9 → 7/9 → 9/9).
    - 2026-06-12: corrected goldens confirmed by this 3-model blind consensus.

  rerun_trigger: any edit to either golden fixture re-runs this protocol
                 (BLIND-VERIFICATION.md) before the change merges. A golden
                 without a current verification block does not gate.
```

## Why this protocol exists (one paragraph, for future readers)

Same-author verification layers share blind spots by construction: the builder's
self-tests, mutation proofs, and corpus all inherited one wrong reference byte and
stayed green. Independence comes from (a) rival model families deriving blind from
rules + inputs, and (b) adjudicating any disagreement against an external source —
never by vote. This file is the provenance answer to the first hostile question any
benchmark gets: "how do you know your reference answers are right?"
