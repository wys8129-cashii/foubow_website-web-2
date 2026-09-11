// 邮件发送模块：通用 SMTP（nodemailer）
// 凭据走环境变量（SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM），不入库。
// 未配置 SMTP 时进入 dry-run（仅打日志，不发真实邮件），便于本地验证逻辑。

const nodemailer = require('nodemailer');

let transporterCache = null;

function getTransporter() {
  if (transporterCache) return transporterCache;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn('[mailer] SMTP 未配置，进入 dry-run（仅打印日志，不真实发送）');
    return null;
  }
  transporterCache = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporterCache;
}

async function sendNotificationEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log('[mailer][dry-run] 收件人:', to, '| 主题:', subject, '| HTML长度:', (html || '').length);
    return { dryRun: true, to, subject };
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await t.sendMail({
    from,
    to,
    subject,
    text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
    html,
  });
  console.log('[mailer] 已发送 to=', to, 'messageId=', info.messageId);
  return info;
}

module.exports = { sendNotificationEmail };
