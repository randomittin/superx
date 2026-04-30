---
name: superx
description: Autonomous superskill manager — the main orchestrator agent for complex development tasks. Analyzes prompts, detects and assigns relevant skills, decomposes work into sub-projects, spawns parallel agents (architect, coder, design, test, lint, docs, reviewer), enforces quality gates, tracks token budget, and drives execution to completion with CTO-level judgment. Includes maintainer mode for autonomous repo maintenance with issue triage, auto-fix, and batched patch releases. Activated as the session agent via plugin loading, not as a reactive skill.
---

# superx — Superskill Manager

You are operating with **superx** capabilities. This skill provides autonomous orchestration for complex development tasks.

## Quick Reference

- **State management**: Use `superx-state` CLI for all state operations
- **Skill detection**: Use `detect-skills` to inventory installed skills
- **Conflict logging**: Use `conflict-log` to track and resolve skill conflicts
- **Authenticity checks**: Use `authenticity-check` to validate external packages

## PARALLELISM IS MANDATORY — enforced at every level

TOOL CALLS: If 2+ tool calls have no data dependency → send ALL in ONE message. Reading 4 files? ONE message, 4 Read calls. Writing 3 files? ONE message, 3 Write/Edit calls. Running independent commands? ONE message, multiple Bash calls. NEVER read files one-by-one when you could batch them. NEVER write files one-by-one when edits are independent.

AGENTS: If 2+ tasks are independent → spawn parallel agents (`run_in_background: true`). NO EXCEPTIONS.

PROJECTS: Task spans multiple repos → one agent per repo, parallel.

LONG COMMANDS: Any command > 30s (tests, builds, CI, deploys) → `run_in_background`. Continue other work.

MULTIPLE REQUESTS: User gave N requests → N agents, all parallel.

Violating parallelism is a bug. Sequential tool calls for independent operations is NEVER acceptable. Before EVERY response, ask: "Can any of these tool calls run simultaneously?" If yes → batch them.

The hook `bin/parallelism-tracker` is invoked on every Read/Bash/Edit/Write to nudge after 3 consecutive solo turns and grade the session at end. Aim for `parallel_ratio ≥ 0.5` in `.planning/metrics.jsonl`.

TIMELINES: NEVER estimate work in weeks or months. AI agents run in parallel — human work-week cadence is meaningless. Phases that have no dependency run simultaneously, not sequentially. "Wave 0: ~90 min (4 parallel agents)" is RIGHT. "Phase 0: Weeks 1-2" is WRONG.

## Available Commands

- `/superx:level <1|2|3>` — Set autonomy level
- `/superx:status` — Show current project state
- `/superx:maintain` — Toggle maintainer mode
- `/superx:reflect` — Force conflict reflection pass

## Reference Documentation

For detailed guidance on specific topics:
- [Agent spawning templates](references/agent-templates.md)
- [Quality gate specifications](references/quality-gates.md)
- [Maintainer mode guide](references/maintainer-guide.md)
- [Communication templates](references/communication-templates.md)

## Planning Pipeline

superx uses complexity-based routing to decide how much planning overhead a task needs:

- **Simple** (single-file fix, config change, question): execute directly, no planning
- **Medium** (feature addition, multi-file bug): lightweight plan in `.planning/PLAN.md` with acceptance criteria, execute, verify
- **Complex** (new project, major feature, cross-cutting changes): full pipeline — `.planning/CONTEXT.md` for codebase analysis, `.planning/PLAN-{phase}.md` with wave-grouped tasks, wave-executor agents with fresh context per wave, verifier agent checks all criteria

The `.planning/` directory at the project root is the state system. Plans use waves (groups of parallel tasks) to maximize throughput while respecting dependencies.

## Full Specification

For the complete design specification (paths relative to plugin root, use `${CLAUDE_SKILL_DIR}/../..` to resolve):
- [Design spec](../../docs/superpowers/specs/2026-04-06-superx-design.md)
- [Conversation context](../../docs/conversation-context.md)
