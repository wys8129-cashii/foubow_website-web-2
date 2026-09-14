// =====================================================================
// H5 打赏入口（公开浮窗，不强制登录）
// ---------------------------------------------------------------------
// 行为：右下角常驻「打赏」悬浮按钮 → 点击弹出说明弹窗：
//   - 展示小程序码（用户长按识别进小程序打赏）
//   - 文案：打赏后加管理员微信，发「打赏截图 + 订单号」，管理员审核后开通白名单
// 注意：小程序码图片请放到 public/images/reward-qrcode.png（占位，需替换）。
//       管理员微信号在此处常量配置。
// =====================================================================
(function () {
  const ADMIN_WECHAT = 'foubow_admin';           // 管理员微信（替换为真实微信号）
  const QR_URL = '/images/reward-qrcode.png';     // 小程序码图片路径

  // ---- 悬浮按钮 ----
  const fab = document.createElement('button');
  fab.id = 'reward-fab';
  fab.setAttribute('aria-label', '打赏支持');
  fab.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">favorite</span><span style="font-weight:600">打赏</span>';
  Object.assign(fab.style, {
    position: 'fixed', bottom: '96px', right: '20px', zIndex: '55',
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 16px', borderRadius: '999px',
    background: 'linear-gradient(135deg,#06b6d4,#22d3ee)', color: '#fff',
    border: 'none', boxShadow: '0 8px 24px rgba(6,182,212,0.35)',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600'
  });
  fab.onclick = openRewardModal;
  document.body.appendChild(fab);

  // ---- 弹窗 ----
  function openRewardModal() {
    const overlay = document.createElement('div');
    overlay.id = 'reward-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '70',
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px'
    });
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;max-width:360px;width:100%;padding:24px;position:relative;font-family:inherit">
        <button id="reward-close" style="position:absolute;top:12px;right:12px;border:none;background:none;cursor:pointer;color:#9ca3af;font-size:22px">×</button>
        <div style="display:flex;align-items:center;gap:8px;color:#06b6d4;margin-bottom:8px">
          <span class="material-symbols-outlined">favorite</span>
          <h3 style="margin:0;font-size:18px;color:#111827">支持 Foubow</h3>
        </div>
        <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 16px">
          长按识别下方小程序码，进入小程序打赏。<br>
          打赏完成后，<b>加管理员微信 <span style="color:#06b6d4">${ADMIN_WECHAT}</span></b>，
          发送「打赏截图 + 订单号」，管理员核对后为你开通白名单权限。
        </p>
        <div style="text-align:center;background:#f8fafc;border-radius:14px;padding:16px">
          <img src="${QR_URL}" alt="小程序码" style="width:180px;height:180px;object-fit:contain;border-radius:10px;background:#fff"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <div style="display:none;font-size:13px;color:#9ca3af;padding:40px 0">请将小程序码图片放到<br>public/images/reward-qrcode.png</div>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin:12px 0 0">订单号可在小程序打赏成功后查看</p>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.getElementById('reward-close').onclick = close;
    function close() { overlay.remove(); }
  }
})();
