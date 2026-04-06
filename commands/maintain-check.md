---
name: maintain-check
description: Run one maintainer cycle — scan for issues, triage, fix, and queue releases. Use --dry-run to preview without executing.
argument-hint: [--dry-run]
disable-model-invocation: true
---

# Maintainer Check Cycle

Run a single maintainer cycle. This is the command that `/loop` or `/schedule` calls repeatedly.

## Dry-Run Mode

If `$ARGUMENTS` contains `--dry-run`:
- Run all scan and triage steps normally
- Show what would happen for each issue (which agents would spawn, which branches would be created, what severity/confidence classification)
- Do NOT actually spawn agents, create branches, create PRs, or modify state
- Format output as a preview:

```
DRY RUN — Maintainer Check Preview
=====================================

Issues found: 5
  #42 Safari login crash        → Critical x High  → WOULD: hotfix agent + human approval
  #38 Typo in error msg         → Low x High       → WOULD: auto-fix, batch into patch
  #45 API 500 on empty body     → High x High      → WOULD: fix + PR + request review
  #47 Missing rate limiting     → High x Medium    → WOULD: investigate then fix
  #51 Update dependencies       → Medium x Medium  → WOULD: investigate, queue

Release queue: 2 items → WOULD: batch into v1.2.4

No changes made. Run without --dry-run to execute.
```

This is useful for building trust before enabling full auto-fix.

## Pre-flight

1. Check maintainer is enabled:
```bash
superx-state get '.maintainer.enabled'
```
If `false`, respond: "Maintainer mode is off. Run `/superx:maintain` to enable." and stop.

2. Read the full maintainer guide for reference:
   Read `skills/superx/references/maintainer-guide.md`

## Cycle Steps

### Step 1: Scan for new issues

Check all configured issue sources:

```bash
# Get configured sources
superx-state get '.maintainer.issue_sources'
```

**For GitHub issues:**
```bash
gh issue list --state open --json number,title,body,labels,createdAt --limit 20
```

**For error logs** (if "logs" is in issue_sources):
- Check for log paths in `superx-state get '.maintainer.log_paths'`
- Parse recent entries for ERROR/FATAL patterns
- Create synthetic issues for new error patterns

**For Elastic/Sentry** (if configured):
- Check configured endpoints in `superx-state get '.maintainer.error_tracking'`

### Step 2: Filter already-tracked issues

Compare scanned issues against `maintainer.pending_fixes` — skip any already being worked on.

### Step 3: Triage each new issue

For each new issue, classify using the routing matrix from the maintainer guide:

1. **Classify severity**: Critical / High / Medium / Low
   - Read the issue body, labels, and any linked error logs
   - Critical: service down, data loss, security breach
   - High: major feature broken
   - Medium: minor bug, non-blocking
   - Low: typo, cosmetic, minor improvement

2. **Classify confidence**: High / Medium / Low
   - High: clear root cause, straightforward fix
   - Medium: likely cause, needs investigation
   - Low: unclear, needs human input

3. **Route based on matrix**:

   | Route | Action |
   |-------|--------|
   | Critical x Any | Alert user immediately. Spawn hotfix coder agent on a `hotfix/<issue>` branch. Require human approval before merge. |
   | High x High | Spawn coder agent on `fix/<issue>-<desc>` branch. Run test + lint + review agents. Create PR requesting human review. |
   | High x Medium | Spawn architect agent to investigate first. If root cause found, spawn coder. Create PR. |
   | Medium/Low x High | Spawn coder agent. Run quality pipeline. Add to release queue for batched patch. |
   | Medium/Low x Medium | Spawn architect to investigate. If fixable, add to release queue. |
   | Any x Low | Add to `maintainer.pending_fixes` with status "needs-human". Alert user with context. |

### Step 4: Track state

For each issue being worked on:
```bash
# Add to pending_fixes
superx-state set '.maintainer.pending_fixes += [{"issue": <NUMBER>, "status": "<status>", "severity": "<severity>", "confidence": "<confidence>", "branch": "<branch-name>"}]'
```

### Step 5: Check release queue

If there are 3+ items in `maintainer.release_queue`, or if the oldest item is more than 24 hours old:

1. Collect all queued fixes
2. Merge all fix branches into a `release/v<next-patch>` branch
3. Run full test suite on the release branch
4. If tests pass:
   - Bump version in package.json / pyproject.toml / Cargo.toml (whichever exists)
   - Generate changelog entry from PR descriptions
   - Create release tag: `git tag v<version>`
   - Create GitHub release: `gh release create v<version> --generate-notes`
   - Clear the release queue
   - Communicate: "Released v<version> with <N> fixes: <brief list>"
5. If tests fail:
   - Remove the failing fix from the batch
   - Retry the release without it
   - Flag the failing fix for investigation

### Step 6: Communicate

After the cycle, post a summary (only if there was activity):

- **New issues found**: "Found <N> new issues. <breakdown by severity>."
- **Fixes in progress**: "<N> fixes being worked on."
- **Release ready**: "Patch v<version> ready with <N> fixes."
- **Needs help**: "Stuck on #<N> — <brief context>."

If Slack skills are available and the user has opted in, post the summary to the configured channel.

### Step 7: Done

The cycle is complete. If running via `/loop`, it will repeat at the configured interval.
