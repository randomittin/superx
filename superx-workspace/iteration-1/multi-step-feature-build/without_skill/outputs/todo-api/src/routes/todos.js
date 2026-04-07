const express = require("express");
const { authenticate } = require("../middleware/auth");
const { getDb } = require("../db/database");

const router = express.Router();

router.use(authenticate);

// List all todos for the authenticated user
router.get("/", (req, res) => {
  const db = getDb();
  const todos = db
    .prepare("SELECT * FROM todos WHERE user_id = ? ORDER BY id DESC")
    .all(req.userId);

  res.json(todos);
});

// Get a single todo
router.get("/:id", (req, res) => {
  const db = getDb();
  const todo = db
    .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  res.json(todo);
});

// Create a new todo
router.post("/", (req, res) => {
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const db = getDb();
  const result = db
    .prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)")
    .run(req.userId, title.trim());

  const todo = db
    .prepare("SELECT * FROM todos WHERE id = ?")
    .get(result.lastInsertRowid);

  res.status(201).json(todo);
});

// Update a todo
router.put("/:id", (req, res) => {
  const { title, completed } = req.body;
  const db = getDb();

  const existing = db
    .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!existing) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newCompleted =
    completed !== undefined ? (completed ? 1 : 0) : existing.completed;

  if (title !== undefined && !newTitle) {
    return res.status(400).json({ error: "Title cannot be empty" });
  }

  db.prepare(
    "UPDATE todos SET title = ?, completed = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(newTitle, newCompleted, req.params.id, req.userId);

  const updated = db
    .prepare("SELECT * FROM todos WHERE id = ?")
    .get(req.params.id);

  res.json(updated);
});

// Delete a todo
router.delete("/:id", (req, res) => {
  const db = getDb();

  const existing = db
    .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!existing) {
    return res.status(404).json({ error: "Todo not found" });
  }

  db.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.userId
  );

  res.json({ message: "Todo deleted successfully" });
});

module.exports = router;
