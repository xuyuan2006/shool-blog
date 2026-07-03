// --小许同学--
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// @route   GET /api/modules
// @desc    Get all modules
router.get('/', (req, res) => {
  db.all('SELECT * FROM modules WHERE is_active = 1 ORDER BY sort_order ASC', [], (err, modules) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败' });
    }
    res.json({ success: true, modules });
  });
});

// @route   POST /api/modules
// @desc    Create a module (admin only)
router.post('/', authenticateToken, isAdmin, (req, res) => {
  const { name, description, icon, sortOrder } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: '模块名称不能为空' });
  }

  db.get('SELECT id FROM modules WHERE name = ?', [name], (err, row) => {
    if (err || row) {
      return res.status(409).json({ success: false, message: '模块名称已存在' });
    }

    db.run(
      'INSERT INTO modules (name, description, icon, sort_order) VALUES (?, ?, ?, ?)',
      [name, description || '', icon || '', sortOrder || 0],
      function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: '创建失败' });
        }
        res.status(201).json({ success: true, message: '模块创建成功', moduleId: this.lastID });
      }
    );
  });
});

// @route   PUT /api/modules/:id
// @desc    Update a module (admin only)
router.put('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, icon, sortOrder, isActive } = req.body;

  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
  if (sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(sortOrder); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, message: '无更改内容' });
  }

  values.push(id);

  db.run(`UPDATE modules SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: '更新失败' });
    }
    res.json({ success: true, message: '模块更新成功' });
  });
});

// @route   DELETE /api/modules/:id
// @desc    Delete a module (admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  db.get('SELECT COUNT(*) as count FROM posts WHERE module_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '查询失败' });
    }
    if (row.count > 0) {
      return res.status(400).json({ success: false, message: '该模块下还有帖子，无法删除' });
    }

    db.run('DELETE FROM modules WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '删除失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: '模块不存在' });
      }
      res.json({ success: true, message: '模块已删除' });
    });
  });
});

module.exports = router;
