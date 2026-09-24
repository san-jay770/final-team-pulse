/**
 * TEAM PULSE — Doubts Routes (with email notifications)
 */

const express = require('express');
const router  = express.Router();
const { run, all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

// GET /api/doubts
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, team_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT d.*, u.name AS user_name, u.email AS user_email, t.name AS team_name,
        a.name AS answered_by_name
      FROM doubts d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN teams t ON d.team_id = t.id
      LEFT JOIN users a ON d.answered_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND d.user_id = ?'; params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      sql += ' AND d.team_id = ?'; params.push(req.user.team_id);
    }
    if (status) { sql += ' AND d.status = ?'; params.push(status); }
    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND d.team_id = ?'; params.push(team_id);
    }

    sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const doubts = await all(sql, params);
    return res.json({ success: true, data: doubts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch doubts.' });
  }
});

// GET /api/doubts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const doubt = await get(`
      SELECT d.*, u.name AS user_name, t.name AS team_name, a.name AS answered_by_name
      FROM doubts d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN teams t ON d.team_id = t.id
      LEFT JOIN users a ON d.answered_by = a.id
      WHERE d.id = ?
    `, [req.params.id]);

    if (!doubt) return res.status(404).json({ success: false, message: 'Doubt not found.' });
    return res.json({ success: true, data: doubt });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch doubt.' });
  }
});

// POST /api/doubts — Submit a doubt
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, question, team_id } = req.body;
    if (!question) return res.status(400).json({ success: false, message: 'Question is required.' });

    const effectiveTeamId = team_id || req.user.team_id;

    const result = await run(
      'INSERT INTO doubts (user_id, team_id, title, question, status) VALUES (?, ?, ?, ?, "Open")',
      [req.user.id, effectiveTeamId, title || null, question]
    );

    const doubt = await get('SELECT * FROM doubts WHERE id = ?', [result.lastID]);

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "DOUBT_SUBMITTED", ?)',
      [req.user.id, `${req.user.name} submitted a doubt: "${title || question.substring(0, 50)}"`]
    );

    // Notify team admin via email
    const teamAdmin = await get(
      "SELECT u.id, u.name, u.email FROM users u WHERE u.team_id = ? AND u.role IN ('ADMIN', 'SUPER_ADMIN') AND u.status = 'Active' LIMIT 1",
      [effectiveTeamId]
    );

    if (teamAdmin) {
      await notificationService.createNotification(
        teamAdmin.id,
        'DOUBT_SUBMITTED',
        `New doubt from ${req.user.name}: "${title || question.substring(0, 60)}"`,
        result.lastID
      );
      emailService.sendDoubtNotificationEmail(teamAdmin, doubt, req.user.name).catch(() => {});
    }

    return res.status(201).json({ success: true, message: 'Doubt submitted successfully.', data: doubt });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to submit doubt.' });
  }
});

// PUT /api/doubts/:id — Update / Resolve doubt
router.put('/:id', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const doubt = await get('SELECT * FROM doubts WHERE id = ?', [req.params.id]);
    if (!doubt) return res.status(404).json({ success: false, message: 'Doubt not found.' });

    const { answer, status } = req.body;
    const newStatus = status || doubt.status;
    const answeredAt = newStatus === 'Resolved' ? new Date().toISOString() : doubt.answered_at;

    await run(
      'UPDATE doubts SET answer = ?, status = ?, answered_by = ?, answered_at = ? WHERE id = ?',
      [answer || doubt.answer, newStatus, req.user.id, answeredAt, req.params.id]
    );

    // Notify user if resolved
    if (newStatus === 'Resolved' && answer) {
      await notificationService.createNotification(
        doubt.user_id,
        'DOUBT_REPLY',
        `Your doubt has been resolved by ${req.user.name}`,
        doubt.id
      );

      const submitter = await get('SELECT id, name, email FROM users WHERE id = ?', [doubt.user_id]);
      if (submitter) {
        emailService.sendDoubtResolvedEmail(submitter, doubt, answer).catch(() => {});
      }
    }

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "DOUBT_RESOLVED", ?)',
      [req.user.id, `${req.user.name} responded to a doubt`]
    );

    const updated = await get('SELECT * FROM doubts WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Doubt updated successfully.', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update doubt.' });
  }
});

// DELETE /api/doubts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const doubt = await get('SELECT * FROM doubts WHERE id = ?', [req.params.id]);
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found.' });
    }

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isAdmin = req.user.role === 'ADMIN' && req.user.team_id === doubt.team_id;
    const isOwner = doubt.user_id === req.user.id;

    if (!isSuperAdmin && !isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You cannot delete this doubt.' });
    }

    await run('DELETE FROM doubts WHERE id = ?', [req.params.id]);

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "DOUBT_DELETED", ?)',
      [req.user.id, `${req.user.name} deleted doubt #${req.params.id}`]
    ).catch(() => {});

    return res.json({ success: true, message: 'Doubt deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete doubt.' });
  }
});

module.exports = router;
