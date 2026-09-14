// 必须在其他模块之前加载 dotenv
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const multer = require('multer');
const { supabase, supabaseAdmin } = require('./src/api/supabase');
const { getOrCreateUserApiKey, getUserByApiKey, regenerateUserApiKey } = require('./src/api/apikey');
const { getQuota, incrementQuota } = require('./src/api/quota');
const { saveNotifyRule, getNotifyRule, deleteNotifyRule, sendTestEmail, runNotifyScan } = require('./src/api/notify');
const { deleteSupabaseImage } = require('./src/api/storage');
const {
  getFullState, getCollection, getDoc, createDoc, updateDocFull, patchDoc, deleteDoc,
  addItem, insertItem, removeItem, reorderItems,
} = require('./src/api/outputdocs');
const { createRewardOrder, markRewardPaid, getMyRewardStatus, REWARD_TIERS } = require('./src/api/reward');
const { adminMiddleware, listPending, addWhitelist, removeWhitelist } = require('./src/api/admin');

// 身份验证中间件（双认证）
//   方式一：Supabase JWT（前端登录态）→ 通过 supabase.auth.getUser 校验
//   方式二：fob_xxx API Key（浏览器插件 / 第三方调用）→ 查 user_api_keys 反查 user_id
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.json({ code: 0, msg: '未登录或登录已过期，请重新登录' });
  }

  // 方式一：Supabase JWT
  if (!token.startsWith('fob_')) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.userEmail = user.email;
      req.userId = user.id;
      req.authVia = 'jwt';
      return next();
    }
  }

  // 方式二：fob_xxx API Key
  const uid = await getUserByApiKey(token);
  if (uid) {
    req.userId = uid;
    // 取该用户的邮箱（Coze 工作流以 email 为参数）
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      req.userEmail = u?.user?.email || `user:${uid.slice(0, 8)}`;
    } catch (e) {
      req.userEmail = `user:${uid.slice(0, 8)}`;
    }
    req.authVia = 'apikey';
    return next();
  }

  return res.json({ code: 0, msg: '未登录或登录已过期，请重新登录' });
}

// 频率限制：仅在非 Serverless 环境启用（Vercel Serverless 使用 Edge 限流）
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.IS_IGA;
const rateLimit = isServerless ? null : require('express-rate-limit');
const ipKeyGenerator = rateLimit ? rateLimit.ipKeyGenerator : null;
const { cozeGetMaterials, cozeGetCollections, cozeGetMaterialDetail, cozeFilterByCollection, cozeUploadMaterial, cozeCreateCollection, cozeUpdateCollection, cozeDeleteCollection, cozeUploadFile, cozeMoveMaterial, cozeDeleteMaterial, cozeSearchMaterials, cozeUpdateMaterialCover, cozeReorderCollections, cozeRunScreenshotWorkflow } = require('./src/api/coze');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 } });

const app = express();
// 端口优先级：veFaaS 运行时注入的 _FAAS_RUNTIME_PORT > 自定义 PORT > 本地默认 2300
const PORT = process.env._FAAS_RUNTIME_PORT || process.env.PORT || 2300;
app.set('trust proxy', 1);

// CORS：支持逗号分隔的多域名白名单（前后端分离部署时填前端域名）
// 例：CORS_ORIGIN=https://foubow.igapages.com,https://www.foubow.com
const corsOriginEnv = (process.env.CORS_ORIGIN || '*').trim();
const corsOrigin = corsOriginEnv === '*'
  ? '*'
  : corsOriginEnv.split(',').map(s => s.trim()).filter(Boolean);

// 中间件
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// 截图 base64 体积较大，放宽 JSON 上限到 12mb（上传类接口走 multipart，不受影响）
app.use(express.json({ limit: '12mb' }));
// 静态资源仅托管 public/（单机部署时用；分离部署时前端由 IGA Pages 托管）
// 注意：不要再 static 整个 __dirname，否则会把 .env 与后端源码暴露到公网
app.use(express.static(path.join(__dirname, 'public')));

// 频率限制配置（仅在非 Serverless 环境生效）
const noop = (req, res, next) => next();

// 全局兜底：IP 维度，所有请求
const globalLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { code: 0, msg: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

// 登录/注册防暴力破解：IP 维度，每分钟 5 次
const authLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { code: 0, msg: '操作过于频繁，请 1 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

// Coze API：用户维度（通过 authMiddleware 注入的 userId），每人每分钟 30 次
const cozeApiLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req),  // 已登录按用户 ID，未登录兜底 IP
  message: { code: 0, msg: 'API 调用过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

// 上传：用户维度，每人每分钟 5 次
const uploadLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req),
  message: { code: 0, msg: '上传过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

app.use(globalLimiter);

// ===== 合集分享：保存 HTML 为临时文件，生成可访问链接（仅本地非 Serverless 有效）=====
if (!isServerless) {
  const fs = require('fs');
  const crypto = require('crypto');
  // veFaaS 的代码目录是只读的，只有 /tmp 可写；本地/ECS 仍写入 public/share
  const SHARE_DIR = process.env._FAAS_RUNTIME_PORT
    ? path.join('/tmp', 'share')
    : path.join(__dirname, 'public', 'share');
  try {
    if (!fs.existsSync(SHARE_DIR)) fs.mkdirSync(SHARE_DIR, { recursive: true });
  } catch (e) {
    // 目录不可写时不阻塞服务启动，分享接口会在写入时报错并降级为前端下载 HTML
    console.warn('[share] 目录不可写，分享链接功能不可用:', SHARE_DIR, e.message);
  }

  // 提供 /share/* 静态访问
  app.use('/share', express.static(SHARE_DIR, { maxAge: '5m' }));

  app.post('/api/share/save', async (req, res) => {
    try {
      const { name, html } = req.body || {};
      if (typeof html !== 'string' || html.length === 0 || html.length > 500000) {
        return res.status(400).json({ code: 0, msg: 'HTML 内容不合法或过大（>500KB）' });
      }
      const id = crypto.randomBytes(6).toString('hex'); // 12 位
      const safeName = String(name || 'collection')
        .replace(/[^\w一-龥\-]/g, '_')
        .slice(0, 30);
      const filename = `${safeName}_${id}.html`;
      const filepath = path.join(SHARE_DIR, filename);
      fs.writeFileSync(filepath, html, 'utf-8');
      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0];
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const url = `${proto}://${host}/share/${filename}`;
      console.log(`[share] 已保存 ${filename} (${(html.length / 1024).toFixed(1)}KB), URL=${url}`);
      res.json({ code: 1, msg: 'ok', data: { url, filename } });
    } catch (e) {
      console.error('[share] 保存失败:', e.message);
      res.status(500).json({ code: 0, msg: e.message });
    }
  });
} else {
  app.post('/api/share/save', (req, res) => {
    res.status(501).json({ code: 0, msg: '当前为 serverless 环境，不支持生成分享链接，请下载 HTML 文件' });
  });
}

// 注册（加防暴力破解限流）
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, login_password, user_name } = req.body;

    if (!email || !login_password || !user_name) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: login_password,
      options: {
        data: { nickname: user_name }
      }
    });

    if (error) {
      console.error('注册失败:', error.message);
      return res.json({ code: 0, msg: error.message.includes('already registered') ? '该邮箱已被注册' : error.message });
    }

    res.json({ code: 1, msg: '注册成功' });
  } catch (error) {
    console.error('注册错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 登录
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, login_password } = req.body;

    if (!email || !login_password) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: login_password
    });

    if (error) {
      console.error('登录失败:', error.message);
      return res.json({ code: 0, msg: '邮箱或密码错误' });
    }

    // 查询 profile 获取用户信息
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, avatar')
      .eq('id', data.user.id)
      .single();

    // 查询/创建该用户的 API Key（fob_xxx），失败不影响登录主流程
    let apiKey = null;
    try {
      apiKey = await getOrCreateUserApiKey(data.user.id);
    } catch (e) {
      console.error('生成 API Key 失败（不影响登录）:', e.message);
    }

    res.json({
      code: 1,
      msg: '登录成功',
      data: {
        nickname: profile?.nickname || '用户',
        email: data.user.email,
        avatar: profile?.avatar || '',
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        api_key: apiKey
      }
    });
  } catch (error) {
    console.error('登录错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 刷新 token（保持 30 天登录态）
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.json({ code: 0, msg: '缺少 refresh_token' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) {
      console.error('刷新 token 失败:', error.message);
      return res.json({ code: 0, msg: '登录已过期，请重新登录' });
    }

    res.json({
      code: 1,
      msg: '刷新成功',
      data: {
        token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (error) {
    console.error('刷新 token 错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 获取当前用户的 API Key（需 JWT 登录）
app.get('/api/auth/token', authMiddleware, async (req, res) => {
  try {
    const apiKey = await getOrCreateUserApiKey(req.userId);
    res.json({ code: 1, msg: 'ok', data: { api_key: apiKey } });
  } catch (error) {
    console.error('获取 API Key 错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 重置当前用户的 API Key（旧 Key 立即失效，需 JWT 登录）
app.post('/api/auth/token/regenerate', authMiddleware, async (req, res) => {
  try {
    const apiKey = await regenerateUserApiKey(req.userId);
    res.json({ code: 1, msg: '已重置', data: { api_key: apiKey } });
  } catch (error) {
    console.error('重置 API Key 错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 浏览器插件「截图上传」：fob_ token 验证通过后，由后端代跑 Coze 截图工作流并流式返回
// 插件先调 /api/auth/token 验证 token 有效性，再调本接口执行（authMiddleware 已双重验证）
app.post('/api/plugin/screenshot', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const { screenshot, user, web_url } = req.body || {};
    if (!screenshot || typeof screenshot !== 'string') {
      return res.status(400).json({ code: 0, msg: '缺少 screenshot 截图数据' });
    }
    // user 缺省时回退到 token 对应的邮箱（authMiddleware 已解析）
    const cozeUser = (user && user.trim()) || req.userEmail;

    console.log('插件截图请求:', { user: cozeUser, web_url, screenshotLen: screenshot.length, authVia: req.authVia });
    const upstream = await cozeRunScreenshotWorkflow({ screenshot, user: cozeUser, web_url });

    // 以 SSE 流原样代理回插件（插件侧按 data: 行解析，与原 Coze 直连行为一致）
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 流正常结束（非 error）视为一次成功上传，计数 +1；达限仅用于前端打赏提醒，不做功能限制
    let streamErrored = false;
    upstream.data.on('error', (e) => {
      streamErrored = true;
      console.error('Coze 截图流错误:', e.message);
      res.end();
    });
    upstream.data.on('end', () => {
      if (!streamErrored) {
        incrementQuota(cozeUser)
          .then((q) => console.log('[quota] 素材计数 +1:', cozeUser, '->', q.count, q.limitReached ? '(已达上限，提醒打赏)' : ''))
          .catch((e) => console.warn('[quota] 计数失败:', e.message));
      }
    });

    upstream.data.pipe(res);
    res.on('close', () => {
      if (typeof upstream.data.destroy === 'function') upstream.data.destroy();
    });
  } catch (error) {
    console.error('插件截图代理失败:', error.message);
    const msg = error.response?.data?.message || error.message;
    if (!res.headersSent) {
      res.status(502).json({ code: 0, msg: `截图工作流调用失败：${msg}` });
    } else {
      res.end();
    }
  }
});

// 浏览器插件：查询当前用户截图素材配额（用于打赏提醒，非功能限制）
app.get('/api/plugin/quota', authMiddleware, async (req, res) => {
  try {
    const q = await getQuota(req.userEmail);
    res.json({ code: 1, msg: 'ok', data: q });
  } catch (error) {
    res.json({ code: 0, msg: error.message });
  }
});

// API 路由
app.post('/api/coze/materials', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    
    console.log('收到获取素材列表请求:', { email });

    console.log('调用 Coze 获取素材列表 API...');
    const result = await cozeGetMaterials({ email });

    console.log('Coze 返回结果:', result);
    
    res.json({ code: 1, msg: '获取成功', data: result });
  } catch (error) {
    console.error('获取素材列表错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 更新素材封面裁剪位置（持久化 coverPos）
app.post('/api/coze/materials/cover', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { title, coverPos } = req.body;
    if (!title) return res.json({ code: 0, msg: '缺少素材标题' });
    if (!coverPos) return res.json({ code: 0, msg: '缺少裁剪位置' });

    console.log('更新素材封面裁剪位置:', { email, title, coverPos });
    const result = await cozeUpdateMaterialCover({ email, title, coverPos });
    res.json({ code: 1, msg: '保存成功', data: result });
  } catch (error) {
    console.error('更新封面裁剪位置错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 获取合集列表
app.post('/api/coze/collections', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    
    console.log('收到获取合集列表请求:', { email });

    console.log('调用 Coze 获取合集列表 API...');
    const result = await cozeGetCollections({ email });

    console.log('Coze 返回结果:', result);
    
    res.json({ code: 1, msg: '获取成功', data: result });
  } catch (error) {
    console.error('获取合集列表错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 获取素材详情
app.post('/api/coze/material/detail', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const { title } = req.body;
    
    console.log('收到获取素材详情请求:', { title });
    
    if (!title) {
      return res.json({ code: 0, msg: '缺少标题参数' });
    }

    console.log('调用 Coze 获取素材详情 API...');
    const result = await cozeGetMaterialDetail({ title });

    console.log('Coze 返回结果:', result);
    
    res.json({ code: 1, msg: '获取成功', data: result });
  } catch (error) {
    console.error('获取素材详情错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 上传素材（支持批量多图）
app.post('/api/coze/materials/upload', authMiddleware, uploadLimiter, upload.array('images', 20), async (req, res) => {
  try {
    const user = req.userEmail;
    const files = req.files;

    console.log('收到上传素材请求:', { user, fileCount: files?.length });

    if (!files || files.length === 0) {
      return res.json({ code: 0, msg: '请选择图片文件' });
    }

    // 逐张上传到 Coze 文件存储，收集所有 file_id
    const fileIds = [];
    for (let i = 0; i < files.length; i++) {
      console.log(`上传文件 (${i + 1}/${files.length}) 到 Coze 文件存储...`);
      const fileId = await cozeUploadFile(files[i].buffer, files[i].originalname);
      fileIds.push(fileId);
    }

    console.log('所有文件上传完成，共', fileIds.length, '个 file_id');
    console.log('调用 Coze 上传素材 API（批量）...');
    const result = await cozeUploadMaterial({
      screenshot: fileIds,
      user: user,
    });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '上传成功', data: result });
  } catch (error) {
    console.error('上传素材错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 新增合集
app.post('/api/coze/collections/create', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { input } = req.body;

    console.log('收到新增合集请求:', { email, input });

    if (!input) {
      return res.json({ code: 0, msg: '缺少合集名称' });
    }

    console.log('调用 Coze 新增合集 API...');
    const result = await cozeCreateCollection({ email, input });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '新增合集成功', data: result });
  } catch (error) {
    console.error('新增合集错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 修改合集
app.post('/api/coze/collections/update', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { input, old_name } = req.body;

    console.log('收到修改合集请求:', { email, old_name, input });

    if (!input || !old_name) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }

    console.log('调用 Coze 修改合集 API...');
    const result = await cozeUpdateCollection({ email, input, oldName: old_name });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '修改合集成功', data: result });
  } catch (error) {
    console.error('修改合集错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 修改合集排序（持久化 sort）
app.post('/api/coze/collections/reorder', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { topicName, sort } = req.body;

    console.log('收到修改合集排序请求:', { email, topicName, sort });

    if (!topicName || sort === undefined || sort === null) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }

    const result = await cozeReorderCollections({ email, topicName, sort });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '修改合集排序成功', data: result });
  } catch (error) {
    console.error('修改合集排序错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 删除合集
app.post('/api/coze/collections/delete', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { input } = req.body;

    console.log('收到删除合集请求:', { email, input });

    if (!input) {
      return res.json({ code: 0, msg: '缺少合集名称' });
    }

    console.log('调用 Coze 删除合集 API...');
    const result = await cozeDeleteCollection({ email, input });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '删除合集成功', data: result });
  } catch (error) {
    console.error('删除合集错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 修改素材所属合集
app.post('/api/coze/materials/move', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { title, topic } = req.body;

    console.log('收到修改素材所属合集请求:', { email, title, topic });

    if (!title || !topic) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }

    console.log('调用 Coze 修改素材所属合集 API...');
    const result = await cozeMoveMaterial({ email, title, topic });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '移动成功', data: result });
  } catch (error) {
    console.error('修改素材所属合集错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 按合集筛选素材
app.post('/api/coze/materials/filter', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { topic } = req.body;
    
    console.log('收到按合集筛选素材请求:', { email, topic });
    
    if (!topic) {
      return res.json({ code: 0, msg: '缺少合集名称参数' });
    }

    console.log('调用 Coze 按合集筛选素材 API...');
    const result = await cozeFilterByCollection({ email, topic });

    console.log('Coze 返回结果:', result);
    
    res.json({ code: 1, msg: '获取成功', data: result });
  } catch (error) {
    console.error('按合集筛选素材错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 删除素材
app.post('/api/coze/materials/delete', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { input, image_url } = req.body;

    console.log('收到删除素材请求:', { email, input, hasImage: !!image_url });

    if (!input) {
      return res.json({ code: 0, msg: '缺少素材标题' });
    }

    console.log('调用 Coze 删除素材 API...');
    const result = await cozeDeleteMaterial({ email, input });

    console.log('Coze 返回结果:', result);

    // 删除素材成功后，连带删除 Supabase 上对应的图片（best-effort，失败不影响主流程）
    let imageDeleted = null;
    if (image_url) {
      try {
        imageDeleted = await deleteSupabaseImage(image_url);
        console.log('Supabase 图片删除结果:', imageDeleted);
      } catch (e) {
        console.error('Supabase 图片删除异常（已忽略）:', e.message);
        imageDeleted = { deleted: false, reason: e.message };
      }
    }

    res.json({ code: 1, msg: '删除素材成功', data: result, imageDeleted });
  } catch (error) {
    console.error('删除素材错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// 搜索素材
app.post('/api/coze/materials/search', authMiddleware, cozeApiLimiter, async (req, res) => {
  try {
    const email = req.userEmail;
    const { input } = req.body;

    console.log('收到搜索素材请求:', { email, input });

    if (!input) {
      return res.json({ code: 0, msg: '缺少搜索关键词' });
    }

    console.log('调用 Coze 搜索素材 API...');
    const result = await cozeSearchMaterials({ email, input });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '搜索成功', data: result });
  } catch (error) {
    console.error('搜索素材错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

// ===== 合集提醒通知 =====
// 收件邮箱优先级：请求体 email > 鉴权注入的 req.userEmail
function resolveNotifyEmail(req) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const body = req.body || {};
  if (body.email && re.test(body.email)) return body.email;
  if (req.userEmail && re.test(req.userEmail)) return req.userEmail;
  return null;
}

// 保存/更新提醒规则
app.post('/api/notify/rule', authMiddleware, async (req, res) => {
  try {
    const email = resolveNotifyEmail(req);
    const { topic, mode, notifyTime, weekdays, thresholdCount, enabled } = req.body || {};
    if (!email) return res.json({ code: 0, msg: '缺少有效的收件邮箱，请在提醒弹窗中填写' });
    if (!topic) return res.json({ code: 0, msg: '缺少合集名称' });
    if (!notifyTime || !/^\d{2}:\d{2}$/.test(notifyTime)) return res.json({ code: 0, msg: '提醒时间格式应为 HH:MM' });
    const data = await saveNotifyRule({
      userEmail: email,
      topic,
      mode: mode === 'weekly' ? 'weekly' : 'schedule',
      notifyTime,
      weekdays,
      thresholdCount,
      enabled,
    });
    res.json({ code: 1, msg: 'ok', data });
  } catch (e) {
    console.error('[notify] 保存规则失败', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 查询某合集的提醒规则
app.get('/api/notify/rule', authMiddleware, async (req, res) => {
  try {
    const email = resolveNotifyEmail(req);
    const { topic } = req.query;
    if (!email) return res.json({ code: 0, msg: '缺少有效邮箱' });
    if (!topic) return res.json({ code: 0, msg: '缺少合集名称' });
    const data = await getNotifyRule({ userEmail: email, topic });
    res.json({ code: 1, msg: 'ok', data: data || null });
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 删除提醒规则
app.delete('/api/notify/rule', authMiddleware, async (req, res) => {
  try {
    const email = resolveNotifyEmail(req);
    const { topic } = req.body || {};
    if (!email || !topic) return res.json({ code: 0, msg: '缺少邮箱或合集名称' });
    await deleteNotifyRule({ userEmail: email, topic });
    res.json({ code: 1, msg: 'ok' });
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 发送测试邮件（立即发送，不写 last_sent_date）
app.post('/api/notify/test', authMiddleware, async (req, res) => {
  try {
    const email = resolveNotifyEmail(req);
    const { topic, mode, notifyTime, weekdays } = req.body || {};
    if (!email) return res.json({ code: 0, msg: '缺少有效邮箱' });
    const info = await sendTestEmail({
      to: email,
      topic: topic || '示例合集',
      mode,
      notifyTime,
      weekdays,
    });
    if (info && info.dryRun) {
      res.json({ code: 1, msg: 'SMTP 未配置，已进入 dry-run（仅打印日志，未真实发送）。配置 SMTP_* 环境变量后即为真实发送。', dryRun: true });
    } else {
      res.json({ code: 1, msg: '测试邮件已发送，请查收', data: info });
    }
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 定时扫描：由 veFaaS Timer 触发器每分钟调用，需携带 x-cron-secret 头
app.post('/api/cron/notify', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ code: 0, msg: 'forbidden' });
  }
  try {
    const result = await runNotifyScan();
    res.json({ code: 1, msg: 'ok', data: result });
  } catch (e) {
    console.error('[cron/notify] 扫描失败', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// ===== 工作区初始化（公开，无需鉴权）=====
// 前端首次使用无登录态：本接口创建一个匿名 Supabase auth user（email=uuid@foubow.local, email_confirm=true）
// 并为其签发 fob_xxx API Key，返回给前端长期保存于 localStorage。
// 所有产出物请求均携带此 Key 作为「工作区身份」。
app.post('/api/workspace/init', async (req, res) => {
  try {
    const uid = crypto.randomUUID();
    const email = `${uid}@foubow.local`;
    const password = crypto.randomBytes(16).toString('hex');
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr || !created || !created.user) {
      console.error('[workspace/init] 创建用户失败:', cErr && cErr.message);
      return res.status(500).json({ code: 0, msg: '工作区初始化失败：无法创建用户' });
    }
    const apiKey = await getOrCreateUserApiKey(created.user.id);
    if (!apiKey) {
      return res.status(500).json({ code: 0, msg: '工作区初始化失败：无法签发密钥' });
    }
    res.json({ code: 1, msg: 'ok', data: { apiKey, userId: created.user.id } });
  } catch (e) {
    console.error('[workspace/init] 异常:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 取归属身份：优先 userId（JWT 或 fob_xxx 反查），兜底 userEmail
function resolveOwner(req) {
  return req.userId || req.userEmail || null;
}

// ===== 产出物（Output Docs）=====
// 列表：?collection= 取单个合集；否则取全部合集（与前端 localStorage state map 对齐）
app.get('/api/output-docs', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  try {
    if (req.query.collection) {
      const docs = await getCollection(owner, String(req.query.collection));
      res.json({ code: 1, msg: 'ok', data: docs });
    } else {
      const map = await getFullState(owner);
      res.json({ code: 1, msg: 'ok', data: map });
    }
  } catch (e) {
    console.error('[output-docs] GET 失败:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 取单个文档（含块）
app.get('/api/output-docs/:docId', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  try {
    const doc = await getDoc(owner, req.params.docId);
    if (!doc) return res.json({ code: 0, msg: '文档不存在' });
    res.json({ code: 1, msg: 'ok', data: doc });
  } catch (e) {
    console.error('[output-docs] GET/:docId 失败:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 新建文档（upsert，docId 由前端生成，幂等）
app.post('/api/output-docs', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const { collection, title, type, items, id } = req.body || {};
  if (!collection) return res.json({ code: 0, msg: '缺少合集名称' });
  try {
    const doc = await createDoc({ userId: owner, collection, title, type, items, id });
    res.json({ code: 1, msg: '创建成功', data: doc });
  } catch (e) {
    console.error('[output-docs] POST 失败:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 整篇覆盖（title/type/items 全量，items 为数组则重写块）
app.put('/api/output-docs/:docId', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const { title, type, items } = req.body || {};
  try {
    const doc = await updateDocFull({ userId: owner, docId: req.params.docId, title, type, items });
    res.json({ code: 1, msg: '保存成功', data: doc });
  } catch (e) {
    console.error('[output-docs] PUT 失败:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 局部更新（title / type 可选，不传则不改动块）
app.patch('/api/output-docs/:docId', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const { title, type } = req.body || {};
  try {
    await patchDoc({ userId: owner, docId: req.params.docId, title, type });
    res.json({ code: 1, msg: '更新成功' });
  } catch (e) {
    console.error('[output-docs] PATCH 失败:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 删除文档（连带块）
app.delete('/api/output-docs/:docId', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  try {
    await deleteDoc({ userId: owner, docId: req.params.docId });
    res.json({ code: 1, msg: '删除成功' });
  } catch (e) {
    console.error('[output-docs] DELETE 失败:', e.message);
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 追加块
app.post('/api/output-docs/:docId/items', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const { item } = req.body || {};
  if (!item) return res.json({ code: 0, msg: '缺少 block 数据' });
  try {
    const items = await addItem({ userId: owner, docId: req.params.docId, item });
    res.json({ code: 1, msg: 'ok', data: items });
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 指定位置插入块
app.post('/api/output-docs/:docId/items/:idx', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const { item } = req.body || {};
  const idx = parseInt(req.params.idx, 10);
  if (!item || isNaN(idx)) return res.json({ code: 0, msg: '缺少 block 或非法位置' });
  try {
    const items = await insertItem({ userId: owner, docId: req.params.docId, idx, item });
    res.json({ code: 1, msg: 'ok', data: items });
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 删除块
app.delete('/api/output-docs/:docId/items/:idx', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const idx = parseInt(req.params.idx, 10);
  if (isNaN(idx)) return res.json({ code: 0, msg: '非法位置' });
  try {
    const items = await removeItem({ userId: owner, docId: req.params.docId, idx });
    res.json({ code: 1, msg: 'ok', data: items });
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// 重排块：body.items 为重排后的完整数组
app.put('/api/output-docs/:docId/items/reorder', authMiddleware, async (req, res) => {
  const owner = resolveOwner(req);
  if (!owner) return res.json({ code: 0, msg: '无有效身份' });
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.json({ code: 0, msg: '缺少 items 数组' });
  try {
    const out = await reorderItems({ userId: owner, docId: req.params.docId, items });
    res.json({ code: 1, msg: 'ok', data: out });
  } catch (e) {
    res.status(500).json({ code: 0, msg: e.message });
  }
});

// ===== 打赏（虚拟支付：个人）+ 白名单 =====
// 公开：打赏档位列表
app.get('/api/pay/tiers', (req, res) => {
  res.json({ code: 1, msg: 'ok', data: REWARD_TIERS });
});

// 创建打赏订单（小程序调用；可选带 JWT 关联已登录用户，不强制）
app.post('/api/pay/order', async (req, res) => {
  try {
    const { code, amount, item_id } = req.body || {};
    let userId = null;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token && !token.startsWith('fob_')) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }
    const result = await createRewardOrder({ code, amount, item_id, user_id: userId });
    res.json({ code: 1, msg: 'ok', data: result });
  } catch (e) {
    console.error('[pay] 下单失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

// 微信虚拟支付异步通知（验签占位，联调时按官方文档补齐；此处直接标记 paid）
app.post('/api/pay/notify', async (req, res) => {
  try {
    const { order_id } = req.body || {};
    await markRewardPaid(order_id);
    res.json({ code: 1, msg: 'ok' });
  } catch (e) {
    console.error('[pay] notify 失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

// 小程序/前端支付成功兜底上报（防 notify 丢失）
app.post('/api/pay/report', async (req, res) => {
  try {
    const { order_id, screenshot_note } = req.body || {};
    await markRewardPaid(order_id, { screenshot_note });
    res.json({ code: 1, msg: 'ok' });
  } catch (e) {
    console.error('[pay] report 失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

// 当前用户打赏状态（需登录）
app.get('/api/pay/status', authMiddleware, async (req, res) => {
  try {
    const status = await getMyRewardStatus(req.userId);
    res.json({ code: 1, msg: 'ok', data: status });
  } catch (e) {
    console.error('[pay] 状态查询失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

// ===== 管理员：白名单审核（方案 A：Supabase profiles.is_admin）=====
app.get('/api/admin/whitelist/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const list = await listPending();
    res.json({ code: 1, msg: 'ok', data: list });
  } catch (e) {
    console.error('[admin] 待审核列表失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

app.post('/api/admin/whitelist', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { order_id, user_id, email, note } = req.body || {};
    let targetUserId = user_id;
    let targetEmail = email;
    if (order_id && !targetUserId && !targetEmail) {
      const { data: rw } = await supabaseAdmin.from('rewards').select('user_id, openid').eq('order_id', order_id).single();
      if (rw && rw.user_id) targetUserId = rw.user_id;
      else return res.json({ code: 0, msg: '该订单未关联 Foubow 账号，请手动填写用户邮箱' });
    }
    const result = await addWhitelist({ user_id: targetUserId, email: targetEmail, note, adminUid: req.userId });
    res.json({ code: 1, msg: '已添加白名单', data: result });
  } catch (e) {
    console.error('[admin] 添加白名单失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

app.post('/api/admin/whitelist/remove', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { order_id, user_id, email } = req.body || {};
    let targetUserId = user_id;
    let targetEmail = email;
    if (order_id && !targetUserId && !targetEmail) {
      const { data: rw } = await supabaseAdmin.from('rewards').select('user_id').eq('order_id', order_id).single();
      if (rw && rw.user_id) targetUserId = rw.user_id;
    }
    const result = await removeWhitelist({ user_id: targetUserId, email: targetEmail });
    res.json({ code: 1, msg: '已移除', data: result });
  } catch (e) {
    console.error('[admin] 移除白名单失败:', e.message);
    res.json({ code: 0, msg: e.message });
  }
});

// 健康检查：供 veFaaS / 负载均衡探活，不依赖前端静态文件
// 纯后端部署（无 public/ 目录）时，用这个地址验证服务是否正常
app.get('/health', (req, res) => {
  res.json({ code: 1, msg: 'ok', ts: Date.now() });
});

// 路由到 HTML 文件（统一从 public/ 目录读取，本地 ECS 与 IGA Pages 一致）
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/material.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'material.html'));
});

app.get('/privacy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
// - Serverless Function（IGA Pages / Vercel）：平台托管网络层，不 listen，只导出 app
// - veFaaS Web 应用函数 / 本地 / ECS：真实 HTTP Server，必须监听 0.0.0.0
if (!isServerless) {
  app.listen(PORT, '0.0.0.0', () => {
    const mode = process.env._FAAS_RUNTIME_PORT ? 'veFaaS Web 应用函数' : '本地/ECS';
    console.log(`[${mode}] Server listening on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;