# Changelog

All notable changes to superx will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-06

### Added
- Design agent (`agents/design.md`) for UI/UX work with design-for-ai skill integration
- `/superx:maintain-check` command — runs one full maintenance cycle (scan → triage → fix → release)
- `/superx:level +/-` cycling — quick autonomy level switching without remembering numbers
- Guided maintainer activation wizard — one-command setup for issue sources, frequency, Slack notifications
- Plugin marketplace authenticity checking (was stubbed, now validates registry + manifest + GitHub signals)
- Slack skill integration in orchestrator for team communication
- `.gitignore` for clean repo hygiene
- Development setup and local testing instructions in README
- Test framework auto-detection in test-runner agent (jest, pytest, cargo, go, make)
- Dependency validation in conflict-log script

### Changed
- `/superx:maintain` upgraded from simple toggle to guided setup wizard with first-check-on-activation
- Maintainer mode now supports configurable issue sources (GitHub, logs, Sentry/Elastic)
- Resolved all 4 open design questions in spec (skill detection, state sync, cron, keybindings)
- Updated LICENSE copyright holder

### Fixed
- SKILL.md spec paths now use relative paths from plugin root
- detect-skills now has --help/usage documentation

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
