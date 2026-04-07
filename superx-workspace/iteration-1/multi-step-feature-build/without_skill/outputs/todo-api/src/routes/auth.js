const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../db/database");

const router = express.Router();

router.post("/signup", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db
    .prepare("INSERT INTO users (email, password) VALUES (?, ?)")
    .run(email, hashedPassword);

  const token = jwt.sign(
    { userId: result.lastInsertRowid },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.status(201).json({
    message: "User created successfully",
    token,
    userId: result.lastInsertRowid,
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const db = getDb();

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });

  res.json({ message: "Login successful", token, userId: user.id });
});

module.exports = router;
