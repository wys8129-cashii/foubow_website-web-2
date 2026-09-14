// =====================================================================
// 小程序「打赏支持」页面
// ---------------------------------------------------------------------
// 流程：onLoad 取 wx.login code → 选档位 → 点打赏 → 后端 /api/pay/order 下单签名
//       → wx.requestVirtualPayment 拉起虚拟支付 → 成功 → 提示加管理员微信发截图
// 说明：虚拟支付签名字段以微信「虚拟支付：个人」官方文档最新版为准，联调时核对。
// =====================================================================
const API_BASE = 'https://sm42ps27mabdnv01fac5a.apigateway-cn-shanghai.volceapi.com';
const ADMIN_WECHAT = 'foubow_admin';

// Promise 化的 wx.request
function req(opts) {
  return new Promise((resolve, reject) => {
    wx.request(Object.assign({}, opts, { success: resolve, fail: reject }));
  });
}

Page({
  data: {
    tiers: [],
    selected: null,
    code: '',
    orderId: '',
    paid: false,
    adminWechat: ADMIN_WECHAT
  },

  onLoad() {
    wx.login({
      success: (res) => { if (res.code) this.setData({ code: res.code }); }
    });
    this.loadTiers();
  },

  async loadTiers() {
    try {
      const res = await req({ url: API_BASE + '/api/pay/tiers', method: 'GET' });
      const r = res.data;
      if (r && r.code === 1 && Array.isArray(r.data)) {
        this.setData({ tiers: r.data });
        if (r.data.length) this.setData({ selected: r.data[0] });
      }
    } catch (e) { /* 忽略，使用兜底档位 */ }
  },

  selectTier(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ selected: this.data.tiers[idx] });
  },

  async pay() {
    if (!this.data.selected) { wx.showToast({ title: '请选择打赏金额', icon: 'none' }); return; }
    if (!this.data.code) { wx.showToast({ title: '登录态获取中，请重试', icon: 'none' }); return; }

    wx.showLoading({ title: '创建订单...' });
    try {
      const res = await req({
        url: API_BASE + '/api/pay/order',
        method: 'POST',
        data: {
          code: this.data.code,
          amount: this.data.selected.amount,
          item_id: this.data.selected.item_id || ''
        }
      });
      const r = res.data;
      wx.hideLoading();
      if (!r || r.code !== 1) {
        wx.showToast({ title: (r && r.msg) || '下单失败', icon: 'none' });
        return;
      }
      this.setData({ orderId: r.data.order_id });
      this.requestVirtualPayment(r.data.pay_params);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '下单异常', icon: 'none' });
    }
  },

  // 拉起微信虚拟支付（个人）
  requestVirtualPayment(p) {
    wx.requestVirtualPayment({
      signData: {
        offerId: p.offerId,
        buyQuantity: 1,
        env: (p.env === 'sandbox') ? 1 : 0,   // 0 现网 / 1 沙箱
        currencyType: 'CNY',
        productId: p.item_id || 'reward',
        goodsId: p.item_id || 'reward',
        outTradeNo: p.order_id,
        signature: p.signature
      },
      success: () => this.onPaid(),
      fail: (err) => {
        // errCode -1 用户取消 / 其他失败
        wx.showToast({ title: '支付取消或失败', icon: 'none' });
      }
    });
  },

  onPaid() {
    this.setData({ paid: true });
    // 兜底上报（后端 notify 才是正式标记；此处确保即使 notify 未达也能记录）
    req({ url: API_BASE + '/api/pay/report', method: 'POST', data: { order_id: this.data.orderId } });
  },

  copyWechat() {
    wx.setClipboardData({ data: this.data.adminWechat });
  }
});
