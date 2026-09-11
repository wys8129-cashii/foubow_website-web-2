// 合集通知规则：保存/查询/删除 + 定时扫描发邮件
// 规则存 Supabase collection_notify_rules，所有访问走 supabaseAdmin（service_role 绕过 RLS）。
// 定时扫描由 veFaaS Timer 触发器调用 /api/cron/notify 触发：到点（notify_time）按星期几 → 发邮件。
// 不依赖 Coze：提醒以「时间 + 星期」触发，素材数阈值(threshold_count)为预留字段，当前未启用。

const { supabaseAdmin } = require('./supabase');
const { sendNotificationEmail } = require('./mailer');

const TABLE = 'collection_notify_rules';
const WD_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

// 保存/更新规则（每用户每合集一条，upsert）
async function saveNotifyRule({ userEmail, topic, mode, notifyTime, weekdays, thresholdCount, enabled }) {
  const row = {
    user_email: userEmail,
    topic,
    mode: mode || 'schedule',
    notify_time: notifyTime,
    weekdays: Array.isArray(weekdays) ? weekdays : [0, 1, 2, 3, 4, 5, 6],
    threshold_count: (typeof thresholdCount === 'number' && thresholdCount > 0) ? thresholdCount : null,
    enabled: enabled !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(row, { onConflict: 'user_email,topic' })
    .select()
    .single();
  if (error) throw new Error('保存通知规则失败: ' + error.message);
  return data;
}

// 查询单条规则
async function getNotifyRule({ userEmail, topic }) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('user_email', userEmail)
    .eq('topic', topic)
    .maybeSingle();
  if (error) throw new Error('查询通知规则失败: ' + error.message);
  return data;
}

// 删除规则（按 用户+合集）
async function deleteNotifyRule({ userEmail, topic }) {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq('user_email', userEmail)
    .eq('topic', topic);
  if (error) throw new Error('删除通知规则失败: ' + error.message);
  return true;
}

// 拼接收件人星期展示
function wdText(weekdays) {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return '每天';
  const set = weekdays.slice().sort((a, b) => a - b);
  return set.map((d) => WD_LABELS[d] || '').join('、') + '（周' + (set.length === 7 ? '每' : '') + '）';
}

// 邮件 HTML
function notifyHtml(topic, mode, notifyTime, weekdays, isTest) {
  const when = mode === 'weekly'
    ? `每周一 ${notifyTime}`
    : `${wdText(weekdays)} ${notifyTime}`;
  const testTag = isTest ? '<p style="color:#DC2626;font-size:12px">（这是一封测试邮件）</p>' : '';
  return `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
    <h2 style="color:#1A1A1A;margin:0 0 12px">合集「${topic}」的提醒</h2>
    <p style="color:#4B5563;line-height:1.6">你设置了合集「${topic}」的定时提醒：<b>${when}</b>。</p>
    <p style="color:#4B5563;line-height:1.6">打开 Foubow 看看这段时间里又积累了哪些值得回味的素材吧。</p>
    ${testTag}
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px">此邮件由 Foubow 自动发送 · 可在合集页「提醒」中管理</p>
  </div>`;
}

// 发测试邮件（立即发送，不写 last_sent_date）
async function sendTestEmail({ to, topic, mode, notifyTime, weekdays }) {
  return sendNotificationEmail({
    to,
    subject: `Foubow 提醒测试：合集「${topic}」`,
    html: notifyHtml(topic, mode || 'schedule', notifyTime || '09:00', weekdays, true),
  });
}

// 定时扫描：当前 HH:MM 匹配 + 今天未发过 + 星期几匹配 → 发邮件
async function runNotifyScan() {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const dow = now.getDay(); // 0=周日 .. 6=周六
  console.log('[notify] 扫描开始 当前时间', hhmm, '星期', dow, '日期', today);

  const { data: rules, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('enabled', true)
    .eq('notify_time', hhmm);
  if (error) throw new Error('扫描规则失败: ' + error.message);
  if (!rules || rules.length === 0) {
    console.log('[notify] 当前时刻无匹配规则');
    return { scanned: 0, sent: 0 };
  }

  let sent = 0;
  for (const rule of rules) {
    if (rule.last_sent_date === today) {
      console.log('[notify] 规则', rule.id, '今天已发送，跳过');
      continue;
    }
    // 按时间点模式需要匹配星期几；每周模式固定在周一触发（weekdays 默认含周一即可）
    if (rule.mode === 'schedule') {
      const wds = Array.isArray(rule.weekdays) ? rule.weekdays : [];
      if (!wds.includes(dow)) {
        continue;
      }
    }
    try {
      await sendNotificationEmail({
        to: rule.user_email,
        subject: `Foubow 提醒：合集「${rule.topic}」该看看啦`,
        html: notifyHtml(rule.topic, rule.mode, rule.notify_time, rule.weekdays, false),
      });
      await supabaseAdmin
        .from(TABLE)
        .update({ last_sent_date: today, updated_at: new Date().toISOString() })
        .eq('id', rule.id);
      sent++;
      console.log('[notify] 已发送通知 user=', rule.user_email, 'topic=', rule.topic);
    } catch (e) {
      console.error('[notify] 发送邮件失败 topic=', rule.topic, 'err=', e.message);
    }
  }
  return { scanned: rules.length, sent };
}

module.exports = { saveNotifyRule, getNotifyRule, deleteNotifyRule, sendTestEmail, runNotifyScan };
