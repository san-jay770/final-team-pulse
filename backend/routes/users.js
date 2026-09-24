/**
 * TEAM PULSE — Users Routes
 * Full CRUD with email notifications on create, activate, deactivate, password reset.
 */

const express = require('express');
const router  = express.Router();
const { run, all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { hashPassword } = require('../utils/passwordUtil');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

// GET /api/users — List users (grouped by email so 1 email = 1 unique account)
router.get('/', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { q, team_id, role, status, raw, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (raw === 'true') {
      let sql = `
        SELECT u.*, t.name AS team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE 1=1
      `;
      const params = [];
      if (req.user.role === 'ADMIN') { sql += ' AND u.team_id = ?'; params.push(req.user.team_id); }
      if (q) { sql += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
      if (team_id && req.user.role === 'SUPER_ADMIN') { sql += ' AND u.team_id = ?'; params.push(team_id); }
      if (role) { sql += ' AND u.role = ?'; params.push(role); }
      if (status) { sql += ' AND u.status = ?'; params.push(status); }

      sql += ' ORDER BY u.team_id, u.role, u.name LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const users = await all(sql, params);
      return res.json({ success: true, data: users });
    }

    // Default: Group by unique email for User Management table
    let sql = `
      SELECT
        MIN(u.id) AS id,
        u.name,
        u.email,
        CASE
          WHEN MAX(CASE WHEN u.role = 'SUPER_ADMIN' THEN 3 WHEN u.role = 'ADMIN' THEN 2 ELSE 1 END) = 3 THEN 'SUPER_ADMIN'
          WHEN MAX(CASE WHEN u.role = 'SUPER_ADMIN' THEN 3 WHEN u.role = 'ADMIN' THEN 2 ELSE 1 END) = 2 THEN 'ADMIN'
          ELSE 'TEAM_MEMBER'
        END AS role,
        GROUP_CONCAT(DISTINCT t.name) AS team_name,
        MAX(u.points) AS points,
        COALESCE(MAX(u.phone), '+919876543210') AS phone,
        u.status,
        MIN(u.created_at) AS created_at
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'ADMIN') {
      sql += ' AND u.team_id = ?'; params.push(req.user.team_id);
    }
    if (q) {
      sql += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND u.team_id = ?'; params.push(team_id);
    }
    if (role) {
      sql += ` AND lower(u.email) IN (SELECT lower(email) FROM users WHERE role = ?)`;
      params.push(role);
    }
    if (status) {
      sql += ' AND u.status = ?'; params.push(status);
    }

    sql += `
      GROUP BY lower(u.email)
      ORDER BY 
        CASE 
          WHEN MAX(CASE WHEN u.role = 'SUPER_ADMIN' THEN 3 WHEN u.role = 'ADMIN' THEN 2 ELSE 1 END) = 3 THEN 1
          WHEN MAX(CASE WHEN u.role = 'SUPER_ADMIN' THEN 3 WHEN u.role = 'ADMIN' THEN 2 ELSE 1 END) = 2 THEN 2
          ELSE 3
        END,
        u.name
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const users = await all(sql, params);
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('[Users] GET error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// GET /api/users/:id — Single user
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (req.user.role === 'TEAM_MEMBER' && req.user.id !== targetId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const user = await get(`
      SELECT u.*, t.name AS team_name
      FROM users u LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = ?
    `, [targetId]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.role === 'ADMIN' && user.team_id !== req.user.team_id && user.id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const tasks = await all(
      'SELECT * FROM tasks WHERE assigned_to = ? ORDER BY created_at DESC LIMIT 10',
      [user.id]
    );
    const activities = await all(
      'SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [user.id]
    );

    return res.json({ success: true, data: { ...user, tasks, activities } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
});

// POST /api/users — Create user
router.post('/', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role = 'TEAM_MEMBER', team_id, status = 'Active', phone } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const normalizedEmail = email.trim().toLowerCase();
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : (team_id || req.user.team_id);

    // ADMIN cannot create SUPER_ADMIN
    const effectiveRole = (req.user.role === 'ADMIN' && role === 'SUPER_ADMIN') ? 'TEAM_MEMBER' : role;

    // Check if already in this team
    const existing = await get(
      'SELECT id FROM users WHERE lower(email) = ? AND team_id = ?',
      [normalizedEmail, effectiveTeamId]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already assigned to this team.' });
    }

    // Check global user (already exists somewhere)
    const globalUser = await get('SELECT * FROM users WHERE lower(email) = ? LIMIT 1', [normalizedEmail]);

    let passwordHash;
    let plainPassword = password;

    if (globalUser) {
      if (!name && !password) {
        // Re-add to new team with same credentials
        passwordHash = globalUser.password;
        plainPassword = null;
      } else {
        passwordHash = password
          ? await hashPassword(password)
          : globalUser.password;
      }
    } else {
      if (!name || !password) {
        return res.status(400).json({ success: false, message: 'Name and password are required for new users.' });
      }
      passwordHash = await hashPassword(password);
    }

    const effectiveName = name || (globalUser ? globalUser.name : '');
    const effectivePhone = phone ? phone.trim() : (globalUser && globalUser.phone ? globalUser.phone : null);

    const result = await run(
      'INSERT INTO users (name, email, password, role, team_id, phone, points, status) VALUES (?,?,?,?,?,?,0,?)',
      [effectiveName, normalizedEmail, passwordHash, effectiveRole, effectiveTeamId, effectivePhone, status]
    );

    const newUser = await get('SELECT *, (SELECT name FROM teams WHERE id = users.team_id) AS team_name FROM users WHERE id = ?', [result.lastID]);

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "USER_CREATED", ?)',
      [req.user.id, `${req.user.name} added user ${effectiveName} to team`]
    );

    // Send welcome email
    if (plainPassword) {
      emailService.sendWelcomeEmail(
        { name: effectiveName, email: normalizedEmail, role: effectiveRole },
        plainPassword
      ).catch(() => {});
    }

    return res.status(201).json({ success: true, message: 'User created successfully.', data: newUser });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'User already exists in this team.' });
    }
    console.error('[Users] POST error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

// PUT /api/users/:id — Update user
router.put('/:id', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (req.user.role === 'ADMIN' && user.team_id !== req.user.team_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { name, email, role, team_id, status, password, phone } = req.body;
    const effectiveRole = (req.user.role === 'ADMIN' && role === 'SUPER_ADMIN') ? 'TEAM_MEMBER' : (role || user.role);
    const effectiveTeamId = req.user.role === 'ADMIN' ? req.user.team_id : (team_id || user.team_id);
    const effectivePhone = phone !== undefined ? (phone ? phone.trim() : null) : user.phone;

    let passwordHash = user.password;
    if (password) {
      passwordHash = await hashPassword(password);
      // Sync password across all teams for this email
      await run('UPDATE users SET password = ? WHERE lower(email) = ?', [passwordHash, user.email.toLowerCase()]);
    }

    await run(
      'UPDATE users SET name=?, email=?, role=?, team_id=?, status=?, password=?, phone=? WHERE id=?',
      [name || user.name, email || user.email, effectiveRole, effectiveTeamId, status || user.status, passwordHash, effectivePhone, userId]
    );

    if (phone !== undefined) {
      // Sync phone across all teams for this user
      await run('UPDATE users SET phone = ? WHERE lower(email) = ?', [effectivePhone, user.email.toLowerCase()]);
    }

    // Send status change email if status changed
    if (status && status !== user.status) {
      emailService.sendAccountStatusEmail({ name: user.name, email: user.email }, status).catch(() => {});
    }

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "USER_UPDATED", ?)',
      [req.user.id, `${req.user.name} updated user ${user.name}`]
    );

    const updated = await get('SELECT *, (SELECT name FROM teams WHERE id = users.team_id) AS team_name FROM users WHERE id = ?', [userId]);
    return res.json({ success: true, message: 'User updated successfully.', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

// POST /api/users/:id/phone — Update cellular SMS phone
router.post('/:id/phone', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required.' });

    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await run('UPDATE users SET phone = ? WHERE lower(email) = ?', [phone.trim(), user.email.toLowerCase()]);
    return res.json({ success: true, message: 'Cellular phone updated successfully.', phone: phone.trim() });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update phone.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const userEmail = user.email.toLowerCase();

    if (userId === req.user.id || userEmail === req.user.email.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own logged-in account.' });
    }

    if (req.user.role === 'ADMIN' && user.team_id !== req.user.team_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Safely unassign or remove foreign key dependencies across all tables
    await run(`
      UPDATE tasks SET assigned_to = NULL 
      WHERE assigned_to IN (SELECT id FROM users WHERE lower(email) = ?)
    `, [userEmail]).catch(() => {});

    await run(`
      UPDATE tasks SET created_by = NULL 
      WHERE created_by IN (SELECT id FROM users WHERE lower(email) = ?)
    `, [userEmail]).catch(() => {});

    await run(`
      DELETE FROM doubts 
      WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ?)
         OR answered_by IN (SELECT id FROM users WHERE lower(email) = ?)
    `, [userEmail, userEmail]).catch(() => {});

    await run(`
      DELETE FROM suggestions 
      WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ?)
    `, [userEmail]).catch(() => {});

    await run(`
      DELETE FROM notifications 
      WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ?)
    `, [userEmail]).catch(() => {});

    await run(`
      DELETE FROM activities 
      WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ?)
    `, [userEmail]).catch(() => {});

    if (req.user.role === 'ADMIN') {
      await run('DELETE FROM users WHERE id = ?', [userId]);
    } else {
      await run('DELETE FROM users WHERE lower(email) = ?', [userEmail]);
    }

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "USER_DELETED", ?)',
      [req.user.id, `${req.user.name} deleted user ${user.name} (${user.email})`]
    ).catch(() => {});

    return res.json({ success: true, message: `User ${user.name} deleted successfully.` });
  } catch (err) {
    console.error('[Users] Delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
});

// PUT /api/users/:id/reset-password
router.put('/:id/reset-password', requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const user = await get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Allow user to reset their own password, or admins/super admins
    const isSelf = req.user.id === targetUserId || req.user.email.toLowerCase() === user.email.toLowerCase();
    const isAdmin = req.user.role === 'ADMIN' && (user.team_id === req.user.team_id);
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    if (!isSelf && !isAdmin && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hash = await hashPassword(new_password);
    await run('UPDATE users SET password = ? WHERE lower(email) = ?', [hash, user.email.toLowerCase()]);

    emailService.sendPasswordResetEmail(user, new_password).catch(() => {});
    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "PASSWORD_RESET", ?)',
      [req.user.id, `${req.user.name} reset password for ${user.name}`]
    );

    return res.json({ success: true, message: 'Password reset and email sent.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// GET /api/users/check-email or /api/users/user-by-email
router.get(['/check-email', '/user-by-email'], requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.json({ found: false });

  const user = await get(`
    SELECT u.name, u.email, GROUP_CONCAT(t.name, ', ') AS current_teams
    FROM users u LEFT JOIN teams t ON u.team_id = t.id
    WHERE lower(u.email) = ?
    GROUP BY lower(u.email)
  `, [email]);

  if (user) {
    return res.json({ found: true, name: user.name, email: user.email, current_teams: user.current_teams });
  }
  return res.json({ found: false });
});

module.exports = router;
