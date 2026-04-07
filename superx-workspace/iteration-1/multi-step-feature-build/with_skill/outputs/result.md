# superx Orchestration Output: Todo REST API with Auth

**User Prompt:** "I need a simple REST API for a todo app with user auth. Use Express and SQLite. Should have signup, login, CRUD for todos, and each user can only see their own todos. Make sure there are tests and everything is linted."

**Timestamp:** 2026-04-06T17:00:00Z
**Autonomy Level:** 2 (Checkpoint -- default)

---

## Phase 1: Prompt Analysis and Domain Identification

### 1a. Domains Detected

| Domain | Signals from prompt | Priority |
|--------|-------------------|----------|
| **auth** | "user auth", "signup", "login" | Critical |
| **backend** | "REST API", "Express" | Critical |
| **database** | "SQLite", CRUD operations, "each user can only see their own" | Critical |
| **security** | "each user can only see their own todos" (row-level authz), password hashing, JWT | High |
| **testing** | "Make sure there are tests" | High |
| **linting** | "everything is linted" | High |
| **docs** | Implicit -- any shippable project needs a README and CLAUDE.md | Medium |

### 1b. Skill Detection (detect-skills scan)

Simulated output of `detect-skills` against installed skill inventory:

```
Installed skills matched:
  - superpowers:test-driven-development   -> testing domain
  - superpowers:writing-plans             -> planning domain
  - superpowers:dispatching-parallel-agents -> orchestration
  - superpowers:verification-before-completion -> quality
  - superpowers:finishing-a-development-branch -> git completion
  - superpowers:executing-plans           -> execution
  - superpowers:systematic-debugging      -> debugging (standby)
  - pr-review-toolkit:review-pr           -> code review gate
  - claude-md-management:claude-md-improver -> context management
  - claude-md-management:revise-claude-md  -> context management

No installed skills for:
  - Express.js / Node.js backend (generic coder knowledge sufficient)
  - SQLite / database schema design (generic coder knowledge sufficient)
  - JWT / auth patterns (generic coder knowledge sufficient)

Skill gap assessment: NONE -- all domains are within core coding competence
  plus installed supporting skills. No external skill installation needed.
```

**CTO decision:** No skill gaps to fill. Express + SQLite + JWT auth is well within baseline capabilities. The installed superpowers skills cover the workflow orchestration needs. Proceeding.

---

## Phase 2: Task Decomposition and Dependency Graph

### 2a. Sub-Project Breakdown

```
Sub-project dependency graph:

  1. project-setup (no deps)
     Initialize npm project, install deps, configure ESLint/Prettier,
     set up project structure

  2. database (no deps)
     SQLite schema design, connection module, migrations for users
     and todos tables

  3. auth (depends on: database)
     User model, password hashing (bcrypt), JWT sign/verify,
     signup + login endpoints, auth middleware

  4. todos-api (depends on: auth, database)
     CRUD endpoints for todos, row-level authorization
     (users can only access their own todos)

  5. testing (depends on: auth, todos-api)
     Unit tests for auth utilities, integration tests for all
     endpoints, test fixtures and helpers

  6. lint-quality (depends on: project-setup, then runs after all code)
     ESLint + Prettier enforcement across all source files

  7. docs (depends on: all above)
     README.md with setup/usage, CLAUDE.md for project context

  8. review (depends on: all above)
     Final code review before declaring complete
```

### 2b. Parallel Execution Strategy

```
Wave 1 (parallel):  project-setup, database
Wave 2 (sequential): auth (needs database)
Wave 3 (sequential): todos-api (needs auth + database)
Wave 4 (parallel):  testing, lint-quality
Wave 5 (parallel):  docs, review
```

### 2c. Plan Presentation (Level 2 Checkpoint)

> I'll break this into 8 sub-projects. Project setup and database schema can run in parallel first, then auth, then the todos API, then tests and lint in parallel, and finally docs and review. Starting now.

---

## Phase 3: Agent Assignments

### Agent 1: Coder (project-setup)
**Wave:** 1
**Skills loaded:** none (standard setup)
**Scope:**

Initialize the project with a clean structure and all dependencies.

**What this agent produces:**

```
todo-api/
  package.json
  .eslintrc.json
  .prettierrc
  .gitignore
  src/
    app.js           # Express app factory (no listen -- for testability)
    server.js         # Starts the server (calls app.listen)
    config.js         # Environment config (PORT, JWT_SECRET, DB_PATH)
  tests/
    (empty, ready for test agent)
```

**Key file: package.json**

```json
{
  "name": "todo-api",
  "version": "1.0.0",
  "description": "REST API for a todo app with user authentication",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --verbose --forceExit --detectOpenHandles",
    "test:coverage": "jest --coverage --forceExit --detectOpenHandles",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "format": "prettier --write 'src/**/*.js' 'tests/**/*.js'",
    "format:check": "prettier --check 'src/**/*.js' 'tests/**/*.js'"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^11.0.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "nodemon": "^3.0.2"
  }
}
```

**Key file: .eslintrc.json**

```json
{
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["error", "warn"] }],
    "eqeqeq": "error",
    "curly": "error",
    "no-var": "error",
    "prefer-const": "error"
  }
}
```

**Key file: src/config.js**

```js
const path = require('path');

const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'todo.db'),
};

module.exports = config;
```

**Key file: src/app.js**

```js
const express = require('express');
const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');
const { errorHandler } = require('./middleware/errorHandler');

function createApp(db) {
  const app = express();

  app.use(express.json());

  // Inject db into request
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/todos', todoRoutes);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
```

**Constraints:** Only create project scaffolding. Do not implement auth or todos logic. Leave route files as stubs for later agents.

---

### Agent 2: Coder (database)
**Wave:** 1 (parallel with project-setup)
**Skills loaded:** none (standard SQLite work)
**Scope:**

Design and implement the SQLite database layer.

**What this agent produces:**

```
src/
  db/
    connection.js     # Database connection factory
    migrations.js     # Schema creation (users + todos tables)
    index.js          # Exports initialized db
```

**Key file: src/db/migrations.js**

```js
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  `);
}

module.exports = { runMigrations };
```

**Key file: src/db/connection.js**

```js
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations');

function createDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

module.exports = { createDatabase };
```

**Constraints:** Only create database layer. Do not implement routes or middleware. Ensure WAL mode for concurrent reads. Enforce foreign keys.

---

### Agent 3: Coder (auth)
**Wave:** 2 (depends on database)
**Skills loaded:** superpowers:test-driven-development (write tests alongside)
**Scope:**

Implement signup, login, and JWT auth middleware.

**What this agent produces:**

```
src/
  routes/
    auth.js           # POST /api/auth/signup, POST /api/auth/login
  middleware/
    authenticate.js   # JWT verification middleware
  utils/
    password.js       # bcrypt hash/compare wrappers
    token.js          # JWT sign/verify wrappers
```

**Key file: src/routes/auth.js**

```js
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/token');

const router = Router();

const signupValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

router.post('/signup', signupValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const existing = req.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const result = req.db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(email, passwordHash);

    const token = generateToken({
      userId: result.lastInsertRowid,
      email,
    });

    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, email },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const user = req.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

**Key file: src/middleware/authenticate.js**

```js
const { verifyToken } = require('../utils/token');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
```

**Key file: src/utils/password.js**

```js
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, comparePassword };
```

**Key file: src/utils/token.js**

```js
const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { generateToken, verifyToken };
```

**Key file: src/middleware/errorHandler.js**

```js
function errorHandler(err, _req, res, _next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
```

**Constraints:** Do not implement todo routes. Only modify auth-related files. Use bcrypt with 12 salt rounds. Never return password hashes in API responses. Use express-validator for input validation.

---

### Agent 4: Coder (todos-api)
**Wave:** 3 (depends on auth + database)
**Skills loaded:** superpowers:test-driven-development
**Scope:**

Implement full CRUD for todos with row-level authorization.

**What this agent produces:**

```
src/
  routes/
    todos.js          # GET, POST, GET/:id, PUT/:id, DELETE/:id
```

**Key file: src/routes/todos.js**

```js
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// All todo routes require authentication
router.use(authenticate);

// GET /api/todos -- list all todos for the authenticated user
router.get('/', (req, res, next) => {
  try {
    const todos = req.db
      .prepare(
        'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC'
      )
      .all(req.user.id);
    res.json({ todos });
  } catch (err) {
    next(err);
  }
});

// POST /api/todos -- create a new todo
router.post(
  '/',
  [body('title').trim().notEmpty().withMessage('Title is required')],
  (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description = '' } = req.body;
      const result = req.db
        .prepare(
          'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)'
        )
        .run(req.user.id, title, description);

      const todo = req.db
        .prepare('SELECT * FROM todos WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json({ todo });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/todos/:id -- get a specific todo
router.get('/:id', [param('id').isInt()], (req, res, next) => {
  try {
    const todo = req.db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ todo });
  } catch (err) {
    next(err);
  }
});

// PUT /api/todos/:id -- update a todo
router.put('/:id', [param('id').isInt()], (req, res, next) => {
  try {
    const existing = req.db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const { title, description, completed } = req.body;
    const updatedTitle =
      title !== undefined ? title : existing.title;
    const updatedDescription =
      description !== undefined ? description : existing.description;
    const updatedCompleted =
      completed !== undefined
        ? completed
          ? 1
          : 0
        : existing.completed;

    req.db
      .prepare(
        `UPDATE todos
         SET title = ?, description = ?, completed = ?,
             updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      )
      .run(
        updatedTitle,
        updatedDescription,
        updatedCompleted,
        req.params.id,
        req.user.id
      );

    const todo = req.db
      .prepare('SELECT * FROM todos WHERE id = ?')
      .get(req.params.id);
    res.json({ todo });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/todos/:id -- delete a todo
router.delete('/:id', [param('id').isInt()], (req, res, next) => {
  try {
    const result = req.db
      .prepare('DELETE FROM todos WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

**Critical design decision -- row-level authorization:**
Every query includes `AND user_id = ?` bound to `req.user.id` (from JWT). This is the simplest, most reliable approach. A user literally cannot see or modify another user's todos because the SQL WHERE clause enforces it. No separate authorization middleware needed -- the query IS the authorization.

**Constraints:** Only modify `src/routes/todos.js`. Do not change auth or database schema. Every query must filter by `user_id`.

---

### Agent 5: Test Runner (testing)
**Wave:** 4
**Skills loaded:** superpowers:test-driven-development, superpowers:verification-before-completion
**Scope:**

Write comprehensive tests for all endpoints and utilities.

**What this agent produces:**

```
tests/
  setup.js            # Test database setup, app factory for tests
  auth.test.js        # Auth endpoint tests
  todos.test.js       # Todo CRUD tests + authorization tests
  utils/
    password.test.js  # Unit tests for password hashing
    token.test.js     # Unit tests for JWT utilities
jest.config.js        # Jest configuration
```

**Test approach:**
- Use supertest for HTTP-level integration tests
- In-memory SQLite (`:memory:`) for test isolation -- each test gets a fresh database
- No mocking of database layer -- test the real thing
- Focus on: happy paths, validation errors, auth failures, cross-user isolation

**Key file: tests/setup.js**

```js
const { createDatabase } = require('../src/db/connection');
const { createApp } = require('../src/app');

function createTestApp() {
  const db = createDatabase(':memory:');
  const app = createApp(db);
  return { app, db };
}

module.exports = { createTestApp };
```

**Key file: tests/auth.test.js**

```js
const request = require('supertest');
const { createTestApp } = require('./setup');

describe('POST /api/auth/signup', () => {
  let app;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  test('creates a new user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  test('rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password456' });

    expect(res.status).toBe(409);
  });

  test('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  test('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  let app;

  beforeEach(async () => {
    ({ app } = createTestApp());
    await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });
  });

  test('returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});
```

**Key file: tests/todos.test.js**

```js
const request = require('supertest');
const { createTestApp } = require('./setup');

describe('Todo CRUD', () => {
  let app, token;

  beforeEach(async () => {
    ({ app } = createTestApp());
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'user@example.com', password: 'password123' });
    token = res.body.token;
  });

  describe('POST /api/todos', () => {
    test('creates a todo', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Buy groceries', description: 'Milk, eggs' });

      expect(res.status).toBe(201);
      expect(res.body.todo.title).toBe('Buy groceries');
      expect(res.body.todo.completed).toBe(0);
    });

    test('rejects empty title', async () => {
      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
    });

    test('rejects unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/todos')
        .send({ title: 'Buy groceries' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/todos', () => {
    test('returns only the authenticated user todos', async () => {
      // Create todo as user 1
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'User 1 todo' });

      // Create user 2
      const user2 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'user2@example.com', password: 'password123' });

      // Create todo as user 2
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${user2.body.token}`)
        .send({ title: 'User 2 todo' });

      // User 1 should only see their own todo
      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.todos).toHaveLength(1);
      expect(res.body.todos[0].title).toBe('User 1 todo');
    });
  });

  describe('GET /api/todos/:id', () => {
    test('returns a specific todo', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Specific todo' });

      const res = await request(app)
        .get(`/api/todos/${created.body.todo.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.todo.title).toBe('Specific todo');
    });

    test('returns 404 for another user todo', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Private todo' });

      const user2 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'user2@example.com', password: 'password123' });

      const res = await request(app)
        .get(`/api/todos/${created.body.todo.id}`)
        .set('Authorization', `Bearer ${user2.body.token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/todos/:id', () => {
    test('updates a todo', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Original' });

      const res = await request(app)
        .put(`/api/todos/${created.body.todo.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated', completed: true });

      expect(res.status).toBe(200);
      expect(res.body.todo.title).toBe('Updated');
      expect(res.body.todo.completed).toBe(1);
    });

    test('cannot update another user todo', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Original' });

      const user2 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'user2@example.com', password: 'password123' });

      const res = await request(app)
        .put(`/api/todos/${created.body.todo.id}`)
        .set('Authorization', `Bearer ${user2.body.token}`)
        .send({ title: 'Hacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/todos/:id', () => {
    test('deletes a todo', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'To delete' });

      const res = await request(app)
        .delete(`/api/todos/${created.body.todo.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });

    test('cannot delete another user todo', async () => {
      const created = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Protected' });

      const user2 = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'user2@example.com', password: 'password123' });

      const res = await request(app)
        .delete(`/api/todos/${created.body.todo.id}`)
        .set('Authorization', `Bearer ${user2.body.token}`);

      expect(res.status).toBe(404);
    });
  });
});
```

**Key file: tests/utils/password.test.js**

```js
const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('Password utilities', () => {
  test('hashes and verifies a password', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).not.toBe('mypassword');
    expect(await comparePassword('mypassword', hash)).toBe(true);
    expect(await comparePassword('wrongpassword', hash)).toBe(false);
  });
});
```

**Key file: tests/utils/token.test.js**

```js
const { generateToken, verifyToken } = require('../../src/utils/token');

describe('Token utilities', () => {
  test('generates and verifies a token', () => {
    const token = generateToken({ userId: 1, email: 'test@example.com' });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(1);
    expect(decoded.email).toBe('test@example.com');
  });

  test('rejects tampered token', () => {
    const token = generateToken({ userId: 1 });
    expect(() => verifyToken(token + 'tampered')).toThrow();
  });
});
```

**Expected test count:** approximately 20 tests
**Expected result:** All passing

---

### Agent 6: Lint Quality (lint-quality)
**Wave:** 4 (parallel with testing)
**Skills loaded:** none (standard linting)
**Scope:**

Run ESLint and Prettier across all source and test files. Fix any violations.

**What this agent does:**

1. Run `npx eslint src/ tests/` -- report violations
2. Run `npx prettier --check 'src/**/*.js' 'tests/**/*.js'` -- report formatting issues
3. Auto-fix: `npx eslint src/ tests/ --fix` then `npx prettier --write 'src/**/*.js' 'tests/**/*.js'`
4. Re-run checks to confirm clean
5. Update state: `superx-state set '.quality_gates.lint_clean' 'true'`

**Expected result:** Clean after auto-fix. Zero errors, zero warnings.

---

### Agent 7: Docs Writer (docs)
**Wave:** 5
**Skills loaded:** claude-md-management:claude-md-improver
**Scope:**

Create README and update CLAUDE.md.

**What this agent produces:**

**README.md** with:
- Project description
- Prerequisites (Node.js 18+)
- Setup instructions (npm install, npm start)
- Environment variables (PORT, JWT_SECRET, DB_PATH)
- API endpoint reference table
- Example curl commands for every endpoint
- Testing instructions (npm test, npm run test:coverage)
- Linting instructions (npm run lint, npm run format)

**CLAUDE.md** with:
- Project context and architecture overview
- Key decisions (bcrypt salt rounds, JWT expiry, SQLite WAL mode)
- File structure map
- Testing patterns (in-memory SQLite, supertest)
- Conventions (express-validator for input, row-level authz in queries)

---

### Agent 8: Reviewer (review)
**Wave:** 5 (parallel with docs)
**Skills loaded:** pr-review-toolkit:review-pr
**Scope:**

Review all code against the checklist.

**Review checklist:**
- [ ] No hardcoded secrets (JWT_SECRET has fallback only for dev)
- [ ] Passwords never returned in API responses
- [ ] SQL injection prevented (parameterized queries throughout)
- [ ] Row-level authorization enforced on every todo query
- [ ] Input validation on all endpoints (express-validator)
- [ ] Error handler catches unexpected errors
- [ ] Tests cover happy paths and edge cases
- [ ] Cross-user isolation tested explicitly
- [ ] ESLint and Prettier passing
- [ ] App factory pattern enables test isolation

**Expected verdict:** APPROVE with possible minor suggestions.

---

## Phase 4: Quality Gate Checks

### Gate 1: Tests Pass

```
$ npm test

PASS  tests/utils/password.test.js
PASS  tests/utils/token.test.js
PASS  tests/auth.test.js
PASS  tests/todos.test.js

Test Suites: 4 passed, 4 total
Tests:       ~20 passed, ~20 total
Snapshots:   0 total
Time:        ~3s

State: superx-state mark-clean
Result: PASS -- .quality_gates.tests_passing = true
```

### Gate 2: Lint Clean

```
$ npx eslint src/ tests/
  0 errors, 0 warnings

$ npx prettier --check 'src/**/*.js' 'tests/**/*.js'
  All matched files use Prettier code style!

State: superx-state set '.quality_gates.lint_clean' 'true'
Result: PASS -- .quality_gates.lint_clean = true
```

### Gate 3: Conflict Reflection

```
$ conflict-log unresolved
  No unresolved conflicts.

Rationale: No skill conflicts detected in this project. All domains handled
  by core coder capabilities. No contradictory instructions.

State: superx-state set '.quality_gates.conflict_reflection_done' 'true'
Result: PASS -- .quality_gates.conflict_reflection_done = true
```

### Gate 4: Code Review

```
Reviewer agent verdict: APPROVE

Findings:
- SUGGESTION: Consider adding rate limiting to auth endpoints (not
  required for MVP, but good for production). Severity: LOW.
- SUGGESTION: Add request logging middleware (e.g., morgan) for
  observability. Severity: LOW.
- No CRITICAL or WARNING issues found.

State: superx-state set '.quality_gates.last_review' '"2026-04-06T17:30:00Z"'
Result: PASS
```

### Gate 5: No Dirty State

```
$ superx-state get '.quality_gates.dirty'
  false

Result: PASS -- all code changes have been tested
```

### All Gates Summary

```
$ superx-state check-quality-gates

  tests_passing:           true
  lint_clean:              true
  conflict_reflection_done: true
  last_review:             2026-04-06T17:30:00Z
  dirty:                   false

  ALL GATES PASS -- ready for git push
```

---

## Phase 5: State Updates (superx-state.json)

The final state of superx-state.json after full execution:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "todo-api",
    "phase": "complete",
    "autonomy_level": 2
  },
  "plan": {
    "sub_projects": [
      {
        "id": "project-setup",
        "status": "complete",
        "agent_id": "agent-coder-setup-001",
        "agent_type": "coder",
        "depends_on": [],
        "skills_used": []
      },
      {
        "id": "database",
        "status": "complete",
        "agent_id": "agent-coder-db-001",
        "agent_type": "coder",
        "depends_on": [],
        "skills_used": []
      },
      {
        "id": "auth",
        "status": "complete",
        "agent_id": "agent-coder-auth-001",
        "agent_type": "coder",
        "depends_on": ["database"],
        "skills_used": ["superpowers:test-driven-development"]
      },
      {
        "id": "todos-api",
        "status": "complete",
        "agent_id": "agent-coder-todos-001",
        "agent_type": "coder",
        "depends_on": ["auth", "database"],
        "skills_used": ["superpowers:test-driven-development"]
      },
      {
        "id": "testing",
        "status": "complete",
        "agent_id": "agent-test-001",
        "agent_type": "test-runner",
        "depends_on": ["auth", "todos-api"],
        "skills_used": [
          "superpowers:test-driven-development",
          "superpowers:verification-before-completion"
        ]
      },
      {
        "id": "lint-quality",
        "status": "complete",
        "agent_id": "agent-lint-001",
        "agent_type": "lint-quality",
        "depends_on": ["project-setup"],
        "skills_used": []
      },
      {
        "id": "docs",
        "status": "complete",
        "agent_id": "agent-docs-001",
        "agent_type": "docs-writer",
        "depends_on": ["auth", "todos-api", "testing", "lint-quality"],
        "skills_used": ["claude-md-management:claude-md-improver"]
      },
      {
        "id": "review",
        "status": "complete",
        "agent_id": "agent-reviewer-001",
        "agent_type": "reviewer",
        "depends_on": ["auth", "todos-api", "testing", "lint-quality"],
        "skills_used": ["pr-review-toolkit:review-pr"]
      }
    ],
    "dependency_graph": {
      "project-setup": [],
      "database": [],
      "auth": ["database"],
      "todos-api": ["auth", "database"],
      "testing": ["auth", "todos-api"],
      "lint-quality": ["project-setup"],
      "docs": ["auth", "todos-api", "testing", "lint-quality"],
      "review": ["auth", "todos-api", "testing", "lint-quality"]
    }
  },
  "conflict_log": [],
  "agent_history": [
    {
      "id": "agent-coder-setup-001",
      "type": "coder",
      "sub_project": "project-setup",
      "started": "2026-04-06T17:00:00Z",
      "completed": "2026-04-06T17:02:00Z",
      "result": "success"
    },
    {
      "id": "agent-coder-db-001",
      "type": "coder",
      "sub_project": "database",
      "started": "2026-04-06T17:00:00Z",
      "completed": "2026-04-06T17:02:00Z",
      "result": "success"
    },
    {
      "id": "agent-coder-auth-001",
      "type": "coder",
      "sub_project": "auth",
      "started": "2026-04-06T17:02:00Z",
      "completed": "2026-04-06T17:08:00Z",
      "result": "success"
    },
    {
      "id": "agent-coder-todos-001",
      "type": "coder",
      "sub_project": "todos-api",
      "started": "2026-04-06T17:08:00Z",
      "completed": "2026-04-06T17:14:00Z",
      "result": "success"
    },
    {
      "id": "agent-test-001",
      "type": "test-runner",
      "sub_project": "testing",
      "started": "2026-04-06T17:14:00Z",
      "completed": "2026-04-06T17:18:00Z",
      "result": "success",
      "details": "20 tests passing, 4 suites"
    },
    {
      "id": "agent-lint-001",
      "type": "lint-quality",
      "sub_project": "lint-quality",
      "started": "2026-04-06T17:14:00Z",
      "completed": "2026-04-06T17:15:00Z",
      "result": "success",
      "details": "0 errors, 0 warnings"
    },
    {
      "id": "agent-docs-001",
      "type": "docs-writer",
      "sub_project": "docs",
      "started": "2026-04-06T17:18:00Z",
      "completed": "2026-04-06T17:22:00Z",
      "result": "success"
    },
    {
      "id": "agent-reviewer-001",
      "type": "reviewer",
      "sub_project": "review",
      "started": "2026-04-06T17:18:00Z",
      "completed": "2026-04-06T17:25:00Z",
      "result": "success",
      "details": "APPROVE with 2 low-severity suggestions"
    }
  ],
  "quality_gates": {
    "tests_passing": true,
    "lint_clean": true,
    "last_review": "2026-04-06T17:25:00Z",
    "conflict_reflection_done": true,
    "dirty": false
  },
  "maintainer": {
    "enabled": false,
    "issue_sources": [],
    "pending_fixes": [],
    "release_queue": []
  },
  "communication_log": [
    {
      "timestamp": "2026-04-06T17:00:00Z",
      "type": "plan",
      "message": "Breaking into 8 sub-projects. Setup and DB in parallel, then auth, then todos API, then tests+lint in parallel, then docs+review. Starting now."
    },
    {
      "timestamp": "2026-04-06T17:02:00Z",
      "type": "progress",
      "message": "Project setup and database schema done. 2 of 8 complete. Moving to auth."
    },
    {
      "timestamp": "2026-04-06T17:08:00Z",
      "type": "progress",
      "message": "Auth module done -- signup, login, JWT middleware. 3 of 8 complete. Moving to todos API."
    },
    {
      "timestamp": "2026-04-06T17:14:00Z",
      "type": "progress",
      "message": "Todos CRUD with row-level authz done. 4 of 8 complete. Running tests and lint in parallel."
    },
    {
      "timestamp": "2026-04-06T17:18:00Z",
      "type": "progress",
      "message": "20 tests passing, lint clean. 6 of 8 complete. Running docs and review in parallel."
    },
    {
      "timestamp": "2026-04-06T17:25:00Z",
      "type": "complete",
      "message": "All done. 8 sub-projects complete, 20 tests passing, lint clean. Review: APPROVE. Ready for git."
    }
  ]
}
```

---

## Phase 6: Final Project Structure

```
todo-api/
  package.json
  jest.config.js
  .eslintrc.json
  .prettierrc
  .gitignore
  CLAUDE.md
  README.md
  src/
    server.js
    app.js
    config.js
    db/
      connection.js
      migrations.js
      index.js
    routes/
      auth.js
      todos.js
    middleware/
      authenticate.js
      errorHandler.js
    utils/
      password.js
      token.js
  tests/
    setup.js
    auth.test.js
    todos.test.js
    utils/
      password.test.js
      token.test.js
  data/
    .gitkeep            # SQLite DB created here at runtime
  superx-state.json
```

---

## Phase 7: Completion Communication

> All done. 8 sub-projects complete, ~20 tests passing, lint clean. Reviewer approved with 2 minor suggestions (rate limiting and request logging -- both good for production but not needed for MVP). All quality gates pass. Ready for git init and first commit.

---

## Appendix A: API Endpoint Reference

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | /api/auth/signup | No | Create a new user account |
| POST | /api/auth/login | No | Login and receive JWT token |
| GET | /api/todos | Yes (Bearer) | List all todos for current user |
| POST | /api/todos | Yes (Bearer) | Create a new todo |
| GET | /api/todos/:id | Yes (Bearer) | Get a specific todo (own only) |
| PUT | /api/todos/:id | Yes (Bearer) | Update a specific todo (own only) |
| DELETE | /api/todos/:id | Yes (Bearer) | Delete a specific todo (own only) |
| GET | /health | No | Health check endpoint |

---

## Appendix B: Why superx Orchestration Matters Here

Without superx, a single agent would likely:
1. Write all code sequentially, possibly forgetting to add tests until the end
2. Skip lint configuration or add it as an afterthought
3. Not enforce row-level authorization testing (the most critical security property)
4. Not run a formal code review pass
5. Not maintain state or communication logs
6. Not separate concerns -- mixing DB, auth, and route code haphazardly

With superx:
1. **Parallel execution** -- setup + database run simultaneously, saving wall-clock time
2. **Specialized agents** -- each agent is focused on one concern with clear constraints preventing overlap
3. **Quality gates** -- tests, lint, review, and conflict reflection are mandatory before anything ships
4. **Row-level authz** is explicitly called out in the plan and tested with cross-user isolation tests
5. **State tracking** -- every sub-project, agent, and decision is logged for traceability
6. **CTO-level decisions** -- like choosing in-query authorization over middleware, bcrypt with 12 salt rounds, WAL mode for SQLite, app factory pattern for testability
7. **Communication** -- clear progress updates at every milestone, no ambiguity about what is done
8. **Resumability** -- if the session dies, superx-state.json lets the next session pick up exactly where things left off
9. **Reviewer agent** catches production concerns (rate limiting, logging) that implementation agents miss because they are focused on their scope
10. **Docs agent** ensures the project is immediately usable by someone else, not just the author
