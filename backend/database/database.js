/**
 * TEAM PULSE — PostgreSQL Database Module
 * Supabase PostgreSQL compatible
 */

const { Pool } = require('pg');
const { hashPassword } = require('../utils/passwordUtil');

if (!process.env.DATABASE_URL) {
  throw new Error('[DB] DATABASE_URL is not configured.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('connect', () => {
  console.log('[DB] PostgreSQL connection established.');
});

pool.on('error', (err) => {
  console.error('[DB] PostgreSQL pool error:', err.message);
});

// --------------------------------------------------
// Convert SQLite ? placeholders to PostgreSQL $1, $2...
// --------------------------------------------------

function convertPlaceholders(sql) {
  let index = 0;

  return sql.replace(/\?/g, () => {
    index++;
    return `$${index}`;
  });
}

// --------------------------------------------------
// Promise Query Helpers
// --------------------------------------------------

async function run(sql, params = []) {
  const pgSql = convertPlaceholders(sql);

  // INSERT statements need RETURNING id so that
  // existing routes can continue using result.lastID.
  const isInsert = /^\s*INSERT\s+/i.test(sql);

  const finalSql = isInsert && !/RETURNING\s+/i.test(sql)
    ? `${pgSql} RETURNING id`
    : pgSql;

  const result = await pool.query(finalSql, params);

  return {
    lastID: result.rows.length > 0 && result.rows[0].id !== undefined
      ? result.rows[0].id
      : undefined,
    changes: result.rowCount
  };
}

async function get(sql, params = []) {
  const pgSql = convertPlaceholders(sql);

  const result = await pool.query(pgSql, params);

  return result.rows[0];
}

async function all(sql, params = []) {
  const pgSql = convertPlaceholders(sql);

  const result = await pool.query(pgSql, params);

  return result.rows;
}

// --------------------------------------------------
// Database Initialization
// --------------------------------------------------

async function initDatabase() {
  console.log('[DB] Initializing PostgreSQL database schema...');

  // Test connection
  await pool.query('SELECT NOW()');
  console.log('[DB] Connected to Supabase PostgreSQL.');

  // --------------------------------------------------
  // Teams
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      admin_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Users
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TEAM_MEMBER',
      team_id INTEGER,
      points INTEGER DEFAULT 0,
      phone TEXT,
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Tasks
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Doubts
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doubts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      title TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      answered_by INTEGER,
      answered_at TEXT,
      status TEXT DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Suggestions
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      title TEXT,
      suggestion TEXT NOT NULL,
      response TEXT,
      reviewed_by INTEGER,
      status TEXT DEFAULT 'New',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Activities
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      action TEXT NOT NULL,
      activity TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Notifications
  // --------------------------------------------------

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      target_id INTEGER,
      related_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --------------------------------------------------
  // Indexes
  // --------------------------------------------------

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_team
    ON users(team_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_team
    ON tasks(team_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned
    ON tasks(assigned_to)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks(status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_activities_created
    ON activities(created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, is_read)
  `);

  // --------------------------------------------------
  // Initial Super Admin
  // --------------------------------------------------

  const userCount = await pool.query(
    'SELECT COUNT(*) AS count FROM users'
  );

  if (Number(userCount.rows[0].count) === 0) {
    console.log('[DB] No users found. Creating initial setup...');

    const defaultTeams = [
      ['Development', 'Software development team'],
      ['Testing', 'Software testing team'],
      ['AI & ML', 'Artificial Intelligence and Machine Learning team'],
      ['Backend', 'Backend development team'],
      ['Frontend', 'Frontend development team'],
      ['Data Science', 'Data Science team'],
      ['Cloud & DevOps', 'Cloud and DevOps team'],
      ['UI/UX', 'UI/UX design team'],
      ['Research', 'Research team'],
      ['Support', 'Support team']
    ];

    for (const [name, description] of defaultTeams) {
      await pool.query(
        `
        INSERT INTO teams (name, description)
        VALUES ($1, $2)
        `,
        [name, description]
      );
    }

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error(
        '[DB] INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required.'
      );
    } else {
      const hashedPassword = await hashPassword(adminPassword);

      const firstTeam = await pool.query(
        'SELECT id FROM teams ORDER BY id ASC LIMIT 1'
      );

      await pool.query(
        `
        INSERT INTO users
        (name, email, password, role, team_id, status)
        VALUES ($1, $2, $3, 'SUPER_ADMIN', $4, 'Active')
        `,
        [
          'Super Admin',
          adminEmail.trim().toLowerCase(),
          hashedPassword,
          firstTeam.rows[0]?.id || null
        ]
      );

      console.log('[DB] Initial Super Admin created successfully.');
    }
  }

  console.log('[DB] PostgreSQL database initialization complete.');
}

module.exports = {
  pool,
  run,
  get,
  all,
  initDatabase
};