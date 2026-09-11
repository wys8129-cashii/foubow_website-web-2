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

// ======================
// 回到顶部按钮 + Wiki 卡片点击提示
// ======================
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.style.transition = 'opacity 0.25s';
  toast.style.opacity = '1';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 250);
  }, 3200);
}

document.addEventListener('DOMContentLoaded', () => {
  // 回到顶部按钮
  const backToTop = document.getElementById('back-to-top');
  window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  if (backToTop) {
    const toggleBackTop = () => {
      if (window.scrollY > 400) backToTop.classList.remove('hidden');
      else backToTop.classList.add('hidden');
    };
    window.addEventListener('scroll', toggleBackTop, { passive: true });
    toggleBackTop();
  }

  // Wiki 卡片与「探索 Wiki」按钮点击提示
  const wikiTips = {
    '工作 Wiki': '职场生活·技能成长知识库，汇集工作方法、效率工具与职场进阶干货。',
    '旅游 Wiki': '出行打卡·美食游玩指南，覆盖目的地攻略、行程规划与避坑经验。',
    '求职 Wiki': '求职面试·职场准入参考，整理简历技巧、面试题库与行业洞察。',
    '艺术 Wiki': '创作·风格学习，收录设计灵感、艺术流派与创作方法论。',
    '商业 Wiki': '营销运营·品牌商业洞察，分享增长案例、品牌策略与商业模式。',
    '文化 Wiki': '对话空间·议题写作，汇聚文化观察、观点表达与深度长文。',
    '成长 Wiki': '情绪管理·认知升级，聚焦自我提升、心理建设与思维训练。',
    '潮流 Wiki': '新品上新·好物速递，追踪趋势单品、生活方式与消费风向。'
  };

  document.querySelectorAll('#wiki-grid .glass-card').forEach(card => {
    const h4 = card.querySelector('h4');
    const title = h4 ? h4.textContent.trim() : '';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const desc = wikiTips[title] || '该知识板块正在筹备中，敬请期待更多精彩内容。';
      showToast('【' + title + '】' + desc);
    });
  });

  const exploreBtn = document.getElementById('explore-wiki-btn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      const grid = document.getElementById('wiki-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth' });
      showToast('向下滚动即可浏览 Foubow 整理好的各类知识共享 Wiki');
    });
  }
});