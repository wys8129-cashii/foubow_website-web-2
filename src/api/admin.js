// =====================================================================
// 管理员模块（方案 A：Supabase 角色鉴权）
// ---------------------------------------------------------------------
// 管理员身份：profiles.is_admin = true（由 SQL 迁移 + 种子设置）
// adminMiddleware 复用 authMiddleware 注入的 req.userId，查 profile.is_admin
// =====================================================================
const { supabase, supabaseAdmin } = require('./supabase');

// 管理员中间件：必须在 authMiddleware 之后调用
async function adminMiddleware(req, res, next) {
  const uid = req.userId;
  if (!uid) {
    return res.json({ code: 0, msg: '管理员未登录' });
  }
  try {
    // 用 service_role 查（anon 受 RLS 限制查不了别人，但查自己可以；用 admin 更稳）
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', uid)
      .single();
    if (error) {
      console.error('[admin] 查 is_admin 失败:', error.message);
      return res.json({ code: 0, msg: '权限校验失败' });
    }
    if (!data || !data.is_admin) {
      return res.json({ code: 0, msg: '无管理员权限' });
    }
    req.isAdmin = true;
    next();
  } catch (e) {
    console.error('[admin] 鉴权异常:', e.message);
    res.json({ code: 0, msg: '权限校验异常' });
  }
}

// 待审核列表：rewards.status='paid' 且对应 profile 未加白名单
async function listPending({ page = 1, pageSize = 50 } = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabaseAdmin
    .from('rewards')
    .select('id, user_id, openid, order_id, amount, item_name, status, paid_at, created_at, screenshot_note')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error('查询待审核失败: ' + error.message);

  // 过滤：profile.reward_status != 'whitelisted' 才视为待审核
  const result = [];
  for (const r of (data || [])) {
    let rw = null;
    if (r.user_id) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('nickname, email, reward_status, whitelisted_at')
        .eq('id', r.user_id)
        .single();
      rw = p;
    }
    if (rw && rw.reward_status === 'whitelisted') continue; // 已加白，跳过
    result.push({
      ...r,
      user: rw ? { nickname: rw.nickname, email: rw.email, reward_status: rw.reward_status } : { openid: r.openid },
    });
  }
  return result;
}

// 添加白名单：按 user_id 或 email 定位 profile
async function addWhitelist({ user_id, email, note, adminUid }) {
  let targetId = user_id;
  if (!targetId && email) {
    const { data: u } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();
    if (!u) throw new Error('未找到该邮箱对应的用户');
    targetId = u.id;
  }
  if (!targetId) throw new Error('缺少 user_id 或 email');

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      reward_status: 'whitelisted',
      whitelisted_by: adminUid,
      whitelisted_at: new Date().toISOString(),
      whitelist_note: note || null,
    })
    .eq('id', targetId);
  if (error) throw new Error('添加白名单失败: ' + error.message);
  return { ok: true, user_id: targetId };
}

// 移除白名单
async function removeWhitelist({ user_id, email }) {
  let targetId = user_id;
  if (!targetId && email) {
    const { data: u } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();
    if (!u) throw new Error('未找到该邮箱对应的用户');
    targetId = u.id;
  }
  if (!targetId) throw new Error('缺少 user_id 或 email');

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      reward_status: 'paid',   // 回退到已打赏待审核
      whitelisted_by: null,
      whitelisted_at: null,
      whitelist_note: null,
    })
    .eq('id', targetId);
  if (error) throw new Error('移除白名单失败: ' + error.message);
  return { ok: true, user_id: targetId };
}

module.exports = {
  adminMiddleware,
  listPending,
  addWhitelist,
  removeWhitelist,
};
