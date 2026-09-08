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
// 移动端导航（顶部汉堡包按钮 / 底部导航栏）
// ======================
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('mobile-nav-toggle');
  const navFab = document.getElementById('mobile-nav-fab');
  const navOverlay = document.getElementById('mobile-nav-overlay');
  const navPanel = document.getElementById('mobile-nav-panel');
  const navAuth = document.getElementById('mobile-nav-auth');
  if (!navOverlay || !navPanel) return;

  // 用内联样式控制位移，避免 Tailwind 编译产物中 translate-y-* 规则缺失导致「点了没反应」
  navPanel.style.transform = 'translateY(100%)';

  function isOpen() { return navOverlay.classList.contains('is-open'); }
  function openNav() {
    navOverlay.classList.remove('hidden');
    void navPanel.offsetWidth; // 强制 reflow，确保过渡动画生效
    navPanel.style.transform = 'translateY(0)';
    navOverlay.classList.add('is-open');
  }
  function closeNav() {
    navPanel.style.transform = 'translateY(100%)';
    navOverlay.classList.remove('is-open');
    setTimeout(() => { if (!navOverlay.classList.contains('is-open')) navOverlay.classList.add('hidden'); }, 300);
  }
  function toggleNav() { isOpen() ? closeNav() : openNav(); }
  // 供顶部汉堡包按钮的 onclick="toggleMobileNav()" 调用
  window.toggleMobileNav = toggleNav;

  // 仅在底部 FAB（无 onclick 属性）上挂监听；顶部汉堡按钮用 inline onclick="toggleMobileNav()" 触发 window.toggleMobileNav
  if (navFab) navFab.addEventListener('click', toggleNav);
  navOverlay.addEventListener('click', closeNav);
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
      navAuth.innerHTML = '<a href="/login.html" class="w-full text-center px-4 py-3 border border-primary text-primary font-medium rounded-xl active:scale-95 transition-all">登录</a>' +
                          '<a href="/register.html" class="w-full text-center px-4 py-3 bg-primary text-on-primary font-medium rounded-xl active:scale-95 transition-all">注册</a>';
    }
  }
});