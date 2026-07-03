// --小许同学--
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware (must be before routes and rate limiters)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Rate limiting (after body parsing)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/notifications', require('./routes/notifications'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: '文件大小超过限制' });
  }

  res.status(500).json({ success: false, message: '服务器内部错误' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`  Campus Blog Server`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`Default admin account:`);
  console.log(`  Username: admin`);
  console.log(`  Password: admin123`);
  console.log(`========================================`);
});

module.exports = app;
