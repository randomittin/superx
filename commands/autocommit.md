---
name: autocommit
description: Toggle auto git commits on/off for this project. Run without args to see status, or with "on"/"off" to set.
---

# Toggle Auto-Commit

Check the current auto-commit state and toggle it:

1. Check if `.superx-no-autocommit` exists in the project root
2. If called with no args or "status": report current state
3. If called with "off" or "disable": `touch .superx-no-autocommit` and confirm
4. If called with "on" or "enable": `rm -f .superx-no-autocommit` and confirm
5. If called with no qualifier (just `/superx:autocommit`): TOGGLE — if on, turn off; if off, turn on

## Implementation

```bash
# Check current state
if [ -f .superx-no-autocommit ]; then
  echo "Auto-commit is OFF"
else
  echo "Auto-commit is ON"
fi
```

To toggle, run the appropriate bash command:
- Turn OFF: `touch .superx-no-autocommit`
- Turn ON: `rm -f .superx-no-autocommit`

Report the new state after toggling.
