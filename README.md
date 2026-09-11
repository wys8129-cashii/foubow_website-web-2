# Foubow 后端（veFaaS Web 应用函数）

从 `foubow_website-web-2` 拆分出的独立后端，部署于**火山引擎 veFaaS**。
前端已独立部署于 IGA Pages（仓库 `front` 分支），本包不含任何前端文件。

## 目录结构

```
server.js              Express 应用（全部 API 路由）
run.sh                 veFaaS 启动脚本（exec node server.js）
package.json           仅后端依赖（无 tailwind/postcss）
.env.example           环境变量模板
config/coze.js         Coze 工作流 ID 与 API 地址
src/api/
  supabase.js          Supabase 客户端（登录鉴权）
  coze/auth.js         Coze 工作流调用实现
  coze/index.js        对外导出
```

## 本地运行

```bash
npm install
cp .env.example .env     # 填入真实密钥
npm start                # 监听 0.0.0.0:2300
curl http://localhost:2300/health    # 健康检查，应返回 {"code":1,"msg":"ok",...}
```

## 部署到 veFaaS

### 1. 打包

veFaaS 上传的 zip **必须包含 `node_modules`**（平台不会替你 npm install）：

```bash
npm install --omit=dev            # 只装生产依赖，减小体积
zip -r foubow-backend.zip . -x ".env" -x "*.git*" -x "*.DS_Store" -x "*.log"
```

### 2. 创建函数

火山引擎控制台 → **veFaaS 函数服务** → 创建函数：

| 配置项 | 值 |
|--------|-----|
| 函数类型 | **Web 应用函数** |
| 运行时 | Node.js 20 / 22（Native） |
| 启动命令 | `./run.sh`（或 `node server.js`） |
| 代码来源 | 上传 `foubow-backend.zip` |
| **超时时间** | **60–120 秒**（必须调大，见下方注意事项） |
| 内存 | 512 MB 起 |

### 3. 配置环境变量

在「函数配置 → 环境变量」中添加（**不要**把 `.env` 打进 zip）：

| 变量 | 必需 | 说明 |
|------|:----:|------|
| `SUPABASE_URL` | ✅ | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | ✅ | Supabase 匿名密钥 |
| `COZE_TOKEN` | ✅ | Coze 个人访问令牌（`pat_xxx`），**只存服务端** |
| `COZE_APP_ID` | ✅ | Coze 应用 ID |
| `CORS_ORIGIN` | ✅ | 前端域名，如 `https://xxx.igapages.com`，多个用逗号分隔 |

### 4. 绑定网关并联通前端

1. 函数创建后开启 HTTP 触发器 / API 网关，拿到公网地址，如
   `https://foubow-api-xxxxxx.volces.com`
2. 用 `/health` 验证服务是否正常
3. 把该地址填进前端 `front` 分支的 `public/js/config.js`：
   ```js
   window.__API_BASE__ = 'https://foubow-api-xxxxxx.volces.com';
   ```
4. 把前端域名填进本函数的 `CORS_ORIGIN`，重新部署函数

## API 契约

所有业务接口均为 **POST**，需在请求头带 Supabase 登录 token：

```
Authorization: Bearer <token>
Content-Type: application/json
```

| 路径 | 鉴权 | 说明 |
|------|:----:|------|
| `GET  /health` | — | 健康检查 |
| `POST /api/auth/register` | — | 注册 |
| `POST /api/auth/login` | — | 登录，返回 token + refresh_token |
| `POST /api/auth/refresh` | — | 刷新 token |
| `POST /api/coze/materials` | ✅ | 素材列表 |
| `POST /api/coze/materials/search` | ✅ | 搜索素材 |
| `POST /api/coze/materials/filter` | ✅ | 按合集筛选 |
| `POST /api/coze/material/detail` | ✅ | 素材详情（含正文 content / 标签 tag） |
| `POST /api/coze/materials/upload` | ✅ | **上传素材**（multipart/form-data，字段 `images`，≤20 张 / 单张 ≤10MB） |
| `POST /api/coze/materials/move` | ✅ | 移动素材到其他合集 |
| `POST /api/coze/materials/delete` | ✅ | 删除素材 |
| `POST /api/coze/materials/cover` | ✅ | 更新封面裁剪位置 |
| `POST /api/coze/collections` | ✅ | 合集列表 |
| `POST /api/coze/collections/create` | ✅ | 新建合集 |
| `POST /api/coze/collections/update` | ✅ | 修改合集 |
| `POST /api/coze/collections/reorder` | ✅ | 合集排序 |
| `POST /api/coze/collections/delete` | ✅ | 删除合集 |

### 浏览器插件对接上传接口

```js
const form = new FormData();
form.append('images', blob, 'screenshot.png');   // 可 append 多张

const res = await fetch('https://foubow-api-xxxxxx.volces.com/api/coze/materials/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },   // 不要手动设 Content-Type
  body: form
});
```

后端会用服务端的 `COZE_TOKEN` 去调 Coze，并从 token 解析出用户邮箱做数据分区——
**插件永远拿不到、也不需要 Coze 的 PAT**。

> 当前插件需要先拿到 Supabase 登录 token。若希望改成填一个长期 `fob_xxx` API Key，
> 需要再补：`user_api_keys` 表 + 注册/登录时发放 + `authMiddleware` 双认证分支。

## 注意事项

1. **超时必须调大**：调用 Coze `stream_run` 上传素材可能耗时十几秒，veFaaS 默认超时（几秒）会把请求掐断。建议 60–120 秒。
2. **文件系统只读**：veFaaS 只有 `/tmp` 可写。分享链接功能会写入 `/tmp/share`，**函数重启即失效**，前端应走「下载 HTML」分支。
3. **COZE_TOKEN 绝不外泄**：它是你 Coze 账号的长期令牌，只能存在 veFaaS 环境变量里，不要写进代码、不要下发给前端或插件。
4. **CORS 一定要配**：分离部署后前后端不同域，`CORS_ORIGIN` 没配对会导致前端所有请求被浏览器拦截。
5. **`.env` 不要打进 zip**：密钥统一走 veFaaS 环境变量管理。
6. **限流**：`express-rate-limit` 在非 Serverless 模式下生效（veFaaS Web 应用函数是常驻进程形态，会生效）。多实例扩容时限流是按实例计的。
