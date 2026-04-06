---
name: maintain
description: Toggle maintainer mode for automatic issue triage, bug fixing, and patch releases
disable-model-invocation: true
---

# Toggle Maintainer Mode

Toggle the superx maintainer mode.

## Instructions:

1. Read current maintainer state:
```bash
superx-state get '.maintainer.enabled'
```

2. If currently **disabled**, enable it:
   - Set `maintainer.enabled` to true: `superx-state set '.maintainer.enabled' 'true'`
   - Set default issue sources: `superx-state set '.maintainer.issue_sources' '["github"]'`
   - Confirm: "Maintainer mode enabled. I'll watch for GitHub issues and handle triage/fixes."
   - Suggest: "Run `/loop 30m /superx:maintain-check` for continuous monitoring, or I'll check on demand."

3. If currently **enabled**, disable it:
   - Set `maintainer.enabled` to false: `superx-state set '.maintainer.enabled' 'false'`
   - Confirm: "Maintainer mode disabled. I'll stop monitoring for issues."
   - If there are pending fixes, warn: "Note: there are <N> pending fixes in the queue. These won't be processed until maintainer mode is re-enabled."

4. For detailed maintainer mode documentation, read `skills/superx/references/maintainer-guide.md`.
