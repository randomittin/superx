---
name: save
description: Save current work state for next session. Creates/updates .planning/ files (CHECKPOINT.md, STATE.md, settings.json) so superx resumes with full context. NOT a rewind — saves forward progress. Run before closing a session or at any milestone.
---

# Save — Checkpoint Current State

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

## Project Settings
- Parallelism: [max 10 / max 5 / sequential — what worked for this project]
- Model routing: [any overrides from defaults, e.g. "sonnet works fine for React components here"]
- Governance: [hierarchical / democratic / emergency last used]
- Test command: [exact command, e.g. "npm test", "pytest tests/", "cargo test"]
- Lint command: [exact command, e.g. "npx eslint src/", "ruff check ."]
- Build command: [exact command, e.g. "npm run build", "cargo build"]
- Deploy command: [if known]
- Directories to avoid: [e.g. "vendor/, generated/, dist/"]
- User preferences: [e.g. "prefers tabs over spaces", "wants detailed commit messages", "hates emojis in code"]
```

### 4. `.planning/settings.json` (project-specific superx config)
Write or update project-specific execution settings:

```json
{
  "parallelism": {
    "max_agents": 10,
    "min_agents_for_parallel": 2,
    "notes": "React components safe to parallelize, DB migrations must be sequential"
  },
  "model_routing": {
    "default_code": "opus",
    "default_effort": "high",
    "overrides": {
      "*.test.ts": "sonnet",
      "*.md": "sonnet",
      "*.css": "haiku"
    }
  },
  "commands": {
    "test": "npm test",
    "lint": "npx eslint src/ --fix",
    "build": "npm run build",
    "typecheck": "npx tsc --noEmit"
  },
  "governance": "hierarchical",
  "avoid_dirs": ["node_modules", "dist", ".next", "vendor"],
  "user_preferences": []
}
```

This file is read mechanically on every `superx` launch (injected into preamble alongside CHECKPOINT.md). Claude doesn't need to "discover" test/lint/build commands — they're hardcoded from the first run.

### 5. Git checkpoint
```bash
git add -A && git commit -m "superx: checkpoint — [brief description]"
```

## Rules
- ALWAYS write `.planning/CHECKPOINT.md` — this is the most important file
- ALWAYS write `.planning/settings.json` — project settings must persist
- Keep the handoff note under 60 lines — terse, actionable
- Include commit hashes for everything completed
- The "Resume Instructions" section should be specific enough that a fresh Claude session can start working immediately without asking questions
- The "Project Settings" section captures how THIS project likes to be built — commands, parallelism, model preferences
- Update `settings.json` whenever you discover a new command or preference (don't wait for checkpoint)
