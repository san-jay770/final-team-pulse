/**
 * TEAM PULSE — Auth Routes
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 */

const express = require('express');
const router = express.Router();

const { all, get, run } = require('../database/database');
const { requireAuth } = require('../middleware/authMiddleware');
const { verifyPassword } = require('../utils/passwordUtil');

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password, team_id, view_mode } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find all users with this email
    const users = await all(`
      SELECT u.*, t.name AS team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE lower(u.email) = ?
    `, [normalizedEmail]);

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Verify password
    const passwordMatch = await verifyPassword(
      password,
      users[0].password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Filter active users
    const activeUsers = users.filter(
      user => user.status === 'Active'
    );

    if (activeUsers.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Contact your admin.'
      });
    }

    const isSuperAdmin = activeUsers.some(
      user => user.role === 'SUPER_ADMIN'
    );

    // ============================================================
    // TEAM SELECTION
    // ============================================================
    if (
      activeUsers.length > 1 &&
      !team_id &&
      (!view_mode || view_mode === 'auto')
    ) {
      let allTeams = [];

      if (isSuperAdmin) {
        const dbTeams = await all(
          'SELECT id, name FROM teams ORDER BY name ASC',
          []
        );

        allTeams = dbTeams.map(team => ({
          team_id: team.id,
          team_name: team.name,
          role: 'SUPER_ADMIN',
          is_all_teams: true
        }));
      }

      return res.json({
        success: true,
        requireTeamSelection: true,
        requires_team_selection: true,
        is_super_admin: isSuperAdmin,

        user: {
          id: users[0].id,
          name: users[0].name,
          email: users[0].email,
          role: isSuperAdmin
            ? 'SUPER_ADMIN'
            : users[0].role
        },

        teams: activeUsers.map(user => ({
          user_id: user.id,
          team_id: user.team_id,
          team_name: user.team_name || `Team ${user.team_id}`,
          role: user.role
        })),

        all_teams: allTeams
      });
    }

    // ============================================================
    // SELECT USER
    // ============================================================
    let selectedUser;

    if (team_id) {
      selectedUser =
        activeUsers.find(
          user => String(user.team_id) === String(team_id)
        ) || activeUsers[0];
    } else {
      selectedUser =
        activeUsers.find(user => user.role === 'SUPER_ADMIN') ||
        activeUsers.find(user => user.role === 'ADMIN') ||
        activeUsers[0];
    }

    // ============================================================
    // SET SESSION
    // ============================================================
    req.session.userId = selectedUser.id;
    req.session.name = selectedUser.name;
    req.session.role = selectedUser.role;
    req.session.teamId = selectedUser.team_id;

    // ============================================================
    // LOG LOGIN ACTIVITY
    // PostgreSQL uses single quotes for string literals
    // ============================================================
    await run(
      `INSERT INTO activities
       (user_id, action, activity)
       VALUES (?, 'LOGIN', ?)`,
      [
        selectedUser.id,
        `${selectedUser.name} logged in`
      ]
    );

    // ============================================================
    // REDIRECT
    // ============================================================
    const redirectMap = {
      SUPER_ADMIN: '/dashboard_super.html',
      ADMIN: '/dashboard_admin.html',
      TEAM_MEMBER: '/dashboard_member.html'
    };

    let targetRedirect =
      redirectMap[selectedUser.role] ||
      '/dashboard_member.html';

    if (selectedUser.role === 'SUPER_ADMIN') {
      if (view_mode === 'admin') {
        targetRedirect = '/dashboard_admin.html';
      } else {
        targetRedirect = '/dashboard_super.html';
      }
    }

    // Save session
    req.session.save(saveErr => {
      if (saveErr) {
        console.error(
          '[Auth] Session save error:',
          saveErr
        );
      }

      return res.json({
        success: true,
        message: `Welcome, ${selectedUser.name}!`,
        is_super_admin:
          selectedUser.role === 'SUPER_ADMIN',

        user: {
          id: selectedUser.id,
          name: selectedUser.name,
          email: selectedUser.email,
          role: selectedUser.role,
          team_id: selectedUser.team_id,
          team_name: selectedUser.team_name
        },

        redirect: targetRedirect
      });
    });

  } catch (err) {
    console.error(
      '[Auth] Login error:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});


// ============================================================
// LOGOUT
// POST /api/auth/logout
// GET  /api/auth/logout
// ============================================================
const handleLogout = (req, res) => {
  const userName =
    req.session && req.session.name;

  const userId =
    req.session && req.session.userId;

  if (userId) {
    run(
      `INSERT INTO activities
       (user_id, action, activity)
       VALUES (?, 'LOGOUT', ?)`,
      [
        userId,
        `${userName || 'User'} logged out`
      ]
    ).catch(err => {
      console.error(
        '[Auth] Logout activity error:',
        err.message
      );
    });
  }

  res.clearCookie('teampulse.sid');

  const sendResponse = () => {
    if (
      req.originalUrl.includes('/api/') ||
      req.xhr
    ) {
      return res.json({
        success: true,
        message: 'Logged out successfully.',
        redirect: '/login.html'
      });
    }

    return res.redirect('/login.html');
  };

  if (
    req.session &&
    typeof req.session.destroy === 'function'
  ) {
    req.session.destroy(err => {
      if (err) {
        console.error(
          '[Auth] Logout session destroy error:',
          err.message
        );
      }

      return sendResponse();
    });
  } else {
    return sendResponse();
  }
};

router.post('/logout', handleLogout);
router.get('/logout', handleLogout);


// ============================================================
// GET /api/auth/me
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    let userTeams = await all(`
      SELECT
        u.id AS user_id,
        u.role,
        u.team_id,
        t.name AS team_name
      FROM users u
      JOIN teams t ON u.team_id = t.id
      WHERE lower(u.email) = lower(?)
        AND u.status = 'Active'
      ORDER BY t.name
    `, [req.user.email]);

    // Super Admin can inspect all teams
    if (req.user.role === 'SUPER_ADMIN') {
      const allSystemTeams = await all(
        `SELECT
           id AS team_id,
           name AS team_name
         FROM teams
         ORDER BY name`,
        []
      );

      userTeams = allSystemTeams.map(team => ({
        user_id: req.user.id,
        team_id: team.team_id,
        team_name: team.team_name,
        role: 'SUPER_ADMIN'
      }));
    }

    return res.json({
      success: true,

      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        team_id: req.user.team_id,
        team_name: req.user.team_name
      },

      teams: userTeams,

      is_super_admin:
        req.user.role === 'SUPER_ADMIN'
    });

  } catch (err) {
    console.error(
      '[Auth] /me error:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Could not fetch user info.'
    });
  }
});


// ============================================================
// POST /api/auth/switch-team
// ============================================================
router.post(
  '/switch-team',
  requireAuth,
  async (req, res) => {
    try {
      const { team_id, view_mode } = req.body;

      let targetUser = null;

      // ========================================================
      // SUPER ADMIN
      // ========================================================
      if (req.user.role === 'SUPER_ADMIN') {
        const targetTeam = await get(
          'SELECT * FROM teams WHERE id = ?',
          [team_id]
        );

        if (targetTeam) {
          targetUser = {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: 'SUPER_ADMIN',
            team_id: targetTeam.id,
            team_name: targetTeam.name
          };
        }

      } else {

        // ======================================================
        // NORMAL USER
        // ======================================================
        targetUser = await get(`
          SELECT
            u.*,
            t.name AS team_name
          FROM users u
          LEFT JOIN teams t
            ON u.team_id = t.id
          WHERE lower(u.email) = lower(?)
            AND u.team_id = ?
            AND u.status = 'Active'
        `, [
          req.user.email,
          team_id
        ]);
      }

      if (!targetUser) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized for this team.'
        });
      }

      // ========================================================
      // UPDATE SESSION
      // ========================================================
      req.session.userId = targetUser.id;
      req.session.name = targetUser.name;
      req.session.role = targetUser.role;
      req.session.teamId = targetUser.team_id;

      // ========================================================
      // LOG TEAM SWITCH
      // ========================================================
      await run(
        `INSERT INTO activities
         (user_id, action, activity)
         VALUES (?, 'SWITCH_TEAM', ?)`,
        [
          targetUser.id,
          `${targetUser.name} switched to ${targetUser.team_name}`
        ]
      );

      // ========================================================
      // REDIRECT
      // ========================================================
      const redirectMap = {
        SUPER_ADMIN: '/dashboard_super.html',
        ADMIN: '/dashboard_admin.html',
        TEAM_MEMBER: '/dashboard_member.html'
      };

      let targetRedirect =
        redirectMap[targetUser.role] ||
        '/dashboard_member.html';

      if (targetUser.role === 'SUPER_ADMIN') {
        if (view_mode === 'admin') {
          targetRedirect = '/dashboard_admin.html';
        } else if (view_mode === 'super_admin') {
          targetRedirect = '/dashboard_super.html';
        }
      }

      return res.json({
        success: true,
        message:
          `Switched to ${targetUser.team_name}`,

        user: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
          team_id: targetUser.team_id,
          team_name: targetUser.team_name
        },

        redirect: targetRedirect
      });

    } catch (err) {
      console.error(
        '[Auth] Switch team error:',
        err.message
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to switch team.'
      });
    }
  }
);


module.exports = router;