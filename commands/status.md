---
name: status
description: Show current superx state — project phase, active agents, quality gates, conflicts
disable-model-invocation: true
---

# superx Status

Show the current superx project state.

## Instructions:

1. Check if `superx-state.json` exists. If not, run `superx-state init` first.

2. Run `superx-state status` to get the formatted summary.

3. Additionally, read the full state file and present a rich status view:

```
═══════════════════════════════════════
  superx status
═══════════════════════════════════════

  Project:  <name or (unnamed)>
  Phase:    <idle|planning|implementing|reviewing|complete>
  Level:    <1|2|3> (<Guided|Checkpoint|Full Auto>)

  Quality Gates:
    Tests:      <passing|failing>
    Lint:       <clean|dirty>
    Reflection: <done|pending>
    Dirty:      <yes|no>

  Active Agents: <count>
  Sub-projects:  <complete>/<total>
  Conflicts:     <count> (<unresolved> unresolved)
  Maintainer:    <enabled|disabled>

═══════════════════════════════════════
```

4. If there are active sub-projects, list them with their status.

5. If there are unresolved conflicts, mention them briefly.

6. If maintainer mode is enabled, show pending fixes and release queue status.
