// ======================
// API 基础地址（前后端分离部署支持）
// ======================
// 由 js/config.js 提供 window.__API_BASE__：
//   留空     → 同源部署（本地 / 单机 ECS）
//   完整 URL → 分离部署（前端 IGA Pages + 后端 veFaaS）
const API_BASE = (window.__API_BASE__ || '').replace(/\/+$/, '');

// 把 /api/* 相对路径改写为后端绝对地址（API_BASE 为空时原样返回）
function resolveApiUrl(url) {
  if (!API_BASE || typeof url !== 'string') return url;
  return url.startsWith('/api/') ? API_BASE + url : url;
}

// 带超时保护的 fetch 封装（全局），避免后端无响应时浏览器无限转圈
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await window.fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ======================
// 全局加载提示（顶部小胶囊）
// ======================
function showLoading(msg) {
  msg = msg || '处理中...';
  let bar = document.getElementById('loading-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'loading-bar';
    bar.innerHTML = `
      <style>
        @keyframes loading-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes loading-fade { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        #loading-bar {
          position: fixed; top: 16px; left: 50%; transform: translate(-50%, -4px); z-index: 9999;
          display: flex; align-items: center; gap: 8px; padding: 8px 18px;
          background: #fff; color: #6b7280; font-size: 13px;
          border-radius: 20px; border: 1px solid #e5e7eb;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease;
        }
        #loading-bar.show { opacity: 1; transform: translate(-50%, 0); animation: loading-fade 0.2s ease; }
        #loading-bar .material-symbols-outlined {
          font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal;
          font-size: 16px; color: #9ca3af; animation: loading-spin 0.8s linear infinite;
        }
      </style>
      <span class="material-symbols-outlined">progress_activity</span>
      <span id="loading-text"></span>`;
    document.body.appendChild(bar);
  }
  document.getElementById('loading-text').textContent = msg;
  bar.classList.add('show');
}

function hideLoading() {
  const bar = document.getElementById('loading-bar');
  if (bar) bar.classList.remove('show');
}

// ======================
// Token 自动刷新（保持 30 天登录态）
// ======================
let _refreshing = null;

async function ensureValidToken() {
  const token = localStorage.getItem('authToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const expiry = parseInt(localStorage.getItem('tokenExpiry') || '0');

  // Token 有效且剩余超过 5 分钟 → 直接返回
  if (token && Date.now() < expiry - 5 * 60 * 1000) {
    return token;
  }

  // 没有 refresh_token → 无法刷新
  if (!refreshToken) {
    return null;
  }

  // 防止并发刷新（多个请求同时触发刷新时，只发一次）
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    try {
      const res = await _originalFetch(resolveApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const result = await res.json();
      if (result.code === 1) {
        localStorage.setItem('authToken', result.data.token);
        localStorage.setItem('refreshToken', result.data.refresh_token);
        localStorage.setItem('tokenExpiry', Date.now() + 55 * 60 * 1000);
        return result.data.token;
      }
    } catch (e) {
      console.error('Token 刷新失败:', e);
    }
    // 刷新失败 → 清除所有登录状态
    localStorage.clear();
    return null;
  })();

  return _refreshing.finally(() => { _refreshing = null; });
}

// 包装 fetch：自动注入 token、过期时刷新，并把 /api/* 指向后端 API_BASE
const _originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url.url;
  const isApi = !!urlStr && urlStr.startsWith('/api/');

  if (
    isApi &&
    !urlStr.startsWith('/api/auth/login') &&
    !urlStr.startsWith('/api/auth/register') &&
    !urlStr.startsWith('/api/auth/refresh')
  ) {
    const token = await ensureValidToken();
    if (!token) {
      window.location.replace('/login.html');
      throw new Error('登录已过期，请重新登录');
    }
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  // 分离部署时改写为后端绝对地址；同源部署保持原样
  return _originalFetch(isApi ? resolveApiUrl(urlStr) : url, options);
};

document.addEventListener('DOMContentLoaded', () => {
  // ======================
  // 点击LOGO跳首页
  // ======================
  const logo = document.querySelector('nav img');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  // ======================
  // 判断登录状态
  // ======================
  const isLogin = localStorage.getItem('isLogin') === 'true';
  const navRight = document.querySelector('nav .flex.items-center.gap-4');

  if (navRight) {
    // ======================
  // 隐藏 登录 / 注册 按钮（支持 button 和 a 标签）
  // ======================
  const authElements = navRight.querySelectorAll('button, a');
  authElements.forEach(el => {
    const text = el.textContent.trim();
    if (text.includes('登录') || text.includes('注册')) {
      el.style.display = 'none';
    }
  });

    // ======================
    // 已登录 → 显示【退出登录】
    // 样式和注册按钮完全一样
    // ======================
    if (isLogin) {
      // 登录态下的「退出登录」与头像入口交由 user-token.js 处理（头像弹窗内含退出按钮）
    }

    // ======================
  // 未登录 → 按钮可跳转（支持 button 和 a 标签）
  // ======================
  if (!isLogin) {
    authElements.forEach(el => {
      const text = el.textContent.trim();
      if (text.includes('登录')) {
        el.onclick = () => window.location.href = 'login.html';
      }
      if (text.includes('注册')) {
        el.onclick = () => window.location.href = 'register.html';
      }
    });
  }
  }

  // 立即开始按钮跳转
  document.querySelectorAll('button').forEach(btn => {
    if (btn.textContent.trim().includes('立即开始')) {
      btn.onclick = () => window.location.href = 'register.html';
    }
  });
});