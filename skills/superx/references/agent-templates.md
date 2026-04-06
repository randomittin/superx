# Agent Spawning Templates

Templates for spawning each agent type with appropriate context.

## Architect Agent

```
Analyze the codebase and decompose the following task into sub-projects:

Task: [TASK DESCRIPTION]

Requirements:
1. Map existing codebase structure
2. Identify files that need creation or modification
3. Create dependency graph between sub-projects
4. Recommend which sub-projects can run in parallel
5. Flag any risks or ambiguities

Output a structured plan with sub-projects, dependencies, and agent assignments.
```

## Coder Agent

```
Implement [SUB-PROJECT NAME] for the [PROJECT] project.

Scope:
- [Specific deliverables]
- [Files to create/modify]

Context:
- [Relevant existing files]
- [Patterns to follow]
- [Skills to apply]

Constraints:
- Only modify files in [SCOPE]
- Do not touch [OUT-OF-SCOPE areas]
- Write tests alongside implementation

After completion, run:
  superx-state set '.plan.sub_projects[INDEX].status' '"complete"'
```

## Test Runner Agent

```
Run the test suite and report results for the [PROJECT] project.

Focus areas:
- [Specific modules to test]
- [New features that need coverage]

Protocol:
1. Discover test framework from package.json/config
2. Run full test suite
3. Report pass/fail/skip counts
4. Flag any untested code paths in recently changed files
5. If all pass: run `superx-state mark-clean`
6. If failures: report details with file paths and error messages
```

## Lint Quality Agent

```
Run lint and formatting checks on the [PROJECT] project.

Protocol:
1. Run the project's configured linter (check package.json scripts)
2. Run formatting check
3. Report all violations with file paths and line numbers
4. If clean: run `superx-state set '.quality_gates.lint_clean' 'true'`
5. If violations: list them for the coder agent to fix
```

## Docs Writer Agent

```
Update documentation for the [PROJECT] project after recent changes.

Changes made:
- [Summary of recent changes]

Tasks:
1. Update CLAUDE.md with current project state
2. Update README.md if API or setup changed
3. Add/update inline documentation where genuinely needed
4. Update CHANGELOG.md with new entries
```

## Reviewer Agent

```
Review all changes before push for the [PROJECT] project.

Review scope:
- Run `git diff` to see all staged/unstaged changes
- Check each changed file against the review checklist
- Verify test coverage for new code
- Check for security vulnerabilities
- Ensure code follows existing patterns

Output:
- Verdict: APPROVE / REQUEST CHANGES / BLOCK
- List of issues with severity (CRITICAL/WARNING/SUGGESTION)
- File paths and line numbers for each issue
```

## Design Agent

```
Handle the UI/UX design for [SUB-PROJECT NAME] in the [PROJECT] project.

Scope:
- [Specific design deliverables — layouts, components, design tokens]
- [Pages/views to design]

Context:
- [Existing design system or styles]
- [Brand guidelines if any]
- [Target audience and platform]

Design-for-ai skills available:
- Use `design-for-ai:design` for establishing foundations
- Use `design-for-ai:color` for color system
- Use `design-for-ai:fonts` for typography
- Use `design-for-ai:flow` for interactions and responsive behavior
- Use `design-for-ai:exam` for design audit
- Use `design-for-ai:hone` for final quality pass

Constraints:
- Follow existing design patterns in the project
- Ensure WCAG AA accessibility compliance
- Mobile-first responsive approach
- Do not change business logic or API code

After completion, run:
  superx-state set '.plan.sub_projects[INDEX].status' '"complete"'
```

## Agent Team Template

For large tasks requiring 3+ parallel workers:

```
Create an agent team to build [PROJECT DESCRIPTION].

Team structure:
- coder-auth: Handle authentication module (use coder agent type)
- coder-api: Handle API endpoints (use coder agent type)
- coder-frontend: Handle UI components (use coder agent type)
- test-runner: Continuous testing as code lands (use test-runner agent type)

Coordination:
- Auth and API can work in parallel (no file overlap)
- Frontend depends on API being complete
- Test runner watches for completed sub-projects
- Require plan approval for each teammate before implementation
```
