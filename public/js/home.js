document.addEventListener('DOMContentLoaded', () => {
  // 卡片悬浮动画
  const cards = document.querySelectorAll('.glass-card');
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px)';
      card.style.boxShadow = '0 25px 50px -15px rgba(6,182,212,0.2)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
  });
});

// ======================
// 移动端导航抽屉（由首页 FAB 触发）
// ======================
document.addEventListener('DOMContentLoaded', () => {
  const navFab = document.getElementById('mobile-nav-fab');
  const navOverlay = document.getElementById('mobile-nav-overlay');
  const navPanel = document.getElementById('mobile-nav-panel');
  const navAuth = document.getElementById('mobile-nav-auth');
  if (!navFab || !navOverlay || !navPanel) return;

  function openNav() {
    navOverlay.classList.remove('hidden');
    navPanel.classList.remove('translate-y-full');
    navPanel.classList.add('translate-y-0');
  }
  function closeNav() {
    navOverlay.classList.add('hidden');
    navPanel.classList.add('translate-y-full');
    navPanel.classList.remove('translate-y-0');
  }
  navFab.addEventListener('click', () => {
    if (navOverlay.classList.contains('hidden')) openNav(); else closeNav();
  });
  navOverlay.addEventListener('click', closeNav);

  // 点击任意导航链接后关闭面板
  navPanel.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));

  // 登录态同步（与顶部导航栏一致）
  if (navAuth) {
    const isLogin = localStorage.getItem('isLogin') === 'true';
    if (isLogin) {
      navAuth.innerHTML = '<button id="nav-logout-btn" class="w-full px-4 py-3 bg-primary text-on-primary font-medium rounded-xl active:scale-95 transition-all">退出登录</button>';
      document.getElementById('nav-logout-btn').onclick = () => {
        localStorage.clear();
        alert('已退出登录');
        window.location.href = 'index.html';
      };
    } else {
      navAuth.innerHTML = '<a href="/login" class="w-full text-center px-4 py-3 border border-primary text-primary font-medium rounded-xl active:scale-95 transition-all">登录</a>' +
                          '<a href="/register" class="w-full text-center px-4 py-3 bg-primary text-on-primary font-medium rounded-xl active:scale-95 transition-all">注册</a>';
    }
  }
});