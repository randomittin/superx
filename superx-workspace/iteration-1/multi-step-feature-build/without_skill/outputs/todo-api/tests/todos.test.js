const request = require("supertest");
const app = require("../src/app");
const { getDb, closeDb, resetDb } = require("../src/db/database");

process.env.JWT_SECRET = "test-secret";
process.env.DB_PATH = ":memory:";

let token;
let token2;

async function createUserAndGetToken(email, password) {
  const res = await request(app)
    .post("/auth/signup")
    .send({ email, password });
  return res.body.token;
}

beforeEach(async () => {
  resetDb();
  getDb(":memory:");
  token = await createUserAndGetToken("user1@example.com", "password123");
  token2 = await createUserAndGetToken("user2@example.com", "password456");
});

afterEach(() => {
  closeDb();
});

describe("POST /todos", () => {
  it("should create a todo", async () => {
    const res = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Buy groceries" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Buy groceries");
    expect(res.body.completed).toBe(0);
    expect(res.body.id).toBeDefined();
  });

  it("should reject todo without title", async () => {
    const res = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Title is required");
  });

  it("should reject empty title", async () => {
    const res = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Title is required");
  });

  it("should reject request without auth", async () => {
    const res = await request(app)
      .post("/todos")
      .send({ title: "Buy groceries" });

    expect(res.status).toBe(401);
  });
});

describe("GET /todos", () => {
  beforeEach(async () => {
    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Todo 1" });

    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Todo 2" });

    // Create a todo for user2 -- should NOT appear in user1's list
    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token2}`)
      .send({ title: "User 2 Todo" });
  });

  it("should list only the authenticated user's todos", async () => {
    const res = await request(app)
      .get("/todos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe("Todo 2"); // DESC order
    expect(res.body[1].title).toBe("Todo 1");
  });

  it("should not show other user's todos", async () => {
    const res = await request(app)
      .get("/todos")
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("User 2 Todo");
  });
});

describe("GET /todos/:id", () => {
  let todoId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Specific todo" });
    todoId = res.body.id;
  });

  it("should get a specific todo", async () => {
    const res = await request(app)
      .get(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Specific todo");
  });

  it("should not allow access to another user's todo", async () => {
    const res = await request(app)
      .get(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });

  it("should return 404 for non-existent todo", async () => {
    const res = await request(app)
      .get("/todos/99999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe("PUT /todos/:id", () => {
  let todoId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Original title" });
    todoId = res.body.id;
  });

  it("should update the title", async () => {
    const res = await request(app)
      .put(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated title");
  });

  it("should mark todo as completed", async () => {
    const res = await request(app)
      .put(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(1);
  });

  it("should reject empty title update", async () => {
    const res = await request(app)
      .put(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Title cannot be empty");
  });

  it("should not allow updating another user's todo", async () => {
    const res = await request(app)
      .put(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ title: "Hacked" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /todos/:id", () => {
  let todoId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "To be deleted" });
    todoId = res.body.id;
  });

  it("should delete a todo", async () => {
    const res = await request(app)
      .delete(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Todo deleted successfully");

    // Verify it's gone
    const getRes = await request(app)
      .get(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });

  it("should not allow deleting another user's todo", async () => {
    const res = await request(app)
      .delete(`/todos/${todoId}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });
});

describe("Authentication middleware", () => {
  it("should reject requests without Authorization header", async () => {
    const res = await request(app).get("/todos");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("should reject requests with invalid token", async () => {
    const res = await request(app)
      .get("/todos")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("should reject requests with malformed Authorization header", async () => {
    const res = await request(app)
      .get("/todos")
      .set("Authorization", "NotBearer token");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });
});

describe("GET /health", () => {
  it("should return health status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
