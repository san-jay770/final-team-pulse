const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();

function getAll(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

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
            require("path").join(__dirname, "../database/team_pulse.db")
        );

        const run = (sql, params = []) =>
            new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });

        await run("PRAGMA foreign_keys = OFF");
        await run("BEGIN TRANSACTION");

        try {
            // Clear existing Render data
            const tables = [
                "activities",
                "notifications",
                "doubts",
                "suggestions",
                "password_resets",
                "roles",
                "team_members",
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
            for (const row of data.tasks) {
                await run(
                    `INSERT INTO tasks
           (id, title, description, team_id, assigned_to, created_by,
            priority, status, due_date, created_at, completed_at,
            points_awarded, start_date, updated_at, attachment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        row.updated_at,
                        row.attachment
                    ]
                );
            }

            // Activities
            for (const row of data.activities) {
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
            for (const row of data.doubts) {
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
            for (const row of data.notifications) {
                await run(
                    `INSERT INTO notifications
           (id, user_id, type, message, related_id, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        row.id,
                        row.user_id,
                        row.type,
                        row.message,
                        row.related_id,
                        row.is_read,
                        row.created_at
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

            // Hit points

            // Team members
            for (const row of data.team_members || []) {
                await run(
                    `INSERT INTO team_members
           (id, team_id, user_id, joined_at)
           VALUES (?, ?, ?, ?)`,
                    [
                        row.id,
                        row.team_id,
                        row.user_id,
                        row.joined_at
                    ]
                );
            }

            // Roles
            for (const row of data.roles || []) {
                await run(
                    `INSERT INTO roles
           (id, user_id, role)
           VALUES (?, ?, ?)`,
                    [
                        row.id,
                        row.user_id,
                        row.role
                    ]
                );
            }

            // Password resets
            for (const row of data.password_resets || []) {
                await run(
                    `INSERT INTO password_resets
           (id, user_id, token, expires_at, used, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        row.id,
                        row.user_id,
                        row.token,
                        row.expires_at,
                        row.used,
                        row.created_at
                    ]
                );
            }

            await run("COMMIT");
            await run("PRAGMA foreign_keys = ON");

            db.close();

            res.json({
                success: true,
                message: "Local Team Pulse data imported successfully",
                counts: {
                    teams: data.teams.length,
                    users: data.users.length,
                    tasks: data.tasks.length,
                    activities: data.activities.length,
                    notifications: data.notifications.length,
                    doubts: data.doubts.length,
                    suggestions: (data.suggestions || []).length
                }
            });
        } catch (error) {
            await run("ROLLBACK").catch(() => { });
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

