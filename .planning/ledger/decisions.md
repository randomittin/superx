# Decisions (ADR-lite, append-only)

The Coordination Ledger's decision log (spec T-2 / T-3). Every entry is
HAID-attributed and append-only — decisions are recorded, never rewritten, so
the history of who decided what (and why) stays auditable in git.

Entries are written by:
- `heimdall-claim reap` / auto-release — when a TTL-expired or heartbeat-dead
  claim is released (notes the displaced HAID + task; surfaces are freed).
- The governance override flow (T-3) — when an owner/maintainer displaces
  another agent's active claim, the final resolution is recorded here citing
  BOTH HAIDs and linking the relevant `conflicts/{date}-{id}.md` file.
- Manual ADRs — any coordination decision worth preserving (a sequencing call,
  a surface-ownership agreement, a convention adopted mid-flight).

## Entry format

```
## {ISO-8601 UTC timestamp} — {short title}

{One paragraph: the decision, who made it (HAID), and the why. Cite both HAIDs
on a conflict resolution. Link the conflicts file when applicable.}
```

Newest entries are appended at the bottom. Do not edit prior entries.

<!-- auto-release and override entries are appended below this line -->
