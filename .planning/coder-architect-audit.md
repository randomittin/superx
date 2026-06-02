# Audit task — coder + architect agent improvement

Read-only. Do not edit anything. Output one structured markdown report.

## Tasks

### 1. Baseline current agents (read VERBATIM)
- `/Users/rj/Downloads/superx/agents/coder.md`
- `/Users/rj/Downloads/superx/agents/architect.md`

For each, identify: frontmatter fields, body sections, length, weaknesses, internal contradictions, anything ambiguous, anything a senior dev would expect but is missing.

### 2. Survey related agents in the same repo for transferable patterns
- `/Users/rj/Downloads/superx/agents/planner.md`
- `/Users/rj/Downloads/superx/agents/wave-executor.md`
- `/Users/rj/Downloads/superx/agents/verifier.md`
- `/Users/rj/Downloads/superx/agents/reviewer.md`
- `/Users/rj/Downloads/superx/agents/test-runner.md`

What do they do better than coder/architect? Where do coder/architect diverge unnecessarily?

### 3. Survey installed superpowers skills for adjacent best practices
- `ls ~/.claude/plugins/cache/superpowers* 2>/dev/null`
- `find ~/.claude -path "*superpowers*skills*" -name "SKILL.md"`

Read these in particular: test-driven-development, systematic-debugging, verification-before-completion, writing-plans, subagent-driven-development, dispatching-parallel-agents, brainstorming, using-git-worktrees, finishing-a-development-branch.

For each, extract the 1-3 most impactful techniques the coder or architect agent should bake in.

### 4. Cross-reference superx project rules
- `/Users/rj/Downloads/superx/CLAUDE.md`
- `/Users/rj/Downloads/superx/hooks/hooks.json`
- `/Users/rj/Downloads/superx/bin/superx` preamble (around lines 888-995)

Note any place coder/architect bodies CONTRADICT project rules (parallelism, autocommit, stub-block, etc).

## Deliverable

One markdown document with sections:

1. **coder.md baseline** — fields + body outline + 8-12 specific weaknesses prioritized P0/P1/P2.
2. **architect.md baseline** — same shape.
3. **Transferable patterns** — table of techniques from other agents and superpowers skills the coder/architect should adopt, with one-line rationale each.
4. **Contradictions with project rules** — bullets with file:line refs.
5. **Proposed improvements** — for each of coder + architect, a prioritized list (P0/P1/P2) of concrete edits. Each edit gets a 3-5 line before/after minimal snippet.

Be specific. Quote file paths and line numbers. Every recommendation should be a concrete diff, not generic advice.
