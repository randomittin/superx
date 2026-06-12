# Security Policy

Heimdall is a verification layer for coding agents, so we hold our own security
to the same standard we hold your code to: **nothing ships unproven — including
our own history.**

## Reporting a vulnerability

Please report security issues **privately**, not in a public issue or pull
request.

- Open a **GitHub Security Advisory** on this repository
  (Security → Advisories → *Report a vulnerability*). This keeps the report
  confidential until a fix is ready and gives us a private channel to coordinate.

What to expect:

- **Acknowledgement target: within 48 hours.** We confirm receipt and let you
  know whether we can reproduce it.
- We work a fix and a coordinated disclosure timeline with you. We credit
  reporters who want credit; we honor requests to stay anonymous.
- **No bug bounty.** Heimdall is an MIT-licensed open-source project with no
  paid disclosure program. We are grateful for responsible reports regardless.

Please give us a reasonable window to ship a fix before any public disclosure.

## Supported scope

| In scope                                                        | Out of scope                                              |
|-----------------------------------------------------------------|-----------------------------------------------------------|
| The Heimdall harness, gates, sentinels, and hooks in this repo. | Vulnerabilities in Claude Code or the Anthropic platform — report those to their respective projects. |
| The latest released version on the default branch.              | Issues that require a user to run `--dangerously-skip-permissions` in a throwaway sandbox (that flag is documented as autonomy with no safety classifier in the loop). |
| Bypasses of a quality or safety gate that let unproven code through. | Third-party dependencies — we will help upstream the report. |

Only the latest released version receives security fixes. There are no separately
maintained release branches.

## Secret hygiene

Heimdall treats leaked credentials as a build defect, not an afterthought — and
it points that policy at itself first.

- **A standing secret-scan gate guards every push.** Heimdall's security sentinel
  runs [`gitleaks`](https://github.com/gitleaks/gitleaks) over the working tree
  and the commit range a push would publish, before any code leaves the machine.
  A finding is a hard fail: the push is blocked until the credential is removed
  and rotated. This is the same `git push` gate that re-triggers the
  falsifiability and corpus checks — security is part of the proof, not a
  side-channel.
- **It can run earlier too.** The same scan is safe to wire as a local
  pre-commit step so a credential is caught before it is ever recorded, not just
  before it is pushed. The gate is designed to run at whichever boundary you put
  it on.
- **It degrades honestly, never falsely.** If no scanner is installed, the gate
  reports *skipped* and names the missing tool — it never reports "clean" without
  a real scanner having actually run and found nothing. A pass means a real tool
  ran; a skip means go install one. (Install `gitleaks` to get a real verdict;
  `trufflehog` is a supported fallback.)
- **The principle:** a verification system that cannot prove its own history is
  clean cannot be trusted to prove yours. So the same secret scan that protects
  contributors protects this repository's own commits — credentials are kept out
  of history by construction, not by hope.

If you find a credential that did make it into the tree, please report it through
the private channel above rather than opening a public issue, so it can be
rotated before attention is drawn to it.
