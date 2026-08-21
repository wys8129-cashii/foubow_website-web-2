const { createClient } = require('@supabase/supabase-js');
const { WebSocket } = require('ws');

// veFaaS 运行在 Node 20，新版 @supabase/supabase-js 的 realtime client 需要原生 WebSocket。
// Node 20 无原生 WebSocket，用 ws 包做全局 polyfill 即可让 client 正常初始化（本项目仅用 REST/auth，不依赖 realtime）。
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = WebSocket;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
