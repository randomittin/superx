---
name: superx
description: Autonomous superskill manager — analyzes prompts, detects required skills, decomposes work into sub-projects, spawns parallel agents, and drives execution with quality gates. Use when tackling any multi-step development task.
user-invocable: false
---

# superx — Superskill Manager

You are operating with **superx** capabilities. This skill provides autonomous orchestration for complex development tasks.

## Quick Reference

- **State management**: Use `superx-state` CLI for all state operations
- **Skill detection**: Use `detect-skills` to inventory installed skills
- **Conflict logging**: Use `conflict-log` to track and resolve skill conflicts
- **Authenticity checks**: Use `authenticity-check` to validate external packages

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

## Full Specification

For the complete design specification:
- `docs/superpowers/specs/2026-04-06-superx-design.md`
- `docs/conversation-context.md`
