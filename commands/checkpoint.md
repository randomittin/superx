---
name: checkpoint
description: Save a checkpoint of current work state. Creates/updates .planning/ files so the next superx session resumes with full context. Run this before closing a session or at any milestone.
---

# Checkpoint — Save Current State

Create or update ALL `.planning/` state files so the next `superx` run resumes exactly where you left off.

## What to save

Read the current state of the project and write/update these files:

### 1. `.planning/STATE.md`
Update with:
- **Current phase**: what phase are we in (planning, executing wave N, verifying, idle)
- **What's done**: list completed tasks/features with commit hashes
- **What's in progress**: currently active work
- **What's next**: queued tasks not yet started
- **Blockers**: anything preventing progress
- **Decisions made**: key architectural/design decisions from this session
- **Key files changed**: list of files modified in this session

### 2. `.planning/CONTEXT.md`
Update with:
- Tech stack observations from this session
- Patterns discovered in the codebase
- User preferences expressed during the session
- Constraints encountered

### 3. `.planning/CHECKPOINT.md` (NEW — the handoff note)
Write a concise handoff note that another Claude session can read and immediately continue:

```markdown
# Checkpoint — [timestamp]

## TL;DR
[One sentence: what was the task, how far did we get]

## Completed
- [x] Task 1 (commit abc1234)
- [x] Task 2 (commit def5678)

## In Progress
- [ ] Task 3 — started, file X partially edited

## Not Started
- [ ] Task 4
- [ ] Task 5

## Resume Instructions
[Exact next step: "Run tests in src/auth/, fix any failures, then proceed to Task 4"]

## Key Context
- [Decision 1: chose X over Y because Z]
- [File A imports from File B — don't break this]
- [User wants: specific preference]
```

### 4. Git checkpoint
```bash
git add -A && git commit -m "superx: checkpoint — [brief description]"
```

## Rules
- ALWAYS write `.planning/CHECKPOINT.md` — this is the most important file
- Keep the handoff note under 50 lines — terse, actionable
- Include commit hashes for everything completed
- The "Resume Instructions" section should be specific enough that a fresh Claude session can start working immediately without asking questions
