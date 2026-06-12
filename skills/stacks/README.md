# Stack Skill Packs

Stack specialization in Heimdall ships as **knowledge packs loaded onto existing
role agents** — never as new role x stack agents.

- **Agents are roles.** `planner`, `coder`, `reviewer`, `architect`, etc. There
  is exactly one of each. We do NOT create a `nextjs-coder` or `spring-boot-reviewer`.
- **Stacks are knowledge.** A pack is a Markdown file describing a stack's
  conventions, directory layout, exact lint/format/test/build commands,
  runnable acceptance-criteria templates, and common failure patterns + fixes.

A role agent stays generic. At task start it reads the pack(s) relevant to the
target project and gains stack-specific judgment without changing its identity.

## Layout

```
skills/stacks/
  README.md                  <- this file
  <stack-id>/
    PACK.md                  <- the knowledge pack for one stack
```

Each pack lives at `skills/stacks/<stack-id>/PACK.md`. Stack ids are the same
ids emitted by `bin/stack-detect`:

| Stack id        | Detected from                                   |
|-----------------|-------------------------------------------------|
| `nextjs`        | `package.json` dep `next`                       |
| `react-native`  | `package.json` dep `react-native` / `expo`      |
| `react`         | `package.json` dep `react` (no next/rn)         |
| `vue`           | `package.json` dep `vue`                         |
| `svelte`        | `package.json` dep `svelte`                      |
| `node`          | `package.json` with none of the above           |
| `spring-boot`   | `build.gradle*` / `pom.xml` with `spring-boot`  |
| `jvm`           | `build.gradle*` / `pom.xml` without spring-boot |
| `fastapi`       | `requirements.txt` / `pyproject.toml` `fastapi` |
| `django`        | `requirements.txt` / `pyproject.toml` `django`  |
| `flask`         | `requirements.txt` / `pyproject.toml` `flask`   |
| `python`        | python project with none of the above           |
| `go`            | `go.mod`                                          |
| `rust`          | `Cargo.toml`                                      |

## How packs are loaded

1. **Detect** — `bin/stack-detect [path]` scans the target project's manifest
   files (reading their contents) and emits the detected stack id(s) as JSON:

   ```json
   {"stacks":["nextjs"],"signals":["package.json:next"]}
   ```

   A monorepo can yield multiple stacks. No match yields `{"stacks":[],"signals":[]}`.

2. **Resolve** — `bin/stack-pack load [path]` runs detection, then prints the
   pack file paths a role agent should read, in layering order:

   - **Base pack** — `skills/stacks/<id>/PACK.md`, resolved via
     `CLAUDE_PLUGIN_ROOT`. This is the cold-start scaffold: generic, stable,
     shipped with the plugin.
   - **Repo refinement** — any `*.md` under the target project's
     `.planning/skills/`. These are learned, repo-specific notes that layer on
     top of the base pack and override it where they disagree.

3. **Read** — each role agent reads those paths at task start and applies the
   conventions. The agent's identity does not change; only its knowledge does.

### Layering: cold-start scaffold vs per-repo refinement

The base pack is the **cold-start scaffold** — what a role agent should know
about a stack before it has ever seen this particular repo. It encodes
stack-wide truths (e.g. "run `./gradlew test`", "Next.js app routes live under
`app/`").

`.planning/skills/` is the **per-repo refinement layer**. As Heimdall works in a
repo it extracts patterns specific to that codebase (its test runner flags, its
directory quirks, recurring failure modes). Those refine — and where they
conflict, take precedence over — the base pack, because they are closer to the
ground truth of the actual project.

## Session integration

A `SessionStart` hook runs `bin/stack-pack detect` and writes the result to
`.planning/detected-stack.json` (when the project is a Heimdall project). Role
agents can read that file instead of re-running detection, and call
`bin/stack-pack load` to get the pack paths to read.

## Adding a new pack

Copy `STACK_PACK_TEMPLATE.md` (at the repo root) to
`skills/stacks/<stack-id>/PACK.md` and fill in every section. Make sure
`bin/stack-detect` already emits your `<stack-id>` — if it does not, the pack
will never be loaded. Keep every command exact and every acceptance criterion
runnable (a test/grep/build command), never a vague statement.
