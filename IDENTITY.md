# IDENTITY.md — canonical identity (single source of truth)

Every wave reads identity from this file, never from memory.
Signed-off: RJ, 2026-06-13 (gate foundation signed — GATE-REVIEW.md; domain screen complete).

```yaml
name:      Heimdall
repo:      github.com/randomittin/heimdall   # rename of superx — GitHub repo RENAME, never a
                                             # fresh repo; personal account by design;
                                             # org transfer reserved post-L3
domain:
  canonical: runheimdall.dev
  redirect:  runheimdall.com    # 301 -> canonical
  parked:    heimdall.team      # L3 waitlist page only
npm:       "@runheimdall"       # org exists, 2FA on, ZERO tokens issued —
                                # publishing is human-gated, always
x_twitter: "@runheimdall"
tagline:   "Nothing ships unproven."
thesis:    README ¶1 verbatim = the moving-bar thesis (growth spec v4)
```

## Brand rules
- Slang ships in product messages only — never explained, let users discover it:
  "the Bifröst is closed" = merge blocked · "Gjallarhorn" = human-escalation alert ·
  "passed the watchman" = green run.
- Denial stamp: `⛔ HEIMDALL: YOU SHALL NOT MERGE — <violation> · <displaced-to> · <explanation-path>`
- No typo domains, ever. No Marvel/MCU visual echo. "Thou shalt not pass" may be memed by
  users; the brand never uses it.

## Hard boundaries (constitution-level)
- No telemetry, no network calls home, MIT, read the source.
- Publishing (npm, GitHub-publish, X, registrar) is ALWAYS human-gated; the agent never
  holds credentials.
- Any public number traces to `heimdall bench` output or a commit sha; deltas measured on
  pinned `claude-fable-5` only.
