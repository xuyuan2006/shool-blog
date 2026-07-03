// --小许同学--
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// @route   GET /api/posts
// @desc    Get all posts with pagination and filtering
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const moduleId = req.query.moduleId || null;
    const search = req.query.search || null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.is_active = 1';
    const params = [];

    if (moduleId) {
      whereClause += ' AND p.module_id = ?';
      params.push(moduleId);
    }

    if (search) {
      whereClause += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const sortMap = {
      created_at: 'p.created_at',
      view_count: 'p.view_count',
      like_count: 'p.like_count',
      title: 'p.title'
    };
    const sortField = sortMap[sortBy] || 'p.created_at';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM posts p ${whereClause}`;
    db.get(countQuery, params, (err, countRow) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败' });
      }

      // Get posts
      const postsQuery = `
        SELECT p.*, u.username, u.avatar, m.name as module_name, m.icon as module_icon,
               (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_active = 1) as comment_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN modules m ON p.module_id = m.id
        ${whereClause}
        ORDER BY p.is_pinned DESC, ${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      db.all(postsQuery, [...params, limit, offset], (err, posts) => {
        if (err) {
          return res.status(500).json({ success: false, message: '查询失败' });
        }

        res.json({
          success: true,
          data: posts,
          pagination: {
            page,
            limit,
            total: countRow.total,
            totalPages: Math.ceil(countRow.total / limit)
          }
        });
      });
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get single post by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;

  // Increment view count
  db.run('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [id]);

  db.get(`
    SELECT p.*, u.username, u.avatar, m.name as module_name, m.icon as module_icon,
           (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_active = 1) as comment_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN modules m ON p.module_id = m.id
    WHERE p.id = ? AND p.is_active = 1
  `, [id], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ success: false, message: '帖子不存在' });
    }
    post.image_urls = post.image_urls ? JSON.parse(post.image_urls) : [];
    res.json({ success: true, post });
  });
});

// @route   POST /api/posts
// @desc    Create a new post
router.post('/', authenticateToken, (req, res) => {
  const { title, content, moduleId, images } = req.body;

  if (!title || !content) {
    return res.status(400).json({ success: false, message: '标题和内容不能为空' });
  }

  if (title.length > 100) {
    return res.status(400).json({ success: false, message: '标题不能超过100个字符' });
  }

  const imageUrls = images ? JSON.stringify(images) : '';

  db.run(
    'INSERT INTO posts (title, content, module_id, user_id, image_urls) VALUES (?, ?, ?, ?, ?)',
    [title, content, moduleId || null, req.user.id, imageUrls],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '发布失败，请重试' });
      }

      // Notify admins
      db.run(
        'INSERT INTO notifications (user_id, type, title, content) SELECT id, "post_created", "新帖子发布", ? FROM users WHERE role IN ("admin", "super_admin")',
        [`用户 ${req.user.username} 发布了: ${title}`]
      );

      res.status(201).json({
        success: true,
        message: '发布成功',
        postId: this.lastID
      });
    }
  );
});

// @route   PUT /api/posts/:id
// @desc    Update a post
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, content, moduleId, images } = req.body;

  db.get('SELECT * FROM posts WHERE id = ?', [id], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ success: false, message: '帖子不存在' });
    }

    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只能修改自己的帖子' });
    }

    const imageUrls = images ? JSON.stringify(images) : post.image_urls;
    const fields = [];
    const values = [];

    if (title !== undefined) fields.push('title = ?');
    if (title !== undefined) { values.push(title); }
    if (content !== undefined) fields.push('content = ?');
    if (content !== undefined) { values.push(content); }
    if (moduleId !== undefined) fields.push('module_id = ?');
    if (moduleId !== undefined) { values.push(moduleId); }
    if (images !== undefined) fields.push('image_urls = ?');
    if (images !== undefined) { values.push(imageUrls); }

    if (fields.length === 0) {
      return res.json({ success: true, message: '无更改内容' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.run(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '更新失败' });
      }
      res.json({ success: true, message: '更新成功' });
    });
  });
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post (soft delete)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM posts WHERE id = ?', [id], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ success: false, message: '帖子不存在' });
    }

    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '只能删除自己的帖子' });
    }

    db.run('UPDATE posts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id], function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: '删除失败' });
        }
        res.json({ success: true, message: '删除成功' });
      });
  });
});

// @route   POST /api/posts/:id/like
// @desc    Like/unlike a post
router.post('/:id/like', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [id, req.user.id], (err, existing) => {
    if (err) {
      return res.status(500).json({ success: false, message: '操作失败' });
    }

    if (existing) {
      // Unlike
      db.run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [id, req.user.id], function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: '取消点赞失败' });
        }
        res.json({ success: true, message: '已取消点赞', liked: false });
      });
    } else {
      // Like
      db.run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [id, req.user.id], function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: '点赞失败' });
        }

        // Notify post author
        db.get('SELECT user_id, title FROM posts WHERE id = ?', [id], (err, post) => {
          if (!err && post && post.user_id !== req.user.id) {
            db.run(
              'INSERT INTO notifications (user_id, type, title, content) VALUES (?, "like", "你的帖子被点赞了", ?)',
              [post.user_id, `用户 ${req.user.username} 点赞了你的帖子: ${post.title}`]
            );
          }
        });

        res.json({ success: true, message: '点赞成功', liked: true });
      });
    }
  });
});

// @route   GET /api/posts/:id/liked
// @desc    Check if current user liked a post
router.get('/:id/liked', authenticateToken, (req, res) => {
  db.get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
    [req.params.id, req.user.id], (err, row) => {
      res.json({ success: true, liked: !!row });
    });
});

module.exports = router;
