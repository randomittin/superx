---
name: reflect
description: Force a reflection pass over the conflict log — re-evaluate all unresolved skill conflicts
disable-model-invocation: true
---

# Conflict Reflection Pass

Force a reflection pass over all unresolved conflicts in the conflict log.

## Instructions:

1. Get unresolved conflicts:
```bash
conflict-log unresolved
```

2. If no unresolved conflicts, report: "No unresolved conflicts. Reflection gate is clear."

3. For each unresolved conflict:
   a. Read the conflict details (skills involved, what they disagreed on, the resolution chosen)
   b. Re-evaluate the resolution in the current context:
      - Is the original resolution still the best choice?
      - Has anything changed that would alter the decision?
      - Were there any downstream effects from this decision?
   c. If the resolution is still sound, explain briefly why and mark it reflected
   d. If the resolution needs revision:
      - Explain what changed
      - Propose the new approach
      - Update the code if needed
      - Log the revised resolution

4. After reviewing all conflicts:
```bash
conflict-log reflect-all
```

5. Report summary: "Reflected on <N> conflicts. <resolved> confirmed, <revised> revised. Reflection gate is now clear."
