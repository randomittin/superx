---
name: maintain
description: Run automated maintenance — seeker finds bugs from pod logs and raises GitHub issues, fixer picks them up and creates PRs. Can run as a one-shot or scheduled via /routine.
---

# Maintain — Automated Bug Detection & Fix Pipeline

Two-phase maintenance: **seek** then **fix**.

## Usage

`/superx:maintain` — run once (seek + fix)
`/superx:maintain seek` — only find bugs, raise issues
`/superx:maintain fix` — only fix existing issues
`/superx:maintain auto` — schedule recurring via /routine

## Phase 1: Seek

Spawn a **seeker agent** to:
1. Pull logs from Kubernetes pods (or local logs, docker, cloud)
2. Analyze for errors, crashes, anomalies
3. Deduplicate by stack trace signature
4. Raise GitHub issues with full context (labeled "bug,seeker")

## Phase 2: Fix

Spawn a **fixer agent** to:
1. List open issues: `gh issue list --label bug --state open`
2. For each issue (oldest first):
   - Create fix branch from main
   - Implement minimal fix
   - Run tests
   - Push + create PR (with "closes #N")
3. Move to next issue

## Phase 3: Auto (scheduled)

Set up recurring maintenance:
```
/routine "run /superx:maintain" --every 6h
```

Or manually schedule:
```
/schedule "/superx:maintain" --cron "0 */6 * * *"
```

This runs seeker first, waits for issues to be created, then runs fixer on the new + existing issues.

## Rules
- Seeker checks for duplicate issues before creating
- Fixer creates one branch + one PR per issue
- Fixer never modifies main directly
- If a fix is unclear, fixer comments on the issue instead
- All PRs need human review before merge
