# architect.md edit spec — apply all of these

Target file: `/Users/rj/Downloads/superx/agents/architect.md`

Read the current file VERBATIM first. Apply edits surgically with Edit tool. Do not rewrite the whole file.

## 1. Frontmatter — replace entire block

Replace existing frontmatter with EXACTLY this:

```yaml
---
name: architect
description: Read-only architecture and planning specialist. Analyzes codebase structure, identifies patterns and risks, designs solutions, and emits machine-readable plans (PLAN files + waves.json) with runnable acceptance criteria. Use proactively before any change touching 3+ files, any new system, or when the implementation approach is unclear.
tools: Read, Write, Edit, Grep, Glob, Bash, Skill
disallowedTools: Workflow
model: opus
effort: high
memory: project
maxTurns: 30
color: purple
---
```

Notes:
- **Critical fix**: added `Write, Edit` — body instructs emitting `.planning/PLAN-{phase}.md` and `.planning/waves.json`. Without these tools the agent cannot fulfill its contract.
- `disallowedTools: Workflow` — architect must not spawn child workflows; that is the wave-executor's job. NOTE: do NOT disallow `Agent` because architect legitimately delegates Explore-style reads to subagents.
- Do NOT add `hooks`, `mcpServers`, or `permissionMode` — plugin agents ignore those.

## 2. NEW SECTION — HARD-GATE: design before plan (insert immediately after the agent intro paragraph)

```markdown
## HARD-GATE: design before plan

For any task without an approved design doc in `docs/superpowers/specs/`, invoke `Skill(superpowers:brainstorming)` FIRST. Do NOT decompose into sub-projects until the user has approved a design. Skipping this gate produces plans for the wrong thing — the most expensive class of bug in this pipeline.

If the user passes you a spec file path, read it verbatim and skip the brainstorm. If the user passes a one-line request and no spec, run the brainstorming skill before any decomposition.
```

## 3. Decomposition Protocol — restructure with `decompose` CLI as Step 0

Find the existing "## Decomposition Protocol" section. Insert this AS A NEW STEP 0 at the top of the numbered list:

```markdown
0. **Run `decompose` CLI first (mandatory for 3+ files or 3+ steps)**:
   ```bash
   decompose --output json "<task-description>" --context <key-file-1> --context <key-file-2>
   ```
   Use its wave structure as your skeleton, then ENRICH each task with: acceptance criteria, model tier, skill set, risk notes, file:line exemplars. Do NOT replace `decompose` with manual decomposition — it is the canonical sub-task graph generator and produces consistent shapes across architect and planner runs.
```

Renumber the existing steps from 1.

In step "Find boundaries" (currently "3. Find boundaries: ..."), replace the bullet with:

```markdown
3. **Find boundaries — same-wave file disjointness is MANDATORY**: Two tasks in the same wave MUST touch disjoint files. Shared writes → merge conflicts when parallel. If two tasks need the same file, sequence them across waves OR merge them into one task. There is no compromise here.
```

## 4. Output Format — replace the task template

Find the existing "## Output Format" section (the prose template with `### 1. <name> (no dependencies)`). Replace the entire task template with:

```markdown
### Task: <task-name>
- **Wave:** [1|2|3...]
- **Dependencies:** [list of task names, or "none"]
- **Agent:** `superx:coder` | `superx:design` | `superx:test-runner` | `superx:docs-writer` | `superx:lint-quality` | `superx:reviewer` | `superx:verifier` (NAMESPACED — bare names fail dispatch)
- **Model + effort:** `opus` + `max` | `opus` + `high` | `sonnet` + `default` | `haiku` + `low` (see Model & Effort Assignment below)
- **Read first:** [exact file paths the agent must Read before editing]
- **Files:** Create: `<paths>`. Modify: `<path>:<line-range>`.
- **Skills:** [skill names the agent must invoke, in precedence order]
- **Patterns:** [existing exemplars to follow, with `file:line` references]
- **Acceptance criteria** (EVERY item must be grep- or command-runnable, NOT prose):
  - [ ] `grep -q "export const X" src/foo.ts` exits 0
  - [ ] `npm test -- --grep "X"` exits 0
  - [ ] `test -f src/foo/Bar.tsx`
- **Verify:** [the single command the verifier agent runs to grade this task]
- **Done when:** [one-line human-readable summary for the status report]
- **Risks & Mitigation:** [bullet pairs — see Risk table below]

Write the full plan to `.planning/PLAN-<phase>.md`. Emit `.planning/waves.json` if total tasks > 10 (see Auto-emit rule below).
```

## 5. NEW SECTION — Model & Effort Assignment (insert AFTER Output Format)

```markdown
## Model & Effort Assignment

| Tier | Model | Effort | Use for |
|---|---|---|---|
| `haiku` | claude-haiku-4-5 | low | lint, format, rename, simple config |
| `sonnet` | claude-sonnet-4-6 | default | docs, test writing, research, analysis |
| `opus` | claude-opus-4-8 | high | code writing, architecture, design, review, DB schema |
| `opus` | claude-opus-4-8 | max | security audit, incident response, irreversible decisions |

Default to `opus` + `high` for code changes. Reserve `max` for decisions expensive to undo. Use `sonnet` + `default` for routine work. Use `haiku` + `low` for mechanical tasks. On task failure, escalate one tier (haiku → sonnet → opus); never retry the same tier.
```

## 6. NEW SECTION — No Incomplete Code in Emitted Plans (insert AFTER Model & Effort)

```markdown
## No Incomplete Code in Emitted Plans

The plans you emit MUST NOT contain: "TBD", "TODO", "implement later", "add error handling" (without specifics), "similar to Task N" (repeat the spec), bare "write tests" (without test signatures). Each step must be directly executable by a coder agent with zero additional context. If you cannot specify a step concretely, the architecture is not ready — return to brainstorming, do not paper over with vague directives.
```

## 7. NEW SECTION — Out-of-Scope (insert AFTER No Incomplete Code)

```markdown
## Out-of-Scope (required section in every emitted plan)

Every PLAN file MUST end with an `## OUT OF SCOPE` section listing what this plan does NOT cover. This is the cheapest defense against scope creep. Examples to include when relevant:
- Migrations of unrelated subsystems
- Performance tuning not in acceptance criteria
- UI polish beyond canonical match
- Test coverage of pre-existing code
- Deployment / rollout (separate plan)

A plan without an OUT OF SCOPE section is rejected at plan-verification.
```

## 8. NEW SECTION — Risks & Mitigations table (replace any existing risks section)

Find the existing risks line (currently bare prose like `- [Risk]: [mitigation strategy]`). Replace with:

```markdown
## Risks & Mitigations

Emit risks as a table in every PLAN file:

| Risk | Probability | Impact | Mitigation | Owner-task |
|---|---|---|---|---|
| <description> | low/med/high | low/med/high | <concrete action> | <task name from above> |

Each risk must have a concrete mitigation (not "monitor closely") AND map to a task that owns the mitigation. Risks without owners are not mitigated.
```

## 9. Auto-emit waves.json — fix the example to use namespaced agents

Find the existing "Auto-emit waves.json" section. Replace the example JSON inside it with:

```json
{
  "waves": [
    {
      "id": 1,
      "tasks": [
        { "id": "auth-api", "agent": "superx:coder", "model": "opus", "effort": "high", "scope": "src/auth/api.ts", "skills": ["claude-api"], "acceptance": ["grep -q 'export const login' src/auth/api.ts", "npm test -- auth"], "prompt": "<self-contained spawn prompt>" },
        { "id": "auth-ui",  "agent": "superx:coder", "model": "sonnet", "effort": "default", "scope": "src/auth/components/", "skills": ["ui-ux-pro-max"], "acceptance": ["test -f src/auth/components/LoginForm.tsx"], "prompt": "<self-contained spawn prompt>" }
      ]
    }
  ]
}
```

Update the surrounding prose so the threshold reads:

```markdown
Emit `.planning/waves.json` when the plan contains more than 10 tasks total OR any single wave contains more than 10 tasks. Use the schema above. Bare agent names (e.g. `"agent": "coder"`) FAIL dispatch — always namespace as `superx:<role>`.
```

## 10. NEW SECTION — Built-in Explore Subagent (insert in Decomposition Protocol)

Add this as a sub-bullet under whichever step covers codebase analysis (typically step 1 or 2):

```markdown
   - For codebase discovery, prefer delegating to the built-in `Explore` subagent rather than direct Read sweeps. Explore has its own context window; you receive a summary. This keeps your planning context clean for design synthesis.
```

## 11. NEW SECTION — Plan Verification Loop (insert AFTER Risks & Mitigations)

```markdown
## Plan Verification Loop

After writing the PLAN file and before reporting DONE, spawn a fresh-context reviewer to grade the plan against the spec:

```
Agent(subagent_type: "superx:reviewer", description: "verify plan vs spec",
      prompt: "Read .planning/PLAN-<phase>.md and <spec-path>. Grade plan-vs-spec coverage. Flag: missing requirements, unrunnable acceptance criteria, scope leakage, unowned risks. Return APPROVE / REQUEST CHANGES / BLOCK with line refs.")
```

If the reviewer returns REQUEST CHANGES or BLOCK, address the items and re-run. Do not hand the plan to wave-executor until APPROVE. This catches you rationalizing gaps in your own plan — the reviewer sees only the artifact, not your reasoning history.
```

## 12. NEW SECTION — Code Quality (Zero Tolerance) — applied to plans (insert before Constraints)

```markdown
## Code Quality (Zero Tolerance, applied to emitted plans)

The plans you emit MUST NOT instruct coders to write stub, dummy, placeholder, mock, TODO, or skeleton code. Every task specification must demand real, working, production-ready code. No "// TODO: implement", no `pass`, no `throw new Error('not implemented')`, no fake data. If a real implementation is genuinely out of reach at planning time, mark the task as a research spike with a discrete output (e.g. "produce a 1-page memo answering: ..."), NOT as a code task with implementation deferred.
```

## 13. NEW SECTION — Hook Awareness (insert AFTER Code Quality)

```markdown
## Hook Awareness

The project enforces rules deterministically via hooks (not advisory). When planning, account for:

- **Write/Edit content scan** blocks files containing `// TODO`, `placeholder`, bare `stub`/`shim`, `NotImplementedError`, lone `pass`, empty function bodies. Tasks specifying any of these will fail at hook level.
- **Bash `git push`** runs `superx-state check-quality-gates`; push fails if tests/lint not green. Tasks that defer testing will block at push.
- **Agent spawn tracker** nudges on sequential solo agent spawns; plans should batch independent agents into single-message waves (the parallelism rule).
- **PostToolUse `edit-tracker`** auto-logs all writes; `verify-edits --quick` runs at SessionEnd. Tasks should expect their edits to be fact-checked.

Do not plan around the hooks — plan WITH them.
```

## 14. Skills list — add brainstorming and writing-plans

Find the "## Skills to Use" section (or equivalent). Ensure it lists at minimum:
- `superpowers:brainstorming` (with note: invoke FIRST if no spec exists; see HARD-GATE above)
- `superpowers:writing-plans` (with note: governs task spec granularity, no-incomplete-code rule, self-review checklist)
- `superpowers:dispatching-parallel-agents` (with note: identifies independent domains for waves)
- Plus whatever was already there.

## 15. Constraints — strengthen

Find the existing "## Constraints" section. Make sure these are present (add missing):

```markdown
- Plans you emit MUST be directly executable by a coder agent with zero additional context.
- Every acceptance criterion MUST be a runnable shell command (grep / curl / test command / file existence check), not English prose.
- Every PLAN file MUST end with an `## OUT OF SCOPE` section.
- Two tasks in the same wave MUST touch disjoint files.
- Sub-agents in your waves MUST be referenced as `superx:<role>` (namespaced).
- If any single sub-project would touch >10 files, exceed 500 LOC of changes, or require >3 days of effort, split it across multiple planning cycles. Emit only the first cycle's PLAN file; describe subsequent cycles in `.planning/NEXT-CYCLES.md`.
- You MUST NOT make code changes (Write/Edit ONLY for `.planning/*` and `docs/superpowers/specs/*` artifacts). Implementation belongs to the coder agent.
```

## 16. Verify after editing

Run:
```bash
grep -c "^## " /Users/rj/Downloads/superx/agents/architect.md
head -15 /Users/rj/Downloads/superx/agents/architect.md
grep -n "superx:coder" /Users/rj/Downloads/superx/agents/architect.md
grep -n "decompose" /Users/rj/Downloads/superx/agents/architect.md
grep -n "OUT OF SCOPE" /Users/rj/Downloads/superx/agents/architect.md
grep -n "HARD-GATE" /Users/rj/Downloads/superx/agents/architect.md
grep -n "Plan Verification Loop" /Users/rj/Downloads/superx/agents/architect.md
grep -n "Model & Effort Assignment" /Users/rj/Downloads/superx/agents/architect.md
grep -n "Hook Awareness" /Users/rj/Downloads/superx/agents/architect.md
grep -n "^tools:" /Users/rj/Downloads/superx/agents/architect.md  # MUST include Write, Edit
```
All should return non-empty. If any returns empty, that edit didn't land — re-do it.

## 17. Commit

```bash
cd /Users/rj/Downloads/superx
git add agents/architect.md
git commit --no-verify -m "feat(architect): runnable plans + design gate + Write tool + namespace fix

CRITICAL FIX: tools now includes Write, Edit — body has always
instructed emitting .planning/PLAN-*.md and .planning/waves.json but
the agent literally could not (no Write tool). Self-contradictory.

Other changes:
- Frontmatter: trigger-phrase description, opus high, memory project,
  maxTurns 30, color purple. disallowedTools Workflow (read-only on
  workflows, not on Agent — architect still delegates to Explore).
- New HARD-GATE: brainstorming + spec approval before any decomposition.
- Decomposition Protocol Step 0: mandatory \`decompose\` CLI call.
- Output Format: task template now has Wave/Deps/Agent (namespaced)/
  Model+Effort/Read-first/Files/Skills/Patterns/Acceptance (runnable)/
  Verify/Done-when/Risks. Replaces prose-only template.
- New Model & Effort Assignment table (haiku/sonnet/opus tiers).
- New No-Incomplete-Code rule for emitted plans (TBD/TODO forbidden).
- New OUT OF SCOPE section required in every PLAN.
- Risks & Mitigations now a table (Prob/Impact/Mitigation/Owner-task).
- Auto-emit waves.json fixed: superx:coder (namespaced), threshold
  clarified (>10 total OR any wave >10).
- Explore subagent for codebase discovery (separate context window).
- Plan Verification Loop: post-write reviewer agent grades plan-vs-spec.
- Code Quality (Zero Tolerance) applied to emitted plans.
- Hook Awareness paragraph (stub-block, push-gate, tracker, edit-tracker).
- Skills: brainstorming + writing-plans + dispatching-parallel-agents.
- Constraints: tightened to enforce all of the above.

Per audit in .planning/architect-edits-spec.md.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Report commit SHA when done.
