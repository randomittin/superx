# superx

Autonomous superskill manager for Claude Code.

superx reads your prompt, identifies which skills are needed, decomposes work into sub-projects, spawns parallel agents, enforces quality gates, and drives execution to completion — with the judgment of a senior dev / CTO.

## Quick Start

```bash
# Add superx/bin to your PATH
export PATH="$PATH:/path/to/superx/bin"

# Run superx
superx "build a dashboard with auth and real-time charts"

# Or start interactively
superx
```

## What It Does

1. **Analyzes your prompt** — identifies required domains (auth, frontend, backend, etc.)
2. **Detects installed skills** — matches domains to your Claude Code skills/plugins
3. **Decomposes work** — creates sub-projects with dependency graphs
4. **Spawns agents** — architect, coder, test-runner, lint, docs, reviewer
5. **Runs in parallel** — independent sub-projects execute simultaneously
6. **Enforces quality** — tests, lint, code review before any push
7. **Maintains state** — tracks progress in `superx-state.json` across sessions

## Autonomy Levels

| Level | Name | Behavior |
|-------|------|----------|
| 1 | Guided | Asks approval on every action |
| 2 | Checkpoint | Runs autonomously, pauses at milestones (default) |
| 3 | Full Auto | Runs until complete or blocked |

Change with: `/superx:level <1|2|3>`

## Commands

| Command | Description |
|---------|-------------|
| `/superx:level <1\|2\|3>` | Set autonomy level |
| `/superx:status` | Show project state and quality gates |
| `/superx:maintain` | Toggle maintainer mode |
| `/superx:reflect` | Force conflict reflection pass |

## Agent Types

| Agent | Role | Model |
|-------|------|-------|
| `superx` | Main orchestrator | Opus |
| `architect` | Task decomposition, planning | Opus |
| `coder` | Feature implementation | Opus |
| `test-runner` | Test writing and execution | Sonnet |
| `lint-quality` | Lint and formatting checks | Haiku |
| `docs-writer` | Documentation maintenance | Sonnet |
| `reviewer` | Code review before push | Opus |

## Quality Gates

Every push must pass:
1. All tests passing
2. Lint clean (zero warnings)
3. Conflict reflection done
4. Code review completed
5. No dirty (untested) changes

## Maintainer Mode

Opt-in automatic repo maintenance:
- Watches GitHub issues
- Triages by severity and confidence
- Auto-fixes low-risk issues
- Batches fixes into patch releases
- Communicates like a colleague, not a bot

Enable: `/superx:maintain`

## Plugin Structure

```
superx/
├── .claude-plugin/plugin.json    # Plugin manifest
├── agents/                       # Agent definitions
├── skills/superx/                # Skill + reference docs
├── commands/                     # Slash commands
├── hooks/hooks.json              # Quality gate hooks
├── bin/                          # CLI tools
├── docs/                         # Spec + design decisions
└── settings.json                 # Default settings
```

## Requirements

- Claude Code (latest)
- `jq` (for state management)
- `gh` CLI (for GitHub integration, optional)

## License

MIT
