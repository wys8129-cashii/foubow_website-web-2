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