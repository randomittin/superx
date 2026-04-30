---
name: report-bug
description: File a GitHub issue against the superx plugin repo from inside a session. Use when the user reports a bug, requests a feature, or wants to flag a docs/help-text problem in superx itself. Auto-fills environment (plugin SHA, OS, recent commits) and posts to randomittin/superx (or the plugin's origin remote). Returns the issue URL.
---

# /superx:report-bug — File an Issue Against the superx Plugin

Use when the user wants to report a bug, request a feature, or flag a docs problem in the superx plugin itself (NOT in the project they're working on).

## Process

1. **Classify the report** from the user's description:
   - `bug` — something in superx is broken or behaves wrong
   - `feature` — a new capability they want
   - `docs` — wrong/missing/confusing docs or help text
   - `question` — they want clarification (last resort — try answering first)
   - `enhancement` — improvement to existing behavior

   If unclear, ask one clarifying question. Do NOT spam questions.

2. **Gather details** — pull from the conversation and (if relevant) recent tool output:
   - What were they trying to do?
   - What did superx do instead?
   - Reproduction steps (concrete commands or actions)
   - Stack trace / error output (verbatim, in a fenced code block)
   - Expected behavior

3. **Compose the body** as Markdown. Use this template:

   ```markdown
   ## Summary
   <one or two sentences>

   ## Steps to reproduce
   1. ...
   2. ...

   ## Expected behavior
   <what should have happened>

   ## Actual behavior
   <what did happen, with error output verbatim>

   ## Additional context
   <any relevant details — only include if non-trivial>
   ```

   Write the body to a temp file (e.g. `/tmp/superx-issue-body-$$.md`).

4. **Compose a tight title** — under 70 chars, imperative or descriptive. Examples:
   - `bug: parallelism-tracker fails on linux-musl (no fcntl.h)`
   - `feature: add /superx:rollback to revert last wave`
   - `docs: agents/coder.md doesn't mention isolation: worktree`

5. **Invoke the helper**:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/bin/report-issue" \
     --title "<title>" \
     --body-file "/tmp/superx-issue-body-$$.md" \
     --kind <bug|feature|docs|question|enhancement>
   ```

   The helper auto-prepends an `## Environment` block with plugin SHA, OS,
   kernel, recent commits, and dirty cwd files. Do NOT duplicate that in
   your body — keep your body focused on the user's report.

6. **Show the result**:
   - On success the helper prints the issue URL — relay it to the user
     with one line: `Filed: <URL>`.
   - On failure (gh not authenticated, no network, repo not found),
     surface the exact error and suggest: `gh auth login`.

7. **Cleanup**: `rm -f /tmp/superx-issue-body-$$.md`

## Constraints

- This files against the **plugin repo** (the superx codebase), NOT the
  user's current project. Never confuse the two.
- Do NOT include secrets or auth tokens in the body. The helper does not
  scrub — you must.
- Do NOT auto-include the entire transcript. If the user wants a snippet
  attached, copy only the relevant turn(s).
- If the user says "report this" mid-conversation about a real bug, use
  this command without asking a second time — they already triggered it.

## Examples

User: "the tracker hook fails on my Linux box, fcntl.h is missing"
→ kind: bug | title: "bug: parallelism-tracker.c fails to build on linux-musl"
→ body: include the build error verbatim, kernel/arch, and what `clang`/`gcc` they used.

User: "add a way to roll back the last wave if it fails verification"
→ kind: feature | title: "feature: add /superx:rollback for last failed wave"
→ body: motivation + sketch of expected UX.
