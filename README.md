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
