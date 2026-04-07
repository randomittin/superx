# Todo REST API with User Authentication

## Planning

### Requirements Analysis
- REST API for a todo application
- User authentication (signup + login)
- Full CRUD operations for todos
- User isolation: each user sees only their own todos
- Test coverage
- Linting configured and passing

### Technology Choices
- **Runtime**: Node.js with Express
- **Database**: SQLite via `better-sqlite3` (synchronous, no ORM overhead, zero-config)
- **Auth**: JWT tokens via `jsonwebtoken`, password hashing via `bcryptjs`
- **Testing**: Jest + Supertest (in-memory SQLite for test isolation)
- **Linting**: ESLint v10 with flat config format

### Architecture Decisions
- Separate `app.js` (Express app) from `server.js` (listener) so tests can import the app without starting a server
- Database module uses a singleton pattern with `resetDb()` for test isolation
- JWT middleware extracts `userId` from the token and attaches it to `req`, which every todo query uses for filtering
- All todo queries include `AND user_id = ?` to enforce row-level isolation
- Tests use `:memory:` SQLite databases that are created fresh before every test

---

## File Structure

```
todo-api/
  .env                    # Environment variables (gitignored)
  .env.example            # Template for environment variables
  .gitignore
  eslint.config.js        # ESLint flat config
  package.json
  src/
    app.js                # Express app setup and route mounting
    server.js             # Server entry point (dotenv + listen)
    db/
      database.js         # SQLite connection + schema creation
    middleware/
      auth.js             # JWT authentication middleware
    routes/
      auth.js             # POST /auth/signup, POST /auth/login
      todos.js            # CRUD: GET/POST/PUT/DELETE /todos
  tests/
    auth.test.js          # 9 tests for signup and login
    todos.test.js         # 19 tests for CRUD + isolation + auth middleware
```

---

## API Endpoints

| Method | Path         | Auth Required | Description                |
|--------|-------------|---------------|----------------------------|
| GET    | /health     | No            | Health check               |
| POST   | /auth/signup| No            | Create account, get token  |
| POST   | /auth/login | No            | Login, get token           |
| GET    | /todos      | Yes           | List user's todos          |
| GET    | /todos/:id  | Yes           | Get single todo            |
| POST   | /todos      | Yes           | Create todo                |
| PUT    | /todos/:id  | Yes           | Update todo title/completed|
| DELETE | /todos/:id  | Yes           | Delete todo                |

---

## Key Code

### Database Layer (`src/db/database.js`)

Creates two tables on initialization:
- **users**: id, email (unique), password (bcrypt hash), created_at
- **todos**: id, user_id (FK to users), title, completed (0/1), created_at, updated_at

The singleton pattern with `resetDb()` is critical: tests call `resetDb()` then `getDb(":memory:")` in `beforeEach` to get a fresh in-memory database for every test. WAL mode and foreign keys are enabled for production correctness.

### Auth Middleware (`src/middleware/auth.js`)

Extracts the Bearer token from the `Authorization` header, verifies it with `jwt.verify()`, and attaches `req.userId` for downstream route handlers. Returns 401 for missing, malformed, or invalid tokens.

Every todo route is protected by this middleware via `router.use(authenticate)` at the top of the todos router.

### Auth Routes (`src/routes/auth.js`)

**POST /auth/signup**:
- Validates required fields and minimum password length (6 chars)
- Checks for duplicate email (409 Conflict)
- Hashes password with bcrypt (cost factor 10)
- Returns JWT token + userId on success (201)

**POST /auth/login**:
- Validates required fields
- Looks up user by email, compares password hash
- Returns the same "Invalid email or password" for both wrong email and wrong password (prevents user enumeration)
- Returns JWT token + userId on success (200)

### Todo Routes (`src/routes/todos.js`)

User isolation is enforced at the database level: every SELECT, UPDATE, and DELETE includes `AND user_id = ?` with the authenticated user's ID. A user attempting to access another user's todo gets a 404 (not 403), which avoids leaking information about other users' resources.

**GET /todos** - Lists all todos for the authenticated user, ordered by newest first (id DESC)
**GET /todos/:id** - Gets a single todo, scoped to the authenticated user
**POST /todos** - Creates a new todo with title validation and whitespace trimming
**PUT /todos/:id** - Partial updates to title and/or completed status, with validation
**DELETE /todos/:id** - Deletes a todo, verifies ownership first

### App Entry Point (`src/app.js`)

Configures Express with JSON body parsing, mounts routes at `/auth` and `/todos`, includes a health check endpoint and a global error handler.

### Server (`src/server.js`)

Loads `.env` via dotenv, initializes the database, and starts listening on the configured port.

---

## Tests

### Test Strategy
- **In-memory SQLite**: Each test gets a fresh database via `beforeEach`/`afterEach` hooks
- **Supertest**: HTTP-level integration tests against the Express app (no server needed)
- **Two test files**: `auth.test.js` (9 tests) and `todos.test.js` (19 tests) = 28 total

### Auth Tests (`tests/auth.test.js`)

Covers:
- Successful signup returns 201 + token + userId
- Rejects missing email
- Rejects missing password
- Rejects passwords under 6 characters
- Rejects duplicate email registration
- Successful login returns 200 + token
- Rejects nonexistent email
- Rejects wrong password
- Rejects empty credentials

### Todo Tests (`tests/todos.test.js`)

Covers:
- **Create**: Successful creation, reject missing title, reject whitespace-only title, reject unauthenticated request
- **List**: Returns only the authenticated user's todos, does not leak other users' todos
- **Get by ID**: Returns correct todo, returns 404 for another user's todo, returns 404 for nonexistent ID
- **Update**: Update title, mark completed, reject empty title, reject update of another user's todo
- **Delete**: Successful deletion + verify gone, reject deletion of another user's todo
- **Auth middleware**: Reject no header, reject invalid token, reject malformed Authorization header
- **Health check**: Returns `{ status: "ok" }`

### Test Results

```
Test Suites: 2 passed, 2 total
Tests:       28 passed, 28 total
Snapshots:   0 total
Time:        2.554 s
```

All 28 tests pass.

---

## Linting

### ESLint Configuration (`eslint.config.js`)

Uses ESLint v10 flat config format with these rules:
- `no-unused-vars`: Error (with `_` prefix pattern for intentionally unused args)
- `no-console`: Warning (allows `console.error` and `console.warn`)
- `eqeqeq`: Error (requires strict equality)
- `no-var`: Error (enforce `let`/`const`)
- `prefer-const`: Error (use `const` where possible)

### Lint Results

```
src/server.js
  11:3  warning  Unexpected console statement  no-console

0 errors, 1 warning
```

Zero errors. The single warning is the intentional `console.log` for the server startup message in `server.js`, which is standard practice.

---

## How to Run

```bash
# Install dependencies
npm install

# Start the server
npm start

# Run tests
npm test

# Run linter
npm run lint

# Fix auto-fixable lint issues
npm run lint:fix
```

### Example Usage with curl

```bash
# Sign up
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Create a todo (use token from signup/login response)
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Buy groceries"}'

# List todos
curl http://localhost:3000/todos \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update a todo
curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"completed": true}'

# Delete a todo
curl -X DELETE http://localhost:3000/todos/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Quality Assurance Summary

| Check             | Status  | Details                                      |
|-------------------|---------|----------------------------------------------|
| Tests pass        | PASS    | 28/28 tests passing across 2 suites          |
| Lint clean        | PASS    | 0 errors, 1 intentional warning              |
| Auth works        | PASS    | Signup, login, JWT verification              |
| User isolation    | PASS    | Every query scoped by user_id                |
| Input validation  | PASS    | Required fields, min password length, trimming|
| SQL injection     | SAFE    | All queries use parameterized statements     |
| Password security | PASS    | bcrypt hashed, cost factor 10                |
| Error handling    | PASS    | Global error handler, consistent error format|

---

## Complete Source Code

The fully working project is located at:

```
todo-api/
```

(Alongside this result.md in the outputs directory.)

All source files, tests, configuration, and installed dependencies are present and verified working.
