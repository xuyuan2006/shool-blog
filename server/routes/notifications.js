// --小许同学--
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// @route   GET /api/notifications
// @desc    Get current user's notifications
router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id], (err, notifications) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败' });
      }
      res.json({ success: true, notifications });
    });
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
router.put('/:id/read', authenticateToken, (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '操作失败' });
      }
      res.json({ success: true, message: '已标记为已读' });
    });
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
router.put('/read-all', authenticateToken, (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [req.user.id], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '操作失败' });
      }
      res.json({ success: true, message: '全部已标记为已读' });
    });
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
router.get('/unread-count', authenticateToken, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败' });
      }
      res.json({ success: true, count: row.count });
    });
});

module.exports = router;
