# superx — Superskill Manager Design Specification

**Date:** 2026-04-06
**Status:** Draft — pending approach selection and user approval

---

## 1. Vision

superx is an autonomous superskill manager for Claude Code. It reads a user's prompt, identifies which skills are needed, combines their capabilities, spawns parallel agents, and drives execution to completion — all with the judgment of a senior dev / CTO.

It is not just a skill router. It is a full orchestration layer that thinks like a product team: it decomposes work, assigns agents for code, design, docs, testing, and review, enforces quality gates, and maintains state across sessions.

---

## 2. Core Capabilities

### 2.1 Intelligent Skill Detection & Composition

**How it works:**
1. User submits a prompt (e.g., "build a dashboard with auth and real-time charts")
2. superx analyzes the prompt to identify required domains (auth, frontend, data viz, real-time)
3. It scans all installed skills/plugins and matches them to the identified domains
4. It composes a unified execution plan that draws instructions from multiple skills

**Skill gap detection:**
- If superx identifies a domain need that no installed skill covers, it searches:
  - Official Claude plugins marketplace
  - Any registered third-party marketplaces
  - MCP servers, npm packages, GitHub repos
- Before recommending any external resource, superx validates **publisher authenticity** (verified publisher, download count, recency, license compatibility)
- Presents recommendations: "I notice you don't have a real-time WebSocket skill. Here are trusted options: [list]. Want me to install one?"

### 2.2 Autonomy Levels

Three levels, cycleable at any time:

| Level | Name | Behavior |
|-------|------|----------|
| 1 | **Guided** | Asks for approval on every action (file edits, commands, agent spawns) |
| 2 | **Checkpoint** (default) | Runs autonomously, pauses at major milestones (sub-project completion, PR creation, deployment) |
| 3 | **Full Auto** | Runs until complete, only stops if blocked or encounters an error it can't resolve |

**How to change levels:**
- **Slash command:** `/superx:level 1`, `/superx:level 2`, `/superx:level 3`
- **Adaptive suggestions:** superx notices patterns:
  - If user approves everything without changes at Level 1 → suggests bumping to Level 2
  - If user keeps rejecting/modifying at Level 3 → suggests stepping down to Level 2
  - These suggestions are non-intrusive, shown inline

### 2.3 Agent Spawning & Orchestration

superx thinks like a **product team**, not a solo developer:

**Agent types it spawns:**
- **Architect agent** — decomposes large tasks into sub-projects with dependency graphs
- **Coder agents** — implement features, one per independent sub-project (parallel where possible)
- **Design agent** — handles UI/UX decisions, uses design-for-ai skills
- **Test agent** — maintains the test bench, writes and runs tests continuously
- **Lint/Quality agent** — enforces lint standards, code style, static analysis
- **Docs agent** — keeps documentation in sync with implementation
- **Review agent** — uses PR review skills before any code is pushed

**Each agent receives:**
- Specific scope and clear goal
- Relevant skill instructions loaded for that agent
- Access to superx-state.json for shared context
- Constraints on what NOT to do (prevent overlap)

**Parallel execution:**
- Independent sub-projects run in parallel
- Dependent sub-projects are sequenced automatically based on the dependency graph
- superx monitors all agents, collects results, handles failures

### 2.4 "At It" Mode

The core execution loop:

```
while task_not_complete:
    1. Assess current state (what's done, what's left)
    2. Identify next actions (which agents to spawn/continue)
    3. Execute actions (respecting current autonomy level)
    4. Run quality checks (tests, lint, review)
    5. Update state (superx-state.json + CLAUDE.md)
    6. If blocked → escalate to user (or attempt self-resolution at Level 3)
    7. If milestone reached and Level ≤ 2 → checkpoint with user
```

This loop continues until:
- All sub-projects are complete
- All tests pass
- All quality gates clear
- The user confirms completion

---

## 3. Quality Gates

Every piece of work superx produces passes through mandatory quality gates:

### 3.1 Conflict Resolution Log

When multiple skills give contradictory instructions, superx:
1. Uses its judgment (CTO mindset) to pick the approach that best fits the current context
2. Logs the conflict and its resolution to `superx-state.json → conflict_log[]`
3. Before raising any PR, runs a **reflection pass** over the conflict log to ensure all resolutions were sound

### 3.2 Pre-Push Checklist

Before any code reaches git:

1. **Tests pass** — test bench is always maintained and run
2. **Lint clean** — enforced standards, zero warnings policy
3. **Conflict reflection** — reviews all logged conflicts since last push
4. **PR review skill** — mandatory code review before push
5. **CLAUDE.md updated** — project context kept current

### 3.3 Test Bench

superx always maintains a ready test bench:
- Tests are written alongside (or before, if TDD) implementation
- Test agent runs continuously as code changes
- Coverage tracking — flags untested paths
- Integration tests for cross-system interactions

---

## 4. State Management

### 4.1 Human-Readable State: CLAUDE.md

- Project context, goals, current phase
- Active decisions and their rationale
- Links to relevant specs and docs
- Updated at every major milestone

### 4.2 Internal State: superx-state.json

```json
{
  "version": "1.0.0",
  "project": {
    "name": "project-name",
    "phase": "implementing",
    "autonomy_level": 2
  },
  "plan": {
    "sub_projects": [
      {
        "id": "auth",
        "status": "complete",
        "agent_id": "agent-auth-001",
        "depends_on": [],
        "skills_used": ["superpowers:tdd", "security-guidance"]
      }
    ],
    "dependency_graph": {}
  },
  "conflict_log": [
    {
      "timestamp": "2026-04-06T10:30:00Z",
      "skills": ["skill-a", "skill-b"],
      "conflict": "description of contradiction",
      "resolution": "chose skill-a's approach because...",
      "reflected": false
    }
  ],
  "agent_history": [],
  "quality_gates": {
    "tests_passing": true,
    "lint_clean": true,
    "last_review": "2026-04-06T10:45:00Z",
    "conflict_reflection_done": true
  },
  "maintainer": {
    "enabled": false,
    "issue_sources": [],
    "pending_fixes": [],
    "release_queue": []
  },
  "communication_log": []
}
```

### 4.3 GitHub Integration

- Proper branching strategy (feature branches, release branches)
- Semantic versioning (semver) for releases
- Clean commit history with meaningful messages
- Tag-based releases with changelogs
- Draft PRs for work-in-progress, ready PRs when quality gates pass

---

## 5. Maintainer Mode (Opt-In)

Activated separately — superx asks: "Want me to maintain this repo and handle issues/fixes automatically?"

### 5.1 Issue Ingestion

Sources:
- GitHub Issues (primary)
- Elastic / server logs (if configured)
- Error tracking services (Sentry, etc.)
- Direct user reports via team chat

### 5.2 Triage & Fix Workflow

```
Issue detected
  → Classify severity (critical / high / medium / low)
  → Classify confidence (can auto-fix / needs investigation / needs human)

  For auto-fixable (low severity + high confidence):
    → Spawn coder agent with fix
    → Run tests
    → Add to patch release batch
    → Auto-merge after tests pass

  For investigation needed:
    → Spawn investigator agent
    → If fix found → create PR, wait for human merge
    → If unclear → escalate to user with context

  For critical:
    → Immediately alert team
    → Spawn agent for hotfix
    → Fast-track through quality gates
    → Human approval required for merge
```

### 5.3 Batched Patch Releases

- Groups related small fixes (lint, typos, minor bugs)
- Proper semver bump (patch for fixes, minor for features)
- Auto-generated changelog from commit messages and conflict log
- Release tag + GitHub release with notes

### 5.4 Team Communication

superx communicates like a colleague, not a bot:

- **Issue found:** "Spotted a null pointer in the auth middleware on v1.2.3. Investigating."
- **Fix in progress:** "Found the root cause — the session token validation wasn't handling expired tokens. Writing a fix with tests."
- **Fix ready:** "Fixed in PR #47. Also batched two related edge cases. Tests pass. Ready for v1.2.4."
- **Needs help:** "I'm stuck on issue #23 — the expected behavior isn't clear from the spec. Can you clarify: should expired tokens return 401 or 403?"

---

## 6. Skill Ecosystem Integration

### 6.1 Skills superx Always Uses

| Skill | Purpose |
|-------|---------|
| `claude-md-management:claude-md-improver` | Context persistence, CLAUDE.md maintenance |
| `pr-review-toolkit:review-pr` | Mandatory pre-push code review |
| `superpowers:writing-plans` | Plan creation for sub-projects |
| `superpowers:dispatching-parallel-agents` | Parallel agent orchestration |
| `superpowers:test-driven-development` | Test-first development |
| `superpowers:verification-before-completion` | Pre-completion verification |
| `superpowers:finishing-a-development-branch` | Clean branch completion |

### 6.2 Skills superx Uses Conditionally

Detected from prompt analysis:
- `design-for-ai:*` — when UI/UX work is involved
- `seo:*` — when web content/SEO is relevant
- `superpowers:systematic-debugging` — when debugging is needed
- `slack:*` — for team communication
- Any other installed skill that matches the task domain

### 6.3 Skill Gap Recommendations

When no installed skill matches a detected need:
1. Search official + third-party marketplaces
2. Search MCP servers, npm, GitHub
3. Validate publisher authenticity (verified status, stars, license, activity)
4. Present options ranked by trust score
5. Install on user approval

---

## 7. Success Criteria

- A user can say "build me X" and superx handles everything from planning to shipping
- Quality of output matches or exceeds what a skilled developer following all best practices would produce
- Maintainer mode keeps repos healthy with minimal human intervention
- Works across Claude Code CLI, desktop app, and web
- Clean, well-documented, well-tested codebase that others want to contribute to
