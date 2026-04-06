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

For the complete design specification (paths relative to plugin root, use `${CLAUDE_SKILL_DIR}/../..` to resolve):
- [Design spec](../../docs/superpowers/specs/2026-04-06-superx-design.md)
- [Conversation context](../../docs/conversation-context.md)
