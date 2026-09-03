// 浏览器插件配置：统一对接 veFaaS 后端（token 验证 + 工作流代理）
// 不再直连 Coze，Coze Token 由后端保管，插件只持有用户自己的 fob_ API Key。
const PLUGIN_CONFIG = {
  // 后端 veFaaS 网关测试域名（与前端 config.js 的 __API_BASE__ 一致）
  apiBase: "https://sm42ps27mabdnv01fac5a.apigateway-cn-shanghai.volceapi.com",
  // 步骤一：token 校验接口
  verifyPath: "/api/auth/token",
  // 步骤二：截图工作流接口（SSE 流式返回）
  screenshotPath: "/api/plugin/screenshot",
  timeout: 120000
};

// 全局挂载
if (typeof window !== 'undefined') {
  window.PLUGIN_CONFIG = PLUGIN_CONFIG;
}
if (typeof self !== 'undefined') {
  self.PLUGIN_CONFIG = PLUGIN_CONFIG;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PLUGIN_CONFIG = PLUGIN_CONFIG;
}
