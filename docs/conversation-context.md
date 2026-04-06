# superx — Design Conversation Context

Full Q&A from the brainstorming session that produced the design spec. This captures the user's exact intent and priorities.

---

## Q1: Skill Conflict Resolution

**Question:** When superx combines skills and they conflict (e.g., one says "use TDD", another says "code first"), how should it handle it?

**Options presented:** A) User-set priority order, B) Use judgment, C) Flag and ask user

**User's answer:** "does B and keeps maintaining a record of the conflicts it resolved to reflect back later on it. Also, it should always run the reflection before raising a PR and use the PR review skill before pushing anything to git. It should also enforce lint standards to ensure quality code and always have a test bench ready. it must always use claude-md-improver skill for saving and improving flow of things & maintain context at all times."

**Key takeaways:**
- Judgment-based conflict resolution with a logged history
- Mandatory reflection pass before any PR
- PR review skill is a hard gate before git push
- Lint enforcement is non-negotiable
- Test bench must always be maintained and ready
- claude-md-improver is the backbone for context persistence

---

## Q2: Skill Discovery & Recommendation Sources

**Question:** Where should superx look when it detects a skill gap?

**Options presented:** A) Official marketplace only, B) Any registered marketplace, C) Marketplaces + broader ecosystem (MCP servers, npm, GitHub)

**User's answer:** "C -- but superx will need to check once the authenticity of the publisher"

**Key takeaways:**
- Cast the widest net for discovery
- Publisher authenticity validation is mandatory before recommending anything external

---

## Q3: Autonomy Level Switching

**Question:** How should the user switch autonomy levels mid-task?

**Options presented:** A) Slash command, B) Adaptive suggestions from superx, C) Both

**User's answer:** "C and also arrow key style effort changing similar to claude code"

**Key takeaways:**
- Three input methods: slash command, adaptive suggestions, keyboard shortcut
- UX should mirror Claude Code's existing effort slider paradigm
- Seamless, low-friction level changes

---

## Q4: Large Project Decomposition

**Question:** How should superx handle tasks too big for a single plan?

**Options presented:** A) Decompose → sequential execution, B) Decompose → parallel where possible, C) Let user choose

**User's answer:** "B -- always take a wholesome product approach. Ensure many agents are spawned to handle even auxiliary tasks such as designing and enable usage of skills accordingly for those agents."

**Key takeaways:**
- Parallel by default for independent sub-projects
- **"Wholesome product approach"** — this is a core philosophy. superx doesn't just spawn coders. It spawns design agents, documentation agents, testing agents, review agents. It simulates a full product team.
- Every agent gets equipped with the skills relevant to its role

---

## Q5: Context Maintenance Across Sessions

**Question:** How should superx preserve state when context windows compress or sessions change?

**Options presented:** A) Rely on CLAUDE.md, B) Own structured state file, C) Both

**User's answer:** "C for local/cloud hosted claude and human and superx-state for own tracking -- also ensure the whole superx works well with github and maintain versioning to ensure final shipping is apt. Also, explore if a maintainer cron like service can built to take the issues when they arise from the usage and then can be fixed in subsequent release versions. It can also ask users in those cases where it needs guidance to fix a particular issue or user behaviour."

**Key takeaways:**
- Dual state: CLAUDE.md for humans, superx-state.json for internal tracking
- GitHub integration is first-class: proper versioning, branching, clean releases
- **Maintainer cron service** — a background process that:
  - Monitors for issues from real usage
  - Auto-fixes what it can
  - Asks users for guidance when it can't determine the right fix
  - Groups fixes into batched releases

---

## Q6: Maintainer Service Fix Workflow

**Question:** When the maintainer detects an issue, how should the fix workflow work?

**Options presented:** A) Auto-create issue + branch + draft PR, wait for human merge, B) Same but auto-merge low-severity/high-confidence fixes, C) Same but batch related fixes into patch releases

**User's answer:** "C -- also ensure all actions taken by superx are of a senior dev/CTO style mindset to fix and improve -- either via maintainer or via spawned agent coders or by triaging other issues fetched from channels such as elastic/server-logs for issue keeping/tracking. maintainer to be turned on as a separate flag -- the superx can ask user if it wants superx to maintain the repos and fixes."

**Key takeaways:**
- **CTO mindset** is the operating principle for ALL superx actions — not mechanical, but strategic
- Issue ingestion from multiple sources: GitHub, Elastic, server logs, error tracking
- Maintainer mode is **opt-in** — superx asks "want me to maintain this repo?"
- Batched patch releases with proper semver

---

## Q7: Community / Viral Strategy

**Question:** Should superx have built-in community features for virality?

**Options presented:** A) Pure quality, let the tool speak, B) Shareable workflow presets, C) Leaderboard/showcase

**User's answer:** "A for now -- also add a capability for it to chat with the invoker/team to share updates on various issues. Things like, I saw this issue in this version of release -- I'm looking into it. And then later, I fixed it."

**Key takeaways:**
- Launch clean — quality over gimmicks
- **Team communication** is a feature, not a nice-to-have. superx talks like a team member:
  - "Spotted a regression in v1.2.3 — investigating."
  - "Found the root cause. Fix with tests in PR #47."
  - "Batching with two other small fixes for v1.2.4."
- Channels: Slack, GitHub comments, in-session messages

---

## User's Core Priorities (distilled)

1. **CTO-level judgment** — every decision, fix, and triage reflects senior engineering thinking
2. **Full product team simulation** — not just code agents, but design, docs, test, review, lint agents
3. **Quality is non-negotiable** — tests, lint, PR review, conflict reflection are hard gates
4. **Autonomous but accountable** — does the work, but maintains full logs and communicates proactively
5. **Ultra viral potential** — this should be the skill that makes the AI coding community sit up and take notice
6. **Maintainer mode** — a self-healing repo management system that keeps projects healthy long-term
7. **Context never lost** — dual state management ensures superx always knows where things stand
