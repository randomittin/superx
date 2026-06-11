# MUTATION-PROOF — emulator-gb oracle gate

**Claim under test:** the `emulator-gb` trace-diff gate
(`evals/oracles/emulator-gb/run.sh`) does not merely *read green* on a correct
emulator — it **catches subtle, single-bit, quietly-wrong bugs** and pinpoints
the exact instruction and field that first diverges.

**Method (mutation testing).** A minimal, correct DMG LR35902 instruction
executor was written from scratch (TS/JS) against `INVARIANTS.md`. It runs a
small fixed program and emits a gameboy-doctor-format trace
(`A:.. F:.. … PC:.. PCMEM:..`). The correct executor's trace is the **truth
reference**. Four mutants were then derived — each flipping exactly **one**
quietly-wrong dimension — and graded against truth through `run.sh`. A gate that
"just reads green" would pass some mutants; a real oracle fails every one with a
correct pinpoint.

**Result: 4 / 4 bugs CAUGHT. 0 MISSED. No false-RED on the correct trace.**

---

## Program under trace (loaded at `0x0100`)

```
0100  C6 0A     ADD A,0x0A   ; A 01+0A=0B  (H: (1&F)+(A&F)=B<=F -> H=0, C=0)   F=00
0102  3C        INC A        ; A 0B->0C    (C preserved=0, low nibble C!=0 -> H=0) F=00
0103  87        ADD A,A      ; A 0C+0C=18  (low-nibble C+C>F -> H=1, no byte carry) F=20
0104  27        DAA          ; BCD adjust of 0x18 with H=1 -> +06 -> 0x1E          F=00
0105  18 02     JR +2        ; next PC = 0105 + 2 + (+2) = 0109  (JR sets no flags)
0109  00        NOP          ; end of program
```

The truth trace (6 lines, post-boot DMG init `A=01 F=B0 … PC=0100`):

```
A:01 F:B0 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0100 PCMEM:C6,0A,3C,87
A:0B F:00 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0102 PCMEM:3C,87,27,18
A:0C F:00 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0103 PCMEM:87,27,18,02
A:18 F:20 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0104 PCMEM:27,18,02,00
A:1E F:00 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0105 PCMEM:18,02,00,00
A:1E F:00 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0109 PCMEM:00,00,00,00
```

The toy executor and all traces live in `/tmp/mut-emulator/` (scratch, outside
the repo tree). `BUG=<name> node cpu.js` reproduces any row below.

---

## Verdict table

| # | mutation | dimension | gate verdict | first_divergence (instruction → expected vs actual) | exit |
|---|----------|-----------|--------------|------------------------------------------------------|------|
| 0 | none (correct trace) | — | **PASS** (no false-RED) | `null` | `0` |
| 1 | `half-carry` | wrong flag derivation (ADD half-carry computed on the full byte, not the low nibble) | **CAUGHT** | instr **4**: `F:20` → `F:00` (H bit cleared; A/PC identical) | `1` |
| 2 | `f-mask` | F-register low nibble not masked (`F &= 0xF0` skipped; leftover ALU nibble leaks) | **CAUGHT** | instr **2**: `F:00` → `F:0B` (low nibble nonzero) | `1` |
| 3 | `jr-off-by-one` | off-by-one in the JR jump target (PC diverges by one) | **CAUGHT** | instr **6**: `PC:0109` → `PC:010A` (registers otherwise sane → control-flow drift) | `1` |
| 4 | `daa` | DAA BCD mis-adjust (+0x05 instead of +0x06 on one instruction) | **CAUGHT** | instr **5**: `A:1E` → `A:1D` | `1` |

**MISSED bugs: none.** Every mutant produced `status:"fail"` with a correct
`divergence_index` and the precise expected/actual line.

---

## Raw gate evidence (`report.json`, via `run.sh --input <trace> --truth truth.gbdoctor`)

```
########## correct ##########
emulator-gb: pass (6 instructions compared)        exit=0
{"status":"pass","first_divergence":null,"idx":0}

########## half-carry (wrong flag derivation) ##########
emulator-gb: fail (4 instructions compared)        exit=1
{"status":"fail","idx":4,
 "first_divergence":"instruction 4: expected A:18 F:20 ... PC:0104 ...
                                   actual A:18 F:00 ... PC:0104 ..."}

########## f-mask (F low nibble not masked) ##########
emulator-gb: fail (2 instructions compared)        exit=1
{"status":"fail","idx":2,
 "first_divergence":"instruction 2: expected A:0B F:00 ... PC:0102 ...
                                   actual A:0B F:0B ... PC:0102 ..."}

########## jr-off-by-one (jump target off by one) ##########
emulator-gb: fail (6 instructions compared)        exit=1
{"status":"fail","idx":6,
 "first_divergence":"instruction 6: expected ... PC:0109 PCMEM:00,00,00,00
                                   actual ... PC:010A PCMEM:00,00,00,00"}

########## daa (BCD mis-adjust) ##########
emulator-gb: fail (5 instructions compared)        exit=1
{"status":"fail","idx":5,
 "first_divergence":"instruction 5: expected A:1E ... PC:0105 ...
                                   actual A:1D ... PC:0105 ..."}
```

---

## Why this is a strong sign-off

- **One-bit faults are caught.** Mutant 1 flips a single flag bit (`H`) and
  nothing else; mutant 2 leaks a nibble into a normally-zero field. Both are the
  textbook "passes most ROMs, fails one obscure edge" silent bugs — the gate
  pins each to the exact field on the exact instruction.
- **The pinpoint is correct, not just the verdict.** Each `divergence_index`
  matches the hand-derived instruction (4, 2, 6, 5), and the `first_divergence`
  string carries the precise expected-vs-actual line — directly actionable per
  the `trace-diff.md` triage table (wrong-F-only → flag rule; PC-drift with sane
  registers → control flow; wrong-A → arithmetic/BCD).
- **No false-RED.** The correct trace passes cleanly (`exit 0`,
  `first_divergence:null`), so a green reading is meaningful rather than vacuous.
- **First-divergence discipline holds.** Even where a mutation corrupts every
  later line (mutants 1 and 4), the gate reports only the earliest divergence
  and stops — exactly the contract in `trace-diff.md §1.2`.

Reproduce: `cd /tmp/mut-emulator && BUG=<half-carry|f-mask|jr-off-by-one|daa>
node cpu.js | <gate> --input - --truth truth.gbdoctor`.
