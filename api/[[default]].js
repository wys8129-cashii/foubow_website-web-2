// IGA Pages Functions 入口（Catch-all 路由接管 /api/*）
//
// 关键约束（来自官方「IGA Pages Functions」文档）：
//   1. 文件必须命名为 api/[[default]].js（Catch-all，转发任意路径到框架实例）
//   2. 必须通过 export default 导出 Express 应用实例
//
// 必须在 require server.js 之前声明 IS_IGA，使 server.js 进入 serverless 模式：
//   - 不执行 app.listen()（由 IGA 运行时接管网络层）
//   - 不启用 public/share 文件写入（serverless 文件系统只读）
// 注意：server.js 通过运行时 require() 加载（而非静态 import），
// 因此不受 ESM import 提升影响，IS_IGA 在 require 时已生效。
process.env.IS_IGA = '1';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// require 调用发生在运行时，此时 IS_IGA 已设置，server.js 以 serverless 模式初始化
const app = require('../server.js');

// IGA Pages 框架集成要求：通过 export default 导出 Express 应用实例
export default app;
