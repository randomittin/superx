# Stack Pack — `spring-boot`

Base scaffold for the `spring-boot` stack. Repo-specific refinements belong in
the project's `.planning/skills/` directory, which layers on top of and overrides
this file where they conflict.

---

## Section 1 — Stack ID & Detection Signals

- **Stack id:** `spring-boot`
- **Detected from:** any of `build.gradle`, `build.gradle.kts`, or `pom.xml`
  whose contents contain a `spring-boot` reference — specifically:
  - Gradle: `id 'org.springframework.boot'` or `id("org.springframework.boot")` plugin declaration, or any `spring-boot-starter-*` dependency string.
  - Maven: `<groupId>org.springframework.boot</groupId>` in a `<parent>` or `<dependency>` block.
- **Disambiguation:** a JVM build file (`build.gradle*` or `pom.xml`) that does
  NOT contain any `spring-boot` reference detects as `jvm`, not `spring-boot`.
  The `spring-boot` id takes precedence over `jvm` whenever the spring-boot
  signal is present.

---

## Section 2 — Directory Layout Conventions

### Gradle project

```
.
├── build.gradle(.kts)              # build definition, plugin + dependency declarations
├── settings.gradle(.kts)           # project name, multi-module includes
├── gradle/wrapper/
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties
├── gradlew                         # always use this, never a system gradle
├── gradlew.bat
├── src/
│   ├── main/
│   │   ├── java/com/example/app/
│   │   │   ├── Application.java            # @SpringBootApplication entry-point
│   │   │   ├── controller/                 # @RestController classes (HTTP layer only)
│   │   │   │   └── OrderController.java
│   │   │   ├── service/                    # @Service — business logic, transactions
│   │   │   │   └── OrderService.java
│   │   │   ├── repository/                 # Spring Data interfaces / @Repository
│   │   │   │   └── OrderRepository.java
│   │   │   ├── model/                      # JPA @Entity classes + DTOs
│   │   │   │   ├── Order.java              # @Entity
│   │   │   │   └── OrderDto.java           # DTO — never expose @Entity from a controller
│   │   │   └── config/                     # @Configuration, SecurityConfig, WebMvcConfig, etc.
│   │   │       └── SecurityConfig.java
│   │   └── resources/
│   │       ├── application.yml             # base config
│   │       ├── application-dev.yml         # dev profile overrides
│   │       ├── application-prod.yml        # prod profile overrides
│   │       └── db/migration/               # Flyway or Liquibase scripts (if present)
│   └── test/
│       └── java/com/example/app/          # mirrors main/ package layout exactly
│           ├── controller/
│           │   └── OrderControllerTest.java   # @WebMvcTest or @SpringBootTest slice
│           ├── service/
│           │   └── OrderServiceTest.java       # plain JUnit 5, no Spring context
│           └── repository/
│               └── OrderRepositoryTest.java    # @DataJpaTest slice
└── build/                                  # generated — never commit
    └── libs/app-0.0.1-SNAPSHOT.jar
```

### Maven project

Same `src/` layout. Build descriptor is `pom.xml`; wrapper is `mvnw` / `mvnw.cmd`.
Build output lands in `target/` (never commit).

### Placement rules for new code

| What you are adding | Where it goes |
|---------------------|---------------|
| HTTP endpoint | `controller/` — `@RestController`, no business logic |
| Business rule / orchestration | `service/` — `@Service`, owns `@Transactional` |
| Data access | `repository/` — Spring Data interface or `@Repository` class |
| JPA entity | `model/` (or `model/entity/` in larger codebases) |
| Response/request shape | `model/` (or `model/dto/`) — never reuse `@Entity` as DTO |
| Cross-cutting config | `config/` — `@Configuration` class |
| Integration test | `src/test/java/…` mirror of the tested class's package |

---

## Section 3 — Lint / Format / Test / Build Commands

Both build tools are shown. Use whichever wrapper (`gradlew` / `mvnw`) is present
in the repo root. Always use the wrapper (`./gradlew`, `./mvnw`) — it pins the
exact tool version and never requires a local installation.

### Format

```bash
# Gradle — Spotless (apply fixes in-place)
./gradlew spotlessApply

# Maven — Spotless
./mvnw spotless:apply
```

If Spotless is not configured, check for a separate Checkstyle-only setup; in
that case formatting is manual and `checkstyleMain` / `checkstyleTest` are the
enforcement targets.

### Lint / static analysis

```bash
# Gradle — runs Checkstyle + Spotless check (no tests); exits non-zero on any violation
./gradlew check -x test

# Maven — validate + checkstyle without running tests
./mvnw checkstyle:check -DskipTests

# If only Spotless is configured (no Checkstyle):
./gradlew spotlessCheck
./mvnw spotless:check
```

Violations are printed to stdout and also written to
`build/reports/checkstyle/` (Gradle) or `target/checkstyle-result.xml` (Maven).
The build fails on any violation — warnings are not silently tolerated.

### Test

```bash
# Gradle — full suite
./gradlew test

# Gradle — single test class
./gradlew test --tests 'com.example.app.controller.OrderControllerTest'

# Gradle — single test method
./gradlew test --tests 'com.example.app.controller.OrderControllerTest.shouldReturn200WhenOrderFound'

# Maven — full suite
./mvnw test

# Maven — single test class
./mvnw test -Dtest=OrderControllerTest

# Maven — single test method
./mvnw test -Dtest=OrderControllerTest#shouldReturn200WhenOrderFound
```

Test reports: `build/reports/tests/test/index.html` (Gradle) or
`target/surefire-reports/` (Maven).

### Build (compile + package)

```bash
# Gradle
./gradlew clean build

# Gradle — skip tests (only for packaging; never skip in CI)
./gradlew clean build -x test

# Maven
./mvnw clean package

# Maven — skip tests
./mvnw clean package -DskipTests
```

Output artifact: `build/libs/<name>-<version>.jar` (Gradle) or
`target/<name>-<version>.jar` (Maven).

### Run locally

```bash
# Gradle
./gradlew bootRun

# Gradle — activate a profile
./gradlew bootRun --args='--spring.profiles.active=dev'

# Maven
./mvnw spring-boot:run

# Maven — activate a profile
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Run the packaged jar directly
java -jar build/libs/app-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev
```

---

## Section 4 — Acceptance-Criteria Templates

Drop these into a task plan verbatim; each is runnable by a reviewer.

### Build and test

```bash
# Full suite passes — exit 0 required
./gradlew test
# Maven equivalent
./mvnw test
```
Proves: all unit and integration tests green.

```bash
# Full build compiles and packages — exit 0 required
./gradlew clean build
# Maven equivalent
./mvnw clean package
```
Proves: no compile errors, no test failures, no static-analysis violations.

### Lint / style

```bash
# Checkstyle + Spotless pass — exit 0, zero violations printed
./gradlew check -x test
# Maven equivalent
./mvnw checkstyle:check -DskipTests
```
Proves: code style conforms to project standards.

### Controller coverage

```bash
# Every new @RestController class has a corresponding test file
grep -rl '@RestController' src/main/java \
  | sed 's|src/main/java/||; s|\.java$||' \
  | while read cls; do
      base=$(basename "$cls")
      found=$(find src/test/java -name "${base}Test.java" | head -1)
      if [ -z "$found" ]; then echo "MISSING TEST: $base"; fi
    done
# Must print nothing (no missing tests)
```
Proves: every new REST controller has a test class.

```bash
# That test class uses @WebMvcTest or @SpringBootTest
grep -rl '@WebMvcTest\|@SpringBootTest' src/test/java \
  | xargs grep -l 'OrderController'
# Must return at least one file
```
Proves: the controller is exercised via the Spring MVC layer.

### Constructor injection

```bash
# No field injection — zero @Autowired on fields
grep -rn '@Autowired' src/main/java \
  | grep -v '// OK\|@Autowired.*constructor' \
  | grep -v '^.*public\|^.*protected\|^.*private.*('
# Must print nothing
```
Proves: all injection is via constructor, not field injection.

### No entity leakage

```bash
# No @Entity class is imported/referenced inside controller package
grep -rn 'import.*\.model\.' src/main/java/**/controller/*.java \
  | grep -v 'Dto\|Request\|Response\|dto\|request\|response'
# Must print nothing
```
Proves: controllers consume DTOs, not JPA entities.

### Health endpoint

```bash
# After bootRun is up, actuator/health returns 200
./gradlew bootRun &
sleep 15
curl -sf -o /dev/null -w '%{http_code}' http://localhost:8080/actuator/health
# Must print 200
```
Proves: application starts and management endpoint is reachable.

### Profile activation

```bash
# application-dev.yml exists when a dev profile is used
test -f src/main/resources/application-dev.yml && echo OK
# Must print OK
```

```bash
# Active profile is not hardcoded in application.yml
grep -n 'spring.profiles.active' src/main/resources/application.yml
# Must print nothing — active profile is passed at launch, not baked in
```
Proves: profile selection is external, not baked into the artifact.

---

## Section 5 — Common Failure Patterns + Fixes

### Injection

**Symptom:** `UnsatisfiedDependencyException` or brittle tests requiring
`ReflectionTestUtils`.
**Cause:** field injection via `@Autowired` on a private field.
**Fix:** replace with constructor injection. In Lombok projects, `@RequiredArgsConstructor`
on a class with `final` fields generates the constructor automatically:

```java
// BAD
@Service
public class OrderService {
    @Autowired
    private OrderRepository repo;
}

// GOOD
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository repo;
}
```

---

**Symptom:** `NoSuchBeanDefinitionException: No qualifying bean of type '…'` at startup.
**Cause:** the `@Service`, `@Repository`, or `@Component` class lives outside the
package tree rooted at the `@SpringBootApplication` class, so component-scan
never finds it.
**Fix:** move the class under the base package (the package containing
`Application.java`), or explicitly add
`@ComponentScan(basePackages = {"com.example.app", "com.other.lib"})` to the
application class.

---

**Symptom:** `BeanCurrentlyInCreationException` — circular dependency.
**Cause:** bean A depends on bean B, which depends on bean A (directly or
transitively). Spring cannot satisfy both.
**Fix options (in preference order):**
1. Refactor: extract a third `@Service` or event that breaks the cycle.
2. Use `@Lazy` on one injection point to defer initialization:
   `public ServiceA(@Lazy ServiceB b)`.
3. Restructure so one dependency direction goes through an interface; never use
   `@Autowired(required = false)` to paper over a design problem.

---

### Testing

**Symptom:** `@WebMvcTest` test throws `UnsatisfiedDependencyException` for a
`@Service` or `@Repository` bean.
**Cause:** `@WebMvcTest` is a web-layer slice test; it does not load `@Service`
or `@Repository` beans.
**Fix:** declare the dependency as a `@MockBean` in the test class:

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @MockBean OrderService orderService;   // required in web-layer tests
}
```

---

**Symptom:** `IllegalStateException: Failed to load ApplicationContext` in a
`@SpringBootTest` when `application.yml` references environment variables that
are not set in the test environment.
**Cause:** required properties (`${DB_URL}`, `${JWT_SECRET}`, etc.) have no
default and no test override.
**Fix:** add a `src/test/resources/application.yml` (or `application-test.yml`)
with safe in-memory defaults:

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    driver-class-name: org.h2.Driver
  jpa:
    hibernate:
      ddl-auto: create-drop
```

---

### JPA / transactions

**Symptom:** `LazyInitializationException: could not initialize proxy — no Session`
when accessing a lazily-loaded association outside a transaction.
**Cause:** the JPA session closed before the lazy collection was accessed, typically
because a service method is not `@Transactional` or because the entity was accessed
in the controller after the transaction ended.
**Fix options:**
1. Annotate the service method with `@Transactional` so the session stays open
   for the full business operation.
2. Use a fetch join or `@EntityGraph` to eagerly load the association only when
   needed, instead of leaving it lazy globally:

```java
// Fetch join in JPQL
@Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
Optional<Order> findByIdWithItems(@Param("id") Long id);

// @EntityGraph — no JPQL needed
@EntityGraph(attributePaths = {"items"})
Optional<Order> findById(Long id);
```

3. Map a DTO projection directly in the query so the entity is never returned
   to the controller at all.

---

**Symptom:** N+1 queries — application issues one SELECT for the parent list and
then one SELECT per row for a child association, producing O(n) database round-trips.
**Cause:** `findAll()` loads a list of entities; accessing a `LAZY` association
on each triggers an individual query per row.
**Fix:**
1. Prefer DTO projections with a single JOIN FETCH or `@EntityGraph` query.
2. For read-heavy list endpoints, use a native or JPQL query that returns a flat
   `List<SomeDto>` and never loads the entity graph at all.
3. Enable `spring.jpa.show-sql=true` and `logging.level.org.hibernate.SQL=DEBUG`
   during development to count queries in test output.

---

**Symptom:** `@Transactional` on a method has no effect; changes are not committed
or rolled back as expected.
**Cause (a):** the method is called from within the same bean (`this.method()`).
Spring's AOP proxy is bypassed — the transaction interceptor never fires.
**Fix:** move the transactional method to a separate `@Service` bean and inject
it, so the call goes through the proxy.

**Cause (b):** `@Transactional` is placed on a `private` method.
**Fix:** make the method `public` (or `protected`); Spring AOP cannot intercept
private methods.

---

### Configuration / profiles

**Symptom:** application starts with wrong config values; profile-specific overrides
are not applied.
**Cause:** `spring.profiles.active` is not set, or is set to a profile name that
does not match any `application-<profile>.yml` file.
**Fix:** pass the active profile at launch time:

```bash
# Gradle
./gradlew bootRun --args='--spring.profiles.active=dev'

# Jar
java -jar app.jar --spring.profiles.active=prod

# Environment variable (preferred in containers)
SPRING_PROFILES_ACTIVE=prod java -jar app.jar
```

Never hardcode `spring.profiles.active` inside `application.yml`; that removes
the ability to override it externally.

---

**Symptom:** `@Value("${some.property}")` fails at startup with
`IllegalArgumentException` reporting the property key is unresolvable.
**Cause:** the key is missing from all active `application.yml` files and has no
inline default.
**Fix:** add the property to the appropriate profile file, or supply an inline
default in the annotation: `@Value("${some.property:fallbackValue}")`.

---

### Entity / DTO leakage

**Symptom:** Jackson serializes an `@Entity` directly from a controller, producing
unexpected fields, triggering lazy-load exceptions, or exposing internal data.
**Cause:** the controller returns the JPA entity object rather than a DTO.
**Fix:** map the entity to a DTO before returning from the controller. Use a
dedicated mapper method, MapStruct, or a record DTO:

```java
// BAD — exposes @Entity from controller
@GetMapping("/{id}")
public Order getOrder(@PathVariable Long id) {
    return orderService.findById(id);
}

// GOOD — returns DTO
@GetMapping("/{id}")
public OrderDto getOrder(@PathVariable Long id) {
    Order order = orderService.findById(id);
    return new OrderDto(order.getId(), order.getStatus(), order.getTotal());
}
```

---

### Port conflicts

**Symptom:** `Web server failed to start. Port 8080 was already in use.`
**Cause:** a previous `bootRun` process is still bound to the port.
**Fix:**

```bash
lsof -ti tcp:8080 | xargs kill -9
```

For tests, configure a random port to avoid conflicts entirely:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
```

---

## Code Quality Bar

All generated code must be production-ready: real implementations, no empty
method bodies, no hardcoded return values intended to be replaced later. If a
full implementation is not possible given available information, state that
explicitly rather than emitting incomplete code. The repo's PreToolUse content
scan enforces this automatically.
