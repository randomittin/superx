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

Change with: `/superx:level <1|2|3>` or cycle with `/superx:level +` / `/superx:level -`

## Commands

| Command | Description |
|---------|-------------|
| `/superx:level <1\|2\|3\|+\|->` | Set or cycle autonomy level |
| `/superx:status` | Show project state and quality gates |
| `/superx:maintain [on\|off\|status]` | Activate maintainer mode (guided setup) |
| `/superx:maintain-check` | Run one maintenance cycle (triage + fix + release) |
| `/superx:reflect` | Force conflict reflection pass |

## Agent Types

| Agent | Role | Model |
|-------|------|-------|
| `superx` | Main orchestrator | Opus |
| `architect` | Task decomposition, planning | Opus |
| `coder` | Feature implementation | Opus |
| `design` | UI/UX design, accessibility, design systems | Opus |
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

Opt-in autonomous repo maintenance with one-command activation:

```bash
/superx:maintain
```

Walks you through setup: issue sources, check frequency, Slack notifications.
Then runs continuously — triage, fix, test, review, batch release.

| Severity x Confidence | What happens |
|---|---|
| Critical x Any | Alert + hotfix + human approval |
| High x High | Auto-fix + PR + request review |
| Medium/Low x High | Auto-fix, batch into patch release |
| Any x Low | Escalate with context |

Communicates like a colleague: "Spotted a regression in v1.2.3 — investigating."

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
- `jq` (for state management): `brew install jq` (macOS) / `apt-get install jq` (Linux)
- `gh` CLI (for GitHub integration, optional): `brew install gh`

## Setup

```bash
# Clone
git clone git@github.com:randomittin/superx.git
cd superx

# Add bin to PATH (add to your .zshrc / .bashrc for persistence)
export PATH="$PATH:$(pwd)/bin"

# Load as a Claude Code plugin
claude --plugin-dir ./superx

# Or use the launcher directly
superx "build a dashboard with auth and real-time charts"
```

## Testing Locally

```bash
# Start superx in any project directory
cd /path/to/your/project
superx

# Check state management works
superx-state init
superx-state status

# Verify skill detection
detect-skills | jq .

# Test authenticity checker
authenticity-check npm express
authenticity-check github vercel/next.js
```

## License

MIT
