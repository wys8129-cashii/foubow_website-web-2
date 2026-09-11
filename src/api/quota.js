// 浏览器插件截图上传「素材数量统计」模块
// 基于 Supabase 表 plugin_screenshot_quota，按用户邮箱累计成功上传的素材数。
// 达到上限(QUOTA_LIMIT)仅用于前端打赏提醒，不做功能限制（没打赏也能继续上传）。
const { supabaseAdmin } = require('./supabase');

const QUOTA_LIMIT = 10;
const TABLE = 'plugin_screenshot_quota';

// 查询当前用户素材计数与是否达限
async function getQuota(email) {
  const safeEmail = (email || '').trim();
  const fallback = { count: 0, limit: QUOTA_LIMIT, limitReached: false };
  if (!safeEmail || !supabaseAdmin) return fallback;
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('count')
      .eq('email', safeEmail)
      .maybeSingle();
    if (error) {
      // 表不存在 / 网络异常：降级为「未达限」，不阻断上传
      console.warn('[quota] getQuota 查询失败(降级未达限):', error.message);
      return fallback;
    }
    const count = Number(data && data.count) || 0;
    return { count, limit: QUOTA_LIMIT, limitReached: count >= QUOTA_LIMIT };
  } catch (e) {
    console.warn('[quota] getQuota 异常(降级未达限):', e.message);
    return fallback;
  }
}

// 上传成功后计数 +1（低频场景用 read-modify-write，存在极小竞态；业务仅用于提醒，可接受）
async function incrementQuota(email) {
  const safeEmail = (email || '').trim();
  const fallback = { count: 0, limit: QUOTA_LIMIT, limitReached: false };
  if (!safeEmail || !supabaseAdmin) return fallback;
  try {
    const { data: cur, error: selErr } = await supabaseAdmin
      .from(TABLE)
      .select('count')
      .eq('email', safeEmail)
      .maybeSingle();
    if (selErr) {
      console.warn('[quota] incrementQuota 读取失败(降级未计数):', selErr.message);
      return fallback;
    }
    const next = (Number(cur && cur.count) || 0) + 1;
    const { error: upsErr } = await supabaseAdmin
      .from(TABLE)
      .upsert(
        { email: safeEmail, count: next, updated_at: new Date().toISOString() },
        { onConflict: 'email' }
      );
    if (upsErr) {
      console.warn('[quota] incrementQuota 写入失败(降级未计数):', upsErr.message);
      return fallback;
    }
    return { count: next, limit: QUOTA_LIMIT, limitReached: next >= QUOTA_LIMIT };
  } catch (e) {
    console.warn('[quota] incrementQuota 异常(降级未计数):', e.message);
    return fallback;
  }
}

module.exports = { getQuota, incrementQuota, QUOTA_LIMIT };
