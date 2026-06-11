# INVARIANTS — LR35902 flag & behavior ledger

Re-read before EACH opcode-group wave. These are the silent-bug landmines.

## Flag register F (only high nibble used; low nibble ALWAYS 0)
- bit 7 Z (zero), bit 6 N (subtract), bit 5 H (half-carry), bit 4 C (carry)
- Z80 leftover bits 0-3 do NOT exist on DMG. Mask F &= 0xF0 after every write.

## Post-boot register init (DMG, what GBdoctor truth assumes)
A=01 F=B0 B=00 C=13 D=00 E=D8 H=01 L=4D SP=FFFE PC=0100
(F=B0 -> Z=1 N=0 H=1 C=1)

## 8-bit ALU flag rules (a = A, b = operand)
- ADD:  r=a+b;            Z=(r&0xFF==0) N=0 H=((a&0xF)+(b&0xF))>0xF      C=(r>0xFF)
- ADC:  r=a+b+cy;         Z=(r&0xFF==0) N=0 H=((a&0xF)+(b&0xF)+cy)>0xF   C=(r>0xFF)
- SUB:  r=a-b;            Z=(r&0xFF==0) N=1 H=((a&0xF)-(b&0xF))<0         C=(a<b)
- SBC:  r=a-b-cy;         Z=(r&0xFF==0) N=1 H=((a&0xF)-(b&0xF)-cy)<0     C=(a-b-cy<0)
- AND:  r=a&b;            Z N=0 H=1 C=0
- OR/XOR: r=a|^b;         Z N=0 H=0 C=0
- CP:   like SUB but discard result (flags only)
- INC r: r=r+1; Z N=0 H=((r&0xF)==0) C=unchanged   <-- C PRESERVED
- DEC r: r=r-1; Z N=1 H=((r&0xF)==0xF) C=unchanged  <-- C PRESERVED, H set when low nibble was 0

## 16-bit arithmetic
- ADD HL,rr: N=0  H=((HL&0xFFF)+(rr&0xFFF))>0xFFF   C=(sum>0xFFFF)   Z UNCHANGED
- INC rr / DEC rr: NO flags affected
- ADD SP,e (e signed): Z=0 N=0  H/C computed on the LOW BYTE (unsigned):
    H=((SP&0xF)+(e&0xF))>0xF      C=((SP&0xFF)+(e&0xFF))>0xFF
  LD HL,SP+e uses SAME flag rule.

## Rotates (A-register fast forms): Z ALWAYS 0, N=0, H=0
- RLCA: C=oldbit7; A=(A<<1)|oldbit7
- RRCA: C=oldbit0; A=(A>>1)|(oldbit0<<7)
- RLA:  newbit0=oldC; C=oldbit7; A=(A<<1)|oldC
- RRA:  newbit7=oldC; C=oldbit0; A=(A>>1)|(oldC<<7)
  (CB-prefix RLC/RRC/RL/RR on regs are SAME math but Z set from result, NOT forced 0)

## CB-prefix
- RLC/RRC/RL/RR/SLA/SRA/SWAP/SRL: Z from result, N=0, H=0, C=shifted-out bit (SWAP C=0)
- SRA: arithmetic right, bit7 preserved. SRL: logical, bit7=0. SLA: bit0=0.
- SWAP: nibble swap, all flags 0 except Z.
- BIT b,r: Z=!(r>>b & 1), N=0, H=1, C UNCHANGED
- RES/SET: no flags.

## DAA (the classic killer) — adjusts A after add/sub for BCD
if !N:
  if C or A>0x99: A+=0x60; C=1
  if H or (A&0xF)>0x9: A+=0x06
else:
  if C: A-=0x60
  if H: A-=0x06
then Z=(A==0); H=0; C unchanged-from-above; N unchanged.

## Cycle counts (machine cycles; GBdoctor doesn't check but blargg timing does NOT for cpu_instrs)
- Not gating the trace oracle. Track for completeness; correctness oracle = register/PC trace.

## SCF / CCF
- SCF: C=1 N=0 H=0 (Z unchanged)
- CCF: C=~C N=0 H=0 (Z unchanged)

## CPL: A=~A; N=1 H=1 (Z,C unchanged)
