/**
 * TEAM PULSE — Reports Routes
 * Daily, Weekly, Monthly reports with JSON data & styled Excel (.xlsx) downloads.
 */

const express = require('express');
const router  = express.Router();
const { all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const {
  COLORS,
  createStyledWorkbook,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  addTitleBanner,
} = require('../utils/excelUtil');

// ─────────────────────────────────────────────
// GET /api/reports/daily — JSON
// ─────────────────────────────────────────────
router.get('/daily', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0], team_id } = req.query;
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : team_id;

    const created = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE date(created_at) = ? AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );
    const completed = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE date(completed_at) = ? AND status IN ('Completed','COMPLETED') AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );
    const pending = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status NOT IN ('Completed','COMPLETED') AND date(created_at) <= ? AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );
    const overdue = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Overdue','OVERDUE') AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );

    const activeUsers = await get(
      `SELECT COUNT(DISTINCT user_id) AS count FROM activities WHERE date(created_at) = ?`,
      [date]
    );

    const taskList = await all(
      `SELECT t.*, u.name AS assigned_user_name, tm.name AS team_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN teams tm ON t.team_id = tm.id
       WHERE date(t.created_at) = ? ${effectiveTeamId ? 'AND t.team_id = ?' : ''}
       ORDER BY t.created_at DESC`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );

    return res.json({
      success: true,
      data: {
        date,
        stats: {
          created:     created ? created.count : 0,
          completed:   completed ? completed.count : 0,
          pending:     pending ? pending.count : 0,
          overdue:     overdue ? overdue.count : 0,
          active_users:activeUsers ? activeUsers.count : 0,
        },
        tasks: taskList,
      },
    });
  } catch (err) {
    console.error('[Reports] Daily error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate daily report.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/reports/export/daily — Excel (.xlsx)
// ─────────────────────────────────────────────
router.get('/export/daily', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0], team_id } = req.query;
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : team_id;

    let teamName = 'All Teams';
    if (effectiveTeamId) {
      const tm = await get('SELECT name FROM teams WHERE id = ?', [effectiveTeamId]);
      if (tm) teamName = tm.name;
    }

    const created = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE date(created_at) = ? AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );
    const completed = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE date(completed_at) = ? AND status IN ('Completed','COMPLETED') AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );
    const pending = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status NOT IN ('Completed','COMPLETED') AND date(created_at) <= ? AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );
    const overdue = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Overdue','OVERDUE') AND ${effectiveTeamId ? 'team_id = ?' : '1=1'}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );
    const activeUsers = await get(
      `SELECT COUNT(DISTINCT user_id) AS count FROM activities WHERE date(created_at) = ?`,
      [date]
    );

    const taskList = await all(
      `SELECT t.*, u.name AS assigned_user_name, u.email AS assigned_user_email, tm.name AS team_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN teams tm ON t.team_id = tm.id
       WHERE date(t.created_at) = ? ${effectiveTeamId ? 'AND t.team_id = ?' : ''}
       ORDER BY t.created_at DESC`,
      effectiveTeamId ? [date, effectiveTeamId] : [date]
    );

    const workbook = createStyledWorkbook('Daily Report');

    // ── SHEET 1: Summary ──
    const summarySheet = workbook.addWorksheet('Summary & KPIs');
    addTitleBanner(summarySheet, 'TEAM PULSE — DAILY PERFORMANCE REPORT', `Date: ${date} | Scope: ${teamName}`, 'D');

    summarySheet.addRow([]);
    const kpiHeaderRow = summarySheet.addRow(['Metric', 'Count / Value', 'Description', 'Status']);
    styleHeaderRow(kpiHeaderRow, COLORS.headerBg);

    summarySheet.addRow(['Tasks Created Today', created ? created.count : 0, 'New tasks added to the system', 'Active']);
    summarySheet.addRow(['Tasks Completed Today', completed ? completed.count : 0, 'Tasks marked as completed on this date', 'Finished']);
    summarySheet.addRow(['Pending Tasks', pending ? pending.count : 0, 'Tasks currently in progress or waiting', 'Action Needed']);
    summarySheet.addRow(['Overdue Tasks', overdue ? overdue.count : 0, 'Tasks past their due date', 'Attention Required']);
    summarySheet.addRow(['Active Team Members', activeUsers ? activeUsers.count : 0, 'Distinct members with logged activity', 'Online']);

    styleDataRows(summarySheet, 5);
    autoFitColumns(summarySheet, 18, 50);

    // ── SHEET 2: Tasks List ──
    const tasksSheet = workbook.addWorksheet("Today's Tasks");
    addTitleBanner(tasksSheet, `TASK BREAKDOWN (${date})`, `Team: ${teamName} | Total Records: ${taskList.length}`, 'H');

    tasksSheet.addRow([]);
    const taskHeaderRow = tasksSheet.addRow([
      'Task ID', 'Title', 'Description', 'Team', 'Assigned To', 'Priority', 'Status', 'Due Date'
    ]);
    styleHeaderRow(taskHeaderRow, COLORS.subHeaderBg);

    taskList.forEach(t => {
      tasksSheet.addRow([
        t.id,
        t.title,
        t.description || '-',
        t.team_name || '-',
        t.assigned_user_name || 'Unassigned',
        t.priority || 'Medium',
        t.status || 'Pending',
        t.due_date ? t.due_date.substring(0, 10) : '-'
      ]);
    });

    styleDataRows(tasksSheet, 5);
    autoFitColumns(tasksSheet, 14, 50);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="TeamPulse_Daily_Report_${date}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Reports] Daily Excel export error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to export daily report.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/reports/weekly — JSON
// ─────────────────────────────────────────────
router.get('/weekly', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { team_id } = req.query;
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : team_id;

    const teamPerf = await all(`
      SELECT t.id, t.name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END),0) AS completed,
        COALESCE(SUM(CASE WHEN tk.status IN ('Overdue','OVERDUE') THEN 1 ELSE 0 END),0) AS overdue
      FROM teams t
      LEFT JOIN tasks tk ON tk.team_id = t.id AND date(tk.created_at) >= date('now','-7 days')
      ${effectiveTeamId ? 'WHERE t.id = ?' : ''}
      GROUP BY t.id ORDER BY t.id
    `, effectiveTeamId ? [effectiveTeamId] : []);

    const userPerf = await all(`
      SELECT u.id, u.name, t.name AS team_name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END),0) AS completed,
        u.points
      FROM users u
      LEFT JOIN tasks tk ON tk.assigned_to = u.id AND date(tk.created_at) >= date('now','-7 days')
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'Active' ${effectiveTeamId ? 'AND u.team_id = ?' : ''}
      GROUP BY u.id ORDER BY completed DESC
      LIMIT 10
    `, effectiveTeamId ? [effectiveTeamId] : []);

    const doubtsThisWeek = await get(
      `SELECT COUNT(*) AS count FROM doubts WHERE date(created_at) >= date('now','-7 days') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );
    const suggestionsThisWeek = await get(
      `SELECT COUNT(*) AS count FROM suggestions WHERE date(created_at) >= date('now','-7 days') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );

    const dailyData = await all(`
      SELECT date(created_at) AS day, COUNT(*) AS created,
        SUM(CASE WHEN status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END) AS completed
      FROM tasks
      WHERE date(created_at) >= date('now','-7 days')
      ${effectiveTeamId ? 'AND team_id = ?' : ''}
      GROUP BY day ORDER BY day
    `, effectiveTeamId ? [effectiveTeamId] : []);

    return res.json({
      success: true,
      data: {
        team_performance:  teamPerf.map(t => ({ ...t, pct: t.total > 0 ? Math.round((t.completed/t.total)*100) : 0 })),
        user_performance:  userPerf,
        doubts:            doubtsThisWeek ? doubtsThisWeek.count : 0,
        suggestions:       suggestionsThisWeek ? suggestionsThisWeek.count : 0,
        daily_breakdown:   dailyData,
      },
    });
  } catch (err) {
    console.error('[Reports] Weekly error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate weekly report.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/reports/export/weekly — Excel (.xlsx)
// ─────────────────────────────────────────────
router.get('/export/weekly', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { team_id } = req.query;
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : team_id;
    const todayStr = new Date().toISOString().split('T')[0];

    const teamPerf = await all(`
      SELECT t.id, t.name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END),0) AS completed,
        COALESCE(SUM(CASE WHEN tk.status IN ('Overdue','OVERDUE') THEN 1 ELSE 0 END),0) AS overdue
      FROM teams t
      LEFT JOIN tasks tk ON tk.team_id = t.id AND date(tk.created_at) >= date('now','-7 days')
      ${effectiveTeamId ? 'WHERE t.id = ?' : ''}
      GROUP BY t.id ORDER BY t.id
    `, effectiveTeamId ? [effectiveTeamId] : []);

    const userPerf = await all(`
      SELECT u.id, u.name, t.name AS team_name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END),0) AS completed,
        u.points
      FROM users u
      LEFT JOIN tasks tk ON tk.assigned_to = u.id AND date(tk.created_at) >= date('now','-7 days')
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'Active' ${effectiveTeamId ? 'AND u.team_id = ?' : ''}
      GROUP BY u.id ORDER BY completed DESC
      LIMIT 15
    `, effectiveTeamId ? [effectiveTeamId] : []);

    const doubtsThisWeek = await get(
      `SELECT COUNT(*) AS count FROM doubts WHERE date(created_at) >= date('now','-7 days') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );
    const suggestionsThisWeek = await get(
      `SELECT COUNT(*) AS count FROM suggestions WHERE date(created_at) >= date('now','-7 days') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );

    const dailyData = await all(`
      SELECT date(created_at) AS day, COUNT(*) AS created,
        SUM(CASE WHEN status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END) AS completed
      FROM tasks
      WHERE date(created_at) >= date('now','-7 days')
      ${effectiveTeamId ? 'AND team_id = ?' : ''}
      GROUP BY day ORDER BY day
    `, effectiveTeamId ? [effectiveTeamId] : []);

    const workbook = createStyledWorkbook('Weekly Report');

    // ── SHEET 1: Team Performance ──
    const teamSheet = workbook.addWorksheet('Team Performance');
    addTitleBanner(teamSheet, 'WEEKLY TEAM PERFORMANCE (LAST 7 DAYS)', `Generated: ${todayStr}`, 'F');
    teamSheet.addRow([]);

    const teamHeader = teamSheet.addRow(['Team ID', 'Team Name', 'Total Tasks (7D)', 'Completed Tasks', 'Overdue Tasks', 'Completion Rate (%)']);
    styleHeaderRow(teamHeader, COLORS.headerBg);

    teamPerf.forEach(t => {
      const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
      teamSheet.addRow([t.id, t.name, t.total, t.completed, t.overdue, `${pct}%`]);
    });
    styleDataRows(teamSheet, 5);
    autoFitColumns(teamSheet, 16, 40);

    // ── SHEET 2: Top Performers ──
    const userSheet = workbook.addWorksheet('Top Performers');
    addTitleBanner(userSheet, 'TOP MEMBER CONTRIBUTIONS (LAST 7 DAYS)', `Generated: ${todayStr}`, 'F');
    userSheet.addRow([]);

    const userHeader = userSheet.addRow(['Rank', 'User Name', 'Team', 'Tasks Assigned (7D)', 'Tasks Completed (7D)', 'Total Points']);
    styleHeaderRow(userHeader, COLORS.subHeaderBg);

    userPerf.forEach((u, index) => {
      userSheet.addRow([index + 1, u.name, u.team_name || '-', u.total, u.completed, u.points || 0]);
    });
    styleDataRows(userSheet, 5);
    autoFitColumns(userSheet, 16, 40);

    // ── SHEET 3: Daily Activity & Summary ──
    const dailySheet = workbook.addWorksheet('Daily Trend & Overview');
    addTitleBanner(dailySheet, 'WEEKLY DAILY ACTIVITY TREND', `Doubts Logged: ${doubtsThisWeek ? doubtsThisWeek.count : 0} | Suggestions: ${suggestionsThisWeek ? suggestionsThisWeek.count : 0}`, 'D');
    dailySheet.addRow([]);

    const trendHeader = dailySheet.addRow(['Date', 'Tasks Created', 'Tasks Completed', 'Completion Rate (%)']);
    styleHeaderRow(trendHeader, '0284C7'); // Light blue

    dailyData.forEach(d => {
      const pct = d.created > 0 ? Math.round(((d.completed || 0) / d.created) * 100) : 0;
      dailySheet.addRow([d.day, d.created, d.completed || 0, `${pct}%`]);
    });
    styleDataRows(dailySheet, 5);
    autoFitColumns(dailySheet, 18, 35);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="TeamPulse_Weekly_Report_${todayStr}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Reports] Weekly Excel export error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to export weekly report.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/reports/monthly — JSON
// ─────────────────────────────────────────────
router.get('/monthly', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { month, year, team_id } = req.query;
    const now = new Date();
    const m = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const y = year || now.getFullYear();
    const startDate = `${y}-${m}-01`;
    const endDate   = `${y}-${m}-31`;
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : team_id;

    const totalTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE date(created_at) BETWEEN ? AND ? ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [startDate, endDate, effectiveTeamId] : [startDate, endDate]
    );
    const completedTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Completed','COMPLETED') AND date(completed_at) BETWEEN ? AND ? ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [startDate, endDate, effectiveTeamId] : [startDate, endDate]
    );
    const pendingTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status NOT IN ('Completed','COMPLETED') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );
    const overdueTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Overdue','OVERDUE') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );

    const topPerformers = await all(`
      SELECT u.id, u.name, t.name AS team_name, u.points,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.assigned_to = u.id AND tk.status IN ('Completed','COMPLETED')
          AND date(tk.completed_at) BETWEEN ? AND ?) AS monthly_completed
      FROM users u LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'Active' ${effectiveTeamId ? 'AND u.team_id = ?' : ''}
      ORDER BY monthly_completed DESC, u.points DESC
      LIMIT 5
    `, effectiveTeamId ? [startDate, endDate, effectiveTeamId] : [startDate, endDate]);

    const teamComparison = await all(`
      SELECT t.id, t.name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END),0) AS completed
      FROM teams t
      LEFT JOIN tasks tk ON tk.team_id = t.id AND date(tk.created_at) BETWEEN ? AND ?
      GROUP BY t.id ORDER BY t.id
    `, [startDate, endDate]);

    return res.json({
      success: true,
      data: {
        period: `${y}-${m}`,
        stats: {
          total_tasks:     totalTasks ? totalTasks.count : 0,
          completed_tasks: completedTasks ? completedTasks.count : 0,
          pending_tasks:   pendingTasks ? pendingTasks.count : 0,
          overdue_tasks:   overdueTasks ? overdueTasks.count : 0,
        },
        top_performers:    topPerformers,
        team_comparison:   teamComparison.map(t => ({
          ...t,
          pct: t.total > 0 ? Math.round((t.completed/t.total)*100) : 0,
        })),
      },
    });
  } catch (err) {
    console.error('[Reports] Monthly error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate monthly report.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/reports/export/monthly — Excel (.xlsx)
// ─────────────────────────────────────────────
router.get('/export/monthly', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { month, year, team_id } = req.query;
    const now = new Date();
    const m = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const y = year || now.getFullYear();
    const startDate = `${y}-${m}-01`;
    const endDate   = `${y}-${m}-31`;
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : team_id;

    const totalTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE date(created_at) BETWEEN ? AND ? ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [startDate, endDate, effectiveTeamId] : [startDate, endDate]
    );
    const completedTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Completed','COMPLETED') AND date(completed_at) BETWEEN ? AND ? ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [startDate, endDate, effectiveTeamId] : [startDate, endDate]
    );
    const pendingTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status NOT IN ('Completed','COMPLETED') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );
    const overdueTasks = await get(
      `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('Overdue','OVERDUE') ${effectiveTeamId ? 'AND team_id = ?' : ''}`,
      effectiveTeamId ? [effectiveTeamId] : []
    );

    const topPerformers = await all(`
      SELECT u.id, u.name, t.name AS team_name, u.points,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.assigned_to = u.id AND tk.status IN ('Completed','COMPLETED')
          AND date(tk.completed_at) BETWEEN ? AND ?) AS monthly_completed
      FROM users u LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.status = 'Active' ${effectiveTeamId ? 'AND u.team_id = ?' : ''}
      ORDER BY monthly_completed DESC, u.points DESC
      LIMIT 10
    `, effectiveTeamId ? [startDate, endDate, effectiveTeamId] : [startDate, endDate]);

    const teamComparison = await all(`
      SELECT t.id, t.name,
        COUNT(tk.id) AS total,
        COALESCE(SUM(CASE WHEN tk.status IN ('Completed','COMPLETED') THEN 1 ELSE 0 END),0) AS completed
      FROM teams t
      LEFT JOIN tasks tk ON tk.team_id = t.id AND date(tk.created_at) BETWEEN ? AND ?
      GROUP BY t.id ORDER BY t.id
    `, [startDate, endDate]);

    const workbook = createStyledWorkbook('Monthly Report');

    // ── SHEET 1: Monthly Overview ──
    const summarySheet = workbook.addWorksheet('Monthly Overview');
    addTitleBanner(summarySheet, `MONTHLY PERFORMANCE SUMMARY (${y}-${m})`, `Period: ${startDate} to ${endDate}`, 'E');
    summarySheet.addRow([]);

    const kpiHeader = summarySheet.addRow(['Metric', 'Count / Value', 'Period', 'Status']);
    styleHeaderRow(kpiHeader, COLORS.headerBg);

    const tot = totalTasks ? totalTasks.count : 0;
    const comp = completedTasks ? completedTasks.count : 0;
    const completionRate = tot > 0 ? Math.round((comp / tot) * 100) : 0;

    summarySheet.addRow(['Total Tasks Assigned', tot, `${y}-${m}`, 'Overall']);
    summarySheet.addRow(['Total Completed Tasks', comp, `${y}-${m}`, 'Achieved']);
    summarySheet.addRow(['Pending Tasks', pendingTasks ? pendingTasks.count : 0, `${y}-${m}`, 'In Progress']);
    summarySheet.addRow(['Overdue Tasks', overdueTasks ? overdueTasks.count : 0, `${y}-${m}`, 'Critical']);
    summarySheet.addRow(['Monthly Completion Rate', `${completionRate}%`, `${y}-${m}`, completionRate >= 80 ? 'Excellent' : 'Needs Focus']);

    styleDataRows(summarySheet, 5);
    autoFitColumns(summarySheet, 18, 40);

    // ── SHEET 2: Team Breakdown ──
    const teamSheet = workbook.addWorksheet('Team Comparison');
    addTitleBanner(teamSheet, `TEAM PERFORMANCE BREAKDOWN (${y}-${m})`, `Evaluation Period: ${startDate} to ${endDate}`, 'E');
    teamSheet.addRow([]);

    const teamHeader = teamSheet.addRow(['Team ID', 'Team Name', 'Total Tasks', 'Completed Tasks', 'Completion Rate (%)']);
    styleHeaderRow(teamHeader, COLORS.subHeaderBg);

    teamComparison.forEach(t => {
      const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
      teamSheet.addRow([t.id, t.name, t.total, t.completed, `${pct}%`]);
    });
    styleDataRows(teamSheet, 5);
    autoFitColumns(teamSheet, 16, 40);

    // ── SHEET 3: Top Performers ──
    const userSheet = workbook.addWorksheet('Top Performers');
    addTitleBanner(userSheet, `MONTHLY TOP PERFORMERS (${y}-${m})`, `Top Ranked Users by Completed Tasks & Points`, 'F');
    userSheet.addRow([]);

    const userHeader = userSheet.addRow(['Rank', 'User Name', 'Team', 'Completed Tasks This Month', 'Total Earned Points']);
    styleHeaderRow(userHeader, '7C3AED'); // Purple

    topPerformers.forEach((u, index) => {
      userSheet.addRow([index + 1, u.name, u.team_name || '-', u.monthly_completed || 0, u.points || 0]);
    });
    styleDataRows(userSheet, 5);
    autoFitColumns(userSheet, 16, 40);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="TeamPulse_Monthly_Report_${y}-${m}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Reports] Monthly Excel export error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to export monthly report.' });
  }
});

module.exports = router;
