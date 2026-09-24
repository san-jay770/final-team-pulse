/**
 * TEAM PULSE — Suggestions Routes (with Super Admin email notification)
 */

const express = require('express');
const router  = express.Router();
const { run, all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

// GET /api/suggestions
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, team_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT s.*, u.name AS user_name, t.name AS team_name, r.name AS reviewed_by_name
      FROM suggestions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN teams t ON s.team_id = t.id
      LEFT JOIN users r ON s.reviewed_by = r.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND s.user_id = ?'; params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      sql += ' AND s.team_id = ?'; params.push(req.user.team_id);
    }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    if (team_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND s.team_id = ?'; params.push(team_id);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const suggestions = await all(sql, params);
    return res.json({ success: true, data: suggestions });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch suggestions.' });
  }
});

// POST /api/suggestions — Submit a suggestion
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, suggestion, team_id } = req.body;
    if (!suggestion) return res.status(400).json({ success: false, message: 'Suggestion content is required.' });

    const effectiveTeamId = team_id || req.user.team_id;

    const result = await run(
      'INSERT INTO suggestions (user_id, team_id, title, suggestion, status) VALUES (?, ?, ?, ?, "New")',
      [req.user.id, effectiveTeamId, title || null, suggestion]
    );

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "SUGGESTION_SUBMITTED", ?)',
      [req.user.id, `${req.user.name} submitted a suggestion: "${title || suggestion.substring(0, 50)}"`]
    );

    const newSuggestion = await get('SELECT * FROM suggestions WHERE id = ?', [result.lastID]);

    // Notify all Super Admins
    const superAdmins = await all(
      "SELECT id, name, email FROM users WHERE role = 'SUPER_ADMIN' AND status = 'Active'"
    );

    for (const superAdmin of superAdmins) {
      await notificationService.createNotification(
        superAdmin.id,
        'SUGGESTION_SUBMITTED',
        `New suggestion from ${req.user.name}: "${title || suggestion.substring(0, 60)}"`,
        result.lastID
      );
      emailService.sendSuggestionEmail(superAdmin, newSuggestion, req.user.name).catch(() => {});
    }

    return res.status(201).json({ success: true, message: 'Suggestion submitted successfully.', data: newSuggestion });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to submit suggestion.' });
  }
});

// PUT /api/suggestions/:id — Update status/response
router.put('/:id', requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const suggestion = await get('SELECT * FROM suggestions WHERE id = ?', [req.params.id]);
    if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found.' });

    const { status, response } = req.body;

    await run(
      'UPDATE suggestions SET status = ?, response = ?, reviewed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status || suggestion.status, response || suggestion.response, req.user.id, req.params.id]
    );

    // Notify submitter
    if (status && status !== suggestion.status) {
      await notificationService.createNotification(
        suggestion.user_id,
        'SUGGESTION_UPDATE',
        `Your suggestion status changed to: ${status}`,
        suggestion.id
      );
    }

    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "SUGGESTION_UPDATED", ?)',
      [req.user.id, `${req.user.name} updated a suggestion to status: ${status}`]
    );

    const updated = await get('SELECT * FROM suggestions WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Suggestion updated.', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update suggestion.' });
  }
});

// DELETE /api/suggestions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const suggestionId = parseInt(req.params.id);
    const suggestion = await get('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
    if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found.' });

    const isSuper = req.user.role === 'SUPER_ADMIN';
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = suggestion.user_id === req.user.id;

    if (!isSuper && !isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied: You cannot delete this suggestion.' });
    }

    await run('DELETE FROM suggestions WHERE id = ?', [suggestionId]);
    await run(
      'INSERT INTO activities (user_id, action, activity) VALUES (?, "SUGGESTION_DELETED", ?)',
      [req.user.id, `${req.user.name} deleted suggestion #${suggestionId}`]
    );

    return res.json({ success: true, message: 'Suggestion deleted successfully.' });
  } catch (err) {
    console.error('[Suggestions] Delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete suggestion.' });
  }
});

module.exports = router;
