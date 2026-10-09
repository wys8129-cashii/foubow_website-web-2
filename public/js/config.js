// ======================
// 前端运行时配置（前后端分离部署）
// ======================
// __API_BASE__ = 后端服务地址
//
//   ''  (留空)  → 同源部署：前后端都在同一个 server.js（本地开发 / 单机 ECS）
//   完整 URL    → 分离部署：前端静态托管（IGA Pages），后端独立（veFaaS）
//                 例：'https://foubow-api-xxxxxx.volces.com'
//                 注意：末尾不要带斜杠
//
// 部署到 IGA Pages 时，把 veFaaS 的网关地址填到下面这一行即可，
// 其余前端代码无需任何改动（common.js 会自动为所有 /api/* 请求加上该前缀）。
// 本地开发（localhost / 127.0.0.1）自动走同源后端：前端 /api/* 直接打到本地 server.js，
// 无需填写网关地址；线上 IGA Pages 的 hostname 是域名，仍走 veFaaS 网关，互不影响。
const _isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
window.__LOCAL_DEV__ = _isLocalHost;
window.__API_BASE__ = _isLocalHost
  ? ''
  : 'https://sm42ps27mabdnv01fac5a.apigateway-cn-shanghai.volceapi.com';
