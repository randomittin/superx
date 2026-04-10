# Changelog

All notable changes to superx will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-10

First marketplace-ready release. Pixel dashboard is feature-complete and the orchestration loop has been simplified to a clean single-phase state machine.

### Added
- **Pixel-art dashboard** (`ui/server.py` + `ui/static/`) — local Python HTTP+SSE server with a real-time isometric city map of your project, war room of agents, streaming logs panel, and timeline view of every decision.
- **Single-phase state machine** — `idle → running → awaiting_user_input → running → idle`. Replaces the old three-phase refining/planning/executing pipeline that was forcing approval gates whether you needed them or not.
- **Question-mark protocol** — every prompt sent to Claude is prefixed with an INPUT PROTOCOL instruction. Claude only stops to ask when it actually needs input; the dashboard detects the trailing `?` and opens an awaiting-input panel.
- **Awaiting-input panel** — orange-tinted panel showing the question, auto-detected option buttons (parses `(A)`, `(B)`, `(C)`, `(D)` patterns), yes/no detection for confirmation questions, and a free-form textarea + SEND button.
- **Conversation continuity** — user replies use `claude --resume <session_id>` so Claude has full prior turn in context. Session id captured from stream-json's `system / init` message.
- **Map features** — drag-to-pan, zoom +/-, day/dawn/dusk/night theme toggle, fullscreen mode, building hover tooltips, agent sprite animation over their working buildings, road/joint alignment, custom pixel cursor.
- **History drawer** — every session archived with a smart auto-generated title from the task prompt; rename, browse, or replay any past run. Hover any session card and click the pencil icon to rename inline.
- **Auto-checkpointing** — background `git add -A && git commit` every 5 file writes during long runs, plus a recovery checkpoint so a crash never loses work.
- **Resume bar** — restores the last interrupted task on server start, with a one-click RESUME button.
- **GitHub integration** — one-click commit + push from inside the dashboard with SSH remote auto-detection.
- **Token budgets** — set a budget per session and get warned at 80% via `superx-state set-budget`.
- **Image attachments** — drag-and-drop or paste images into the prompt; they're saved to a temp dir and Claude reads them via the Read tool.
- **Smart timeline grouping** — collapses repetitive tool calls from the same agent into a rolling window so the timeline stays readable on long runs.
- **Markdown rendering** with expand/collapse for long messages.
- **Day/night theming** for the entire dashboard, including the isometric city.
- **Terminal log dedup** via djb2 hash so re-posts from server reconnects don't double up.

### Changed
- Bumped to v1.0.0 with full marketplace metadata in `.claude-plugin/plugin.json` (homepage, repository, keywords, categories, engines).
- README rewritten with dashboard-first quick start, troubleshooting section, and architecture diagram.
- All multi-phase orchestration code (`start_planning`, `execute_approved_plan`, `revise_refinement`, `revise_plan`, `handle_approve`, `handle_revise`) removed in favor of the single-phase flow.
- `.gitignore` strengthened — explicitly excludes all runtime state files (`superx-state.json`, `superx-session.json`, `superx-history.json`, `superx-checkpoint.json`, `superx-github.json`, `superx-workspace/`) and user-generated docs.

### Fixed
- Approval UI no longer disappears after refining/planning completes (was a race between `prompt_refined` and `process exited` events).
- Session restore correctly shows awaiting-input state after a refresh (was tied to `pending_prompts` global which was only set during revise flow).
- SSE replay on reconnect — clients that connect after `awaiting_user_input` already fired now receive the event immediately so the panel opens correctly.
- Stale checkpoint resurrection prevented — `_auto_checkpoint_git` background thread no longer rewrites a cleared checkpoint after task completion.
- `start_claude` clears any leftover checkpoint before writing its own, so a new task never inherits state from a previous one.
- Translucent night-overlay box on the map fixed by moving the overlay outside the zoom transform.
- Road tile alignment with cumulative `(r+c)*4` y-shift correction so road segments and joints connect seamlessly.
- Building/filler/car positions use the same grid correction as roads for consistency.

## [0.2.0] - 2026-04-06

### Added
- Design agent (`agents/design.md`) for UI/UX work with design-for-ai skill integration.
- `/superx:maintain-check` command — runs one full maintenance cycle (scan → triage → fix → release).
- `/superx:level +/-` cycling — quick autonomy level switching without remembering numbers.
- Guided maintainer activation wizard — one-command setup for issue sources, frequency, Slack notifications.
- Plugin marketplace authenticity checking (was stubbed, now validates registry + manifest + GitHub signals).
- Slack skill integration in orchestrator for team communication.
- `.gitignore` for clean repo hygiene.
- Development setup and local testing instructions in README.
- Test framework auto-detection in test-runner agent (jest, pytest, cargo, go, make).
- Dependency validation in conflict-log script.

### Changed
- `/superx:maintain` upgraded from simple toggle to guided setup wizard with first-check-on-activation.
- Maintainer mode now supports configurable issue sources (GitHub, logs, Sentry/Elastic).
- Resolved all 4 open design questions in spec (skill detection, state sync, cron, keybindings).
- Updated LICENSE copyright holder.

### Fixed
- SKILL.md spec paths now use relative paths from plugin root.
- detect-skills now has --help/usage documentation.

## [0.1.0] - 2026-04-06

### Added
- Initial plugin scaffold with `.claude-plugin/plugin.json`.
- Main orchestrator agent (`agents/superx.md`) with CTO-level orchestration loop.
- Specialized subagents: architect, coder, test-runner, lint-quality, docs-writer, reviewer.
- Launcher script (`bin/superx`) for one-command startup.
- State management CLI (`bin/superx-state`) with full CRUD on `superx-state.json`.
- Skill detection helper (`bin/detect-skills`).
- Conflict logging helper (`bin/conflict-log`).
- Publisher authenticity checker (`bin/authenticity-check`).
- Quality gate hooks (PreToolUse blocks push if gates fail, PostToolUse marks dirty state).
- Slash commands: `/superx:level`, `/superx:status`, `/superx:maintain`, `/superx:reflect`.
- Main skill with reference documentation (agent templates, quality gates, maintainer guide, communication templates).
- Full design specification in `docs/`.
- Agent teams support via experimental feature flag.
