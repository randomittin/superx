# trace-diff — per-instruction gameboy-doctor trace-diff gate

Design of the strong oracle for the emulator-gb gate: a per-instruction register/PC trace
diff against gameboy-doctor truth logs, plus a secondary blargg serial verdict.

Companion to [INVARIANTS.md](./INVARIANTS.md), [COVERAGE.md](./COVERAGE.md), and
[ASSETS.md](./ASSETS.md). Runnable form: [gate.sh](./gate.sh).

---

## 1. Strong oracle — gameboy-doctor per-instruction trace diff

### 1.1 Trace line format (one line per executed instruction)

The emulator emits, BEFORE executing each instruction, a single line capturing the full
CPU register file, the stack pointer, the program counter, and the four bytes at `[PC]`:

```
A:01 F:B0 B:00 C:13 D:00 E:D8 H:01 L:4D SP:FFFE PC:0100 PCMEM:00,C3,13,02
```

- All values are uppercase, zero-padded hex.
- 8-bit registers (`A F B C D E H L`) are two hex digits.
- `SP` and `PC` are four hex digits.
- `PCMEM` is exactly four comma-separated bytes = `mem[PC], mem[PC+1], mem[PC+2], mem[PC+3]`.
- Field order is FIXED and must match gameboy-doctor's expected format byte-for-byte.
- `F` always has a zero low nibble (DMG masks `F &= 0xF0`; see INVARIANTS.md §F).
- The FIRST emitted line is the post-boot state: `A:01 F:B0 B:00 C:13 D:00 E:D8 H:01 L:4D
  SP:FFFE PC:0100` (DMG post-boot init, INVARIANTS.md §post-boot).

This is exactly the gameboy-doctor (`robert/gameboy-doctor`) line contract. Each truth log
`N.log` (one per cpu_instrs ROM, N = 01..11) is a newline-delimited stream of these lines,
one per instruction the reference core executed, in order.

### 1.2 Diff algorithm — report FIRST divergence

The gate streams the emulator trace and the truth log line-by-line in lockstep and compares
by **instruction count** (1-based line number). It reports the **first divergence only** —
the earliest instruction at which the two lines differ — and stops. Reporting only the first
divergence is deliberate: every later line is downstream noise once the cores have drifted.

```
n := 0
for (mine, truth) in zip(trace_stream, truth_stream):
    n += 1
    if mine != truth:
        report FIRST divergence at instruction n:
            expected (truth): <truth line>
            actual   (mine):  <mine line>
        exit RED
report: NO divergence over n instructions
exit GREEN
```

Length mismatch is itself a divergence: if one stream ends before the other, the first
line that has no counterpart is the first divergence (instruction count = the line number
where the shorter stream ran out).

### 1.3 Worked divergence reports (from the spike)

The format below is exactly what the gate prints. These are the two load-bearing examples
the spike (`evals/flagship/SPIKE-FINDINGS.md`) produced.

**`02-interrupts` — first divergence at instruction 151,346** (the descoped-timer drift):

```
FIRST DIVERGENCE at instruction 151346
expected (truth): A:05 F:10 B:01 C:00 D:C7 E:BA H:90 L:00 SP:DFFB PC:0051 PCMEM:C9,00,00,00
actual   (mine):  A:04 F:10 B:01 C:00 D:C7 E:BA H:90 L:00 SP:DFFB PC:0050 PCMEM:3C,C9,00,00
```

Reading it: every register is identical except `A` (05 vs 04) and `PC` (0051 vs 0050).
Truth is exactly ONE instruction ahead — it already executed `INC A` (opcode `3C`) at
`0x0050`, advancing `A 04→05` and `PC → 0x0051` (next byte `C9` = RET). This build still
sits on `0x0050`. The `INC A` math is correct; the traces drift by whole instructions
because the test polls a hardware timer the MMU does not tick. CLASSIFICATION: `incomplete`
(descoped timer, NOT gating — see COVERAGE.md).

The spike's second emulator arm reported the same divergence at instruction **151,346**
(line `instr-151,346` in the spike notes); arm 3 cited line **151,347** — the off-by-one is
exactly the one-instruction lead described above, depending on whether you count the truth
line or the matching line.

### 1.4 What a divergence tells you (triage)

- **Wrong `F` only** → flag bug. Cross-reference the exact rule in INVARIANTS.md (ALU
  half-carry, INC/DEC C-preservation, DAA, rotate Z-forcing, etc.).
- **Wrong `A`/result + wrong `F`** → arithmetic bug in that opcode.
- **Wrong `PC`/`PCMEM` with registers otherwise sane** → control-flow drift (mis-sized
  instruction, bad jump target, or — as in `02-interrupts` — a missing peripheral tick that
  changes the loop-iteration count). Whole-instruction lead/lag with correct math = a
  timing/peripheral drift, not an opcode bug.
- **`PCMEM` mismatch but registers match** → MMU read returns wrong bytes (bank/mirror/IO).

---

## 2. Secondary oracle — blargg serial verdict (FF01/FF02 capture)

blargg's `cpu_instrs` ROMs report their own pass/fail by writing ASCII to the **serial
port**: the test writes a byte to `FF01` (SB, serial data) then `0x81` to `FF02` (SC, serial
control — bit 7 = transfer start, bit 0 = internal clock). On each such `FF02 := 0x81` the
emulator appends `mem[FF01]` to a serial-output buffer.

The gate captures that buffer and applies the verdict rule:

- A run that finishes the suite prints the ROM title then `Passed` → **PASS**.
- A failing run prints `Failed #<n>` plus a reason (e.g. `02-interrupts` prints
  `Failed #4` / `Timer doesn't work`) → **FAIL**.
- No terminating `Passed`/`Failed` within the instruction budget → **TIMEOUT** (treated as
  FAIL for gating).

This is the secondary oracle because it is coarse (one verdict per ROM) and can be
shared-misconception-blind. The per-instruction trace diff (§1) is the strong oracle: it
pinpoints the EXACT instruction and field that first diverges, which a serial `Failed #n`
cannot. Run both; the trace diff localizes what the serial verdict merely flags.

### 2.1 Gating matrix

Per-ROM gating verdicts live in [COVERAGE.md](./COVERAGE.md). Summary: 10 of 11 cpu_instrs
ROMs gate GREEN on both oracles. `02-interrupts` is expected-RED and **NOT gating** because
its pass condition depends on the descoped DIV/TIMA/TMA/TAC timer subsystem. A RED
`02-interrupts` is the accepted state until the timer is implemented (re-scope trigger in
COVERAGE.md).
