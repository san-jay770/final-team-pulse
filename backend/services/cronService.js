/**
 * TEAM PULSE — Cron Service (node-cron)
 * Scheduled automated jobs for reminders, overdue checks, and daily reports.
 * All timings are configurable via environment variables.
 */

require('dotenv').config();
const cron = require('node-cron');
const { all, get, run } = require('../database/database');
const emailService = require('./emailService');
const notificationService = require('./notificationService');

// ─────────────────────────────────────────────
// Helper: Log activity
// ─────────────────────────────────────────────
async function logSystemActivity(message) {
  try {
    await run(
      'INSERT INTO activities (user_id, action, activity, description) VALUES (NULL, "SYSTEM", ?, ?)',
      [message, message]
    );
  } catch (err) {
    console.error('[Cron] Failed to log activity:', err.message);
  }
}

// ─────────────────────────────────────────────
// Job 1: Daily Morning Reminder (8:30 AM weekdays)
// Send each user their pending tasks for the day
// ─────────────────────────────────────────────
async function runMorningReminder() {
  console.log('[Cron] ▶ Running morning reminder job...');
  try {
    // Get all active users with pending tasks
    const users = await all(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      INNER JOIN tasks t ON t.assigned_to = u.id
      WHERE u.status = 'Active'
        AND t.status NOT IN ('Completed', 'COMPLETED')
      ORDER BY u.name
    `);

    for (const user of users) {
      const tasks = await all(`
        SELECT t.*, tm.name AS team_name
        FROM tasks t
        LEFT JOIN teams tm ON t.team_id = tm.id
        WHERE t.assigned_to = ?
          AND t.status NOT IN ('Completed', 'COMPLETED')
        ORDER BY t.due_date ASC
      `, [user.id]);

      if (tasks.length > 0) {
        // Create summary notification
        await notificationService.createNotification(
          user.id,
          'TASK_REMINDER',
          `Good morning! You have ${tasks.length} pending task${tasks.length > 1 ? 's' : ''} today.`,
          null
        );

        console.log(`[Cron] Morning reminder: ${user.name} has ${tasks.length} pending tasks`);
      }
    }

    console.log(`[Cron] Morning reminder sent to ${users.length} users`);
    await logSystemActivity('Morning reminder job completed');
  } catch (err) {
    console.error('[Cron] Morning reminder failed:', err.message);
  }
}

// ─────────────────────────────────────────────
// Job 2: Due Tomorrow Reminder (5:00 PM daily)
// Send email for tasks due tomorrow
// ─────────────────────────────────────────────
async function runDueTomorrowReminder() {
  console.log('[Cron] ▶ Running due-tomorrow reminder job...');
  try {
    // Find tasks due tomorrow (not yet completed)
    const tasksDueTomorrow = await all(`
      SELECT t.*, u.name AS user_name, u.email AS user_email
      FROM tasks t
      INNER JOIN users u ON t.assigned_to = u.id
      WHERE date(t.due_date) = date('now', '+1 day')
        AND t.status NOT IN ('Completed', 'COMPLETED')
        AND u.status = 'Active'
    `);

    for (const task of tasksDueTomorrow) {
      const user = { name: task.user_name, email: task.user_email };

      // Send reminder email
      await emailService.sendTaskReminderEmail(user, task, 1);

      // Create notification
      await notificationService.createNotification(
        task.assigned_to,
        'TASK_REMINDER',
        `Reminder: Task "${task.title}" is due tomorrow!`,
        task.id
      );
    }

    console.log(`[Cron] Due-tomorrow reminders sent for ${tasksDueTomorrow.length} tasks`);
    await logSystemActivity(`Due-tomorrow reminders: ${tasksDueTomorrow.length} tasks`);
  } catch (err) {
    console.error('[Cron] Due-tomorrow reminder failed:', err.message);
  }
}

// ─────────────────────────────────────────────
// Job 3: Overdue Task Check (9:00 AM daily)
// Mark tasks as overdue and send notifications
// ─────────────────────────────────────────────
async function runOverdueCheck() {
  console.log('[Cron] ▶ Running overdue task check...');
  try {
    // Find tasks that are past due date and not completed
    const overdueTasks = await all(`
      SELECT t.*, u.name AS user_name, u.email AS user_email
      FROM tasks t
      INNER JOIN users u ON t.assigned_to = u.id
      WHERE date(t.due_date) < date('now')
        AND t.status NOT IN ('Completed', 'COMPLETED', 'Overdue', 'OVERDUE')
        AND t.due_date IS NOT NULL
        AND t.due_date != ''
        AND u.status = 'Active'
    `);

    for (const task of overdueTasks) {
      // Update status to Overdue
      await run(
        'UPDATE tasks SET status = "Overdue", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [task.id]
      );

      const user = { name: task.user_name, email: task.user_email };

      // Send overdue email
      await emailService.sendTaskOverdueEmail(user, task);

      // Create notification
      await notificationService.createNotification(
        task.assigned_to,
        'TASK_OVERDUE',
        `Task "${task.title}" is now OVERDUE. Please complete it immediately.`,
        task.id
      );

      // Log activity
      await run(
        'INSERT INTO activities (user_id, action, activity, description) VALUES (?, "TASK_OVERDUE", ?, ?)',
        [task.assigned_to, `Task "${task.title}" is overdue`, `Task ID: ${task.id}`]
      );
    }

    console.log(`[Cron] Overdue check: ${overdueTasks.length} tasks marked as overdue`);
    await logSystemActivity(`Overdue check: ${overdueTasks.length} tasks marked overdue`);
  } catch (err) {
    console.error('[Cron] Overdue check failed:', err.message);
  }
}

// ─────────────────────────────────────────────
// Job 4: Daily Admin Report (6:00 PM daily)
// Send stats summary to all Super Admins
// ─────────────────────────────────────────────
async function runDailyReport() {
  console.log('[Cron] ▶ Running daily report job...');
  try {
    // Get Super Admin users
    const superAdmins = await all(
      "SELECT DISTINCT name, email FROM users WHERE role = 'SUPER_ADMIN' AND status = 'Active'"
    );

    if (superAdmins.length === 0) {
      console.log('[Cron] No Super Admins found for daily report');
      return;
    }

    // Also send to configured SUPER_ADMIN_EMAIL if set and different
    const configEmail = process.env.SUPER_ADMIN_EMAIL;
    if (configEmail && configEmail !== 'superadmin@yourdomain.com') {
      const alreadyIncluded = superAdmins.some(a => a.email === configEmail);
      if (!alreadyIncluded) {
        superAdmins.push({ name: 'Super Admin', email: configEmail });
      }
    }

    // Gather stats
    const stats = {};

    const totalTasks = await get('SELECT COUNT(*) as count FROM tasks');
    stats.total_tasks = totalTasks ? totalTasks.count : 0;

    const pendingTasks = await get("SELECT COUNT(*) as count FROM tasks WHERE status NOT IN ('Completed','COMPLETED')");
    stats.pending = pendingTasks ? pendingTasks.count : 0;

    const overdueTasks = await get("SELECT COUNT(*) as count FROM tasks WHERE status IN ('Overdue','OVERDUE')");
    stats.overdue = overdueTasks ? overdueTasks.count : 0;

    const today = new Date().toISOString().split('T')[0];
    const completedToday = await get(
      "SELECT COUNT(*) as count FROM tasks WHERE status IN ('Completed','COMPLETED') AND date(completed_at) = ?",
      [today]
    );
    stats.completed_today = completedToday ? completedToday.count : 0;

    const activeUsers = await get("SELECT COUNT(*) as count FROM users WHERE status = 'Active'");
    stats.active_users = activeUsers ? activeUsers.count : 0;

    const openDoubts = await get("SELECT COUNT(*) as count FROM doubts WHERE status = 'Open'");
    stats.open_doubts = openDoubts ? openDoubts.count : 0;

    // Top performer
    const topPerformer = await get(`
      SELECT u.name, u.points
      FROM users u
      WHERE u.status = 'Active'
      ORDER BY u.points DESC
      LIMIT 1
    `);
    stats.top_performer = topPerformer || null;

    // Team performance
    const teams = await all(`
      SELECT t.name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END), 0) AS done
      FROM teams t
      LEFT JOIN tasks tk ON tk.team_id = t.id
      GROUP BY t.id, t.name
      ORDER BY t.id
    `);
    stats.teams = teams.map(t => ({
      name: t.name,
      total: t.total || 0,
      done: t.done || 0,
      pct: t.total > 0 ? Math.round((t.done / t.total) * 100) : 0,
    }));

    // Build Excel Workbook Attachment
    let attachment = null;
    try {
      const { createStyledWorkbook, styleHeaderRow, styleDataRows, autoFitColumns, addTitleBanner } = require('../utils/excelUtil');
      const workbook = createStyledWorkbook('Team Pulse Daily Executive Report');
      
      const ws = workbook.addWorksheet('Daily Summary');
      addTitleBanner(ws, 'TEAM PULSE — EXECUTIVE SYSTEM REPORT', `Generated: ${today}`, 'D');

      ws.addRow(['Metric Category', 'Description', 'Value', 'Status']);
      styleHeaderRow(ws.getRow(3));

      ws.addRow(['Total Tasks', 'All time task volume', stats.total_tasks, 'Total']);
      ws.addRow(['Completed Today', 'Tasks completed today', stats.completed_today, 'Success']);
      ws.addRow(['Pending Tasks', 'Open / In-Progress tasks', stats.pending, 'Pending']);
      ws.addRow(['Overdue Tasks', 'Tasks past due date', stats.overdue, stats.overdue > 0 ? 'Attention' : 'Good']);
      ws.addRow(['Active Members', 'Active registered members', stats.active_users, 'Active']);

      styleDataRows(ws, 4);
      autoFitColumns(ws);

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `Team_Pulse_Daily_Report_${today}.xlsx`;
      attachment = {
        filename,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (excelErr) {
      console.error('[Cron] Error generating Excel attachment:', excelErr.message);
    }

    // Send to all Super Admins
    for (const admin of superAdmins) {
      await emailService.sendDailyReportEmail(admin, stats, attachment);
    }

    console.log(`[Cron] Daily report sent to ${superAdmins.length} super admin(s) with Excel attachment`);
    await logSystemActivity('Daily report emails with Excel sheet sent to Super Admins');
  } catch (err) {
    console.error('[Cron] Daily report failed:', err.message);
  }
}


// ─────────────────────────────────────────────
// Register All Cron Jobs
// ─────────────────────────────────────────────

function startCronJobs() {
  console.log('[Cron] Starting scheduled jobs...');

  // Morning reminder — 8:30 AM weekdays (Mon-Fri)
  const morningSchedule = process.env.CRON_MORNING_REMINDER || '0 30 8 * * 1-5';
  cron.schedule(morningSchedule, runMorningReminder, {
    timezone: 'Asia/Kolkata',
  });
  console.log(`[Cron] Morning reminder scheduled: ${morningSchedule}`);

  // Overdue check — 9:00 AM daily
  const overdueSchedule = process.env.CRON_OVERDUE_CHECK || '0 0 9 * * *';
  cron.schedule(overdueSchedule, runOverdueCheck, {
    timezone: 'Asia/Kolkata',
  });
  console.log(`[Cron] Overdue check scheduled: ${overdueSchedule}`);

  // Due-tomorrow reminder — 5:00 PM daily
  const dueReminderSchedule = process.env.CRON_DUE_REMINDER || '0 0 17 * * *';
  cron.schedule(dueReminderSchedule, runDueTomorrowReminder, {
    timezone: 'Asia/Kolkata',
  });
  console.log(`[Cron] Due-tomorrow reminder scheduled: ${dueReminderSchedule}`);

  // Daily report — 6:00 PM daily
  const dailyReportSchedule = process.env.CRON_DAILY_REPORT || '0 0 18 * * *';
  cron.schedule(dailyReportSchedule, runDailyReport, {
    timezone: 'Asia/Kolkata',
  });
  console.log(`[Cron] Daily report scheduled: ${dailyReportSchedule}`);

  console.log('[Cron] All jobs registered. Timezone: Asia/Kolkata');
}

module.exports = { startCronJobs, runOverdueCheck, runMorningReminder, runDueTomorrowReminder, runDailyReport };
