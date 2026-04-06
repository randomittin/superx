# Maintainer Mode Guide

Maintainer mode turns superx into an autonomous repo maintainer that triages issues, fixes bugs, and manages releases.

## Activation

```
/superx:maintain
```

This runs a guided setup wizard that:
1. Verifies GitHub CLI is authenticated
2. Configures issue sources (GitHub, logs, error tracking)
3. Sets monitoring frequency (15m / 30m / 1h / on-demand)
4. Optionally configures Slack notifications
5. Enables maintainer mode and runs the first check immediately

For subsequent activations, `/superx:maintain` remembers your configuration.

## Continuous Monitoring

After activation, keep the monitor running with:
```
/loop 30m /superx:maintain-check
```

Or for persistent monitoring that survives session restarts:
```
/schedule maintain-check --cron "*/30 * * * *" --command "/superx:maintain-check"
```

Each `/superx:maintain-check` invocation runs one full cycle: scan → triage → fix → release.

## Issue Ingestion

### Sources

1. **GitHub Issues** (primary): `gh issue list --state open --json number,title,body,labels,createdAt`
2. **Error logs** (if configured): Parse log files at paths in `maintainer.log_paths` for ERROR/FATAL patterns
3. **Error tracking** (if configured): Check Sentry/Elastic endpoints in `maintainer.error_tracking`
4. **Direct reports**: User mentions issues in conversation

## Triage Workflow

```
Issue detected
  → Classify severity
  → Classify confidence
  → Route to appropriate handler
```

### Severity Classification

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| **Critical** | Service down, data loss, security breach | Immediate |
| **High** | Major feature broken, significant UX issue | Within session |
| **Medium** | Minor feature issue, non-blocking bug | Next batch |
| **Low** | Typo, cosmetic, minor improvement | Batch with patch |

### Confidence Classification

| Confidence | Criteria | Action |
|------------|----------|--------|
| **High** | Clear root cause, straightforward fix | Auto-fix |
| **Medium** | Likely cause, needs investigation | Investigate then fix |
| **Low** | Unclear, multiple possibilities | Escalate to human |

### Routing Matrix

| Severity × Confidence | Action |
|----------------------|--------|
| Any × Low | Escalate with context |
| Critical × Any | Alert + hotfix agent + human approval |
| High × High | Auto-fix + PR + request review |
| High × Medium | Investigate + fix + PR |
| Medium × High | Auto-fix, batch into patch release |
| Medium × Medium | Investigate, add to release queue |
| Low × High | Auto-fix, batch into patch release |
| Low × Medium | Add to release queue |

## Auto-Fix Protocol

1. Create feature branch: `fix/<issue-number>-<short-description>`
2. Spawn coder agent with issue context
3. Run test suite via test-runner agent
4. Run lint via lint-quality agent
5. Run review via reviewer agent
6. Create PR with:
   - Issue reference: "Fixes #<number>"
   - What changed and why
   - Test coverage summary
7. If all quality gates pass and severity ≤ medium:
   - Add to `maintainer.release_queue`
8. If critical or high:
   - Request human review

## Batched Patch Releases

Group related small fixes into patch releases:

1. Collect fixes from `maintainer.release_queue`
2. Ensure all tests pass together
3. Bump version (patch for fixes, minor for features)
4. Generate changelog from commit messages
5. Create release tag + GitHub release
6. Clear the release queue

## Communication

Maintainer mode communicates progress naturally:

- **Issue found**: "Spotted a null pointer in the auth middleware. Investigating."
- **Fix in progress**: "Root cause found — expired token handling was missing a check. Writing fix with tests."
- **Fix ready**: "Fixed in PR #47. Tests pass. Ready for v1.2.4."
- **Needs help**: "Stuck on #23 — the expected behavior isn't clear from the issue. Can you clarify?"

## State Tracking

All maintainer activity is tracked in superx-state.json under the `maintainer` key:

```json
{
  "maintainer": {
    "enabled": true,
    "issue_sources": ["github"],
    "pending_fixes": [
      {"issue": 23, "status": "investigating", "agent_id": "agent-001"}
    ],
    "release_queue": [
      {"issue": 45, "pr": 47, "severity": "low"}
    ]
  }
}
```
