# BLIND-VERIFICATION.md — Cross-Family Golden Verification Protocol

**Purpose:** independently verify Heimdall's two golden fixtures by blind derivation across model families. The models derive from rules + inputs only — they NEVER see Heimdall's expected outputs. Agreement = verification; divergence = adjudicate that line against the external source (Pan Docs for the emulator, the stated matching rules for the exchange).

## How to run (RJ instructions — do NOT paste this section)

1. Open three fresh sessions: **ChatGPT**, **Gemini**, and a **fresh Claude conversation** (no Heimdall context — note: same family as the builder, so its agreement carries less independent weight than the other two; include it as a tiebreaker, not a primary witness).
2. Paste everything below the cut line into each, verbatim, one shot.
3. Collect the three FINAL ANSWER blocks. Diff them against:
   - `evals/oracles/emulator-gb/fixtures/golden/trace.gbdoctor` (Task A)
   - `evals/oracles/exchange-lob/fixtures/golden/order-stream.json` → `expected_trades` + `expected_book` (Task B)
4. **All three match the goldens** → record and sign.
5. **Any divergence** → adjudicate ONLY that line: Task A against the Pan Docs CPU instruction reference (https://gbdev.io/pandocs/ — the external anchor; majority vote between models is NOT the adjudicator), Task B against the rules as written in the prompt. The golden is wrong if the external source says so, regardless of how many models agree with it.
6. Record results in `evals/oracles/*/fixtures/golden/VERIFICATION.md`:

```
verification:
  method: 3-model blind derivation (single-shot, no expected outputs shown)
  models: [gpt-<ver>, gemini-<ver>, claude-<ver, fresh ctx>]
  date: 2026-06-__
  task_a_divergences_adjudicated: <n> (<details or "none">)
  task_b_divergences_adjudicated: <n> (<details or "none">)
  adjudication_anchor: Pan Docs / rules-as-written
  verdict: goldens confirmed | golden corrected (commit <sha>)
```

---------------------------------------------------------------- CUT — paste below this line ----------------------------------------------------------------

You are acting as an independent verification engine. Complete both tasks below with maximum rigor. Derive everything from the rules and inputs given — do not guess, do not skip steps, and show your work for every step before giving final answers. If you are uncertain about a hardware rule in Task A, state your uncertainty explicitly rather than papering over it; consult the Game Boy Pan Docs specification from your knowledge.

====================================================================
TASK A — Game Boy (DMG / LR35902) CPU trace derivation
====================================================================

Execute the following program instruction-by-instruction on an original Game Boy (DMG) CPU and produce the exact per-instruction state trace.

PROGRAM (loaded at address 0x0100):
  0x0100:  3C        INC A
  0x0101:  3D        DEC A
  0x0102:  A7        AND A
  0x0103:  18 02     JR +2        (relative jump, signed offset e = +2)
  0x0107:  00        NOP
All memory outside these bytes is 0x00.

INITIAL STATE (DMG post-boot):
  A=0x01  F=0xB0  B=0x00  C=0x13  D=0x00  E=0xD8  H=0x01  L=0x4D  SP=0xFFFE  PC=0x0100

RULES YOU MUST APPLY EXACTLY (DMG, not Z80):
- F register: bit7=Z, bit6=N, bit5=H (half-carry), bit4=C (carry). Bits 0-3 do not exist: F is always masked F &= 0xF0.
- INC r: result=r+1; Z from result; N=0; H=1 iff low nibble carried (i.e. (r & 0x0F) == 0x0F before, equivalently result low nibble == 0); C is PRESERVED (unchanged).
- DEC r: result=r-1; Z from result; N=1; H=1 iff low nibble borrowed (i.e. (r & 0x0F) == 0x00 before); C is PRESERVED.
- AND r: result=A&r; Z from result; N=0; H=1 (always); C=0 (always).
- JR e: PC_next = address_after_operand + signed e (the instruction is 2 bytes; from opcode address X, target = X + 2 + e). JR affects NO flags.
- NOP: no effect except PC advance.

OUTPUT FORMAT — one line per instruction, emitted BEFORE that instruction executes (so line 1 is the initial state at PC:0100). Exact format, uppercase zero-padded hex:
A:NN F:NN B:NN C:NN D:NN E:NN H:NN L:NN SP:NNNN PC:NNNN PCMEM:b0,b1,b2,b3
where PCMEM = the 4 bytes in memory starting at PC.

Walk every instruction showing the flag computation explicitly (state each of Z, N, H, C and the resulting F byte in hex), then output the complete trace (5 lines: PC 0100, 0101, 0102, 0103, 0107) as your FINAL ANSWER A in a single code block.

====================================================================
TASK B — Limit order book matching derivation
====================================================================

Process the following order stream through a price-time-priority limit order book and derive the exact trade sequence and final book state.

MATCHING RULES YOU MUST APPLY EXACTLY:
- A trade occurs only when the book crosses: an incoming buy matches the lowest-priced resting sell with sell_price <= buy_limit; an incoming sell matches the highest-priced resting buy with buy_price >= sell_limit. Market orders have no price bound.
- Trade price = the RESTING (maker) order's price, always.
- At equal prices, earlier-arriving resting orders fill first (FIFO).
- Fill quantity = min(incoming remaining, resting remaining). Continue matching the incoming order against the next-best eligible resting order until exhausted or no eligible maker remains.
- A LIMIT order's unmatched remainder rests on the book at its limit price.
- A MARKET order's unmatched remainder is discarded; market orders never rest.

ORDER STREAM (processed strictly one at a time, in this order):
  1. LIMIT  id=1  account=A  SELL  price=105  qty=10
  2. LIMIT  id=2  account=D  SELL  price=99   qty=10
  3. LIMIT  id=3  account=C  BUY   price=99   qty=3
  4. MARKET id=4  account=C  BUY              qty=4
  5. LIMIT  id=5  account=B  BUY   price=95   qty=5
  6. LIMIT  id=6  account=D  BUY   price=97   qty=7
  7. LIMIT  id=7  account=D  BUY   price=102  qty=5

Walk each order step-by-step (state the book before, the matching decision, any trades, the book after). Then output as FINAL ANSWER B in a single code block:
1. The complete ordered trade list, each trade as: {takerId, makerId, price, qty}
2. The final book state: all resting bids (best first) and asks (best first), each as: {id, account, price, qty}

====================================================================
Do not abbreviate the final answers. Accuracy over speed.
