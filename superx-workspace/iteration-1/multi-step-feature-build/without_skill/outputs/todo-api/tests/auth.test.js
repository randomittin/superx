const request = require("supertest");
const app = require("../src/app");
const { getDb, closeDb, resetDb } = require("../src/db/database");

// Use in-memory database for tests
process.env.JWT_SECRET = "test-secret";
process.env.DB_PATH = ":memory:";

beforeEach(() => {
  resetDb();
  getDb(":memory:");
});

afterEach(() => {
  closeDb();
});

describe("POST /auth/signup", () => {
  it("should create a new user and return a token", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.userId).toBeDefined();
    expect(res.body.message).toBe("User created successfully");
  });

  it("should reject signup without email", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });

  it("should reject signup without password", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });

  it("should reject password shorter than 6 characters", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password must be at least 6 characters");
  });

  it("should reject duplicate email", async () => {
    await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com", password: "password123" });

    const res = await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com", password: "password456" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already registered");
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app)
      .post("/auth/signup")
      .send({ email: "test@example.com", password: "password123" });
  });

  it("should login with valid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.message).toBe("Login successful");
  });

  it("should reject invalid email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "wrong@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("should reject invalid password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("should reject login without credentials", async () => {
    const res = await request(app).post("/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });
});
