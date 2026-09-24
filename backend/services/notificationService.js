/**
 * TEAM PULSE — In-App Notification Service
 * Creates notifications in the SQLite notifications table.
 */

const { run, all, get } = require('../database/database');

/**
 * Create a notification for a user
 * @param {number} userId
 * @param {string} type - 'TASK_ASSIGNED'|'TASK_REMINDER'|'TASK_OVERDUE'|'DOUBT_REPLY'|'SUGGESTION_UPDATE'|'ACCOUNT_UPDATE'
 * @param {string} message
 * @param {number|null} relatedId - ID of related entity (task, doubt, etc.)
 */
async function createNotification(userId, type, message, relatedId = null) {
  try {
    await run(
      'INSERT INTO notifications (user_id, type, message, related_id, is_read) VALUES (?, ?, ?, ?, 0)',
      [userId, type, message, relatedId]
    );
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err.message);
  }
}

/**
 * Get all unread notifications for a user
 */
async function getUnreadNotifications(userId) {
  return all(
    'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 20',
    [userId]
  );
}

/**
 * Get all notifications for a user (paginated)
 */
async function getAllNotifications(userId, limit = 50) {
  return all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
}

/**
 * Mark a notification as read
 */
async function markAsRead(notificationId, userId) {
  return run(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
  return run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [userId]
  );
}

/**
 * Get unread count for a user
 */
async function getUnreadCount(userId) {
  const row = await get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return row ? row.count : 0;
}

module.exports = {
  createNotification,
  getUnreadNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
