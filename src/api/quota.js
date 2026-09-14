// 浏览器插件截图上传「素材数量统计」模块
// 基于 Supabase 表 plugin_screenshot_quota，按用户邮箱累计成功上传的素材数。
// 白名单用户（profiles.reward_status='whitelisted'）不受数量限制。
const { supabaseAdmin } = require('./supabase');

const QUOTA_LIMIT = 10;
const TABLE = 'plugin_screenshot_quota';

// 是否为白名单用户（profiles.reward_status = 'whitelisted'），白名单不受数量限制
async function isWhitelisted(email) {
  const safeEmail = (email || '').trim();
  if (!safeEmail || !supabaseAdmin) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('reward_status')
      .eq('email', safeEmail)
      .maybeSingle();
    if (error) {
      // 表/列不存在或未跑迁移：降级为非白名单（保守，仍按数量限制）
      console.warn('[quota] 白名单查询失败(降级非白名单):', error.message);
      return false;
    }
    return !!(data && data.reward_status === 'whitelisted');
  } catch (e) {
    console.warn('[quota] 白名单判断异常(降级非白名单):', e.message);
    return false;
  }
}

// 查询当前用户素材计数、是否达限、是否白名单
// 白名单用户 limitReached 恒为 false（不受 10 条限制）
async function getQuota(email) {
  const safeEmail = (email || '').trim();
  const fallback = { count: 0, limit: QUOTA_LIMIT, limitReached: false, whitelisted: false };
  if (!safeEmail || !supabaseAdmin) return fallback;
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('count')
      .eq('email', safeEmail)
      .maybeSingle();
    if (error) {
      console.warn('[quota] getQuota 查询失败(降级未达限):', error.message);
      return fallback;
    }
    const count = Number(data && data.count) || 0;
    const whitelisted = await isWhitelisted(safeEmail);
    return {
      count,
      limit: QUOTA_LIMIT,
      limitReached: !whitelisted && count >= QUOTA_LIMIT,
      whitelisted,
    };
  } catch (e) {
    console.warn('[quota] getQuota 异常(降级未达限):', e.message);
    return fallback;
  }
}

// 上传成功后计数 +1（低频场景用 read-modify-write，存在极小竞态；可接受）
async function incrementQuota(email) {
  const safeEmail = (email || '').trim();
  const fallback = { count: 0, limit: QUOTA_LIMIT, limitReached: false, whitelisted: false };
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
    const whitelisted = await isWhitelisted(safeEmail);
    return { count: next, limit: QUOTA_LIMIT, limitReached: !whitelisted && next >= QUOTA_LIMIT, whitelisted };
  } catch (e) {
    console.warn('[quota] incrementQuota 异常(降级未计数):', e.message);
    return fallback;
  }
}

module.exports = { getQuota, incrementQuota, QUOTA_LIMIT };
