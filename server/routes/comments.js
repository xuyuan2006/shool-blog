// --小许同学--
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// @route   GET /api/comments/:postId
// @desc    Get comments for a post
router.get('/:postId', (req, res) => {
  const { postId } = req.params;

  db.all(`
    SELECT c.*, u.username, u.avatar,
           (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND is_active = 1) as reply_count
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? AND c.is_active = 1 AND c.parent_id IS NULL
    ORDER BY c.created_at ASC
  `, [postId], (err, comments) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败' });
    }

    // Fetch replies for each comment
    const withReplies = comments.map(c => {
      c.replies = [];
      return c;
    });

    Promise.all(comments.map(comment => {
      return new Promise((resolve) => {
        db.all(`
          SELECT c.*, u.username, u.avatar
          FROM comments c
          JOIN users u ON c.user_id = u.id
          WHERE c.post_id = ? AND c.parent_id = ? AND c.is_active = 1
          ORDER BY c.created_at ASC
        `, [postId, comment.id], (err, replies) => {
          if (!err && replies) {
            const idx = withReplies.findIndex(c => c.id === comment.id);
            if (idx !== -1) {
              withReplies[idx].replies = replies;
            }
          }
          resolve();
        });
      });
    })).then(() => {
      res.json({ success: true, comments: withReplies });
    });
  });
});

// @route   POST /api/comments
// @desc    Add a comment
router.post('/', authenticateToken, (req, res) => {
  const { postId, content, parentId } = req.body;

  if (!postId || !content) {
    return res.status(400).json({ success: false, message: '参数不完整' });
  }

  if (content.length > 1000) {
    return res.status(400).json({ success: false, message: '评论不能超过1000个字符' });
  }

  db.run(
    'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
    [postId, req.user.id, content, parentId || null],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '评论失败' });
      }

      // Notify post author
      db.get('SELECT user_id, title FROM posts WHERE id = ?', [postId], (err, post) => {
        if (!err && post && post.user_id !== req.user.id) {
          db.run(
            'INSERT INTO notifications (user_id, type, title, content) VALUES (?, "comment", "你的帖子有新评论", ?)',
            [post.user_id, `用户 ${req.user.username} 评论了你的帖子: ${post.title}`]
          );
        }
      });

      res.status(201).json({ success: true, message: '评论成功', commentId: this.lastID });
    }
  );
});

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM comments WHERE id = ?', [id], (err, comment) => {
    if (err || !comment) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只能删除自己的评论' });
    }

    db.run('UPDATE comments SET is_active = 0 WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '删除失败' });
      }
      res.json({ success: true, message: '评论已删除' });
    });
  });
});

module.exports = router;
