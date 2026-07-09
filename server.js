// 必须在其他模块之前加载 dotenv
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const multer = require('multer');

// 身份验证密钥（优先使用环境变量，否则用 COZE_TOKEN 前8位作为种子）
const AUTH_SECRET = process.env.AUTH_SECRET || 'foubow-secret-' + (process.env.COZE_TOKEN || 'fallback').slice(0, 8);
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;

// 生成登录令牌（HMAC 签名，防篡改）
function generateToken(email) {
  const payload = JSON.stringify({ email, exp: Date.now() + TOKEN_EXPIRY });
  const base64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(base64).digest('hex');
  return `${base64}.${signature}`;
}

// 验证令牌，返回邮箱或 null
function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64, signature] = parts;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(base64).digest('hex');
    if (signature !== expected) return null;
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload.email;
  } catch {
    return null;
  }
}

// 身份验证中间件
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const email = verifyToken(token);
  if (!email) {
    return res.json({ code: 0, msg: '未登录或登录已过期，请重新登录' });
  }
  req.userEmail = email;
  next();
}

// 频率限制：仅在非 Serverless 环境启用（Vercel Serverless 使用 Edge 限流）
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const rateLimit = isServerless ? null : require('express-rate-limit');
const { cozeRegister, cozeLogin, cozeGetMaterials, cozeGetCollections, cozeGetMaterialDetail, cozeFilterByCollection, cozeUploadMaterial, cozeCreateCollection, cozeUpdateCollection, cozeDeleteCollection, cozeUploadFile, cozeMoveMaterial } = require('./src/api/coze');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
const PORT = process.env.PORT || 2300;
app.set('trust proxy', 1);
// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname))); 

// 频率限制配置（仅在非 Serverless 环境生效）
const noop = (req, res, next) => next();
const globalLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { code: 0, msg: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

const cozeApiLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { code: 0, msg: 'API 调用过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

const authLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { code: 0, msg: '登录/注册过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

const uploadLimiter = rateLimit ? rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { code: 0, msg: '上传过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}) : noop;

app.use(globalLimiter);

// API 路由
app.post('/api/coze/register', authLimiter, async (req, res) => {
  try {
    const { email, login_password, user_name } = req.body;
    
    console.log('收到注册请求:', { email, user_name });
    
    if (!email || !login_password || !user_name) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }

    console.log('调用 Coze 注册 API...');
    const result = await cozeRegister({
      email,
      loginPassword: login_password,
      userName: user_name
    });

    console.log('Coze 返回结果:', result);
    
    // 解析 Coze API 返回的 data 字段（是 JSON 字符串）
    let output = 0;
    try {
      if (result.data) {
        const dataObj = JSON.parse(result.data);
        output = dataObj.output || 0;
      }
    } catch (e) {
      console.error('解析 data 失败:', e);
    }
    
    if (output === 1) {
      res.json({ code: 1, msg: '注册成功' });
    } else {
      console.error('注册失败，Coze 原始返回:', JSON.stringify(result));
      res.json({ code: 0, msg: '注册失败，邮箱已被注册', cozeRaw: result });
    }
  } catch (error) {
    console.error('注册错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

app.post('/api/coze/login', authLimiter, async (req, res) => {
  try {
    const { email, login_password } = req.body;
    
    console.log('收到登录请求:', { email });
    
    if (!email || !login_password) {
      return res.json({ code: 0, msg: '缺少必要参数' });
    }

    console.log('调用 Coze 登录 API...');
    const result = await cozeLogin({
      email,
      loginPassword: login_password
    });

    console.log('Coze 返回结果:', result);
    
    // 解析 Coze API 返回的 data 字段（是 JSON 字符串）
    let output = 0;
    let userInfo = {};
    try {
      if (result.data) {
        const dataObj = JSON.parse(result.data);
        output = dataObj.output || 0;
        // 提取用户信息
        userInfo = {
          nickname: dataObj.nickname || dataObj.user_name || '用户',
          email: dataObj.email || email,
          avatar: dataObj.avatar || dataObj.avatar_url || ''
        };
      }
    } catch (e) {
      console.error('解析 data 失败:', e);
    }
    
    if (output === 1) {
      const token = generateToken(email);
      res.json({ code: 1, msg: '登录成功', data: { ...userInfo, token } });
    } else {
      console.error('登录失败，Coze 原始返回:', JSON.stringify(result));
      res.json({ code: 0, msg: '邮箱或密码错误', cozeRaw: result });
    }
  } catch (error) {
    console.error('登录错误:', error.message);
    res.json({ code: 0, msg: error.message });
  }
});

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

// 上传素材
app.post('/api/coze/materials/upload', authMiddleware, uploadLimiter, upload.single('image'), async (req, res) => {
  try {
    const user = req.userEmail;
    const file = req.file;

    console.log('收到上传素材请求:', { user, fileName: file?.originalname });

    if (!file) {
      return res.json({ code: 0, msg: '请选择图片文件' });
    }

    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('先上传文件到 Coze 文件存储...');
    const fileUrl = await cozeUploadFile(file.buffer, file.originalname);
    console.log('文件上传成功，URL:', fileUrl);

    console.log('调用 Coze 上传素材 API...');
    const result = await cozeUploadMaterial({
      screenshot: fileUrl,
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

// 路由到 HTML 文件
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/matierial.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'matierial.html'));
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