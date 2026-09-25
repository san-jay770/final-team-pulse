/**
 * TEAM PULSE — Tasks Routes
 *
 * PostgreSQL-compatible Tasks CRUD
 * - Create / Read / Update / Delete tasks
 * - Team-based access
 * - Activity logging
 * - Notifications
 * - Email notifications
 * - Excel export
 */

const express = require('express');
const router = express.Router();

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


// ============================================================
// GET /api/tasks/members/:team_id
// Get team members for task assignment
// ============================================================

router.get('/members/:team_id', requireAuth, async (req, res) => {
  try {
    const members = await all(
      `
      SELECT id, name, email, role
      FROM users
      WHERE team_id = ?
        AND status = 'Active'
      ORDER BY name
      `,
      [req.params.team_id]
    );

    return res.json({
      success: true,
      members,
      data: members,
    });
  } catch (err) {
    console.error('[Tasks] Members GET error:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch team members.',
    });
  }
});


// ============================================================
// GET /api/tasks
// List tasks
// ============================================================

router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      q,
      status,
      priority,
      team_id,
      assigned_to,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      100
    );

    const offset = (pageNumber - 1) * limitNumber;

    let sql = `
      SELECT
        t.*,
        u.name AS assigned_user_name,
        u.email AS assigned_user_email,
        c.name AS created_by_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u
        ON t.assigned_to = u.id
      LEFT JOIN users c
        ON t.created_by = c.id
      LEFT JOIN teams tm
        ON t.team_id = tm.id
      WHERE 1 = 1
    `;

    const params = [];

    // TEAM_MEMBER → only own assigned tasks
    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?';
      params.push(req.user.id);
    }

    // ADMIN → only own team tasks
    else if (req.user.role === 'ADMIN') {
      sql += ' AND t.team_id = ?';
      params.push(req.user.team_id);
    }

    // Search
    if (q) {
      sql += `
        AND (
          t.title ILIKE ?
          OR COALESCE(t.description, '') ILIKE ?
        )
      `;

      params.push(`%${q}%`, `%${q}%`);
    }

    // Status
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    // Priority
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    // SUPER_ADMIN can filter by team
    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND t.team_id = ?';
      params.push(team_id);
    }

    // ADMIN / SUPER_ADMIN can filter by assigned user
    if (assigned_to && req.user.role !== 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    sql += `
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limitNumber, offset);

    const tasks = await all(sql, params);

    // Count
    let countSql = `
      SELECT COUNT(*)::INTEGER AS count
      FROM tasks t
      WHERE 1 = 1
    `;

    const countParams = [];

    if (req.user.role === 'TEAM_MEMBER') {
      countSql += ' AND t.assigned_to = ?';
      countParams.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      countSql += ' AND t.team_id = ?';
      countParams.push(req.user.team_id);
    }

    if (q) {
      countSql += `
        AND (
          t.title ILIKE ?
          OR COALESCE(t.description, '') ILIKE ?
        )
      `;

      countParams.push(`%${q}%`, `%${q}%`);
    }

    if (status) {
      countSql += ' AND t.status = ?';
      countParams.push(status);
    }

    if (priority) {
      countSql += ' AND t.priority = ?';
      countParams.push(priority);
    }

    if (team_id && req.user.role === 'SUPER_ADMIN') {
      countSql += ' AND t.team_id = ?';
      countParams.push(team_id);
    }

    if (assigned_to && req.user.role !== 'TEAM_MEMBER') {
      countSql += ' AND t.assigned_to = ?';
      countParams.push(assigned_to);
    }

    const countRow = await get(countSql, countParams);

    return res.json({
      success: true,
      data: tasks,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: countRow ? Number(countRow.count) : 0,
      },
    });

  } catch (err) {
    console.error('[Tasks] GET error:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks.',
    });
  }
});


// ============================================================
// GET /api/tasks/export/excel
// Export tasks as Excel
// ============================================================

router.get('/export/excel', requireAuth, async (req, res) => {
  try {
    const {
      q,
      status,
      priority,
      team_id,
      assigned_to,
    } = req.query;

    let sql = `
      SELECT
        t.*,
        u.name AS assigned_user_name,
        u.email AS assigned_user_email,
        c.name AS created_by_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u
        ON t.assigned_to = u.id
      LEFT JOIN users c
        ON t.created_by = c.id
      LEFT JOIN teams tm
        ON t.team_id = tm.id
      WHERE 1 = 1
    `;

    const params = [];

    // TEAM_MEMBER
    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?';
      params.push(req.user.id);
    }

    // ADMIN
    else if (req.user.role === 'ADMIN') {
      sql += ' AND t.team_id = ?';
      params.push(req.user.team_id);
    }

    if (q) {
      sql += `
        AND (
          t.title ILIKE ?
          OR COALESCE(t.description, '') ILIKE ?
        )
      `;

      params.push(`%${q}%`, `%${q}%`);
    }

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND t.team_id = ?';
      params.push(team_id);
    }

    if (assigned_to && req.user.role !== 'TEAM_MEMBER') {
      sql += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tasks = await all(sql, params);

    const todayStr = new Date()
      .toISOString()
      .split('T')[0];

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
      'Task ID',
      'Title',
      'Description',
      'Team',
      'Assigned To',
      'Created By',
      'Priority',
      'Status',
      'Due Date',
      'Created Date',
    ]);

    styleHeaderRow(headerRow, COLORS.headerBg);

    tasks.forEach((task) => {
      sheet.addRow([
        task.id,
        task.title,
        task.description || '-',
        task.team_name || '-',
        task.assigned_user_name || 'Unassigned',
        task.created_by_name || '-',
        task.priority || 'Medium',
        task.status || 'Pending',
        task.due_date
          ? String(task.due_date).substring(0, 10)
          : '-',
        task.created_at
          ? String(task.created_at).substring(0, 10)
          : '-',
      ]);
    });

    styleDataRows(sheet, 5);
    autoFitColumns(sheet, 14, 50);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TeamPulse_Tasks_${todayStr}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[Tasks] Excel export error:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to export tasks to Excel.',
    });
  }
});


// ============================================================
// GET /api/tasks/:id
// Get single task
// ============================================================

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const task = await get(
      `
      SELECT
        t.*,
        u.name AS assigned_user_name,
        u.email AS assigned_user_email,
        c.name AS created_by_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u
        ON t.assigned_to = u.id
      LEFT JOIN users c
        ON t.created_by = c.id
      LEFT JOIN teams tm
        ON t.team_id = tm.id
      WHERE t.id = ?
      `,
      [req.params.id]
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    // TEAM_MEMBER scope
    if (
      req.user.role === 'TEAM_MEMBER' &&
      task.assigned_to !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // ADMIN scope
    if (
      req.user.role === 'ADMIN' &&
      task.team_id !== req.user.team_id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    return res.json({
      success: true,
      data: task,
    });

  } catch (err) {
    console.error('[Tasks] GET single error:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch task.',
    });
  }
});


// ============================================================
// POST /api/tasks
// Create task
// ============================================================

router.post(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req, res) => {

    try {
      const {
        title,
        description,
        team_id,
        assigned_to,
        priority = 'Medium',
        status = 'Pending',
        start_date,
        due_date,
      } = req.body;

      // Validation
      if (!title || !team_id) {
        return res.status(400).json({
          success: false,
          message: 'Title and team are required.',
        });
      }

      // ADMIN can create only for own team
      if (
        req.user.role === 'ADMIN' &&
        parseInt(team_id, 10) !== parseInt(req.user.team_id, 10)
      ) {
        return res.status(403).json({
          success: false,
          message: 'You can only create tasks for your team.',
        });
      }

      // Insert task
      const result = await run(
        `
        INSERT INTO tasks (
          title,
          description,
          team_id,
          assigned_to,
          created_by,
          priority,
          status,
          start_date,
          due_date,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          title,
          description || null,
          team_id,
          assigned_to || null,
          req.user.id,
          priority,
          status,
          start_date || null,
          due_date || null,
        ]
      );

      const taskId = result.lastID;

      if (!taskId) {
        throw new Error('Task ID was not returned after insertion.');
      }

      // Fetch created task
      const task = await get(
        'SELECT * FROM tasks WHERE id = ?',
        [taskId]
      );

      // Log activity
      await run(
        `
        INSERT INTO activities (
          user_id,
          action,
          activity,
          description
        )
        VALUES (?, 'TASK_CREATED', ?, ?)
        `,
        [
          req.user.id,
          `${req.user.name} created task "${title}"`,
          `Task ID: ${taskId}`,
        ]
      );

      // ======================================================
      // Notify assigned user
      // ======================================================

      let assignedUser = null;

      if (assigned_to) {
        assignedUser = await get(
          'SELECT id, name, email FROM users WHERE id = ?',
          [assigned_to]
        );

        if (assignedUser) {

          // In-app notification
          await notificationService.createNotification(
            assignedUser.id,
            'TASK_ASSIGNED',
            `New task assigned to you: "${title}"`,
            taskId
          );

          // Email
          emailService
            .sendTaskAssignedEmail(
              assignedUser,
              task,
              req.user.name
            )
            .catch((err) => {
              console.error(
                '[Tasks] Email to assigned user failed:',
                err.message
              );
            });
        }
      }

      // ======================================================
      // Notify Super Admins
      // ======================================================

      const superAdmins = await all(
        `
        SELECT id, name, email
        FROM users
        WHERE role = 'SUPER_ADMIN'
          AND status = 'Active'
        `
      );

      for (const superAdmin of superAdmins) {

        // In-app notification
        if (superAdmin.id !== req.user.id) {
          await notificationService.createNotification(
            superAdmin.id,
            'TASK_CREATED',
            `New task "${title}" created by ${req.user.name}`,
            taskId
          );
        }

        // Email
        emailService
          .sendTaskCreatedToSuperAdmin(
            superAdmin,
            task,
            assignedUser,
            req.user.name
          )
          .catch((err) => {
            console.error(
              '[Tasks] Super admin email failed:',
              err.message
            );
          });
      }

      // ======================================================
      // Configured Super Admin Email
      // ======================================================

      const configEmail = process.env.SUPER_ADMIN_EMAIL;

      if (
        configEmail &&
        configEmail !== 'superadmin@yourdomain.com'
      ) {
        const alreadySent = superAdmins.some(
          (admin) => admin.email === configEmail
        );

        if (!alreadySent) {
          emailService
            .sendTaskCreatedToSuperAdmin(
              {
                name: 'Super Admin',
                email: configEmail,
              },
              task,
              assignedUser,
              req.user.name
            )
            .catch((err) => {
              console.error(
                '[Tasks] Configured super admin email failed:',
                err.message
              );
            });
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Task created successfully. Email notification sent.',
        data: task,
      });

    } catch (err) {
      console.error('[Tasks] POST error:', err.message);

      return res.status(500).json({
        success: false,
        message: 'Failed to create task.',
      });
    }
  }
);


// ============================================================
// PUT /api/tasks/:id
// Update task
// ============================================================

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);

    const existingTask = await get(
      'SELECT * FROM tasks WHERE id = ?',
      [taskId]
    );

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    // ADMIN scope
    if (
      req.user.role === 'ADMIN' &&
      existingTask.team_id !== req.user.team_id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // TEAM_MEMBER scope
    if (req.user.role === 'TEAM_MEMBER') {
      if (existingTask.assigned_to !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
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

    // Completion time
    let completed_at = existingTask.completed_at;

    if (
      ['Completed', 'COMPLETED'].includes(status) &&
      !completed_at
    ) {
      completed_at = new Date().toISOString();

      // Award points
      if (existingTask.assigned_to) {
        await run(
          `
          UPDATE users
          SET points = COALESCE(points, 0) + 10
          WHERE id = ?
          `,
          [existingTask.assigned_to]
        );
      }
    }

    // Update task
    await run(
      `
      UPDATE tasks
      SET
        title = ?,
        description = ?,
        team_id = ?,
        assigned_to = ?,
        priority = ?,
        status = ?,
        start_date = ?,
        due_date = ?,
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        title,
        description,
        team_id,
        assigned_to,
        priority,
        status,
        start_date,
        due_date,
        completed_at,
        taskId,
      ]
    );

    // Log activity
    await run(
      `
      INSERT INTO activities (
        user_id,
        action,
        activity,
        description
      )
      VALUES (?, 'TASK_UPDATED', ?, ?)
      `,
      [
        req.user.id,
        `${req.user.name} updated task "${title}"`,
        `Task ID: ${taskId}, Status: ${status}`,
      ]
    );

    // Notify if reassigned
    if (
      assigned_to &&
      parseInt(assigned_to, 10) !==
      parseInt(existingTask.assigned_to, 10)
    ) {

      const newUser = await get(
        'SELECT id, name, email FROM users WHERE id = ?',
        [assigned_to]
      );

      if (newUser) {

        await notificationService.createNotification(
          newUser.id,
          'TASK_ASSIGNED',
          `Task "${title}" has been assigned to you`,
          taskId
        );

        const updatedTaskForEmail = await get(
          'SELECT * FROM tasks WHERE id = ?',
          [taskId]
        );

        emailService
          .sendTaskAssignedEmail(
            newUser,
            updatedTaskForEmail,
            req.user.name
          )
          .catch((err) => {
            console.error(
              '[Tasks] Reassignment email failed:',
              err.message
            );
          });
      }
    }

    // Get updated task
    const updatedTask = await get(
      `
      SELECT
        t.*,
        u.name AS assigned_user_name,
        tm.name AS team_name
      FROM tasks t
      LEFT JOIN users u
        ON t.assigned_to = u.id
      LEFT JOIN teams tm
        ON t.team_id = tm.id
      WHERE t.id = ?
      `,
      [taskId]
    );

    return res.json({
      success: true,
      message: 'Task updated successfully.',
      data: updatedTask,
    });

  } catch (err) {
    console.error('[Tasks] PUT error:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to update task.',
    });
  }
});


// ============================================================
// DELETE /api/tasks/:id
// Delete task
// ============================================================

router.delete(
  '/:id',
  requireAuth,
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req, res) => {

    try {
      const task = await get(
        'SELECT * FROM tasks WHERE id = ?',
        [req.params.id]
      );

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found.',
        });
      }

      // ADMIN scope
      if (
        req.user.role === 'ADMIN' &&
        task.team_id !== req.user.team_id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
      }

      // Delete
      await run(
        'DELETE FROM tasks WHERE id = ?',
        [req.params.id]
      );

      // Activity
      await run(
        `
        INSERT INTO activities (
          user_id,
          action,
          activity
        )
        VALUES (?, 'TASK_DELETED', ?)
        `,
        [
          req.user.id,
          `${req.user.name} deleted task "${task.title}"`,
        ]
      );

      return res.json({
        success: true,
        message: 'Task deleted successfully.',
      });

    } catch (err) {
      console.error('[Tasks] DELETE error:', err.message);

      return res.status(500).json({
        success: false,
        message: 'Failed to delete task.',
      });
    }
  }
);


module.exports = router;