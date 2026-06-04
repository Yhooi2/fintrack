'use strict';

const Database = require('better-sqlite3');
const path = require('path');

// Файл базы данных хранится рядом с исходным кодом.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'fintrack.db');
const db = new Database(dbPath);

// Включаем контроль целостности внешних ключей.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Инициализация схемы данных. Выполняется при каждом старте — IF NOT EXISTS
// гарантирует, что уже созданные таблицы не будут затронуты.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name    TEXT NOT NULL,
    kind    TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    category_id INTEGER,
    kind        TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    amount      INTEGER NOT NULL CHECK (amount > 0),  -- сумма в копейках
    note        TEXT,
    spent_at    TEXT NOT NULL DEFAULT (date('now')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, spent_at);
`);

module.exports = db;
