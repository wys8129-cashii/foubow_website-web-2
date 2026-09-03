// 引入全局配置与后端对接模块
importScripts('config.js', 'pluginApi.js');

chrome.runtime.onInstalled.addListener(() => {
  // 先清除旧菜单项，避免开发期重复加载扩展时 create 同 id 报 "duplicate id" 错误
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'uploadToFoubow',
      title: 'Upload to my Foubow',
      contexts: ['page', 'selection', 'link', 'image']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'uploadToFoubow') {
    const username = await getUsername();
    // 上传开始即写入 storage，标记为「上传中」，使工具栏弹窗可实时看到状态
    chrome.storage.local.set({
      lastUpload: {
        status: 'uploading',
        startedAt: Date.now(),
        web_url: tab?.url || '',
        username: username || ''
      }
    });
    try {
      const result = await captureAndUpload(tab);
      showNotification(`✅ 上传成功：${result.msg || '截图已保存'}`);
      // 把结果写入 storage 并主动 reopen 气泡，让工具栏弹窗展示上传状态
      storeResultAndOpenPopup({ status: 'done', success: true, ...result });
    } catch (result) {
      const detail = formatResultDetail(result);
      logError('右键菜单截图失败', result);
      showNotification(`❌ 上传失败：${result?.msg || '未知错误'}${detail}`, 'error');
      const base = (result && typeof result === 'object') ? result : { msg: String(result) };
      storeResultAndOpenPopup({ status: 'done', success: false, ...base });
    }
  }
});

// 读取用户保存的 fob_ API Key
async function getApiToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get('apiToken', (result) => {
      resolve(result.apiToken || '');
    });
  });
}

async function getUsername() {
  return new Promise((resolve) => {
    chrome.storage.local.get('username', (result) => {
      resolve(result.username || '');
    });
  });
}

// 把返回结构整理成通知用的详细文案
function formatResultDetail(result) {
  if (!result || typeof result !== 'object') return '';
  const parts = [];
  if (result.code) parts.push(`错误码 ${result.code}`);
  if (result.logId) parts.push(`Logid ${result.logId}`);
  const content = (result.raw || result.detail || '').trim();
  if (content) parts.push(`返回内容：${content}`);
  return parts.length ? `\n${parts.join('；')}` : '';
}

// 上传结果写入 storage 并尝试主动打开 popup（用于用户提前关闭弹窗，右键上传后回看状态）
function storeResultAndOpenPopup(result) {
  // 完成时统一标记为 done（成功/失败均 done，由 success 区分）；
  // 上传开始的 uploading 状态由 onClicked 单独写入，这里只覆盖为 done
  const payload = { status: 'done', timestamp: Date.now(), ...result };
  chrome.storage.local.set({ lastUpload: payload }, () => {
    if (chrome.runtime.lastError) {
      console.warn('存储结果失败:', chrome.runtime.lastError.message);
    }
    if (chrome.action && chrome.action.openPopup) {
      try {
        const maybePromise = chrome.action.openPopup();
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch((err) => {
            console.log('openPopup 未触发（popup 可能仍开着或无活动窗口）:', err?.message || err);
          });
        }
      } catch (err) {
        console.log('openPopup 同步调用失败:', err?.message || err);
      }
    }
  });
}

// 工具栏弹窗(popup.html)现在只负责「查看上传状态 + 配置 Token」，
// 实际上传统一由右键菜单「上传到我的foubow」触发，因此不再监听来自 popup 的 executeScreenshot 消息。

// ************************ 工具函数：错误日志收集 ************************
const logError = (message, error) => {
  const errorDetail = {
    timestamp: new Date().toISOString(),
    message,
    errorName: error?.name,
    errorMessage: error?.message,
    stack: error?.stack
  };
  console.error('插件错误详情:', JSON.stringify(errorDetail, null, 2));
};

// 显示通知的工具函数
function showNotification(message, type = 'success') {
  const notificationId = 'screenshot-notification-' + Date.now();
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon128.png'),
    title: '截图上传插件',
    message: message,
    priority: 2
  }, (id) => {
    if (chrome.runtime.lastError) {
      console.warn('通知创建失败:', chrome.runtime.lastError.message);
    }
  });
}

// 图标点击由 manifest 中的 default_popup 直接打开 popup.html 处理，
// 因此不再需要 chrome.action.onClicked 监听（设置 popup 后该监听也不会触发）。

// ************************ 截图 → 后端验证 token → 后端代跑 Coze 工作流 ************************
async function captureAndUpload(activeTab) {
  console.log('Starting capture and upload process...');
  // 统一返回结构：成功/失败都带上 code/msg/data/raw/logId 供气泡弹窗展示
  const result = { success: false, code: null, msg: '', data: '', raw: '', logId: '' };

  try {
    // 1. 校验标签页有效性
    if (!activeTab?.id || !activeTab?.windowId) {
      throw new Error('Invalid tab: missing ID or window ID（无效的标签页：缺少ID或窗口ID）');
    }

    // 1.1 拦截浏览器内置页面（无法截图）
    if (!activeTab?.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
      throw new Error('Cannot process browser internal page, please open a normal web page and try again!（无法处理浏览器内置页面，请打开普通网页重试！）');
    }

    // 2. 截屏并转Base64
    console.log('Capturing screenshot...');
    let screenshotBase64;
    try {
      const captureOptions = { format: 'jpeg', quality: 80 };
      const screenshotDataUrl = activeTab.windowId
        ? await chrome.tabs.captureVisibleTab(activeTab.windowId, captureOptions)
        : await chrome.tabs.captureVisibleTab(captureOptions);

      if (!screenshotDataUrl) throw new Error('Screenshot returned empty data（截图返回空数据）');
      screenshotBase64 = screenshotDataUrl.split(',')[1];
      console.log('Screenshot captured successfully, length:', screenshotBase64.length);
    } catch (captureError) {
      console.error('截图API调用失败:', captureError);
      if (captureError.name === 'NotAllowedError') {
        throw new Error('Insufficient screenshot permission, please check activeTab in manifest.json（截图权限不足：请检查manifest.json的activeTab权限）');
      } else if (captureError.message.includes('No window with id')) {
        throw new Error('Screenshot failed: tab window has been closed（截图失败：标签页窗口已关闭）');
      } else {
        throw new Error(`Screenshot failed: ${captureError.message || captureError.name}（截图失败：${captureError.message || captureError.name}）`);
      }
    }

    // 3. 读取并清洗用户保存的 fob_ token
    const rawToken = await getApiToken();
    if (!rawToken || !rawToken.trim()) {
      throw new Error('Please configure API Token (fob_) first, click the extension icon to open the settings page（请先配置 API Token（fob_ 开头），点击插件图标打开配置页面）');
    }
    const token = PLUGIN_API.cleanToken(rawToken);
    console.log('Token状态: 已配置，前缀:', token.substring(0, 4));

    // 4. 步骤一：先验证 token（后端 authMiddleware 双重认证 fob_）
    console.log('Verifying token with backend...');
    try {
      await PLUGIN_API.verifyToken(token);
      console.log('Token 验证通过');
    } catch (verifyError) {
      throw new Error(`Token 验证失败：${verifyError.message}`);
    }

    // 5. 步骤二：验证通过后，调后端截图接口（后端代跑 Coze 工作流，SSE 流返回）
    const username = await getUsername();
    console.log('Calling backend screenshot workflow...');
    let response;
    try {
      response = await PLUGIN_API.runScreenshot({
        rawToken: token,
        screenshot: screenshotBase64,
        user: username,
        web_url: activeTab.url
      });
    } catch (runError) {
      // 收集 HTTP 层错误（含数量限制超限：后端返回 HTTP 非 2xx + 错误详情）
      result.code = runError.code || null;
      result.raw = runError.message;
      result.msg = runError.message;
      result.success = false;
      console.error('后端截图接口失败:', result);
      throw result;
    }

    // 6. 处理后端返回的流式响应（与 Coze 直连 SSE 解析一致：识别 End 节点 content）
    console.log('Processing workflow response...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ''; // 保留未完成的半行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          result.raw += dataStr + "\n";
          console.log('流式响应数据:', data);

          // 后端约定：code=0/非0、type=error 处理
          if (typeof data.code !== 'undefined') {
            result.code = data.code;
            result.msg = data.msg || result.msg;
          }
          if (data.type === "error") {
            result.success = false;
            result.msg = data.msg || result.msg;
            console.error('工作流错误:', data);
            throw new Error(`工作流错误：${data.msg || '未知错误'}`);
          }
          // 后端代跑 Coze 工作流，返回同样是「节点执行事件流」，结束节点(End)的 content 即最终输出
          if (typeof data.content !== 'undefined' && data.content !== '') {
            const isEnd = data.node_type === 'End' || data.node_title === 'End' || data.node_is_finish;
            if (isEnd) {
              result.data = data.content;
              result.success = true;
              result.msg = result.msg || '截图已成功上传';
            } else if (!result.data) {
              result.data = data.content;
            }
          }
          if (typeof data.data !== 'undefined') {
            result.data = data.data;
          }
        } catch (parseError) {
          if (parseError.message && parseError.message.startsWith('工作流错误')) throw parseError;
          console.warn('响应行解析失败:', line, parseError);
          // 不中断流程，仅记录警告
        }
      }
    }

    // 7. 判定成功：拿到 data 输出（End 节点 content）即视为成功
    if (result.code === 0 || result.data) {
      result.success = true;
      result.msg = result.msg || '截图已成功上传';
      console.log('✅ 截图上传流程执行完成', result);
    } else {
      result.success = false;
      result.msg = result.msg || '未收到有效的成功响应';
      console.warn('⚠️ 上传结果未确认:', result);
    }
    return result;
  } catch (error) {
    console.error('Error in captureAndUpload:', error);
    if (!result.msg) result.msg = error.message || '未知错误';
    result.success = false;
    result.detail = error.message;
    throw result; // 向上抛出包含返回内容的 result
  }
}
