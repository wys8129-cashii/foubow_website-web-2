// 必须在其他模块之前加载 dotenv
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const multer = require('multer');
const supabase = require('./src/api/supabase');

// 身份验证中间件（通过 Supabase Auth 验证 token）
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.json({ code: 0, msg: '未登录或登录已过期，请重新登录' });
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.json({ code: 0, msg: '未登录或登录已过期，请重新登录' });
  }
  req.userEmail = user.email;
  req.userId = user.id;
  next();
}

// 频率限制：仅在非 Serverless 环境启用（Vercel Serverless 使用 Edge 限流）
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const rateLimit = isServerless ? null : require('express-rate-limit');
const ipKeyGenerator = rateLimit ? rateLimit.ipKeyGenerator : null;
const { cozeGetMaterials, cozeGetCollections, cozeGetMaterialDetail, cozeFilterByCollection, cozeUploadMaterial, cozeCreateCollection, cozeUpdateCollection, cozeDeleteCollection, cozeUploadFile, cozeMoveMaterial, cozeDeleteMaterial, cozeSearchMaterials } = require('./src/api/coze');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 } });

const app = express();
const PORT = process.env.PORT || 2300;
app.set('trust proxy', 1);
// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname))); 

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
  const SHARE_DIR = path.join(__dirname, 'public', 'share');
  if (!fs.existsSync(SHARE_DIR)) fs.mkdirSync(SHARE_DIR, { recursive: true });

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

    res.json({
      code: 1,
      msg: '登录成功',
      data: {
        nickname: profile?.nickname || '用户',
        email: data.user.email,
        avatar: profile?.avatar || '',
        token: data.session.access_token,
        refresh_token: data.session.refresh_token
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
    const { input } = req.body;

    console.log('收到删除素材请求:', { email, input });

    if (!input) {
      return res.json({ code: 0, msg: '缺少素材标题' });
    }

    console.log('调用 Coze 删除素材 API...');
    const result = await cozeDeleteMaterial({ email, input });

    console.log('Coze 返回结果:', result);

    res.json({ code: 1, msg: '删除素材成功', data: result });
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

// 路由到 HTML 文件
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/material.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'material.html'));
});

app.get('/privacy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/terms.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器（Vercel Serverless 不需要 listen，直接导出 app）
if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;