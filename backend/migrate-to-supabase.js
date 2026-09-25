
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('[MIGRATION] DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const dataPath = path.join(
  __dirname,
  'database',
  'migration-data.json'
);

const data = JSON.parse(
  fs.readFileSync(dataPath, 'utf8')
);

async function insertRows(client, table, columns, rows) {
  if (!rows || rows.length === 0) {
    console.log(`[MIGRATION] ${table}: 0 rows`);
    return;
  }

  const columnList = columns.join(', ');

  for (const row of rows) {
    const values = columns.map((column) => {
      return row[column] ?? null;
    });

    const placeholders = values
      .map((_, index) => `$${index + 1}`)
      .join(', ');

    await client.query(
      `INSERT INTO ${table} (${columnList})
       VALUES (${placeholders})`,
      values
    );
  }

  console.log(
    `[MIGRATION] ${table}: ${rows.length} rows imported`
  );
}

async function resetSequence(client, table) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE(
        (SELECT MAX(id) FROM ${table}),
        0
      ) + 1,
      false
    )
  `);
}

async function verifyTable(client, table) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM ${table}`
  );

  return result.rows[0].count;
}

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('');
    console.log('==========================================');
    console.log(' TEAM PULSE → SUPABASE MIGRATION');
    console.log('==========================================');
    console.log('');

    console.log('[MIGRATION] Connecting to Supabase...');

    await client.query('SELECT NOW()');

    console.log(
      '[MIGRATION] Supabase connection successful.'
    );

    console.log('');

    await client.query('BEGIN');

    /*
     * Make sure the tasks table has the attachment column.
     */
    await client.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS attachment TEXT
    `);

    console.log(
      '[MIGRATION] Task attachment column checked.'
    );

    /*
     * Clear existing application data.
     *
     * Sessions are NOT deleted here.
     */
    console.log(
      '[MIGRATION] Clearing existing application data...'
    );

    await client.query(`
      TRUNCATE TABLE
        notifications,
        activities,
        doubts,
        suggestions,
        tasks,
        users,
        teams
      RESTART IDENTITY CASCADE
    `);

    console.log(
      '[MIGRATION] Existing application data cleared.'
    );

    console.log('');

    /*
     * ========================================
     * 1. TEAMS
     * ========================================
     */

    await insertRows(
      client,
      'teams',
      [
        'id',
        'name',
        'description',
        'admin_id',
        'created_at'
      ],
      data.teams
    );

    /*
     * ========================================
     * 2. USERS
     * ========================================
     *
     * Existing password hashes are imported
     * exactly as stored in migration-data.json.
     *
     * No passwords are regenerated.
     */

    await insertRows(
      client,
      'users',
      [
        'id',
        'name',
        'email',
        'password',
        'role',
        'team_id',
        'points',
        'status',
        'created_at',
        'phone'
      ],
      data.users
    );

    /*
     * ========================================
     * 3. TASKS
     * ========================================
     */

    await insertRows(
      client,
      'tasks',
      [
        'id',
        'title',
        'description',
        'team_id',
        'assigned_to',
        'created_by',
        'priority',
        'status',
        'due_date',
        'created_at',
        'completed_at',
        'points_awarded',
        'start_date',
        'updated_at',
        'attachment'
      ],
      data.tasks
    );

    /*
     * ========================================
     * 4. DOUBTS
     * ========================================
     */

    await insertRows(
      client,
      'doubts',
      [
        'id',
        'user_id',
        'team_id',
        'question',
        'answer',
        'status',
        'answered_by',
        'created_at',
        'answered_at',
        'title'
      ],
      data.doubts
    );

    /*
     * ========================================
     * 5. SUGGESTIONS
     * ========================================
     */

    await insertRows(
      client,
      'suggestions',
      [
        'id',
        'user_id',
        'team_id',
        'title',
        'suggestion',
        'response',
        'reviewed_by',
        'status',
        'created_at',
        'updated_at'
      ],
      data.suggestions
    );

    /*
     * ========================================
     * 6. ACTIVITIES
     * ========================================
     *
     * Old SQLite data contains some records
     * where action is NULL.
     *
     * PostgreSQL requires action to be NOT NULL.
     *
     * Therefore NULL action values are converted
     * to ACTIVITY.
     */

    const activities = (data.activities || []).map(
      (row) => ({
        ...row,
        action: row.action || 'ACTIVITY'
      })
    );

    await insertRows(
      client,
      'activities',
      [
        'id',
        'user_id',
        'activity',
        'created_at',
        'action',
        'description'
      ],
      activities
    );

    /*
     * ========================================
     * 7. NOTIFICATIONS
     * ========================================
     */

    await insertRows(
      client,
      'notifications',
      [
        'id',
        'user_id',
        'type',
        'message',
        'related_id',
        'is_read',
        'created_at'
      ],
      data.notifications
    );

    /*
     * ========================================
     * RESET SERIAL SEQUENCES
     * ========================================
     *
     * Original SQLite IDs are preserved.
     * PostgreSQL sequences are updated so new
     * records continue from the correct ID.
     */

    console.log('');

    console.log(
      '[MIGRATION] Resetting PostgreSQL ID sequences...'
    );

    await resetSequence(client, 'teams');
    await resetSequence(client, 'users');
    await resetSequence(client, 'tasks');
    await resetSequence(client, 'doubts');
    await resetSequence(client, 'suggestions');
    await resetSequence(client, 'activities');
    await resetSequence(client, 'notifications');

    /*
     * ========================================
     * VERIFY DATA
     * ========================================
     */

    console.log('');
    console.log(
      '[MIGRATION] Verifying imported data...'
    );

    const tables = [
      'teams',
      'users',
      'tasks',
      'doubts',
      'suggestions',
      'activities',
      'notifications'
    ];

    for (const table of tables) {
      const count = await verifyTable(
        client,
        table
      );

      console.log(
        `[VERIFY] ${table}: ${count}`
      );
    }

    /*
     * ========================================
     * COMMIT
     * ========================================
     */

    await client.query('COMMIT');

    console.log('');
    console.log('==========================================');
    console.log(' MIGRATION SUCCESSFUL');
    console.log('==========================================');
    console.log('');

    console.log(
      'Old Team Pulse data is now in Supabase.'
    );

    console.log(
      'Old users and password hashes were preserved.'
    );

    console.log('');

  } catch (error) {

    /*
     * If ANY step fails, rollback everything.
     */

    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        '[MIGRATION] Rollback error:',
        rollbackError.message
      );
    }

    console.error('');
    console.error('==========================================');
    console.error(' MIGRATION FAILED');
    console.error('==========================================');
    console.error('');

    console.error(
      '[ERROR]',
      error.message
    );

    console.error('');

    console.error(
      'No partial migration was committed.'
    );

    console.error('');

    process.exitCode = 1;

  } finally {

    client.release();

    await pool.end();
  }
}

migrate();

