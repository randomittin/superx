---
name: level
description: Set superx autonomy level (1=Guided, 2=Checkpoint, 3=Full Auto)
argument-hint: <1|2|3>
disable-model-invocation: true
---

# Set Autonomy Level

Set the superx autonomy level to `$ARGUMENTS`.

## Valid levels:
- **1 (Guided)**: Ask for approval on every action
- **2 (Checkpoint)**: Run autonomously, pause at major milestones
- **3 (Full Auto)**: Run until complete, only stop if blocked

## Instructions:

1. Validate that `$ARGUMENTS` is 1, 2, or 3. If not, show the valid levels and ask the user to choose.

2. Update the state file:
```bash
superx-state set '.project.autonomy_level' '$ARGUMENTS'
```

3. Confirm the change to the user with a brief description of what the level means.

4. If changing from a lower to higher level, note: "I'll be more autonomous now. You can always run `/superx:level` to adjust."

5. If changing from a higher to lower level, note: "I'll check in more often. You can always run `/superx:level` to adjust."
