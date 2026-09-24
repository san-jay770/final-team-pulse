/**
 * TEAM PULSE — Admin Dashboard Routes
 * Aggregated stats and Super Admin data endpoints.
 */

const express = require('express');
const router  = express.Router();
const { all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');

// GET /api/admin/dashboard — Super Admin dashboard stats
router.get('/dashboard', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    // Unique count of Super Admins (Sanjay, Parthasharathy, Premkumar)
    const superAdminsCount = await get("SELECT COUNT(DISTINCT lower(email)) AS count FROM users WHERE role = 'SUPER_ADMIN'");
    const super_admins = superAdminsCount ? superAdminsCount.count : 3;

    // Unique count of Team Admins (excluding Super Admins)
    const adminsCount = await get(`
      SELECT COUNT(DISTINCT lower(email)) AS count
      FROM users
      WHERE role = 'ADMIN'
        AND lower(email) NOT IN (SELECT lower(email) FROM users WHERE role = 'SUPER_ADMIN')
    `);
    const team_admins = adminsCount ? adminsCount.count : 0;

    // Total Admins (Super Admins + Team Admins)
    const total_admins = super_admins + team_admins;

    // Unique count of Team Members (excluding Super Admins & Admins)
    const membersCount = await get(`
      SELECT COUNT(DISTINCT lower(email)) AS count
      FROM users
      WHERE role = 'TEAM_MEMBER'
        AND lower(email) NOT IN (SELECT lower(email) FROM users WHERE role IN ('SUPER_ADMIN', 'ADMIN'))
    `);
    const total_members = membersCount ? membersCount.count : 0;

    const totalTeams = await get('SELECT COUNT(*) AS count FROM teams');
    const totalTasks = await get('SELECT COUNT(*) AS count FROM tasks');
    const pendingTasks = await get("SELECT COUNT(*) AS count FROM tasks WHERE status NOT IN ('Completed','COMPLETED')");
    const completedTasks = await get("SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Completed','COMPLETED')");
    const overdueTasks = await get("SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Overdue','OVERDUE')");
    const totalDoubts = await get('SELECT COUNT(*) AS count FROM doubts');
    const openDoubts = await get("SELECT COUNT(*) AS count FROM doubts WHERE status = 'Open'");
    const totalSuggestions = await get('SELECT COUNT(*) AS count FROM suggestions');
    const activeUsers = await get("SELECT COUNT(DISTINCT lower(email)) AS count FROM users WHERE status = 'Active'");

    // Team performance
    const teamPerf = await all(`
      SELECT t.id, t.name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END), 0) AS done,
        COALESCE(SUM(CASE WHEN tk.status IN ('Overdue','OVERDUE') THEN 1 ELSE 0 END), 0) AS overdue
      FROM teams t
      LEFT JOIN tasks tk ON tk.team_id = t.id
      GROUP BY t.id, t.name
      ORDER BY t.id
    `);

    const enrichedTeams = teamPerf.map(t => {
      const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
      return {
        ...t,
        team_name: t.name,
        total_tasks: t.total,
        completed_tasks: t.done,
        completion_rate: pct,
        pct: pct,
      };
    });

    // Recent activities
    const recentActivities = await all(`
      SELECT a.*, u.name AS user_name
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 15
    `);

    // Leaderboard top 5
    const leaderboard = await all(`
      SELECT u.id, u.name, u.points, t.name AS team_name,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.assigned_to = u.id AND tk.status IN ('Completed','COMPLETED')) AS completed_count
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'Active'
      ORDER BY u.points DESC, completed_count DESC
      LIMIT 5
    `);

    // Task status distribution for chart
    const taskStatusDist = await all(`
      SELECT status, COUNT(*) AS count FROM tasks GROUP BY status
    `);

    // Weekly completion (last 7 days)
    const weeklyCompletion = await all(`
      SELECT date(completed_at) AS day, COUNT(*) AS count
      FROM tasks
      WHERE status IN ('Completed','COMPLETED')
        AND completed_at >= date('now', '-7 days')
      GROUP BY day
      ORDER BY day
    `);

    return res.json({
      success: true,
      data: {
        stats: {
          super_admins:      super_admins,
          team_admins:       team_admins,
          total_admins:      total_admins,
          total_users:       total_members,
          total_teams:       totalTeams ? totalTeams.count : 0,
          total_tasks:       totalTasks ? totalTasks.count : 0,
          pending_tasks:     pendingTasks ? pendingTasks.count : 0,
          completed_tasks:   completedTasks ? completedTasks.count : 0,
          overdue_tasks:     overdueTasks ? overdueTasks.count : 0,
          total_doubts:      totalDoubts ? totalDoubts.count : 0,
          open_doubts:       openDoubts ? openDoubts.count : 0,
          total_suggestions: totalSuggestions ? totalSuggestions.count : 0,
          active_users:      activeUsers ? activeUsers.count : 0,
          completion_pct:    totalTasks && totalTasks.count > 0
            ? Math.round(((completedTasks ? completedTasks.count : 0) / totalTasks.count) * 100)
            : 0,
        },
        team_performance:  enrichedTeams,
        recent_activities: recentActivities,
        leaderboard,
        task_status_dist:  taskStatusDist,
        weekly_completion: weeklyCompletion,
      },
    });
  } catch (err) {
    console.error('[Admin] Dashboard error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard data.' });
  }
});

// GET /api/admin/stats — Quick stats (for navbar)
router.get('/stats', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    let pendingCount, overdueCount;

    if (req.user.role === 'SUPER_ADMIN') {
      pendingCount = await get("SELECT COUNT(*) AS count FROM tasks WHERE status NOT IN ('Completed','COMPLETED')");
      overdueCount = await get("SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Overdue','OVERDUE')");
    } else {
      pendingCount = await get(
        "SELECT COUNT(*) AS count FROM tasks WHERE team_id = ? AND status NOT IN ('Completed','COMPLETED')",
        [req.user.team_id]
      );
      overdueCount = await get(
        "SELECT COUNT(*) AS count FROM tasks WHERE team_id = ? AND status IN ('Overdue','OVERDUE')",
        [req.user.team_id]
      );
    }

    return res.json({
      success: true,
      data: {
        pending_tasks: pendingCount ? pendingCount.count : 0,
        overdue_tasks: overdueCount ? overdueCount.count : 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

// GET /api/admin/leaderboard
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const rows = await all(`
      SELECT
        u.id, u.name, u.points, t.name AS team_name,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.assigned_to = u.id AND tk.status IN ('Completed','COMPLETED')) AS completed,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.assigned_to = u.id AND tk.status IN ('Overdue','OVERDUE')) AS overdue,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.assigned_to = u.id
          AND tk.status IN ('Completed','COMPLETED')
          AND (tk.completed_at IS NULL OR date(tk.completed_at) <= date(tk.due_date))
        ) AS on_time
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'Active' AND u.role = 'TEAM_MEMBER'
      ORDER BY u.points DESC, completed DESC
      LIMIT 50
    `);

    const ranked = rows.map((row, i) => ({
      rank: i + 1,
      ...row,
    }));

    return res.json({ success: true, data: ranked });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load leaderboard.' });
  }
});

// GET /api/admin/email-config — Get SMTP email configuration details
router.get('/email-config', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const config = emailService.getEmailConfig();
    return res.json({ success: true, data: config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/test-email — Dispatch live test email to recipient
router.post('/test-email', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const targetEmail = (req.body && req.body.to) ? req.body.to.trim() : req.user.email;
    const result = await emailService.sendTestEmail(targetEmail);
    if (result.success) {
      return res.json({
        success: true,
        message: `Live test email successfully dispatched to ${targetEmail}! Message ID: ${result.messageId || 'Delivered'}`,
        messageId: result.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Email dispatch failed: ${result.error || 'Check SMTP configuration'}`,
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
