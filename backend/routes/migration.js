const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

router.post("/import", async (req, res) => {
  let db;

  try {
    const secret = process.env.MIGRATION_SECRET;

    if (!secret || req.headers["x-migration-secret"] !== secret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized migration request"
      });
    }

    const data = req.body;

    if (!data || !Array.isArray(data.users) || !Array.isArray(data.teams)) {
      return res.status(400).json({
        success: false,
        message: "Invalid migration data"
      });
    }

    db = new sqlite3.Database(
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

    const closeDb = () =>
      new Promise((resolve) => {
        if (!db) return resolve();
        db.close(() => resolve());
      });

    await run("BEGIN TRANSACTION");

    try {
      // Clear child tables first, then parent tables
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

      // =========================
      // TEAMS
      // =========================
      for (const row of data.teams) {
        await run(
          `INSERT INTO teams
           (id, name, description, admin_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            row.id,
            row.name,
            row.description ?? null,
            row.admin_id ?? null,
            row.created_at ?? null
          ]
        );
      }

      // =========================
      // USERS
      // =========================
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
            row.team_id ?? null,
            row.points ?? 0,
            row.status ?? "Active",
            row.created_at ?? null,
            row.phone ?? null
          ]
        );
      }

      // =========================
      // TASKS
      // =========================
      // attachment is intentionally excluded because
      // Render database does not currently have this column.
      for (const row of data.tasks || []) {
        await run(
          `INSERT INTO tasks
           (id, title, description, team_id, assigned_to, created_by,
            priority, status, due_date, created_at, completed_at,
            points_awarded, start_date, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.title,
            row.description ?? null,
            row.team_id,
            row.assigned_to ?? null,
            row.created_by ?? null,
            row.priority ?? "Medium",
            row.status ?? "Pending",
            row.due_date ?? null,
            row.created_at ?? null,
            row.completed_at ?? null,
            row.points_awarded ?? 0,
            row.start_date ?? null,
            row.updated_at ?? null
          ]
        );
      }

      // =========================
      // ACTIVITIES
      // =========================
      // Render requires activities.action to be NOT NULL.
      for (const row of data.activities || []) {
        await run(
          `INSERT INTO activities
           (id, user_id, activity, created_at, action, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.user_id ?? null,
            row.activity ?? "Activity",
            row.created_at ?? null,
            row.action ?? "activity",
            row.description ?? ""
          ]
        );
      }

      // =========================
      // DOUBTS
      // =========================
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
            row.answer ?? null,
            row.status ?? "Open",
            row.answered_by ?? null,
            row.created_at ?? null,
            row.answered_at ?? null,
            row.title ?? null
          ]
        );
      }

      // =========================
      // NOTIFICATIONS
      // =========================
      for (const row of data.notifications || []) {
        await run(
          `INSERT INTO notifications
           (id, user_id, type, message, related_id, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.user_id,
            row.type,
            row.message,
            row.related_id ?? null,
            row.is_read ?? 0,
            row.created_at ?? null
          ]
        );
      }

      // =========================
      // SUGGESTIONS
      // =========================
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
            row.status ?? "New",
            row.response ?? null,
            row.reviewed_by ?? null,
            row.created_at ?? null,
            row.updated_at ?? null,
            row.title ?? null
          ]
        );
      }

      // Commit everything
      await run("COMMIT");

      await closeDb();
      db = null;

      return res.json({
        success: true,
        message: "Local Team Pulse data imported successfully",
        counts: {
          teams: data.teams.length,
          users: data.users.length,
          tasks: (data.tasks || []).length,
          activities: (data.activities || []).length,
          notifications: (data.notifications || []).length,
          doubts: (data.doubts || []).length,
          suggestions: (data.suggestions || []).length
        }
      });

    } catch (error) {
      await run("ROLLBACK").catch(() => {});
      await closeDb();
      db = null;
      throw error;
    }

  } catch (error) {
    console.error("[MIGRATION ERROR]", error);

    if (db) {
      await new Promise((resolve) => db.close(() => resolve()));
    }

    return res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message
    });
  }
});

module.exports = router;