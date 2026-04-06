# Changelog

All notable changes to superx will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-06

### Added
- Initial plugin scaffold with `.claude-plugin/plugin.json`
- Main orchestrator agent (`agents/superx.md`) with CTO-level orchestration loop
- Specialized subagents: architect, coder, test-runner, lint-quality, docs-writer, reviewer
- Launcher script (`bin/superx`) for one-command startup
- State management CLI (`bin/superx-state`) with full CRUD on `superx-state.json`
- Skill detection helper (`bin/detect-skills`)
- Conflict logging helper (`bin/conflict-log`)
- Publisher authenticity checker (`bin/authenticity-check`)
- Quality gate hooks (PreToolUse blocks push if gates fail, PostToolUse marks dirty state)
- Slash commands: `/superx:level`, `/superx:status`, `/superx:maintain`, `/superx:reflect`
- Main skill with reference documentation (agent templates, quality gates, maintainer guide, communication templates)
- Full design specification in `docs/`
- Agent teams support via experimental feature flag
