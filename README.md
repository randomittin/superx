# superx

**One prompt → finished project.** 14 specialized agents, 10-parallel execution, project-specific skill learning, mechanical checkpointing, ~75% token savings. Beats raw Claude Code usage.

[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-e056a0?style=flat-square)](https://code.claude.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-9b59b6?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-00d4ff?style=flat-square)](CHANGELOG.md)
[![Install](https://img.shields.io/badge/install-curl-4ecca3?style=flat-square)](#quick-start)

```bash
curl -fsSL https://raw.githubusercontent.com/randomittin/superx/main/install.sh | bash
```

<details>
<summary><strong>What is superx?</strong></summary>

superx makes Claude Code **dramatically more capable** than using it directly:

- **14 specialized agents** (security auditor, database architect, incident responder, etc.) — each with the right model + effort level
- **10-parallel execution** — independent files/projects run simultaneously, not sequentially
- **Project-specific skill learning** — extracts patterns from your codebase into `.planning/skills/`, applies them on future tasks. Gets better with every run.
- **Mechanical checkpointing** — `/superx:checkpoint` saves state + project settings. Next session resumes with full context injected into the prompt. Zero context loss between sessions.
- **Wave-based planning with acceptance gates** — tasks grouped by dependency, verified before and after execution, truth-scored 0.0-1.0
- **~75% token savings** via caveman ultra mode + model routing (Haiku for lint, Sonnet for docs, Opus for code)
- **Pixel-art dashboard** — isometric city map, war room, streaming logs, session history
- **Auto-escalation** — task fails on Haiku → retry on Sonnet → retry on Opus. Never waste expensive tokens, never ship bad code.

**Keywords:** Claude Code plugin, Claude AI agent, Anthropic, autonomous coding agent, multi-agent orchestration, AI pair programmer, LLM agent framework, developer automation, CTO-level AI, parallel agent execution, pixel-art dashboard, wave-based execution, acceptance criteria gates, token compression, caveman mode, cross-session memory, autonomous repo maintenance.

</details>

<details>
<summary><strong>Features</strong></summary>

- **One prompt → finished project.** Drop a task in, get a working repo back.
- **Hybrid planning pipeline.** Complexity-aware: simple tasks execute directly, medium/complex go through planning → parallel execution → verification.
- **Wave-based parallel execution.** Tasks grouped into dependency waves. Each wave runs in parallel with fresh 200K-token context — no context rot.
- **Acceptance criteria as blocking gates.** Every task has runnable checks (grep, curl, test commands). Tasks cannot advance until all criteria pass.
- **Plan verification before execution.** Plans validated up to 3 iterations before code is written.
- **File-based state in `.planning/`.** Human-readable Markdown committed to git. Survives `/clear`.
- **Question-mark protocol.** Claude only stops to ask when it actually needs you. Dashboard surfaces the question with quick-pick buttons.
- **Conversation continuity.** Replies use `claude --resume <session_id>` for full context.
- **Real-time pixel dashboard.** Isometric city map, war room, streaming logs, day/night theme, history drawer.
- **Companion plugins auto-installed.** caveman (~75% token savings), superpowers (brainstorming), claude-mem (persistent memory).
- **Quality gates.** Tests, lint, code review — enforced via hooks before any push.
- **Atomic commits per task.** Each task = one git commit. Bisectable, revertable.
- **Auto-checkpointing.** Background git commits + crash recovery.
- **Maintainer mode.** Autonomous repo maintenance — triage, fix, test, batch release.
- **Token budgets.** Set a budget, get warned at 80%.
- **GitHub integration.** One-click commit + push from the dashboard.

</details>

---

## Quick start

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/randomittin/superx/main/install.sh | bash
```

This installs Node.js (if missing) → Claude Code → superx → companion plugins (caveman, superpowers, claude-mem). Then:

```bash
source ~/.zshrc   # or open a new terminal
cd /path/to/your/project
superx "build a real-time dashboard with auth and charts"
```

### Or install via Claude Code plugin marketplace

```bash
claude plugins marketplace add randomittin/superx-marketplace
claude plugins install superx
```

### Or install manually

```bash
git clone https://github.com/randomittin/superx.git ~/.superx
export PATH="$PATH:$HOME/.superx/bin"
```

### Prerequisites

- **Claude Code** 1.0+ with valid auth ([install guide](https://docs.claude.com/en/docs/claude-code/setup))
- **Python** 3.11+ (for the dashboard; stdlib only, no pip install)
- **Git**

---

## Usage

```bash
superx "deploy to vercel"     # Run a task end-to-end
superx                        # Interactive Claude session with superx powers
superx --dashboard            # Start the pixel dashboard (http://localhost:8080)
superx --update               # Pull latest version from GitHub
superx --setup                # Re-run companion plugin setup
superx --help                 # Show help
```

superx launches Claude Code with:
- `--dangerously-skip-permissions` — full autonomy
- `--plugin-dir <superx>` — all superx agents + skills loaded
- `--agent superx` — CTO-level orchestrator as main agent
- **caveman** — token compression (~65-75% savings)
- **superpowers** — brainstorming, debugging, skill-creator
- **claude-mem** — persistent memory across sessions

### Dashboard mode

```bash
cd /path/to/your/project
superx --dashboard
# open http://localhost:8080
```

Auto-sets the current directory as the project. Click `+ NEW` to start a fresh project with a native folder picker.

---

## How it works — the hybrid pipeline

superx assesses every incoming task and routes it through the right level of planning:

```
User prompt
    ↓
Assess complexity
    ├── Simple (single-file fix, config, question)
    │     → Execute directly. No planning overhead.
    │
    ├── Medium (feature addition, 2-5 file bug)
    │     → Lightweight plan with acceptance criteria → execute → verify
    │
    └── Complex (new project, major feature, 6+ files)
          → Full pipeline ↓

Init .planning/ in project dir
    ↓
Discuss — analyze codebase, surface assumptions → CONTEXT.md
    ↓
Plan — planner agent creates PLAN-{phase}.md
    • Tasks grouped into dependency waves
    • Each task: read_first, action, acceptance_criteria, verify, done
    • Self-verification loop (max 3 iterations)
    ↓
Execute — wave by wave, parallel within each wave
    • Wave 1 (no deps) → fresh context, parallel subagents
    • Wave 2 (depends on 1) → fresh context, parallel subagents
    • Each task = atomic git commit
    • Acceptance criteria BLOCK progression
    ↓
Verify — verifier checks ALL criteria + requirement coverage
    • PASS → ship
    • FAIL → diagnosis + fix plan → re-execute
```

### Why fresh context per wave?

After 4-5 agents complete work and report back, accumulated conversation history can exceed 100K+ tokens. The next wave's agents would be working in degraded context. Instead, each wave gets a clean 200K-token window — just the plan, the context doc, and the source files it needs. No garbage from prior waves.

### Why acceptance criteria as gates?

A task like "Create login API" isn't done when code is written. It's done when:
```
grep "export const login" src/api.ts       # function exists
curl -s localhost:3000/api/login | jq .    # endpoint responds
npm test -- --grep "auth"                   # tests pass
```

These are blocking — the wave-executor won't commit until all pass. If they fail after 2 fix attempts, the task is marked BLOCKED and the orchestrator escalates.

---

## `.planning/` state directory

All planning state lives as human-readable Markdown in your project's `.planning/` directory:

| File | Purpose |
|---|---|
| `PROJECT.md` | Vision, constraints, tech stack |
| `REQUIREMENTS.md` | v1 (must-have), v2 (next), out-of-scope |
| `STATE.md` | Living memory: current phase, decisions, blockers, metrics. YAML frontmatter derived from body content (rebuilt on every write). |
| `CONTEXT.md` | Per-phase user preferences + codebase assumptions |
| `PLAN-{phase}.md` | Task specifications with waves, acceptance criteria, dependencies |
| `SUMMARY-{phase}.md` | Execution results with commit hashes |

These files are:
- **Human-readable** — open them in any editor
- **Git-committable** — track planning decisions in version history
- **Session-surviving** — persist across `/clear` and server restarts
- **Concurrent-safe** — lockfile-based mutual exclusion for parallel agents

---

## Agent roster

| Agent | Role | Model | Effort | When spawned |
|---|---|---|---|---|
| `superx` | Main orchestrator | Opus | max | Always (session agent) |
| `architect` | Decomposition + planning | Opus | high | Complex tasks |
| `planner` | Wave-grouped plans + acceptance criteria | Opus | high | Medium + complex tasks |
| `wave-executor` | Execute one wave (up to 10 parallel) | Opus | high | Per wave during execution |
| `verifier` | Sentinel gate + truth scoring | Opus | high | After each phase |
| `coder` | Feature implementation | Opus | high | Simple + within waves |
| `design` | UI/UX design | Opus | high | When UI work detected |
| `security-auditor` | OWASP, secrets scan, auth review | Opus | max | Complex tasks with auth/API |
| `database-architect` | Schema, migrations, query optimization | Opus | high | Data layer tasks |
| `incident-responder` | Triage, diagnose, mitigate, postmortem | Opus | max | Production fires |
| `reviewer` | Code review before push | Opus | high | Quality gate |
| `test-runner` | Test writing and execution | Sonnet | default | Quality gate |
| `docs-writer` | Documentation | Sonnet | default | Post-execution |
| `lint-quality` | Lint and formatting | Haiku | low | Quality gate |

---

## Architecture

```
superx/
├── .claude-plugin/plugin.json    # Plugin manifest (v1.0.0)
├── agents/                       # 14 specialized agent definitions
│   ├── superx.md                 # Main orchestrator (Opus)
│   ├── architect.md              # Decomposition + planning (Opus)
│   ├── planner.md                # Structured plans with acceptance criteria
│   ├── wave-executor.md          # Per-wave parallel execution
│   ├── verifier.md               # Post-execution verification
│   ├── coder.md                  # Implementation (Opus/high)
│   ├── design.md                 # UI/UX (Opus/high)
│   ├── security-auditor.md       # OWASP + secrets scan (Opus/max)
│   ├── database-architect.md     # Schema + migrations (Opus/high)
│   ├── incident-responder.md     # Production fires (Opus/max)
│   ├── reviewer.md               # Code review (Opus/high)
│   ├── test-runner.md            # Tests (Sonnet/default)
│   ├── docs-writer.md            # Docs (Sonnet/default)
│   └── lint-quality.md           # Lint (Haiku/low)
├── skills/superx/                # Main skill + reference docs
├── commands/                     # Slash commands
├── hooks/
│   ├── hooks.json                # Quality gate hooks (4 event types)
│   └── statusline.sh             # HUD for Claude Code status bar
├── bin/                          # CLI tools
│   ├── superx                    # Main launcher (self-bootstrapping)
│   ├── lib/planning.sh           # .planning/ state management
│   ├── lib/dispatch.sh           # File-based task dispatch queue
│   ├── superx-state              # State CRUD
│   ├── detect-skills             # Skill inventory
│   ├── conflict-log              # Conflict tracking
│   └── authenticity-check        # Package verification
├── ui/                           # Pixel dashboard
│   ├── server.py                 # Stdlib HTTP + SSE server (auto-updates on startup)
│   └── static/                   # HTML/CSS/JS + 35 sprite tiles
├── docs/superpowers/specs/       # Design docs
├── install.sh                    # One-line installer
├── settings.json                 # Default settings
├── CHANGELOG.md
├── LICENSE                       # MIT
└── README.md                     # This file
```

---

## Companion plugins (auto-installed)

| Plugin | What it does | Impact |
|---|---|---|
| **[caveman](https://github.com/juliusbrussee/caveman)** | Terse output compression | ~65-75% output token savings |
| **[superpowers](https://github.com/anthropics/claude-plugins-official)** | Brainstorming, debugging, skill-creator | Better planning + design quality |
| **[claude-mem](https://github.com/thedotmack/claude-mem)** | Persistent memory across sessions | No repeated context between sessions |

All three are installed automatically on first run (`superx --setup` to re-run).

---

## Dashboard

### How it works

1. **Set the project directory** — click `+ NEW` or the GitHub icon, browse for a folder or type a path.
2. **Type a task** in the prompt bar and hit RUN.
3. Watch the **timeline** (left) and **logs panel** (right) update in real time. The **map tab** renders your project as an isometric city.
4. If Claude needs input, the **awaiting-input panel** opens with the question, auto-detected option buttons, and a SEND button.
5. When done, the session is archived to the **history drawer** (clock icon).

### Map controls

| Control | Action |
|---|---|
| **+ / −** | Zoom |
| **Sun/Moon** | Day / dawn / dusk / night theme |
| **⛶** | Fullscreen |
| **Drag** | Pan |
| **Hover** | Building tooltip with package name + file count |

### Status badges

| Badge | Meaning |
|---|---|
| `IDLE` | Nothing running |
| `RUNNING` | Claude subprocess actively streaming |
| `AWAITING INPUT` | Claude finished with a question, waiting on you |
| `ERROR` | Subprocess exited non-zero |

---

## Autonomy levels

| Level | Name | Behavior |
|---|---|---|
| 1 | Guided | Asks approval on every action |
| 2 | Checkpoint | Runs autonomously, pauses at milestones (default) |
| 3 | Full Auto | Runs until complete or blocked |

Change with `/superx:level <1|2|3>` or cycle with `/superx:level +` / `-`.

---

## Slash commands

| Command | Description |
|---|---|
| `/superx:level <1\|2\|3\|+\|->` | Set or cycle autonomy level |
| `/superx:status` | Show project state and quality gates |
| `/superx:maintain [on\|off\|status]` | Activate maintainer mode |
| `/superx:maintain-check [--dry-run]` | Run one maintenance cycle |
| `/superx:reflect` | Force a conflict reflection pass |

---

## Quality gates

Every push must pass:
1. All tests passing
2. Lint clean (zero warnings)
3. Conflict reflection done
4. Code review completed
5. No dirty (untested) changes

Enforced via `hooks/hooks.json` PreToolUse hook on `git push`.

---

## Maintainer mode

```bash
/superx:maintain
```

Continuous repo maintenance: triage → fix → test → review → batch release.

| Severity x Confidence | Action |
|---|---|
| Critical x Any | Alert + hotfix + human approval |
| High x High | Auto-fix + PR + request review |
| Medium/Low x High | Auto-fix, batch into patch release |
| Any x Low | Escalate with context |

---

## Requirements

- **Claude Code** 1.0+ ([install guide](https://docs.claude.com/en/docs/claude-code/setup))
- **Python** 3.11+ (stdlib only)
- **Git**
- **`jq`** (for state helpers): `brew install jq`
- **`gh` CLI** (optional): `brew install gh`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Set a project directory first" | Click `+ NEW` or GitHub icon, enter path |
| Map shows old project | Click `+ NEW`, set the new path — map auto-refreshes |
| Awaiting panel never appears | Claude's response must end with `?`. Check system preamble isn't overridden |
| "Resuming from checkpoint" loop | Click STOP. Delete `superx-checkpoint.json` + `superx-session.json`. Restart server |
| Page won't load | Default port 8080. Override: `SUPERX_PORT=9090 python ui/server.py` |
| `superx: command not found` | Run `source ~/.zshrc` or add `export PATH="$PATH:$HOME/.superx/bin"` to your shell profile |
| SSH permission denied on install | The marketplace uses HTTPS. Run `claude plugins marketplace update superx-marketplace` |

---

## Tips and tricks

### Safer alternative to skip-permissions

```bash
superx --auto "build X"     # uses --permission-mode auto instead
```

Auto-mode uses a background safety classifier — blocks prompt injection and risky escalation while still letting superx work autonomously.

### Project memory via CLAUDE.md

superx auto-generates a `CLAUDE.md` in your project root on first run. This file survives `/clear` and session restarts — Claude reads it on every new session for persistent project conventions, architecture notes, and style rules.

### Flicker-free rendering

superx sets `CLAUDE_CODE_NO_FLICKER=1` automatically for stable alt-screen rendering with mouse support. No configuration needed.

### Recovery from errors

```bash
# Inside Claude Code:
/rewind                    # undo recent changes
# or press Esc Esc

# Outside:
superx --resume            # continue last conversation with full context
```

### Voice input

```bash
# Inside a superx session:
/voice                     # push-to-talk, 20 languages
```

### Remote control

```bash
# Inside a superx session:
/rc                        # continue from phone/tablet/browser
```

### Parallel sessions with git worktrees

superx's wave-executor already uses `isolation: worktree` for parallel tasks. For manual multi-session work:

```bash
# Terminal 1:
cd /project && superx "build auth"

# Terminal 2:
cd /project && superx "build dashboard"
```

Each gets its own git worktree — no conflicts.

### Chrome integration

```bash
claude --chrome --plugin-dir ~/.superx   # browser automation
```

Test web apps, debug console, automate forms, extract data.

### Scheduled background tasks

```bash
# Inside a superx session:
/loop "run tests and report failures"     # local, recurring
/schedule "check for dependency updates"  # cloud, Anthropic infrastructure
```

---

## Inspired by

- **[get-shit-done](https://github.com/gsd-build/get-shit-done)** — wave-based execution, acceptance criteria gates, `.planning/` state files, plan verification loops
- **[caveman](https://github.com/juliusbrussee/caveman)** — token compression via terse communication
- **[claude-mem](https://github.com/thedotmack/claude-mem)** — persistent cross-session memory
- **[claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)** — comprehensive tips, tricks, and workflow patterns

---

## Contributing

PRs welcome. See [CHANGELOG.md](CHANGELOG.md) for release history and [docs/superpowers/specs/](docs/superpowers/specs/) for design docs.

---

## License

[MIT](LICENSE)
