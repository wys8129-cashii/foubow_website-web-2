// user-token.js —— 登录后拉取并展示用户 API Token（fob_xxx）
// 用途：供浏览器插件 / 第三方调用后端 API。点击头像打开弹窗，可复制或重置 Token。
(function () {
  const STORE_KEY = 'userApiKey';
  const POPOVER_ID = 'api-token-popover';

  function getApiKey() { return localStorage.getItem(STORE_KEY); }

  // 拉取当前用户的 API Key（优先缓存，否则请求后端）
  async function loadApiKey() {
    if (getApiKey()) return getApiKey();
    try {
      const res = await fetchWithTimeout('/api/auth/token', { method: 'GET' });
      const r = await res.json();
      if (r.code === 1 && r.data && r.data.api_key) {
        localStorage.setItem(STORE_KEY, r.data.api_key);
        return r.data.api_key;
      }
    } catch (e) { console.error('[token] 获取失败', e); }
    return null;
  }

  function ensurePopover() {
    let el = document.getElementById(POPOVER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = POPOVER_ID;
    el.style.cssText = 'position:fixed;z-index:9999;width:320px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.12);padding:16px;display:none;font-family:PingFang SC,Microsoft YaHei,sans-serif;';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:14px;color:#1A1A1A">我的 API Token</strong>
        <button id="at-close" style="border:none;background:none;cursor:pointer;color:#9CA3AF;font-size:20px;line-height:1">&times;</button>
      </div>
      <p style="font-size:12px;color:#6B7280;margin:0 0 10px;line-height:1.5">用于浏览器插件等第三方调用后端，请妥善保管，勿泄露。</p>
      <div style="display:flex;gap:6px;align-items:stretch;background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px">
        <code id="at-token" style="flex:1;font-size:12px;word-break:break-all;color:#1A1A1A;font-family:monospace;line-height:1.4">加载中...</code>
        <button id="at-copy" style="border:none;background:#1A1A1A;color:#fff;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;white-space:nowrap;align-self:center">复制</button>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px">
        <button id="at-regen" style="border:1px solid #E5E7EB;background:#fff;border-radius:6px;padding:3px 9px;font-size:11px;color:#9CA3AF;cursor:pointer">重置 Token</button>
      </div>
      <button id="at-logout" style="margin-top:6px;width:100%;border:none;background:none;padding:8px;font-size:12px;color:#EF4444;cursor:pointer">退出登录</button>
    `;
    document.body.appendChild(el);
    document.getElementById('at-close').onclick = hidePopover;
    document.getElementById('at-copy').onclick = function () {
      const t = getApiKey(); if (!t) return;
      navigator.clipboard.writeText(t).then(function () {
        const b = document.getElementById('at-copy'); b.textContent = '已复制'; setTimeout(function () { b.textContent = '复制'; }, 1500);
      }).catch(function () { alert('复制失败，请手动选择复制'); });
    };
    document.getElementById('at-regen').onclick = async function () {
      if (!confirm('确认重置？旧 Token 将立即失效，使用旧 Token 的插件需重新配置。')) return;
      const btn = document.getElementById('at-regen'); btn.disabled = true; btn.textContent = '重置中...';
      try {
        const res = await fetchWithTimeout('/api/auth/token/regenerate', { method: 'POST' });
        const r = await res.json();
        if (r.code === 1 && r.data && r.data.api_key) {
          localStorage.setItem(STORE_KEY, r.data.api_key);
          document.getElementById('at-token').textContent = r.data.api_key;
          btn.textContent = '已重置';
        } else { btn.textContent = '重置失败'; }
      } catch (e) { btn.textContent = '重置失败'; }
      setTimeout(function () { btn.textContent = '重置 Token'; }, 1800);
    };
    document.getElementById('at-logout').onclick = function () {
      localStorage.clear(); window.location.href = '/login.html';
    };
    return el;
  }

  function renderToken() {
    const t = getApiKey() || '（未获取到，请刷新页面）';
    const el = document.getElementById('at-token');
    if (el) el.textContent = t;
  }

  function showPopover(rect) {
    const pop = ensurePopover();
    renderToken();
    pop.style.display = 'block';
    let top = rect.bottom + 8;
    let left = rect.right - 320;
    if (left < 8) left = 8;
    if (top + 260 > window.innerHeight) top = Math.max(8, rect.top - 268);
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }
  function hidePopover() { const p = document.getElementById(POPOVER_ID); if (p) p.style.display = 'none'; }

  async function init() {
    if (localStorage.getItem('isLogin') !== 'true') return;
    await loadApiKey();

    // index.html：在 #auth-buttons 注入头像
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) {
      const nickname = localStorage.getItem('userNickname') || localStorage.getItem('userEmail') || '用户';
      const initial = (nickname.charAt(0) || 'U').toUpperCase();
      const avatar = document.createElement('button');
      avatar.id = 'nav-avatar';
      avatar.textContent = initial;
      avatar.style.cssText = 'width:36px;height:36px;border-radius:50%;background:#06B6D4;color:#fff;border:none;cursor:pointer;font-weight:600;font-size:14px;';
      avatar.title = '点击查看 API Token';
      avatar.onclick = function (e) { e.stopPropagation(); showPopover(avatar.getBoundingClientRect()); };
      authButtons.appendChild(avatar);
    }

    // material.html：为 #header-avatar 绑定点击
    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar) {
      headerAvatar.style.cursor = 'pointer';
      headerAvatar.title = '点击查看 API Token';
      headerAvatar.onclick = function (e) { e.stopPropagation(); showPopover(headerAvatar.getBoundingClientRect()); };
    }

    // 点击空白处关闭
    document.addEventListener('click', function (e) {
      const pop = document.getElementById(POPOVER_ID);
      if (pop && pop.style.display === 'block' && !pop.contains(e.target) && e.target.id !== 'nav-avatar' && e.target.id !== 'header-avatar') {
        hidePopover();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
