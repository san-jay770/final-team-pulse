/**
 * TEAM PULSE — Notifications Routes
 */

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');

// GET /api/notifications — All notifications for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await notificationService.getAllNotifications(req.user.id);
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    return res.json({ success: true, data: notifications, unread_count: unreadCount });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return res.json({ success: true, count });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get count.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to mark as read.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
  }
});

module.exports = router;
