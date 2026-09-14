// =====================================================================
// 打赏（虚拟支付：个人）模块
// ---------------------------------------------------------------------
// 流程（人工审核为主）：
//   1) 小程序 wx.login 拿 code → 调 /api/pay/order { code, amount, item_id }
//   2) 后端用 code 换 openid + 生成订单号 + 用虚拟支付 AppKey 签名
//   3) 小程序 wx.requestVirtualPayment(签名参数) 拉起支付
//   4) 支付成功 → 微信 notify 通知 /api/pay/notify（或前端 report 兜底）
//      → rewards.status = 'paid'，profiles.reward_status = 'paid'
//   5) 用户加管理员微信发截图；管理员在 /admin 核对后「添加白名单」
//
// 注意：本文件为骨架实现，所有微信密钥来自环境变量（.env），未硬编码。
// 虚拟支付签名字段以微信开放文档「虚拟支付：个人」最新版为准，联调时需核对。
// =====================================================================
const { supabaseAdmin } = require('./supabase');
const crypto = require('crypto');

// 微信小程序 + 虚拟支付配置（在 .env 配置）
const WX = {
  appid:     process.env.WX_MINI_APPID,
  secret:    process.env.WX_MINI_SECRET,        // wx.login code2session 用
  offerId:   process.env.WX_VP_OFFER_ID,        // 虚拟支付 OfferID
  appKey:    process.env.WX_VP_APPKEY,          // 虚拟支付现网 AppKey
  env:       process.env.WX_VP_ENV || 'prod',   // sandbox（沙箱）/ prod（现网）
  mchId:     process.env.WX_VP_MCH_ID,          // 商户号（如走普通商户号）
};

// 打赏档位（可在 .env 覆盖，或后端从微信道具管理同步；这里给默认）
const REWARD_TIERS = (process.env.REWARD_TIERS || '6.6:小额鼓励,16.6:暖心支持,66:深度共建')
  .split(',')
  .map(s => {
    const [amount, name] = s.split(':');
    return { amount: parseFloat(amount), name: name || `¥${amount}` };
  })
  .filter(t => !isNaN(t.amount));

// ---- 工具：生成订单号 ----
function genOrderId() {
  const ts = Date.now().toString();
  const rand = crypto.randomBytes(6).toString('hex');
  return `RW${ts}${rand}`;
}

// ---- 工具：微信 code2session 换 openid ----
async function code2session(code) {
  if (!WX.appid || !WX.secret) {
    throw new Error('缺少 WX_MINI_APPID / WX_MINI_SECRET 环境变量');
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX.appid}&secret=${WX.secret}&js_code=${code}&grant_type=authorization_code`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.errcode) {
    throw new Error(`wx code2session 失败: ${data.errcode} ${data.errmsg}`);
  }
  return data.openid;
}

// ---- 工具：虚拟支付签名（V2 简化版，以官方文档为准）----
// 真实字段集合参考微信「虚拟支付：个人」下单接口；以下为占位骨架。
function signVirtualPayment(params) {
  if (!WX.appKey) throw new Error('缺少 WX_VP_APPKEY 环境变量');
  const keys = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  const raw = keys.map(k => `${k}=${params[k]}`).join('&') + `&app_key=${WX.appKey}`;
  return crypto.createHash('md5').update(raw, 'utf-8').digest('hex');
}

// =====================================================================
// 创建打赏订单（小程序调用）
// =====================================================================
async function createRewardOrder({ code, amount, item_id, user_id }) {
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('打赏金额不合法');
  }
  // 校验档位（防止前端篡改金额）
  const tier = REWARD_TIERS.find(t => Math.abs(t.amount - amount) < 0.001);
  if (!tier) {
    throw new Error('打赏档位不存在，金额被拒绝');
  }

  // 换 openid（未登录用户也需 openid 用于核对）
  let openid = null;
  try {
    openid = await code2session(code);
  } catch (e) {
    // 沙箱/联调阶段若未配 secret，可降级为不绑定 openid（仅人工审核较弱）
    console.warn('[reward] code2session 失败，订单不绑定 openid:', e.message);
  }

  const orderId = genOrderId();

  // 写 rewards（pending）
  const { error } = await supabaseAdmin
    .from('rewards')
    .insert({
      user_id: user_id || null,
      openid,
      order_id: orderId,
      amount: tier.amount,
      item_id: item_id || null,
      item_name: tier.name,
      status: 'pending',
    });
  if (error) throw new Error('创建订单失败: ' + error.message);

  // 生成虚拟支付签名参数（骨架，联调时按微信文档补齐 session_id / ts / mp_appid 等）
  const ts = Math.floor(Date.now() / 1000);
  const signParams = {
    token: orderId,
    offerId: WX.offerId,
    openid,
    ts,
    sig_method: 'MD5',
    mp_appid: WX.appid,
    env: WX.env,
  };
  const signature = signVirtualPayment(signParams);

  return {
    order_id: orderId,
    amount: tier.amount,
    item_name: tier.name,
    pay_params: { ...signParams, signature },
  };
}

// =====================================================================
// 支付成功通知（微信异步 notify / 前端 report 兜底共用）
// 幂等：已 paid 则直接返回。
// =====================================================================
async function markRewardPaid(orderId, { screenshot_note } = {}) {
  if (!orderId) throw new Error('缺少 order_id');

  // 先查是否已处理
  const { data: exist } = await supabaseAdmin
    .from('rewards')
    .select('id, status, user_id')
    .eq('order_id', orderId)
    .single();
  if (!exist) throw new Error('订单不存在');
  if (exist.status === 'paid') return { already: true };

  // 更新 rewards + profiles
  const { error: e1 } = await supabaseAdmin
    .from('rewards')
    .update({ status: 'paid', paid_at: new Date().toISOString(), screenshot_note: screenshot_note || null })
    .eq('order_id', orderId);
  if (e1) throw new Error('更新订单失败: ' + e1.message);

  if (exist.user_id) {
    const { error: e2 } = await supabaseAdmin
      .from('profiles')
      .update({ reward_status: 'paid' })
      .eq('id', exist.user_id);
    if (e2) console.warn('[reward] 更新 profile.reward_status 失败:', e2.message);
  }
  return { ok: true };
}

// =====================================================================
// 查询某用户自己的打赏状态（H5/小程序展示用）
// =====================================================================
async function getMyRewardStatus(userId) {
  if (!userId) return { reward_status: 'none' };
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('reward_status, whitelisted_at, whitelist_note')
    .eq('id', userId)
    .single();
  return data || { reward_status: 'none' };
}

module.exports = {
  REWARD_TIERS,
  createRewardOrder,
  markRewardPaid,
  getMyRewardStatus,
};
