# Stack Pack Template

Copy this file to `skills/stacks/<stack-id>/PACK.md` and replace every section
below with real, stack-specific content. A pack is **knowledge layered onto a
role agent** (coder/architect/reviewer/...), not a new agent. Keep commands
exact and acceptance criteria runnable.

Before you start: make sure `bin/stack-detect` already emits your `<stack-id>`.
If it does not, the pack will never load — extend the detector first.

Rules for filling this out:

- Every command must be **copy-paste runnable** — the exact invocation, with
  flags, that works in a clean checkout of that stack.
- Every acceptance criterion must be a **command** (test, grep, curl, build) a
  reviewer can run and read the exit code of. No vague prose like "works".
- Keep it generic to the stack. Repo-specific quirks belong in a project's
  `.planning/skills/`, which layers on top of this base pack.

---

## Section 1 — Stack ID & Detection Signals

- **Stack id:** `<stack-id>` (must match what `bin/stack-detect` emits)
- **Detected from:** which manifest file(s) and which contents trigger this id.
- **Disambiguation:** if this stack shares a manifest with others (e.g. all JS
  stacks share `package.json`), state the precedence rule that selects it.

## Section 2 — Directory Layout Conventions

Describe where things live in an idiomatic project of this stack: source root,
tests, config, build output, entrypoints. Use a tree. Note any conventions a
role agent must honor when adding files (e.g. "controllers go under `.../web/`").

## Section 3 — Lint / Format / Test / Build Commands

Exact commands. Fill in real invocations:

- **Format:** `<exact command>`
- **Lint:** `<exact command>` (state how warnings are surfaced / treated)
- **Test:** `<exact command>` (and how to run a single test)
- **Build:** `<exact command>`
- **Type check (if applicable):** `<exact command>`

## Section 4 — Acceptance-Criteria Templates

Reusable, runnable criteria a reviewer can drop into a plan for this stack. Each
must be a command with a checkable outcome.

- `<runnable check>` — what it proves
- `<runnable check>` — what it proves

## Section 5 — Common Failure Patterns + Fixes

For each recurring failure: the symptom, the root cause, and the concrete fix.

- **Symptom:** … **Cause:** … **Fix:** …
- **Symptom:** … **Cause:** … **Fix:** …

---

## Filled Example (shows the expected shape — `spring-boot`)

> The block below is a worked example so a contributor can see the level of
> concreteness expected. Delete it when authoring a real pack.

### Section 1 — Stack ID & Detection Signals

- **Stack id:** `spring-boot`
- **Detected from:** `build.gradle`, `build.gradle.kts`, or `pom.xml` whose
  contents reference `spring-boot` (e.g. `org.springframework.boot` plugin or
  `spring-boot-starter-*` dependencies).
- **Disambiguation:** a JVM build file *without* any `spring-boot` reference
  detects as `jvm`, not `spring-boot`.

### Section 2 — Directory Layout Conventions

```
src/
  main/
    java/com/example/app/
      Application.java          # @SpringBootApplication entrypoint
      web/        controllers   # @RestController classes
      service/    business logic (@Service)
      repository/ data access   (@Repository / Spring Data interfaces)
      domain/     entities + DTOs
    resources/
      application.yml           # config + profiles
  test/
    java/com/example/app/       # mirrors main/ package layout
build.gradle(.kts) | pom.xml    # build definition
```

New REST endpoints go in `web/` as `@RestController` classes; persistence goes
through `repository/` interfaces, never raw JDBC in controllers.

### Section 3 — Lint / Format / Test / Build Commands

Gradle (swap `./gradlew` for `./mvnw` + Maven goals on Maven projects):

- **Format:** `./gradlew spotlessApply`
- **Lint:** `./gradlew check -x test` (Checkstyle/Spotless; build fails on any violation)
- **Test:** `./gradlew test` — single test: `./gradlew test --tests 'com.example.app.web.OrderControllerTest'`
- **Build:** `./gradlew clean build`
- **Run locally:** `./gradlew bootRun`

### Section 4 — Acceptance-Criteria Templates

- `./gradlew test` passes (exit 0) — the full suite is green.
- Each new `@RestController` has a matching `@SpringBootTest` (or
  `@WebMvcTest`) integration test:
  `grep -rl '@SpringBootTest\|@WebMvcTest' src/test/java | xargs grep -l '<ControllerName>'`
  returns the test file.
- `./gradlew clean build` succeeds (exit 0) — compiles and packages.
- `curl -s -o /dev/null -w '%{http_code}' localhost:8080/actuator/health`
  returns `200` after `./gradlew bootRun`.

### Section 5 — Common Failure Patterns + Fixes

- **Symptom:** `No qualifying bean of type '…'` at startup.
  **Cause:** a `@Service`/`@Repository` lives outside the
  `@SpringBootApplication` package scan root.
  **Fix:** move it under the base package, or add
  `@ComponentScan(basePackages = "…")`.
- **Symptom:** `@WebMvcTest` test fails to autowire a service.
  **Cause:** slice tests do not load `@Service` beans.
  **Fix:** add `@MockBean <Service>` to the test, or switch to `@SpringBootTest`.
- **Symptom:** `Port 8080 already in use` on `bootRun`.
  **Cause:** a prior run is still bound.
  **Fix:** `lsof -ti tcp:8080 | xargs kill`, or set
  `server.port=0` for a random test port.

### Code Quality Bar (applies to every pack)

All generated code must be production-ready: real implementations only. Do not
emit incomplete-and-marked-for-later code, do not leave method bodies empty to
be filled in later, do not return fake data in place of real logic. If a piece
cannot be implemented fully, state that explicitly instead of emitting
incomplete code. The repo's PreToolUse content scan enforces this automatically.
