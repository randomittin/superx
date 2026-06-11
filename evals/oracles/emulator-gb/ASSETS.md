# ASSETS — external oracle pointers (DO NOT vendor)

This gate depends on two external multi-megabyte asset sets: the **blargg cpu_instrs** test
ROM suite and the **gameboy-doctor** truth logs. They are referenced here by POINTER ONLY.
Do NOT copy the ROM binaries or the truth logs into this repo — they are large, and the
truth logs in particular are tens-of-millions-of-lines each (ROM 11 ≈ 7.4M lines). The gate
([gate.sh](./gate.sh)) reads them from a local cache directory the operator populates from
these pointers.

## Cache layout (operator-populated, git-ignored)

```
$GB_ORACLE_CACHE/
  roms/
    01-special.gb  02-interrupts.gb  03-op sp,hl.gb  04-op r,imm.gb
    05-op rp.gb     06-ld r,r.gb      07-jr,jp,call,ret,rst.gb
    08-misc instrs.gb 09-op r,r.gb    10-bit ops.gb   11-op a,(hl).gb
    cpu_instrs.gb            # combined all-in-one ROM (optional)
  truth/
    01.log 02.log 03.log 04.log 05.log 06.log 07.log 08.log 09.log 10.log 11.log
```

`GB_ORACLE_CACHE` defaults to `./.gb-oracle-cache` (see gate.sh). It is NOT committed.

## Pointer 1 — blargg cpu_instrs ROM suite

The canonical Game Boy CPU instruction test ROMs, authored by Shay Green (blargg).

- Source repo (gbdev mirror): https://github.com/retrio/gb-test-roms
  - ROMs at `cpu_instrs/individual/*.gb` (the 11 individual ROMs) and
    `cpu_instrs/cpu_instrs.gb` (combined).
- Upstream homepage: https://gbdev.gg8.se/wiki/articles/Test_ROMs
- Original archive: https://github.com/retrio/gb-test-roms (blargg's `gb-tests`).

These ROMs self-report via the serial port (FF01/FF02) — see [trace-diff.md](./trace-diff.md)
§2 for the blargg serial verdict rule.

## Pointer 2 — gameboy-doctor + truth logs

gameboy-doctor (Robert Heaton) is the reference per-instruction trace tool and ships the
truth logs this gate diffs against.

- Tool + truth logs repo: https://github.com/robert/gameboy-doctor
  - Truth logs at `truth/unzipped/cpu_instrs/<N>/<N>.log` after unzipping the
    `truth/zipped/...` archives in that repo (one log per cpu_instrs ROM, N = 1..11).
- Walkthrough / format spec: https://robertheaton.com/gameboy-doctor/
  - Defines the exact trace line contract (`A:.. F:.. B:.. C:.. D:.. E:.. H:.. L:.. SP:..
    PC:.. PCMEM:b0,b1,b2,b3`) that [trace-diff.md](./trace-diff.md) §1.1 reproduces.

The truth logs are the strong oracle's reference stream. They are large (the combined set
is hundreds of MB unzipped) — fetch and unzip them into `$GB_ORACLE_CACHE/truth/` per the
layout above; never vendor them into the repo.

## Populating the cache (operator steps, not run by the gate)

```sh
export GB_ORACLE_CACHE="$PWD/.gb-oracle-cache"
mkdir -p "$GB_ORACLE_CACHE/roms" "$GB_ORACLE_CACHE/truth"
# 1. ROMs:
git clone https://github.com/retrio/gb-test-roms /tmp/gb-test-roms
cp /tmp/gb-test-roms/cpu_instrs/individual/*.gb "$GB_ORACLE_CACHE/roms/"
# 2. truth logs:
git clone https://github.com/robert/gameboy-doctor /tmp/gameboy-doctor
#    unzip the truth/zipped archives into $GB_ORACLE_CACHE/truth/<N>.log
```

The repo stays free of binaries and giant logs; the gate finds them via `GB_ORACLE_CACHE`.
