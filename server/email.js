// --小许同学--
const nodemailer = require('nodemailer');

let transporter;

try {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.qq.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    }
  });
} catch (err) {
  console.warn('Email transporter initialization failed:', err.message);
}

async function sendVerificationEmail(email, username, token) {
  if (!transporter) {
    console.warn('Email not configured. Verification token:', token);
    return true;
  }

  const verifyUrl = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@campus.blog',
    to: email,
    subject: '校园博客 - 邮箱验证',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4A90D9;">欢迎加入校园博客！</h2>
        <p>你好，${username}！</p>
        <p>请点击以下链接验证您的邮箱：</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4A90D9; color: white; text-decoration: none; border-radius: 5px;">验证邮箱</a>
        <p style="color: #999; font-size: 12px;">如果链接无效，请将以下网址复制到浏览器中：<br>${verifyUrl}</p>
        <p style="color: #999; font-size: 12px;">此链接在24小时内有效。</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return false;
  }
}

async function sendPasswordResetEmail(email, username, token) {
  if (!transporter) {
    console.warn('Email not configured. Reset token:', token);
    return true;
  }

  const resetUrl = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/auth/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@campus.blog',
    to: email,
    subject: '校园博客 - 密码重置',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4A90D9;">密码重置请求</h2>
        <p>你好，${username}！</p>
        <p>我们收到了您的密码重置请求。请点击以下链接重置密码：</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4A90D9; color: white; text-decoration: none; border-radius: 5px;">重置密码</a>
        <p style="color: #999; font-size: 12px;">如果链接无效，请将以下网址复制到浏览器中：<br>${resetUrl}</p>
        <p style="color: #999; font-size: 12px;">此链接在1小时内有效。</p>
        <p style="color: #999; font-size: 12px;">如果您没有请求重置密码，请忽略此邮件。</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Failed to send reset email:', err.message);
    return false;
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
