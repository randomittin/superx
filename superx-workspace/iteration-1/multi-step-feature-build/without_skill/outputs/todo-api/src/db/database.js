const Database = require("better-sqlite3");

let db;

function getDb(dbPath) {
  if (db) return db;

  const resolvedPath = dbPath || process.env.DB_PATH || "./todo.db";
  db = new Database(resolvedPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function resetDb() {
  db = null;
}

module.exports = { getDb, closeDb, resetDb };
