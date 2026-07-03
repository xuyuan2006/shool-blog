<!-- --小许同学-- -->
# 校园博客 - 服务器部署指南

> 开发者：小许同学 ｜ 源码免费使用 ｜ QQ：1045967674


##下载地址：
>通过网盘分享的文件：xuyuan.zip 链接: https://pan.baidu.com/s/1er7NOvM4UDEx-WA93g3Iiw?pwd=1111 提取码: 1111 

## 项目简介

校园博客是一个面向大学生的社交平台，包含三个组件：

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| **后端 API** | Node.js + Express + SQLite | RESTful 接口，JWT 认证，邮件通知 |
| **桌面客户端** | Electron + 原生 HTML/CSS/JS | Windows 桌面应用，自带安装包 |
| **移动端** | Android (规划中) | 暂未实现 |

**默认管理员账号**
- 用户名：`admin`
- 邮箱：`admin@campus.blog`
- 密码：`admin123`

---

## 📋 前置条件

### 服务器要求

| 配置项 | 最低配置 | 推荐配置 |
|--------|----------|----------|
| 操作系统 | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| CPU | 1 核 | 2 核 |
| 内存 | 512 MB | 2 GB |
| 硬盘 | 5 GB | 20 GB（含文件上传） |

### 需要准备

1. **服务器公网 IP 地址**
2. **域名（可选）** — 后续可配置 Nginx 反向代理
3. **QQ 邮箱（可选）** — 用于注册验证邮件

---

## 🚀 一键部署

### 第 1 步：SSH 连接服务器

```bash
ssh root@你的服务器IP
```

### 第 2 步：安装 Node.js 18（LTS）

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证
node -v   # 应显示 v18.x.x
npm -v    # 应显示 9.x.x 或更高
```

### 第 3 步：安装 PM2 进程管理器

```bash
npm install -g pm2
```

PM2 保证服务持续运行，服务器重启后自动拉起。

### 第 4 步：上传服务端代码

```bash
# 在服务器上创建项目目录
mkdir -p /opt/campus-blog
cd /opt/campus-blog
```

**方式一：从本地 scp 上传（推荐）**

在 Windows 电脑上打开 PowerShell：

```powershell
scp -r "文件地址\server\*" root@你的服务器IP:/opt/campus-blog/
这里注意看.env有没有上传成功,如果没有请手动上传，或者直接创建，下面有配置方式
```

> 如果没有 scp，可使用 WinSCP、FileZilla 等 SFTP 工具上传 `server/` 目录下所有文件。

**方式二：直接在服务器上创建**

```bash
# 逐个创建文件（适合文件较少的情况）
# 参考下方各文件的完整内容
```

### 第 5 步：安装依赖

```bash
cd /opt/campus-blog
npm install
```

将安装以下依赖：express、sqlite3、bcryptjs、jsonwebtoken、multer、nodemailer、cors、helmet、express-rate-limit、cookie-parser、dotenv。

### 第 6 步：配置环境变量

```bash
cd /opt/campus-blog
cp .env.example .env
nano .env
```

编辑 `.env` 文件：

```ini
# 服务端口
PORT=3000

# JWT 密钥（务必替换为强随机字符串！）
JWT_SECRET=请替换为一串随机密码

# Token 有效期
JWT_EXPIRES_IN=7d

# 运行环境
NODE_ENV=production

# 服务器地址（填写你的公网 IP）
SERVER_URL=http://你的服务器IP:3000

# 文件上传限制（默认 5MB）
MAX_FILE_SIZE=5242880

# 允许的图片格式
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp

# --- 邮箱配置（可选，不配也可正常注册登录）---
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=587
EMAIL_USER=你的QQ邮箱@qq.com
EMAIL_PASS=你的SMTP授权码
EMAIL_FROM=校园博客 <你的QQ邮箱@qq.com>
```

> **QQ 邮箱 SMTP 开启方法：**
> 1. 登录 QQ 邮箱 → 设置 → 账户
> 2. 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV 服务」
> 3. 开启「SMTP 服务」并按提示获取授权码

### 第 7 步：启动服务

```bash
# 启动
pm2 start server.js --name campus-blog

# 查看状态
pm2 status

# 设置开机自启（终端会输出一行命令，照做即可）
pm2 startup
# 执行输出的那行命令

# 保存当前进程列表
pm2 save
```

### 第 8 步：开放端口

#### 系统防火墙

```bash
# 开放 SSH 和博客端口
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable

# 确认
ufw status
```

#### 云服务器安全组

在阿里云 / 腾讯云 / 华为云控制台添加入站规则：

| 协议 | 端口 | 来源 | 描述 |
|------|------|------|------|
| TCP | 3000 | 0.0.0.0/0 | 校园博客 |

### 第 9 步：验证部署

```bash
# 本地测试
curl http://localhost:3000/api/health
```

返回以下即表示成功：

```json
{"success": true, "message": "Server is running", "timestamp": "..."}
```

浏览器访问 `http://你的服务器IP:3000/api/health`，看到相同结果即部署成功。

---

## 💻 桌面客户端打包与分发

### 本地运行（开发模式）

```bash
cd electron-app
npm install
npm start
```

### 打包 Windows 安装包

```bash
cd electron-app
npm run build
```

生成的安装包位于 `electron-app/dist/校园博客 Setup 1.0.0.exe`。

### 配置后端地址

桌面客户端的 API 地址硬编码在 `electron-app/index.html`（大概在1105行） 中，搜索 `API_BASE` 变量修改：

```javascript
const API_BASE = 'http://你的服务器IP:3000/api';
```

---

## 📁 项目文件结构

```
.
├── server/                      # 后端 API
│   ├── server.js                # Express 入口
│   ├── db.js                    # SQLite 数据库 + 初始数据
│   ├── email.js                 # 邮件发送服务
│   ├── .env.example             # 环境变量模板
│   ├── middleware/
│   │   ├── auth.js              # JWT 认证中间件
│   │   └── upload.js            # 文件上传中间件
│   ├── routes/
│   │   ├── auth.js              # 注册/登录/个人资料
│   │   ├── posts.js             # 帖子 CRUD + 点赞
│   │   ├── comments.js          # 评论 + 回复
│   │   ├── modules.js           # 分类管理（管理员）
│   │   └── notifications.js     # 消息通知
│   └── uploads/                 # 上传文件存储
├── electron-app/                # Windows 桌面客户端
│   ├── electron-main.js         # Electron 主进程
│   ├── index.html               # 前端页面（单文件）
│   ├── package.json
│   └── dist/                    # 打包输出
├── .env                         # 根目录环境变量
└── DEPLOYMENT.md                # 本文件
```

---

## 🔧 日常运维

### PM2 管理

```bash
pm2 status                  # 查看运行状态
pm2 logs campus-blog        # 查看日志
pm2 monit                   # 实时监控（CPU/内存）
pm2 restart campus-blog     # 重启服务
pm2 stop campus-blog        # 停止服务
pm2 delete campus-blog      # 删除进程
```

### 数据库管理

SQLite 数据库文件位于 `/opt/campus-blog/database.db`。

```bash
# 查看数据库大小
ls -lh /opt/campus-blog/database.db

# 安装 sqlite3 命令行工具
apt-get install -y sqlite3

# 查询用户列表
sqlite3 /opt/campus-blog/database.db "SELECT username, email, role FROM users;"

# 查询帖子统计
sqlite3 /opt/campus-blog/database.db "SELECT COUNT(*) FROM posts WHERE is_active=1;"
```

### 备份与恢复

```bash
# 全量备份
tar -czf /opt/blog-backup-$(date +%Y%m%d).tar.gz /opt/campus-blog

# 仅备份数据库
cp /opt/campus-blog/database.db /opt/campus-blog/database.db.backup.$(date +%Y%m%d)

# 从备份恢复
cp /opt/campus-blog/database.db.backup.20260702 /opt/campus-blog/database.db
pm2 restart campus-blog
```

### 更新部署

```bash
cd /opt/campus-blog
# 通过 Git 拉取最新代码
git pull
# 或手动替换文件后：
npm install
pm2 restart campus-blog
```

---

## 🌐 可选：Nginx 反向代理 + HTTPS

如需通过域名访问并启用 HTTPS：

```bash
# 安装 Nginx
apt-get install -y nginx

# 创建配置文件
nano /etc/nginx/sites-available/campus-blog
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用配置
ln -s /etc/nginx/sites-available/campus-blog /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 安装 Certbot 获取免费 SSL 证书
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## ❓ 常见问题

### 浏览器打不开博客页面？

1. 检查服务状态：`pm2 status`（确保 running）
2. 检查防火墙：`ufw status`（确认 3000 端口已开放）
3. 检查安全组：登录云控制台确认入站规则
4. 查看日志：`pm2 logs campus-blog --lines 50`

### 注册后收不到验证邮件？

- 检查 `.env` 中 `EMAIL_HOST`、`EMAIL_USER`、`EMAIL_PASS` 是否正确
- QQ 邮箱需开启 SMTP 服务并填写授权码（非登录密码）
- **不配置邮箱不影响使用**，注册后默认直接登录

### 桌面客户端连不上服务器？

- 确认 `electron-app/index.html` 中的 `API_BASE` 指向正确的服务器 IP
- 确保服务器 3000 端口对公网可达

### 如何修改默认管理员密码？

```bash
cd /opt/campus-blog
node -e "
const { updateUserPassword } = require('./db');
updateUserPassword('admin', '新密码').then(() => console.log('密码已修改'));
"
```

或直接操作数据库：

```bash
sqlite3 database.db "UPDATE users SET password_hash='新的hash值' WHERE username='admin';"
```

### 数据库在哪？怎么迁移？

SQLite 数据库文件位于 `server/database.db`，迁移只需拷贝该文件到新服务器即可。

---

## ⚠️ 安全建议

1. **修改默认密码** — 部署后立即修改管理员密码
2. **更换 JWT_SECRET** — 使用强随机字符串，不要用 `changeme123`
3. **启用 HTTPS** — 生产环境务必配置 SSL 证书
4. **定期备份** — 至少每周备份一次数据库
5. **限制上传大小** — 根据需求调整 `MAX_FILE_SIZE`
