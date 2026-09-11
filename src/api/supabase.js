const { createClient } = require('@supabase/supabase-js');
const { WebSocket } = require('ws');

// veFaaS 运行在 Node 20，新版 @supabase/supabase-js 的 realtime client 需要原生 WebSocket。
// Node 20 无原生 WebSocket，用 ws 包做全局 polyfill 即可让 client 正常初始化（本项目仅用 REST/auth，不依赖 realtime）。
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = WebSocket;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量');
}

// 公开客户端：用于 auth 校验（getUser），使用 anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// 管理端客户端：用于 user_api_keys 等需要绕过 RLS 的服务端操作。
// service_role 密钥仅存于后端环境变量，绝不下发前端/插件。
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabase; // 未配置 service_role 时降级为 anon（注意：user_api_keys 开启 RLS 后将无法查询，生产务必配置）

module.exports = { supabase, supabaseAdmin };
