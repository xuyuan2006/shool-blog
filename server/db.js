// --小许同学--
require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      theme TEXT DEFAULT 'light',
      theme_color TEXT DEFAULT '#4A90D9',
      is_active INTEGER DEFAULT 1,
      verification_token TEXT DEFAULT NULL,
      reset_token TEXT DEFAULT NULL,
      reset_token_expires TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Modules/Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Posts table
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      module_id INTEGER,
      user_id INTEGER NOT NULL,
      image_urls TEXT DEFAULT '',
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `);

  // Likes table
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    )
  `);

  // Notifications table
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Insert default modules
  const stmt = db.prepare(`INSERT OR IGNORE INTO modules (name, description, icon, sort_order) VALUES (?, ?, ?, ?)`);
  const modules = [
    ['校园生活', '分享你的校园日常生活', '🏫', 1],
    ['学术交流', '探讨学术问题，分享学习经验', '📚', 2],
    ['情感天地', '倾诉情感，交流心得', '💭', 3],
    ['美食推荐', '校园及周边美食分享', '🍜', 4],
    ['旅游摄影', '记录旅途中的美好瞬间', '📷', 5],
    ['数码科技', '科技产品评测与讨论', '💻', 6],
    ['音乐影视', '音乐电影分享与交流', '🎬', 7],
    ['运动健身', '运动心得与健康生活', '⚽', 8],
    ['求助问答', '有问题？来这里提问吧', '❓', 9],
    ['二手交易', '闲置物品转让', '🔄', 10],
  ];

  modules.forEach(([name, desc, icon, order]) => {
    stmt.run(name, desc, icon, order);
  });
  stmt.finalize();

  // Create admin user if not exists
  const bcrypt = require('bcryptjs');
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, email, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?)`,
    ['admin', 'admin@campus.blog', adminHash, 'admin', '']);
});

module.exports = db;
