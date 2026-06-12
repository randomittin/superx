# Completed task records

One file per completed task: `{date}-{task}.md` (e.g. `2026-06-12-T2.md`).

Each record is the hand-off an agent writes at completion so the NEXT agent
inherits context without re-reading the whole diff. Keep it tight.

## Format

```
# {task-ref} — {one-line title}

- **HAID:** {haid of the agent that completed it}
- **Completed:** {ISO-8601 UTC}
- **Surfaces:** {globs / file#symbol refs that were touched}
- **Commits:** {short SHAs}

## Summary

{2-4 sentences: what shipped, what was verified.}

## Context capsule (<= 10 lines)

{<= 10 lines of the load-bearing context the next agent needs: gotchas,
decisions made, follow-ups, surfaces left intentionally untouched. This is the
"what you must know before you touch this area next" note — not a changelog.}
```

The capsule cap is hard: 10 lines. If it needs more, it belongs in `decisions.md`.
