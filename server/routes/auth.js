// --小许同学--
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const upload = require('../middleware/upload');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: '请填写所有必填字段' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ success: false, message: '用户名长度必须在2-20个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度至少为6个字符' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '请输入有效的邮箱地址' });
    }

    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: '服务器错误' });
      }
      if (row) {
        return res.status(409).json({ success: false, message: '用户名或邮箱已被注册' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Insert user
      db.run(
        'INSERT INTO users (username, email, password_hash, verification_token) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, verificationToken],
        function (err) {
          if (err) {
            return res.status(500).json({ success: false, message: '注册失败，请重试' });
          }

          // Send verification email
          sendVerificationEmail(email, username, verificationToken);

          res.status(201).json({
            success: true,
            message: '注册成功！请检查邮箱进行验证（如未配置邮箱服务，将自动登录）',
            autoLogin: true,
            user: {
              id: this.lastID,
              username,
              email,
              verificationToken
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: '请填写邮箱和密码' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: '服务器错误' });
      }
      if (!user) {
        return res.status(401).json({ success: false, message: '邮箱或密码错误' });
      }
      if (user.is_active === 0) {
        return res.status(403).json({ success: false, message: '账号已被禁用' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: '邮箱或密码错误' });
      }

      const token = generateToken(user);

      res.json({
        success: true,
        message: '登录成功',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          role: user.role,
          theme: user.theme,
          theme_color: user.theme_color
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, avatar, bio, role, theme, theme_color, created_at FROM users WHERE id = ?',
    [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }
      res.json({ success: true, user });
    });
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
router.put('/profile', authenticateToken, (req, res) => {
  const { username, bio, theme, theme_color } = req.body;
  const userId = req.user.id;

  if (username) {
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ success: false, message: '用户名长度必须在2-20个字符之间' });
    }
    db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId], (err, row) => {
      if (err || row) {
        return res.status(409).json({ success: false, message: '用户名已被使用' });
      }
      updateProfile(userId, { username });
    });
  } else {
    updateProfile(userId, { username, bio, theme, theme_color });
  }

  function updateProfile(uid, updates) {
    const fields = [];
    const values = [];
    if (updates.username !== undefined) { fields.push('username = ?'); values.push(updates.username); }
    if (updates.bio !== undefined) { fields.push('bio = ?'); values.push(updates.bio); }
    if (updates.theme !== undefined) { fields.push('theme = ?'); values.push(updates.theme); }
    if (updates.theme_color !== undefined) { fields.push('theme_color = ?'); values.push(updates.theme_color); }
    if (fields.length === 0) {
      return res.json({ success: true, message: '无需更新' });
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(uid);

    db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '更新失败' });
      }
      db.get('SELECT id, username, email, avatar, bio, role, theme, theme_color FROM users WHERE id = ?', [uid], (err, user) => {
        res.json({ success: true, message: '更新成功', user });
      });
    });
  }
});

// @route   POST /api/auth/avatar
// @desc    Upload avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请选择要上传的图片' });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  db.run('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [avatarUrl, req.user.id], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '头像上传失败' });
      }
      res.json({ success: true, message: '头像上传成功', avatar: avatarUrl });
    });
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: '请输入邮箱地址' });
  }

  db.get('SELECT id, username, email FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '服务器错误' });
    }
    if (!user) {
      return res.json({ success: true, message: '如果该邮箱已注册，将发送重置邮件' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    db.run('UPDATE users SET reset_token = ?, reset_token_expires = datetime("now", "+1 hour") WHERE id = ?',
      [resetToken, user.id], function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: '发送失败' });
        }
        sendPasswordResetEmail(user.email, user.username, resetToken);
        res.json({ success: true, message: '重置邮件已发送' });
      });
  });
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: '密码长度至少为6个字符' });
  }

  db.get('SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > datetime("now")',
    [token], async (err, user) => {
      if (err || !user) {
        return res.status(400).json({ success: false, message: '无效或已过期的重置令牌' });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [hash, user.id], function (err) {
          if (err) {
            return res.status(500).json({ success: false, message: '密码重置失败' });
          }
          res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
        });
    });
});

// @route   GET /api/auth/users
// @desc    Get all users (admin only)
router.get('/users', authenticateToken, isAdmin, (req, res) => {
  db.all('SELECT id, username, email, avatar, bio, role, is_active, created_at FROM users ORDER BY created_at DESC',
    [], (err, users) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败' });
      }
      res.json({ success: true, users });
    });
});

// @route   PUT /api/auth/users/:id/status
// @desc    Toggle user active status (admin only)
router.put('/users/:id/status', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  db.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [is_active ? 1 : 0, id], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '更新失败' });
      }
      res.json({ success: true, message: '用户状态已更新' });
    });
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete user (admin only)
router.delete('/users/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: '不能删除自己' });
  }

  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: '删除失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, message: '用户已删除' });
  });
});

module.exports = router;
