# superx — Design Decisions & Context

This document captures the key design decisions made during the planning phase of superx, including platform constraints discovered, architectural trade-offs, and priorities.

## Date: 2026-04-06

---

## Platform Constraints Discovered

### 1. Subagents Cannot Spawn Subagents

This is the single biggest constraint in Claude Code's architecture. Only the main session agent can use the `Agent()` tool to spawn subagents. Subagents themselves cannot spawn further subagents.

**Impact**: superx must run as the **main session agent** (via `claude --agent superx`), not as a subagent. This is why the launcher script uses `--agent superx`.

### 2. Agent Teams Are Experimental

Agent teams (multiple Claude Code instances coordinating via shared task lists and messaging) are behind the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` feature flag. They provide exactly what the spec needs for parallel orchestration.

**Decision**: Enable agent teams via `settings.json` env var. Use subagents for simple tasks (1-3 workers), agent teams for complex parallel work (4+ workers).

### 3. Skills Are Prompt-Based, Not Code

Claude Code skills are markdown files with instructions. They don't execute Python or JS directly. Shell commands can be run via `!command` dynamic injection or `bin/` executables.

**Decision**: All spec'd `scripts/*.py` files became `bin/` bash scripts using `jq` for JSON manipulation. The `bin/` directory is automatically added to PATH when the plugin is enabled.

### 4. No Custom Keybindings

Claude Code doesn't expose a keybinding API. The spec's arrow-key cycling for autonomy levels is not possible.

**Decision**: Autonomy levels are controlled exclusively via `/superx:level <1|2|3>` slash commands. Adaptive suggestions prompt the user to change levels based on behavior patterns.

### 5. Permission Modes Map to Autonomy Levels

Claude Code has built-in permission modes that align with the spec's autonomy levels:
- **Guided (Level 1)** ↔ `default` permission mode
- **Checkpoint (Level 2)** ↔ `acceptEdits` permission mode
- **Full Auto (Level 3)** ↔ `auto` or `bypassPermissions` mode

**Decision**: The launcher uses `--dangerously-skip-permissions` to give superx full control. Autonomy levels are managed by superx's own prompt logic (checking superx-state.json), not by switching Claude Code permission modes.

---

## Architecture Decisions

### Main Agent Pattern

superx runs as the main agent (`claude --agent superx`) rather than as a skill or subagent. This gives it:
- Access to the `Agent()` tool for spawning subagents
- Ability to use agent teams
- Full tool access
- Persistent memory via the `memory: project` frontmatter

### State Management: File-Based

State is managed via `superx-state.json` in the project root, manipulated by the `superx-state` bash CLI tool.

**Why not in-memory?** Subagents and agent teammates need to read/write shared state. The filesystem is the only shared resource between agents.

**Why bash/jq?** It's available everywhere, has no dependencies beyond `jq`, and works in any project regardless of language/runtime.

### Quality Gates via Hooks

The `PreToolUse` hook on the Bash tool intercepts `git push` commands and runs quality gate checks. If any gate fails, the hook exits with code 2, which blocks the tool execution.

This is more reliable than relying on the agent's prompt alone, because hooks execute at the system level regardless of what the agent decides.

### Agent Isolation via Worktrees

Coder and test-runner agents use `isolation: worktree` to get their own copy of the repository. This prevents parallel agents from conflicting on file changes. Agent teams handle this differently (each teammate is a full Claude Code instance).

---

## Priorities

1. **Correctness over speed**: Quality gates are non-negotiable. Every push must pass tests, lint, and review.
2. **Simplicity over cleverness**: Bash scripts over Python modules. File-based state over custom protocols.
3. **Platform-native over custom**: Use Claude Code's built-in subagents, hooks, and skills rather than reinventing.
4. **Incremental over big-bang**: The plugin works with just the main agent + basic commands. Advanced features (agent teams, maintainer mode) are opt-in layers.

---

## Open Items for Future Iterations

1. **Plugin marketplace submission**: Once stable, submit to the official Anthropic marketplace
2. **MCP server integration**: Add `.mcp.json` for external tool access (databases, monitoring, etc.)
3. **LSP integration**: Add `.lsp.json` for code intelligence in supported languages
4. **Design agent**: Not yet implemented — add when design-for-ai skills mature
5. **Slack integration**: Add when slack skills are available for team communication
6. **Remote triggers for maintainer mode**: More robust than `/loop` for production use
