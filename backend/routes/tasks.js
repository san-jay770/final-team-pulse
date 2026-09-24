/**
 * TEAM PULSE — Tasks Routes
 * Full CRUD with email notifications when task is created/assigned.
 *
 * Email flow on task creation:
 *   POST /api/tasks
 *     → Save to SQLite
 *     → Log activity
 *     → Create notification for assigned user
 *     → Send email to assigned user (sendTaskAssignedEmail)
 *     → Send email to all Super Admins (sendTaskCreatedToSuperAdmin)
 */

const express = require('express');
const router  = express.Router();
const { run, all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const {
  COLORS,
  createStyledWorkbook,
  styleHeaderRow,
  styleDataRows,
  autoFitColumns,
  addTitleBanner,
} = require('../utils/excelUtil');

// ─────────────────────────────────────────────
// GET /api/tasks/members/:team_id — Get team members for task assignment
// ─────────────────────────────────────────────
router.get('/members/:team_id', requireAuth, async (req, res) => {
  try {
    const members = await all(`
      SELECT u.id, u.name, u.email, u.role
      FROM users u
      WHERE u.team_id = ? AND u.status = 'Active'
      ORDER BY u.name
    `, [req.params.team_id]);
    return res.json({ success: true, members, data: members });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch team members.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/tasks — List tasks
// ─────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { q, status, priority, team_id, assigned_to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT t.*,
        u.name AS assigned_user_name, u.email AS assigned_user_email,
        c.name AS created_by_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u  ON t.assigned_to = u.id
      LEFT JOIN users c  ON t.created_by  = c.id
      LEFT JOIN teams tm ON t.team_id     = tm.id
      WHERE 1=1
    `;
    const params = [];

    // Scope: TEAM_MEMBER only sees own tasks, ADMIN sees team tasks
    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      sql += ' AND t.team_id = ?';
      params.push(req.user.team_id);
    }
    // SUPER_ADMIN sees all

    if (q) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND t.team_id = ?'; params.push(team_id);
    }
    if (assigned_to && req.user.role !== 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?'; params.push(assigned_to);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const tasks = await all(sql, params);

    // Count total
    let countSql = 'SELECT COUNT(*) as count FROM tasks t WHERE 1=1';
    const countParams = [];
    if (req.user.role === 'TEAM_MEMBER') {
      countSql += ' AND t.assigned_to = ?'; countParams.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      countSql += ' AND t.team_id = ?'; countParams.push(req.user.team_id);
    }
    const countRow = await get(countSql, countParams);

    return res.json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countRow ? countRow.count : 0,
      },
    });
  } catch (err) {
    console.error('[Tasks] GET error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/tasks/export/excel — Export Tasks as Excel
// ─────────────────────────────────────────────
router.get('/export/excel', requireAuth, async (req, res) => {
  try {
    const { q, status, priority, team_id, assigned_to } = req.query;

    let sql = `
      SELECT t.*,
        u.name AS assigned_user_name, u.email AS assigned_user_email,
        c.name AS created_by_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u  ON t.assigned_to = u.id
      LEFT JOIN users c  ON t.created_by  = c.id
      LEFT JOIN teams tm ON t.team_id     = tm.id
      WHERE 1=1
    `;
    const params = [];

    // Scope check
    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      sql += ' AND t.team_id = ?';
      params.push(req.user.team_id);
    }

    if (q) {
      sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND t.team_id = ?'; params.push(team_id);
    }
    if (assigned_to && req.user.role !== 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?'; params.push(assigned_to);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tasks = await all(sql, params);
    const todayStr = new Date().toISOString().split('T')[0];

    const workbook = createStyledWorkbook('Task Report');
    const sheet = workbook.addWorksheet('Tasks');

    addTitleBanner(
      sheet,
      'TEAM PULSE — TASK MANAGEMENT EXPORT',
      `Exported: ${todayStr} | Total Records: ${tasks.length} | User: ${req.user.name} (${req.user.role})`,
      'J'
    );
    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'Task ID', 'Title', 'Description', 'Team', 'Assigned To', 'Created By',
      'Priority', 'Status', 'Due Date', 'Created Date'
    ]);
    styleHeaderRow(headerRow, COLORS.headerBg);

    tasks.forEach(t => {
      sheet.addRow([
        t.id,
        t.title,
        t.description || '-',
        t.team_name || '-',
        t.assigned_user_name || 'Unassigned',
        t.created_by_name || '-',
        t.priority || 'Medium',
        t.status || 'Pending',
        t.due_date ? t.due_date.substring(0, 10) : '-',
        t.created_at ? t.created_at.substring(0, 10) : '-'
      ]);
    });

    styleDataRows(sheet, 5);
    autoFitColumns(sheet, 14, 50);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="TeamPulse_Tasks_${todayStr}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Tasks] Excel export error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to export tasks to Excel.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/tasks/:id — Single task
// ─────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const task = await get(`
      SELECT t.*,
        u.name AS assigned_user_name, u.email AS assigned_user_email,
        c.name AS created_by_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u  ON t.assigned_to = u.id
      LEFT JOIN users c  ON t.created_by  = c.id
      LEFT JOIN teams tm ON t.team_id     = tm.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    // Scope check
    if (req.user.role === 'TEAM_MEMBER' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'ADMIN' && task.team_id !== req.user.team_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({ success: true, data: task });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch task.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/tasks — Create task (with email)
// ─────────────────────────────────────────────
router.post('/', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const {
      title, description, team_id, assigned_to,
      priority = 'Medium', status = 'Pending',
      start_date, due_date,
    } = req.body;

    if (!title || !team_id) {
      return res.status(400).json({ success: false, message: 'Title and team are required.' });
    }

    // Validate team access for ADMIN
    if (req.user.role === 'ADMIN' && parseInt(team_id) !== req.user.team_id) {
      return res.status(403).json({ success: false, message: 'You can only create tasks for your team.' });
    }

    // Insert task
    const result = await run(`
      INSERT INTO tasks (title, description, team_id, assigned_to, created_by, priority, status, start_date, due_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [title, description || null, team_id, assigned_to || null, req.user.id, priority, status, start_date || null, due_date || null]);

    const taskId = result.lastID;
    const task = await get('SELECT * FROM tasks WHERE id = ?', [taskId]);

    // Log activity
    await run(
      'INSERT INTO activities (user_id, action, activity, description) VALUES (?, "TASK_CREATED", ?, ?)',
      [req.user.id, `${req.user.name} created task "${title}"`, `Task ID: ${taskId}`]
    );

    // ── Email & Notification Flow ──────────────────────────────
    // 1. If task is assigned to a user, notify that user
    if (assigned_to) {
      const assignedUser = await get('SELECT id, name, email FROM users WHERE id = ?', [assigned_to]);
      if (assignedUser) {
        // Create in-app notification
        await notificationService.createNotification(
          assignedUser.id,
          'TASK_ASSIGNED',
          `New task assigned to you: "${title}"`,
          taskId
        );

        // Send email to assigned user
        emailService.sendTaskAssignedEmail(assignedUser, task, req.user.name)
          .catch(err => console.error('[Tasks] Email to assigned user failed:', err.message));
      }
    }

    // 2. Notify ALL Super Admins about the new task
    const superAdmins = await all(
      "SELECT id, name, email FROM users WHERE role = 'SUPER_ADMIN' AND status = 'Active'"
    );

    const assignedUser = assigned_to
      ? await get('SELECT id, name, email FROM users WHERE id = ?', [assigned_to])
      : null;

    for (const superAdmin of superAdmins) {
      // Skip if the super admin is the one who created it (they already know)
      if (superAdmin.id !== req.user.id) {
        await notificationService.createNotification(
          superAdmin.id,
          'TASK_CREATED',
          `New task "${title}" created by ${req.user.name}`,
          taskId
        );
      }

      // Always send email to super admins (including if they created it)
      emailService.sendTaskCreatedToSuperAdmin(superAdmin, task, assignedUser, req.user.name)
        .catch(err => console.error('[Tasks] Super admin email failed:', err.message));
    }

    // Also send to env-configured super admin email if different
    const configEmail = process.env.SUPER_ADMIN_EMAIL;
    if (configEmail && configEmail !== 'superadmin@yourdomain.com') {
      const alreadySent = superAdmins.some(a => a.email === configEmail);
      if (!alreadySent) {
        emailService.sendTaskCreatedToSuperAdmin(
          { name: 'Super Admin', email: configEmail },
          task, assignedUser, req.user.name
        ).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Task created successfully. Email notification sent.',
      data: task,
    });
  } catch (err) {
    console.error('[Tasks] POST error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create task.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/tasks/:id — Update task
// ─────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const existingTask = await get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existingTask) return res.status(404).json({ success: false, message: 'Task not found.' });

    // Scope check
    if (req.user.role === 'ADMIN' && existingTask.team_id !== req.user.team_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'TEAM_MEMBER') {
      // Members can only update status of their own tasks
      if (existingTask.assigned_to !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const {
      title = existingTask.title,
      description = existingTask.description,
      team_id = existingTask.team_id,
      assigned_to = existingTask.assigned_to,
      priority = existingTask.priority,
      status = existingTask.status,
      start_date = existingTask.start_date,
      due_date = existingTask.due_date,
    } = req.body;

    // Track completion time
    let completed_at = existingTask.completed_at;
    if (['Completed', 'COMPLETED'].includes(status) && !completed_at) {
      completed_at = new Date().toISOString();
      // Award points to assigned user
      if (existingTask.assigned_to) {
        await run('UPDATE users SET points = points + 10 WHERE id = ?', [existingTask.assigned_to]);
      }
    }

    await run(`
      UPDATE tasks SET
        title = ?, description = ?, team_id = ?, assigned_to = ?,
        priority = ?, status = ?, start_date = ?, due_date = ?,
        completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, description, team_id, assigned_to, priority, status,
        start_date, due_date, completed_at, taskId]);

    // Log activity
    await run(
      'INSERT INTO activities (user_id, action, activity, description) VALUES (?, "TASK_UPDATED", ?, ?)',
      [req.user.id, `${req.user.name} updated task "${title}"`, `Task ID: ${taskId}, Status: ${status}`]
    );

    // Notify assigned user if reassigned
    if (assigned_to && assigned_to !== existingTask.assigned_to) {
      const newUser = await get('SELECT id, name, email FROM users WHERE id = ?', [assigned_to]);
      if (newUser) {
        await notificationService.createNotification(
          newUser.id,
          'TASK_ASSIGNED',
          `Task "${title}" has been assigned to you`,
          taskId
        );
        const updatedTask = await get('SELECT * FROM tasks WHERE id = ?', [taskId]);
        emailService.sendTaskAssignedEmail(newUser, updatedTask, req.user.name)
          .catch(() => {});
      }
    }

    const updatedTask = await get(`
      SELECT t.*, u.name AS assigned_user_name, tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN teams tm ON t.team_id = tm.id
      WHERE t.id = ?
    `, [taskId]);

    return res.json({ success: true, message: 'Task updated successfully.', data: updatedTask });
  } catch (err) {
    console.error('[Tasks] PUT error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update task.' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    if (req.user.role === 'ADMIN' && task.team_id !== req.user.team_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await run('DELETE FROM tasks WHERE id = ?', [req.params.id]);

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "TASK_DELETED", ?)',
      [req.user.id, `${req.user.name} deleted task "${task.title}"`]
    );

    return res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete task.' });
  }
});

module.exports = router;
