---
name: maintain
description: Activate or deactivate maintainer mode — one command for automatic issue triage, bug fixing, and patch releases
argument-hint: [on|off|status]
disable-model-invocation: true
---

# Maintainer Mode

One-command activation for autonomous repo maintenance.

## Instructions:

### Parse arguments

- `$ARGUMENTS` is empty or "on" → activate
- `$ARGUMENTS` is "off" → deactivate
- `$ARGUMENTS` is "status" → show current status and pending work

---

### Activate (default)

1. Check if already enabled:
```bash
superx-state get '.maintainer.enabled'
```
If already `true`, say "Maintainer mode is already active" and show status instead.

2. Verify prerequisites:
```bash
# GitHub CLI must be available and authenticated
gh auth status 2>&1
```
If `gh` is not authenticated, tell the user: "GitHub CLI needs to be authenticated first. Run `! gh auth login` to set it up, then try again." and stop.

3. Check the repo has a remote:
```bash
git remote -v
```
If no remote, warn: "No git remote configured. Maintainer mode needs a GitHub repo to watch issues and create PRs."

4. **Configure issue sources** — ask the user:

> "Which issue sources should I monitor?"
> 1. **GitHub Issues only** (default)
> 2. **GitHub Issues + error logs** (provide log file paths)
> 3. **GitHub Issues + error tracking** (Sentry/Elastic endpoint)
>
> Pick 1, 2, or 3:

Based on their answer:
- Option 1: `superx-state set '.maintainer.issue_sources' '["github"]'`
- Option 2: Ask for log paths, then: `superx-state set '.maintainer.issue_sources' '["github","logs"]'` and `superx-state set '.maintainer.log_paths' '["/path/to/logs"]'`
- Option 3: Ask for endpoint, then: `superx-state set '.maintainer.issue_sources' '["github","error_tracking"]'` and `superx-state set '.maintainer.error_tracking' '{"endpoint":"<url>"}'`

5. **Configure monitoring frequency** — ask:

> "How often should I check for issues?"
> - **a)** Every 15 minutes (active development)
> - **b)** Every 30 minutes (default)
> - **c)** Every hour (stable repo)
> - **d)** On demand only (I'll run `/superx:maintain-check` manually)

6. **Configure Slack notifications** (if Slack skills are available):

> "Want me to post updates to a Slack channel? (y/n)"

If yes, ask for the channel name and store it:
`superx-state set '.maintainer.slack_channel' '"#channel-name"'`

7. **Enable and start:**

```bash
superx-state set '.maintainer.enabled' 'true'
```

If they chose a polling frequency (not on-demand):
- Tell them: "Starting continuous monitoring. Run this to keep it going:"
- Show the command: `/loop <interval> /superx:maintain-check`
- If they're on Claude Code web, suggest: `/schedule` for persistent cron that runs even when the session is closed.

8. **Run first check immediately:**

> "Running first maintenance check now..."

Execute `/superx:maintain-check` inline to give immediate results.

9. **Confirm with status summary:**

```
Maintainer mode: ACTIVE
Issue sources: GitHub Issues
Check interval: every 30 minutes
Slack updates: #eng-updates
Pending fixes: 0
Release queue: 0

Monitoring started. I'll handle triage, fixes, and releases automatically.
For critical issues, I'll always ask before merging.
```

---

### Deactivate

1. Check pending work:
```bash
superx-state get '.maintainer.pending_fixes | length'
superx-state get '.maintainer.release_queue | length'
```

2. If there's pending work, warn:
> "There are <N> pending fixes and <M> items in the release queue. Deactivating will pause all of this. Continue? (y/n)"

3. On confirmation:
```bash
superx-state set '.maintainer.enabled' 'false'
```

4. Confirm: "Maintainer mode deactivated. Pending work is preserved — run `/superx:maintain` to resume."

---

### Status

Show current maintainer state:

```bash
superx-state get '.maintainer'
```

Format as:

```
Maintainer mode: ACTIVE / INACTIVE
Issue sources: <list>
Pending fixes: <count> (<breakdown by status>)
Release queue: <count> items
Last check: <timestamp or "never">
```

If there are pending fixes, list them briefly:
```
Pending:
  #23 — null pointer in auth middleware (investigating)
  #45 — typo in error message (fix ready, queued for v1.2.4)
```
