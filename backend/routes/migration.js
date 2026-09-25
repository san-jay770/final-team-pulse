const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

router.post("/import", async (req, res) => {
  try {
    const secret = process.env.MIGRATION_SECRET;

    if (!secret || req.headers["x-migration-secret"] !== secret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized migration request"
      });
    }

    const data = req.body;

    if (!data || !data.users || !data.teams) {
      return res.status(400).json({
        success: false,
        message: "Invalid migration data"
      });
    }

    const db = new sqlite3.Database(
      process.env.DB_PATH ||
      path.join(__dirname, "../database/team_pulse.db")
    );

    const run = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve(this);
        });
      });

    await run("BEGIN TRANSACTION");

    try {
      // Clear only tables that exist in the current Render schema.
      const tables = [
        "activities",
        "notifications",
        "doubts",
        "suggestions",
        "tasks",
        "users",
        "teams"
      ];

      for (const table of tables) {
        await run(`DELETE FROM ${table}`);
      }

      // Teams
      for (const row of data.teams) {
        await run(
          `INSERT INTO teams
           (id, name, description, admin_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            row.id,
            row.name,
            row.description,
            row.admin_id,
            row.created_at
          ]
        );
      }

      // Users
      for (const row of data.users) {
        await run(
          `INSERT INTO users
           (id, name, email, password, role, team_id, points, status, created_at, phone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.name,
            row.email,
            row.password,
            row.role,
            row.team_id,
            row.points,
            row.status,
            row.created_at,
            row.phone
          ]
        );
      }

      // Tasks
      // attachment is intentionally excluded because
      // the Render database does not currently have that column.
      for (const row of data.tasks) {
        await run(
          `INSERT INTO tasks
           (id, title, description, team_id, assigned_to, created_by,
            priority, status, due_date, created_at, completed_at,
            points_awarded, start_date, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.title,
            row.description,
            row.team_id,
            row.assigned_to,
            row.created_by,
            row.priority,
            row.status,
            row.due_date,
            row.created_at,
            row.completed_at,
            row.points_awarded,
            row.start_date,
            row.updated_at
          ]
        );
      }

      // Activities
      for (const row of data.activities || []) {
        await run(
          `INSERT INTO activities
           (id, user_id, activity, created_at, action, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.user_id,
            row.activity,
            row.created_at,
            row.action,
            row.description
          ]
        );
      }

      // Doubts
      for (const row of data.doubts || []) {
        await run(
          `INSERT INTO doubts
           (id, user_id, team_id, question, answer, status,
            answered_by, created_at, answered_at, title)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.user_id,
            row.team_id,
            row.question,
            row.answer,
            row.status,
            row.answered_by,
            row.created_at,
            row.answered_at,
            row.title
          ]
        );
      }

      // Notifications
   for (const row of data.activities || []) {
  await run(
    `INSERT INTO activities
     (id, user_id, activity, created_at, action, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      row.activity,
      row.created_at,
      row.action || "activity",
      row.description || ""
    ]
  );
}

      // Suggestions
      for (const row of data.suggestions || []) {
        await run(
          `INSERT INTO suggestions
           (id, user_id, team_id, suggestion, status, response,
            reviewed_by, created_at, updated_at, title)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.user_id,
            row.team_id,
            row.suggestion,
            row.status,
            row.response,
            row.reviewed_by,
            row.created_at,
            row.updated_at,
            row.title
          ]
        );
      }

      await run("COMMIT");

      db.close();

      res.json({
        success: true,
        message: "Local Team Pulse data imported successfully",
        counts: {
          teams: data.teams.length,
          users: data.users.length,
          tasks: data.tasks.length,
          activities: (data.activities || []).length,
          notifications: (data.notifications || []).length,
          doubts: (data.doubts || []).length,
          suggestions: (data.suggestions || []).length
        }
      });
    } catch (error) {
      await run("ROLLBACK").catch(() => {});
      db.close();
      throw error;
    }
  } catch (error) {
    console.error("[MIGRATION ERROR]", error);

    res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message
    });
  }
});

module.exports = router;