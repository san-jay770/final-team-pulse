/**
 * TEAM PULSE — Database Module (SQLite3)
 * Handles DB connection, auto-migration of schema, and promise-based query wrappers.
 */

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

function resolveDbPath() {
  if (process.env.DB_PATH) {
    if (path.isAbsolute(process.env.DB_PATH)) return process.env.DB_PATH;
    const cwdPath = path.resolve(process.cwd(), process.env.DB_PATH);
    if (fs.existsSync(cwdPath)) return cwdPath;
    const backendPath = path.resolve(__dirname, '..', process.env.DB_PATH);
    if (fs.existsSync(backendPath)) return backendPath;
    const dirPath = path.resolve(__dirname, process.env.DB_PATH);
    if (fs.existsSync(dirPath)) return dirPath;
  }
  return path.join(__dirname, 'team_pulse.db');
}

const DB_PATH = resolveDbPath();

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] Connection error:', err.message);
  } else {
    console.log(`[DB] Connected to team_pulse.db at ${DB_PATH}`);
  }
});

// Enable WAL mode and foreign keys for performance and data integrity
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA cache_size = -64000');
  db.run('PRAGMA temp_store = MEMORY');
});

// ─────────────────────────────────────────────
// Promise Query Helpers
// ─────────────────────────────────────────────

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ─────────────────────────────────────────────
// Schema Initialization & Migration
// ─────────────────────────────────────────────

async function initDatabase() {
  console.log('[DB] Initializing database schema...');

  // 1. Teams Table
  await run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      admin_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TEAM_MEMBER',
      team_id INTEGER,
      points INTEGER DEFAULT 0,
      phone TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams (id)
    )
  `);

  // 3. Tasks Table
  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      team_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_by INTEGER,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Pending',
      start_date TEXT,
      due_date TEXT,
      completed_at TEXT,
      points_awarded INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams (id),
      FOREIGN KEY (assigned_to) REFERENCES users (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // 4. Doubts Table
  await run(`
    CREATE TABLE IF NOT EXISTS doubts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      title TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      answered_by INTEGER,
      answered_at TEXT,
      status TEXT DEFAULT 'Open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (team_id) REFERENCES teams (id),
      FOREIGN KEY (answered_by) REFERENCES users (id)
    )
  `);

  // 5. Suggestions Table
  await run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      title TEXT,
      suggestion TEXT NOT NULL,
      response TEXT,
      reviewed_by INTEGER,
      status TEXT DEFAULT 'New',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (team_id) REFERENCES teams (id),
      FOREIGN KEY (reviewed_by) REFERENCES users (id)
    )
  `);

  // 6. Activities Table
  await run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      activity TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // 7. Notifications Table
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      target_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Auto-migration for existing tables (ensure columns exist)
  const taskCols = await all('PRAGMA table_info(tasks)');
  const taskColNames = taskCols.map(c => c.name);

  if (!taskColNames.includes('start_date')) {
    await run('ALTER TABLE tasks ADD COLUMN start_date TEXT').catch(() => {});
  }
  if (!taskColNames.includes('updated_at')) {
    await run('ALTER TABLE tasks ADD COLUMN updated_at TEXT').catch(() => {});
  }
  if (!taskColNames.includes('completed_at')) {
    await run('ALTER TABLE tasks ADD COLUMN completed_at TEXT').catch(() => {});
  }
  if (!taskColNames.includes('points_awarded')) {
    await run('ALTER TABLE tasks ADD COLUMN points_awarded INTEGER DEFAULT 0').catch(() => {});
  }

  const userCols = await all('PRAGMA table_info(users)');
  const userColNames = userCols.map(c => c.name);
  if (!userColNames.includes('phone')) {
    await run('ALTER TABLE users ADD COLUMN phone TEXT').catch(() => {});
  }

  const suggCols = await all('PRAGMA table_info(suggestions)');
  const suggColNames = suggCols.map(c => c.name);
  // High-performance database indexes
  await run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').catch(() => {});
  await run('CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id)').catch(() => {});
  await run('CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id)').catch(() => {});
  await run('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)').catch(() => {});
  await run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)').catch(() => {});
  await run('CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC)').catch(() => {});
  await run('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)').catch(() => {});

  console.log('[DB] Database initialization complete.');
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
};
