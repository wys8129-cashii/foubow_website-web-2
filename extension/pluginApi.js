// 浏览器插件后端对接模块
// 职责：① 拿用户填的 fob_ token 调后端 /api/auth/token 验证有效性
//       ② 验证通过后调后端 /api/plugin/screenshot 执行 Coze 截图工作流（SSE 流）
// 注意：本模块不接触 Coze Token，Coze 调用完全由后端代理。
(function (root) {
  'use strict';
  const CFG = root.PLUGIN_CONFIG || {};
  const apiBase = (CFG.apiBase || '').replace(/\/+$/, '');
  const verifyPath = CFG.verifyPath || '/api/auth/token';
  const screenshotPath = CFG.screenshotPath || '/api/plugin/screenshot';
  const timeout = CFG.timeout || 120000;

  // 清洗 token：移除误粘贴的 "Bearer " 前缀，避免后端重复拼接
  function cleanToken(raw) {
    return (raw || '').replace(/^Bearer\s+/i, '').trim();
  }

  // 步骤一：验证 token 是否有效（后端 authMiddleware 双重认证 fob_）
  // 返回后端 JSON；token 无效时抛错。
  async function verifyToken(rawToken) {
    const token = cleanToken(rawToken);
    const resp = await fetch(apiBase + verifyPath, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    // authMiddleware 对无效 token 返回 { code: 0, msg }（HTTP 200），需按 body 判定
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || (data && data.code === 0)) {
      throw new Error((data && data.msg) || `Token 验证失败（HTTP ${resp.status}）`);
    }
    return data;
  }

  // 步骤二：执行截图工作流，返回 fetch Response（body 为 SSE 流）
  async function runScreenshot({ rawToken, screenshot, user, web_url }) {
    const token = cleanToken(rawToken);
    const resp = await fetch(apiBase + screenshotPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ screenshot, user, web_url }),
      signal: AbortSignal.timeout(timeout)
    });
    if (!resp.ok) {
      let detail = '';
      try { detail = await resp.text(); } catch (e) { /* ignore */ }
      throw new Error(`截图请求失败（HTTP ${resp.status}）${detail ? '：' + detail : ''}`);
    }
    return resp; // 调用方按 data: 行解析 SSE
  }

  // 查询当前用户截图素材配额（用于打赏提醒，非功能限制）
  async function getQuota(rawToken) {
    const token = cleanToken(rawToken);
    const resp = await fetch(apiBase + (CFG.quotaPath || '/api/plugin/quota'), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(15000)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || (data && data.code === 0)) {
      throw new Error((data && data.msg) || `配额查询失败（HTTP ${resp.status}）`);
    }
    return data.data; // { count, limit, limitReached }
  }

  const api = { verifyToken, runScreenshot, getQuota, cleanToken, apiBase };
  root.PLUGIN_API = api;
  if (typeof self !== 'undefined') self.PLUGIN_API = api;
  if (typeof globalThis !== 'undefined') globalThis.PLUGIN_API = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
