# Conflict records

One file per resolved conflict: `{date}-{id}.md` (e.g. `2026-06-12-001.md`).

Written by the OVERRIDING agent during the governance override flow (T-3), after
the 15-minute grace window. A conflict file is the auditable account of a claim
displacement — both sides, what survived, and how to recover what didn't.
Displaced work is preserved on a branch that is never deleted.

## Format

```
# Conflict {id} — {short title}

- **Date:** {ISO-8601 UTC}
- **Overriding HAID:** {haid that displaced the claim}  (role: owner|maintainer)
- **Displaced HAID:** {haid whose claim was displaced}
- **Surfaces:** {the contested globs / file#symbol refs}

## Both intents

- **Overriding agent wanted:** {what and why}
- **Displaced agent wanted:** {what and why}

## Resolution

- **Kept:** {which intent won, and why}
- **Displaced:** {what was set aside}
- **Preserved on branch:** `displaced/{haid-slug}-{task}`  (never deleted)

## Recovery path

{Exact steps to restore the displaced work if the resolution is reversed:
the branch name, the commits, how to re-apply or cherry-pick.}
```

Every conflict file is cross-linked from a `decisions.md` entry citing both HAIDs.
