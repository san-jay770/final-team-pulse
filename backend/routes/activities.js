/**
 * TEAM PULSE — Activities Routes (Smooth Reload Verified)
 */

const express = require('express');
const router  = express.Router();
const { all, get } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// GET /api/activities
router.get('/', requireAuth, async (req, res) => {
  try {
    const { user_id, team_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT a.*, u.name AS user_name, u.role AS user_role
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'TEAM_MEMBER') {
      sql += ' AND a.user_id = ?'; params.push(req.user.id);
    } else if (req.user.role === 'ADMIN') {
      sql += ' AND u.team_id = ?'; params.push(req.user.team_id);
    }

    if (user_id && req.user.role === 'SUPER_ADMIN') {
      sql += ' AND a.user_id = ?'; params.push(user_id);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const activities = await all(sql, params);
    return res.json({ success: true, data: activities });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch activities.' });
  }
});

module.exports = router;
