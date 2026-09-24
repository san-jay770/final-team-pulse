/**
 * TEAM PULSE — Teams Routes
 */

const express = require('express');
const router  = express.Router();
const { run, all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// GET /api/teams
router.get('/', requireAuth, async (req, res) => {
  try {
    const teams = await all(`
      SELECT
        t.*,
        a.name AS admin_name,
        (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id AND u.role = 'TEAM_MEMBER') AS member_count,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.team_id = t.id) AS total_tasks,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.team_id = t.id AND tk.status IN ('Completed','COMPLETED')) AS completed_tasks,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.team_id = t.id AND tk.status NOT IN ('Completed','COMPLETED')) AS pending_tasks,
        (SELECT COUNT(*) FROM tasks tk WHERE tk.team_id = t.id AND tk.status IN ('Overdue','OVERDUE')) AS overdue_tasks
      FROM teams t
      LEFT JOIN users a ON t.admin_id = a.id
      ORDER BY t.id
    `);

    const enriched = teams.map(t => ({
      ...t,
      completion_pct: t.total_tasks > 0
        ? Math.round((t.completed_tasks / t.total_tasks) * 100)
        : 0,
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch teams.' });
  }
});

// GET /api/teams/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const team = await get(`
      SELECT t.*, a.name AS admin_name
      FROM teams t LEFT JOIN users a ON t.admin_id = a.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

    const members = await all(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.points
      FROM users u WHERE u.team_id = ? ORDER BY u.role, u.name
    `, [team.id]);

    const tasks = await all(`
      SELECT t.*, u.name AS assigned_user_name
      FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.team_id = ? ORDER BY t.created_at DESC LIMIT 20
    `, [team.id]);

    return res.json({ success: true, data: { ...team, members, tasks } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch team.' });
  }
});

// GET /api/teams/:id/members
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const members = await all(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.points
      FROM users u WHERE u.team_id = ? AND u.status = 'Active' ORDER BY u.role, u.name
    `, [req.params.id]);
    return res.json({ success: true, members, data: members });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch team members.' });
  }
});

// POST /api/teams
router.post('/', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, description, admin_id } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Team name is required.' });

    const result = await run(
      'INSERT INTO teams (name, description, admin_id) VALUES (?, ?, ?)',
      [name, description || null, admin_id || null]
    );

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "TEAM_CREATED", ?)',
      [req.user.id, `${req.user.name} created team "${name}"`]
    );

    const team = await get('SELECT * FROM teams WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, message: 'Team created successfully.', data: team });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create team.' });
  }
});

// PUT /api/teams/:id
router.put('/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, description, admin_id } = req.body;
    const team = await get('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

    await run(
      'UPDATE teams SET name = ?, description = ?, admin_id = ? WHERE id = ?',
      [name || team.name, description || team.description, admin_id || team.admin_id, req.params.id]
    );

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "TEAM_UPDATED", ?)',
      [req.user.id, `${req.user.name} updated team "${team.name}"`]
    );

    const updated = await get('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Team updated successfully.', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update team.' });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const team = await get('SELECT * FROM teams WHERE id = ?', [req.params.id]);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

    const memberCount = await get('SELECT COUNT(*) as count FROM users WHERE team_id = ?', [req.params.id]);
    if (memberCount && memberCount.count > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete team — it has ${memberCount.count} member(s). Remove members first.`
      });
    }

    await run('DELETE FROM teams WHERE id = ?', [req.params.id]);
    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "TEAM_DELETED", ?)',
      [req.user.id, `${req.user.name} deleted team "${team.name}"`]
    );

    return res.json({ success: true, message: 'Team deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete team.' });
  }
});

module.exports = router;
