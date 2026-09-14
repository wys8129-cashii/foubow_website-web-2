// =====================================================================
// 管理后台逻辑：登录 → 待审核打赏列表 → 添加/移除白名单
// 鉴权：复用现有 Supabase 账号登录（/api/auth/login），管理员身份由
//       profiles.is_admin 控制；/api/admin/* 接口内部用 adminMiddleware 校验。
// 依赖：common.js 已全局包装 fetch —— 自动注入 token 并把 /api/* 指向 API_BASE。
// =====================================================================

async function adminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const pwd = document.getElementById('admin-pwd').value;
  if (!email || !pwd) { alert('请输入邮箱和密码'); return; }

  showLoading('登录中...');
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, login_password: pwd })
  });
  const r = await res.json();
  hideLoading();

  if (r.code === 1) {
    localStorage.setItem('isLogin', 'true');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('authToken', r.data.token);
    localStorage.setItem('refreshToken', r.data.refresh_token);
    localStorage.setItem('tokenExpiry', Date.now() + 55 * 60 * 1000);
    enterAdmin(email);
  } else {
    alert('登录失败：' + (r.msg || '未知错误'));
  }
}

function enterAdmin(email) {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('admin-view').classList.remove('hidden');
  document.getElementById('admin-email-label').textContent = email;
  loadPending();
}

async function loadPending() {
  const listEl = document.getElementById('pending-list');
  listEl.innerHTML = '<div class="text-on-surface-variant p-4">加载中...</div>';
  try {
    const res = await fetch('/api/admin/whitelist/pending');
    const r = await res.json();
    if (r.code !== 1) {
      listEl.innerHTML = `<div class="text-error p-4">${r.msg || '加载失败'}</div>`;
      return;
    }
    const list = r.data || [];
    if (!list.length) {
      listEl.innerHTML = '<div class="text-on-surface-variant p-6 text-center bg-surface-container-lowest rounded-2xl">🎉 暂无待审核打赏</div>';
      return;
    }
    listEl.innerHTML = list.map(renderItem).join('');
  } catch (e) {
    listEl.innerHTML = `<div class="text-error p-4">加载失败：${e.message}</div>`;
  }
}

function renderItem(it) {
  const u = it.user || {};
  const name = u.nickname || u.email || it.openid || '未知用户';
  const paidAt = it.paid_at ? new Date(it.paid_at).toLocaleString('zh-CN') : '-';
  return `
  <div class="glass-card p-5 rounded-2xl" data-order="${it.order_id}">
    <div class="flex justify-between items-start gap-3">
      <div class="min-w-0">
        <div class="font-title-md text-title-md truncate">${name}</div>
        <div class="text-sm text-on-surface-variant mt-1">档位：${it.item_name || '-'} · 金额 ¥${it.amount}</div>
        <div class="text-xs text-on-surface-variant mt-1">订单号：<span class="font-mono">${it.order_id}</span></div>
        <div class="text-xs text-on-surface-variant">支付时间：${paidAt}</div>
        ${it.screenshot_note ? `<div class="text-xs text-primary mt-1">管理员备注：${it.screenshot_note}</div>` : ''}
      </div>
      <span class="shrink-0 px-2 py-1 bg-warning-container text-on-warning-container rounded text-xs">待审核</span>
    </div>
    <div class="mt-4 flex flex-col gap-3 border-t border-outline-variant/20 pt-4">
      <input class="wl-email field" placeholder="开通白名单的用户邮箱（留空则用订单对应用户）" value="${u.email || ''}">
      <input class="wl-note field" placeholder="备注（可选，如：已核对截图）">
      <div class="flex gap-2">
        <button class="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-medium active:scale-95 transition-all" onclick="doAdd('${it.order_id}')">
          <span class="material-symbols-outlined" style="vertical-align:-5px;font-size:18px">check_circle</span> 添加白名单
        </button>
      </div>
    </div>
  </div>`;
}

async function doAdd(orderId) {
  const card = document.querySelector(`[data-order="${orderId}"]`);
  const email = card.querySelector('.wl-email').value.trim();
  const note = card.querySelector('.wl-note').value.trim();

  showLoading('处理中...');
  const res = await fetch('/api/admin/whitelist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, email: email || undefined, note: note || undefined })
  });
  const r = await res.json();
  hideLoading();

  if (r.code === 1) { alert('已添加白名单 ✅'); loadPending(); }
  else alert('失败：' + (r.msg || '未知错误'));
}

async function doRemove(orderId) {
  if (!confirm('确认移除该用户白名单？')) return;
  showLoading('处理中...');
  const res = await fetch('/api/admin/whitelist/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId })
  });
  const r = await res.json();
  hideLoading();
  if (r.code === 1) { alert('已移除'); loadPending(); }
  else alert('失败：' + (r.msg || '未知错误'));
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('admin-login-btn');
  if (btn) btn.addEventListener('click', adminLogin);
  // 已登录则直接进入后台
  if (localStorage.getItem('isLogin') === 'true') {
    enterAdmin(localStorage.getItem('userEmail') || '');
  }
});
