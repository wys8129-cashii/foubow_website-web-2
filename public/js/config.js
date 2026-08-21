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
window.__API_BASE__ = '';
