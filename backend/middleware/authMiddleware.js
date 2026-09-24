/**
 * TEAM PULSE — Authentication Middleware
 * requireAuth: Block unauthenticated requests
 * requireRole: Block requests with insufficient role
 */

const { get } = require('../database/database');

/**
 * Require a logged-in session.
 * Refreshes user data from DB on every request (prevents stale session data).
 */
async function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  try {
    const user = await get(
      'SELECT id, name, email, role, team_id, status FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      if (req.session && typeof req.session.destroy === 'function') {
        req.session.destroy(() => {});
      }
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }

    if (user.status !== 'Active') {
      if (req.session && typeof req.session.destroy === 'function') {
        req.session.destroy(() => {});
      }
      return res.status(403).json({ success: false, message: 'Your account is inactive. Contact your admin.' });
    }

    // Attach fresh user data to request
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] DB error during auth check:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * Require one or more specific roles.
 * Must be used AFTER requireAuth.
 * Usage: requireRole('SUPER_ADMIN', 'ADMIN')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
