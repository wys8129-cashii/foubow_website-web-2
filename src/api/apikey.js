const crypto = require('crypto');
const { supabaseAdmin } = require('./supabase');

// 生成 fob_ 前缀的 API Key：fob_ + 24 字节随机十六进制
function generateApiKey() {
  return `fob_${crypto.randomBytes(24).toString('hex')}`;
}

// 获取用户当前有效的 API Key；不存在则创建
async function getOrCreateUserApiKey(userId) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from('user_api_keys')
    .select('api_key')
    .eq('user_id', userId)
    .eq('revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[apikey] 查询失败:', error.message);
    throw new Error('查询 API Key 失败');
  }
  if (data && data.api_key) return data.api_key;

  const apiKey = generateApiKey();
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('user_api_keys')
    .insert({ user_id: userId, api_key: apiKey, name: 'default' })
    .select('api_key')
    .single();
  if (insErr) {
    console.error('[apikey] 创建失败:', insErr.message);
    throw new Error('创建 API Key 失败');
  }
  return inserted.api_key;
}

// 校验 API Key（供浏览器插件等第三方调用），返回 user_id 或 null
async function getUserByApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('fob_')) return null;
  const { data, error } = await supabaseAdmin
    .from('user_api_keys')
    .select('user_id, revoked')
    .eq('api_key', apiKey)
    .maybeSingle();
  if (error) {
    console.error('[apikey] 校验失败:', error.message);
    return null;
  }
  if (!data || data.revoked) return null;
  // 异步更新最后使用时间，不阻塞主流程
  supabaseAdmin
    .from('user_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key', apiKey)
    .then(() => {})
    .catch((e) => console.warn('[apikey] 更新 last_used_at 失败:', e.message));
  return data.user_id;
}

// 重置：吊销旧 Key，生成新 Key
async function regenerateUserApiKey(userId) {
  if (!userId) return null;
  const apiKey = generateApiKey();
  // 先吊销旧的
  await supabaseAdmin
    .from('user_api_keys')
    .update({ revoked: true })
    .eq('user_id', userId);
  const { data, error } = await supabaseAdmin
    .from('user_api_keys')
    .insert({ user_id: userId, api_key: apiKey, name: 'default' })
    .select('api_key')
    .single();
  if (error) {
    console.error('[apikey] 重置失败:', error.message);
    throw new Error('重置 API Key 失败');
  }
  return data.api_key;
}

module.exports = {
  generateApiKey,
  getOrCreateUserApiKey,
  getUserByApiKey,
  regenerateUserApiKey,
};
