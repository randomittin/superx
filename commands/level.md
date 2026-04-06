---
name: level
description: Set superx autonomy level (1=Guided, 2=Checkpoint, 3=Full Auto). Use with a number, +/- to cycle, or no argument to show current level.
argument-hint: <1|2|3|+|->
disable-model-invocation: true
---

# Set Autonomy Level

Set the superx autonomy level.

## Valid levels:
- **1 (Guided)**: Ask for approval on every action
- **2 (Checkpoint)**: Run autonomously, pause at major milestones
- **3 (Full Auto)**: Run until complete, only stop if blocked

## Instructions:

1. Parse `$ARGUMENTS`:
   - If **empty or missing**: Show current level from `superx-state get '.project.autonomy_level'` and the level descriptions. Done.
   - If **`+`**: Read current level, increment by 1 (wrap 3→1). Use the result as the new level.
   - If **`-`**: Read current level, decrement by 1 (wrap 1→3). Use the result as the new level.
   - If **1, 2, or 3**: Use directly as the new level.
   - If **anything else**: Show valid options and ask the user to choose.

2. Update the state file:
```bash
superx-state set '.project.autonomy_level' '<new_level>'
```

3. Confirm with a compact status line:
   - `◀ 1 Guided` / `◀ 2 Checkpoint ▶` / `3 Full Auto ▶`
   - Show the active level highlighted, with arrows indicating cycle direction

4. If changing from a lower to higher level, add: "More autonomous now. `/superx:level -` to step back."

5. If changing from a higher to lower level, add: "More checkpoints now. `/superx:level +` to step up."

## Quick cycling

Since Claude Code keybindings only support built-in actions (no custom action registration), the fastest way to cycle is:
- `/superx:level +` — next level (1→2→3→1)
- `/superx:level -` — previous level (3→2→1→3)

This is the superx equivalent of the effort slider. Users can type `/s` + tab-complete to `/superx:level` and then `+` or `-`.
