# Foubow 前端（front 分支）

纯静态前端，部署于**火山云 IGA Pages**。后端已拆分到 **veFaaS Web 应用函数**，本分支不含任何后端代码。

## 目录结构

```
public/              ← IGA Pages 的 outputDirectory（构建产物目录）
  index.html         首页
  login.html         登录
  register.html      注册
  material.html      素材库
  privacy.html       隐私政策
  terms.html         服务条款
  css/tailwind.css   Tailwind 构建产物
  js/
    config.js        ★ 后端地址配置（部署前必须修改）
    common.js        fetch 拦截层：注入 token + 改写 API 前缀
    home.js / materials.js / login.js / register.js / policy.js
src/styles/index.css Tailwind 输入文件
tailwind.config.js   content 指向 ./public/**/*.html
iga.json             IGA Pages 构建配置
extension/          ← 浏览器插件（截图上传器 MV3）源码，详见文末「浏览器插件」章节
```

## 部署前必做：填写后端地址

编辑 `public/js/config.js`，把 veFaaS 的网关地址填进去：

```js
window.__API_BASE__ = 'https://foubow-api-xxxxxx.volces.com';  // 末尾不要带斜杠
```

- 留空 `''` → 同源模式（前后端在同一服务，用于本地开发）
- 填完整 URL → 分离模式（前端 IGA + 后端 veFaaS）

填好后，前端所有 `/api/*` 请求会被 `common.js` 自动加上该前缀，**其他前端代码无需改动**。

## IGA Pages 部署

1. IGA Pages 控制台新建项目，关联本仓库，分支选 **front**
2. 构建配置会自动读取 `iga.json`：
   - installCommand: `npm install`
   - buildCommand: `npm run build:css`
   - outputDirectory: `public`
3. 无需配置任何环境变量（密钥全在后端 veFaaS）
4. 部署完成后，把分配的域名加入后端的 `CORS_ORIGIN` 白名单

## 本地预览

```bash
npm install
npm run build:css
npx serve public        # 或任意静态服务器
```

注意：本地纯静态预览时，`config.js` 里要填一个可用的后端地址，否则 API 调用会失败。

## 注意事项

- **裸链接**：静态托管下无扩展名路径会 404，所有页面链接都必须带 `.html`
- **样式缺失**：改动 HTML 后需重新 `npm run build:css`，否则新增的 Tailwind 类不会出现在产物里
- **分享链接功能**：依赖后端写文件，veFaaS 上写入 `/tmp`（重启即失效），前端应走「下载 HTML」分支

## 浏览器插件：截图上传器（extension/）

仓库内 `extension/` 目录是 **Foubow 截图上传浏览器插件（公开版，MV3）** 的源码，与网站前端同源托管、共用同一套 veFaaS 后端。

### 功能
- 在任意网页 **右键 → Upload to my Foubow** 上传当前截图 + 链接到平台，由 Coze 工作流自动 AI 分析。
- 工具栏按钮 = 上传状态查看器：未上传时显示用户名/邮箱，上传中显示进度，完成后展示结果。
- **配额限制**：每个用户最多 10 张截图素材；达到上限后工具栏弹窗提示「🙏 请打赏支持后再继续截图上传」，点击「打赏」显示管理员微信二维码。**打赏弹窗仅提醒、不限制功能**（未打赏也可继续上传）。
- Token 校验：插件只持有用户自己的 `fob_` API Key，经后端 `/api/auth/token` 校验，不直接持有 Coze Token。

### 加载方式（开发 / 自测）
1. Chrome 地址栏打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本仓库的 `extension/` 目录
4. 插件即出现在工具栏（首次使用需在弹窗填入自己的 `fob_` API Key）

### 配置（部署 / 分发前必改）
编辑 `extension/config.js`：

```js
const PLUGIN_CONFIG = {
  apiBase: "https://<你的 veFaaS 网关地址>",  // 必须与 public/js/config.js 的 __API_BASE__ 指向同一网关
  verifyPath: "/api/auth/token",
  screenshotPath: "/api/plugin/screenshot",
  timeout: 120000
};
```

- `apiBase` 与网站前端的 `__API_BASE__` 必须指向同一个 veFaaS 网关。
- 用户的 `fob_` API Key 在网站「登录态头像弹窗」中可复制 / 重置，填入插件弹窗即可。

### 替换打赏二维码
`extension/reward-qrcode.png` 目前是占位图，分发前请替换为**管理员真实微信收款二维码**。

### 后端依赖
截图上传代理与配额统计的后端逻辑在另一仓库 `foubow-backend-vefaas`：`/api/plugin/screenshot`（SSE 代理 Coze 工作流）、`/api/plugin/quota`（配额查询）、Supabase 表 `plugin_screenshot_quota`（email 主键、count、limit=10）。
