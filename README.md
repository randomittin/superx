# superx

**Autonomous superskill manager for Claude Code.**

Turn a single prompt into a finished project. superx decomposes work into sub-projects, spawns parallel agents, enforces quality gates, and drives execution end-to-end — with the judgment of a senior dev / CTO.

A real-time **pixel-art dashboard** ships with the plugin so you can watch the work happen: a live isometric city map of your project, a war room of agents, a streaming logs panel, and a clean timeline of every decision.

---

## Features

- **One prompt → finished project.** Drop a task in, get a working repo back.
- **Single-phase end-to-end execution** with `--dangerously-skip-permissions`, full plugin access, parallel `Agent` spawning, and any installed Skill at Claude's disposal.
- **Question-mark protocol.** Claude only stops to ask when it actually needs you. The dashboard surfaces the question with quick-pick buttons and a free-form input.
- **Conversation continuity.** User replies use `claude --resume <session_id>` so Claude has the full prior turn in context.
- **Real-time pixel dashboard.** Isometric city map of your packages, war room of agents, streaming logs, day/night theme, fullscreen mode, hover tooltips on buildings, drag-to-pan, zoom, history drawer with renameable past sessions.
- **Quality gates.** Tests, lint, code review, conflict reflection — enforced via PreToolUse hooks before any push.
- **Auto-checkpointing.** Background `git add -A && git commit` every N file writes, plus a recovery checkpoint so a crash never loses work.
- **History persistence.** Every session is archived with a smart auto-generated title; rename, browse, or replay any past run from the drawer.
- **Maintainer mode.** Opt-in continuous repo maintenance — triage issues, fix, test, review, batch into a release.
- **Token budgets.** Set a budget per session and get warned at 80%.
- **GitHub integration.** One-click commit + push to your remote, even from inside the dashboard.

---

## Quick start

### 1. Clone

```bash
git clone https://github.com/randomittin/superx.git
cd superx
```

### 2. Install Claude Code (if you haven't)

Follow the [official install guide](https://docs.claude.com/en/docs/claude-code/setup) — superx works with Claude Code 1.0+.

### 3. Pick a runtime

You have two ways to use superx:

#### Option A — Pixel dashboard (recommended)

```bash
# Start the local dashboard server
python ui/server.py
# Then open http://localhost:8080 in your browser
```

The dashboard handles project selection, prompt entry, GitHub remote setup, image attachments, and live observability — no terminal juggling required.

> Requires Python 3.11+. No external Python dependencies — everything is stdlib.

#### Option B — Direct CLI

```bash
# Add bin to your PATH (or symlink the launcher)
export PATH="$PATH:$(pwd)/bin"

# Run superx in any project directory
cd /path/to/your/project
superx "build a real-time dashboard with auth and charts"
```

### 4. Optional: install as a Claude Code plugin

Make superx's agents and slash commands available globally:

```bash
claude --plugin-dir /absolute/path/to/superx
```

---

## How the dashboard works

1. **Set the project directory** (click the GitHub icon in the top right, paste a path).
2. **Type a task** in the prompt bar at the bottom and hit RUN.
3. Watch the **timeline** (left) show each decision, tool use, and agent spawn in real time. The **logs panel** (right) streams the raw Claude output. The **map tab** (right, default) renders your project as an isometric city — buildings light up as their packages are touched, agent sprites animate over them.
4. If Claude needs input, the bottom prompt bar transforms into an **awaiting-input panel** with the question highlighted, auto-detected option buttons (`(A)`, `(B)`, …), and a SEND button. Reply and Claude resumes the same conversation.
5. When the task finishes, the status badge returns to **IDLE** and the session is archived to the history drawer (clock icon, top right). Click any past session to replay its full timeline + logs.

### Map controls

- **+ / −** zoom
- **Sun/Moon** toggle day / dawn / dusk / night theme
- **⛶** fullscreen
- **Drag** to pan
- **Hover** any building for a tooltip with the package name and file count

### Status badges

| Badge | Meaning |
|---|---|
| `IDLE` | Nothing running |
| `RUNNING` | Claude subprocess actively streaming |
| `AWAITING INPUT` | Claude finished with a question, waiting on you |
| `ERROR` | Subprocess exited non-zero |

---

## Architecture

```
superx/
├── .claude-plugin/plugin.json    # Plugin manifest (v1.0.0)
├── agents/                       # Specialized agent definitions
│   ├── superx.md                 # Main orchestrator (Opus)
│   ├── architect.md              # Decomposition + planning (Opus)
│   ├── coder.md                  # Implementation (Opus)
│   ├── design.md                 # UI/UX (Opus)
│   ├── test-runner.md            # Test execution (Sonnet)
│   ├── lint-quality.md           # Lint/format (Haiku)
│   ├── docs-writer.md            # Docs (Sonnet)
│   └── reviewer.md               # Code review (Opus)
├── skills/superx/                # Main skill + reference docs
│   ├── SKILL.md
│   └── references/               # Agent templates, quality gates, maintainer guide
├── commands/                     # Slash commands
│   ├── level.md                  # /superx:level
│   ├── status.md                 # /superx:status
│   ├── maintain.md               # /superx:maintain
│   ├── maintain-check.md         # /superx:maintain-check
│   └── reflect.md                # /superx:reflect
├── hooks/hooks.json              # PreToolUse + PostToolUse quality gates
├── bin/                          # CLI tools (launcher, state, helpers)
│   ├── superx                    # Main launcher
│   ├── superx-state              # State CRUD
│   ├── detect-skills             # Match installed skills to required domains
│   ├── conflict-log              # Conflict logging
│   └── authenticity-check        # Plugin/package marketplace verification
├── ui/                           # Pixel dashboard
│   ├── server.py                 # Stdlib HTTP + SSE server
│   └── static/                   # HTML/CSS/JS + sprite tiles
├── docs/superpowers/specs/       # Design docs
├── settings.json                 # Default settings
├── CHANGELOG.md
├── LICENSE                       # MIT
└── README.md                     # This file
```

---

## Single-phase flow

superx runs Claude end-to-end with a tiny state machine:

```
idle ──submit prompt──> running ──stream ends──> idle
                          │              │
                          │              └── (ends with "?") ──> awaiting_user_input
                          │                                              │
                          └──────────────── (user reply) <───────────────┘
```

The server prepends an **INPUT PROTOCOL** instruction to every prompt so Claude knows: end with `?` only if you need user input, otherwise complete the task and finish with a statement. The detector looks at the last assistant text (after stripping trailing whitespace and closing markdown punctuation) and only opens the awaiting panel when it actually sees a `?`.

All Claude capabilities are preserved across the boundary:
- `--dangerously-skip-permissions`
- `--plugin-dir <superx>`
- `--output-format stream-json --verbose`
- Agent spawning, skill use, file writes, bash execution

User replies use `claude --resume <session_id>` so Claude has the full conversation in context.

---

## Autonomy levels

| Level | Name | Behavior |
|---|---|---|
| 1 | Guided | Asks approval on every action |
| 2 | Checkpoint | Runs autonomously, pauses at milestones (default) |
| 3 | Full Auto | Runs until complete or blocked |

Change with `/superx:level <1\|2\|3>` or cycle with `/superx:level +` / `-`.

---

## Slash commands

| Command | Description |
|---|---|
| `/superx:level <1\|2\|3\|+\|->` | Set or cycle autonomy level |
| `/superx:status` | Show project state and quality gates |
| `/superx:maintain [on\|off\|status]` | Activate maintainer mode (guided setup wizard) |
| `/superx:maintain-check [--dry-run]` | Run one maintenance cycle (or preview) |
| `/superx:reflect` | Force a conflict reflection pass |

---

## Quality gates

Every push must pass:
1. All tests passing
2. Lint clean (zero warnings)
3. Conflict reflection done
4. Code review completed
5. No dirty (untested) changes

These are enforced via the `hooks/hooks.json` PreToolUse hook on `git push`.

---

## Maintainer mode

Opt-in continuous repo maintenance with one command:

```bash
/superx:maintain
```

Walks you through setup (issue sources, check frequency, optional Slack notifications) and then runs continuously: triage → fix → test → review → batch release.

| Severity × Confidence | What happens |
|---|---|
| Critical × Any | Alert + hotfix + human approval |
| High × High | Auto-fix + PR + request review |
| Medium/Low × High | Auto-fix, batch into a patch release |
| Any × Low | Escalate with full context |

Communicates like a colleague: "Spotted a regression in v1.2.3 — investigating."

---

## Requirements

- **Claude Code** 1.0+ with valid auth ([install guide](https://docs.claude.com/en/docs/claude-code/setup))
- **Python** 3.11+ (for the dashboard; stdlib only)
- **Git** (for auto-checkpointing and pushes)
- **`jq`** (for state CLI helpers): `brew install jq` (macOS) / `apt-get install jq` (Linux)
- **`gh` CLI** (optional, for GitHub integration): `brew install gh`

---

## Troubleshooting

### Dashboard says "Set a project directory first"
Click the GitHub icon (top right of the header), enter the absolute path to the project where Claude should write code, then optionally a remote URL. The path is persisted in `superx-github.json`.

### Claude finishes but the dashboard says it's still running
Check `ps aux | grep claude` — the subprocess should be gone. If it's hung, click STOP. If the dashboard's status badge is wrong, refresh the page (the SSE handshake replays the current state).

### Approval panel never appears even though Claude asked something
Claude's response must end with a literal `?` for the detector to fire. The system prompt teaches Claude this convention, but if you've added your own wrapper that overrides it, restore the rule. See `docs/superpowers/specs/2026-04-10-single-phase-flow-design.md` for the protocol.

### "Resuming from checkpoint" loop
Stop superx (`/api/stop` or the STOP button). Delete `superx-checkpoint.json` and `superx-session.json`. Restart the server.

### Server is running but the page won't load
Default port is 8080. Override with `SUPERX_PORT=9090 python ui/server.py`. If the page loads but the map is blank, check the browser console — sprite tile loads can fail behind some content blockers.

---

## Local testing

```bash
# Initialize state in any project directory
cd /path/to/your/project
superx-state init
superx-state status

# Set a token budget (optional)
superx-state set-budget 500000

# Migrate older state files to latest schema
superx-state migrate

# Verify skill detection
detect-skills | jq .

# Test authenticity checker
authenticity-check npm express
authenticity-check github vercel/next.js

# Preview maintainer actions without executing
/superx:maintain-check --dry-run

# Generate a changelog from git commits
generate-changelog --version 1.3.0
```

---

## Contributing

PRs welcome! See [CHANGELOG.md](CHANGELOG.md) for the release history and [docs/superpowers/specs/](docs/superpowers/specs/) for design docs.

---

## License

[MIT](LICENSE)
