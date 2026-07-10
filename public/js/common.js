// ======================
// 全局加载长条
// ======================
function showLoading(msg) {
  msg = msg || '正在处理...';
  let bar = document.getElementById('loading-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'loading-bar';
    bar.innerHTML = `
      <style>
        @keyframes loading-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes loading-slide { from{transform:translateY(-100%)} to{transform:translateY(0)} }
        #loading-bar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
          height: 44px; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(135deg, #06B6D4, #0891B2);
          color: #fff; font-size: 14px; font-weight: 500;
          transform: translateY(-100%); transition: transform 0.25s ease;
          box-shadow: 0 2px 12px rgba(6,182,212,0.3);
        }
        #loading-bar.show { transform: translateY(0); animation: loading-slide 0.25s ease; }
        #loading-bar .material-symbols-outlined {
          font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal;
          font-size: 20px; animation: loading-spin 0.8s linear infinite;
        }
      </style>
      <span class="material-symbols-outlined">progress_activity</span>
      <span id="loading-text"></span>`;
    document.body.appendChild(bar);
  }
  document.getElementById('loading-text').textContent = msg;
  bar.classList.add('show');
  // 3 秒后仍显示则追加提示
  setTimeout(() => {
    if (bar.classList.contains('show')) {
      const el = document.getElementById('loading-text');
      if (el && !el.textContent.includes('请耐心等待')) {
        el.textContent = msg + ' · 请耐心等待，首次请求可能较慢';
      }
    }
  }, 3000);
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
      const res = await fetch('/api/auth/refresh', {
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

// 包装 fetch：自动注入 token 并在过期时刷新
const _originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url.url;
  if (
    urlStr &&
    urlStr.startsWith('/api/') &&
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
  return _originalFetch(url, options);
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
      const logoutBtn = document.createElement('button');
      logoutBtn.innerText = '退出登录';
      logoutBtn.className = 'px-6 py-2 bg-primary text-on-primary font-medium rounded-full shadow-lg hover:shadow-cyan-500/20 active:scale-95 transition-all';

      logoutBtn.onclick = function () {
        localStorage.removeItem('authToken');
        localStorage.clear();
        alert('已退出登录');
        window.location.href = 'index.html';
      };

      navRight.appendChild(logoutBtn);
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