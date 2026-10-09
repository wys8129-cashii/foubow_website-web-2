const { createClient } = require('@supabase/supabase-js');
const { WebSocket } = require('ws');

// veFaaS 运行在 Node 20，新版 @supabase/supabase-js 的 realtime client 需要原生 WebSocket。
// Node 20 无原生 WebSocket，用 ws 包做全局 polyfill 即可让 client 正常初始化（本项目仅用 REST/auth，不依赖 realtime）。
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = WebSocket;
}

const _envSupabaseUrl = process.env.SUPABASE_URL;
const _envSupabaseKey = process.env.SUPABASE_ANON_KEY;
const _envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!_envSupabaseUrl || !_envSupabaseKey) {
  console.warn('[supabase] 未配置 SUPABASE_URL / SUPABASE_ANON_KEY：本地预览模式仅静态资源与前端 localStorage 功能可用，登录/素材等需后端的接口将不可用。');
}

// 兜底占位，避免 createClient 因缺少 URL 直接抛错导致进程崩溃（线上始终有真实 env）
const supabaseUrl = _envSupabaseUrl || 'http://localhost:54321';
const supabaseKey = _envSupabaseKey || 'local-dev-anon-key';
const supabaseServiceKey = _envServiceKey || 'local-dev-service-key';

// 公开客户端：用于 auth 校验（getUser），使用 anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// 管理端客户端：用于 user_api_keys 等需要绕过 RLS 的服务端操作。
// service_role 密钥仅存于后端环境变量，绝不下发前端/插件。
const supabaseAdmin = _envServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabase; // 未配置 service_role 时降级为 anon（注意：user_api_keys 开启 RLS 后将无法查询，生产务必配置）

module.exports = { supabase, supabaseAdmin };
