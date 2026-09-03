document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('tokenInput');
  const userIdInput = document.getElementById('userIdInput');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const statusSection = document.getElementById('statusSection');
  const configSection = document.getElementById('configSection');
  const statusIcon = document.getElementById('statusIcon');
  const statusTitle = document.getElementById('statusTitle');
  const statusMsg = document.getElementById('statusMsg');
  const accountInfo = document.getElementById('accountInfo');
  const rawLabel = document.getElementById('rawLabel');
  const resultRaw = document.getElementById('resultRaw');
  const resultMeta = document.getElementById('resultMeta');
  const settingBtn = document.getElementById('settingBtn');
  const backBtn = document.getElementById('backBtn');
  const clearBtn = document.getElementById('clearBtn');
  const rewardSection = document.getElementById('rewardSection');
  const rewardBtn = document.getElementById('rewardBtn');
  const rewardQr = document.getElementById('rewardQr');
  const rewardHint = document.getElementById('rewardHint');

  let currentUsername = '';
  let pollTimer = null;

  // 切换视图：status（查看状态）/ config（设置 Token）
  function showView(name) {
    statusSection.classList.toggle('hidden', name !== 'status');
    configSection.classList.toggle('hidden', name !== 'config');
  }

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
    statusEl.style.display = 'block';
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // 渲染一次上传的结果（成功/失败 + 返回内容）
  function renderUploadResult(res) {
    stopPolling();
    const ok = !!res.success;
    statusIcon.textContent = ok ? '✅' : '❌';
    statusTitle.textContent = ok ? '上传成功' : '上传失败';
    statusTitle.className = 'result-title ' + (ok ? 'ok' : 'fail');
    statusMsg.textContent = res.msg || (ok ? '截图已成功上传' : '未知错误');

    const raw = (res.raw || res.detail || (ok ? res.data : '') || '').trim();
    if (raw) {
      rawLabel.classList.remove('hidden');
      resultRaw.classList.remove('hidden');
      resultRaw.textContent = raw.length > 2000 ? raw.slice(0, 2000) + '\n…(已截断)' : raw;
    } else {
      rawLabel.classList.add('hidden');
      resultRaw.classList.add('hidden');
    }
    rawLabel.textContent = ok ? '工作流返回内容' : '返回内容';

    const meta = [];
    if (res.code) meta.push('错误码 ' + res.code);
    if (res.logId) meta.push('Logid ' + res.logId);
    if (meta.length) {
      resultMeta.classList.remove('hidden');
      resultMeta.textContent = meta.join('  ·  ');
    } else {
      resultMeta.classList.add('hidden');
    }
    accountInfo.classList.add('hidden');
    clearBtn.classList.remove('hidden');
    // 成功后检查是否达到打赏提醒阈值（仅提醒，不限制）
    if (ok) checkReward();
  }

  // 上传中：实时显示
  function renderUploading(last) {
    statusIcon.textContent = '🔄';
    statusTitle.textContent = '上传中…';
    statusTitle.className = 'result-title';
    const url = last?.web_url || '';
    statusMsg.textContent = url
      ? ('正在上传截图：' + (url.length > 48 ? url.slice(0, 48) + '…' : url))
      : '正在上传截图，请稍候…';
    rawLabel.classList.add('hidden');
    resultRaw.classList.add('hidden');
    resultMeta.classList.add('hidden');
    accountInfo.classList.add('hidden');
    clearBtn.classList.add('hidden');
  }

  // 尚未上传：显示当前账号（用户名/邮箱）
  function renderNoUpload(username) {
    stopPolling();
    currentUsername = username || '';
    statusIcon.textContent = '📤';
    statusTitle.textContent = '尚未上传';
    statusTitle.className = 'result-title';
    statusMsg.textContent = '右键页面即可上传截图到我的 foubow';
    rawLabel.classList.add('hidden');
    resultRaw.classList.add('hidden');
    resultMeta.classList.add('hidden');
    accountInfo.classList.remove('hidden');
    accountInfo.textContent = username
      ? ('当前账号：' + username)
      : '当前账号：未设置（请点「设置 Token」）';
    clearBtn.classList.add('hidden');
    // 即便只是查看状态，达限也提示打赏
    checkReward();
  }

  // 打赏提醒：达限时显示提示区块（仅提醒，不限制上传）
  function checkReward() {
    chrome.storage.local.get('apiToken', ({ apiToken }) => {
      if (!apiToken) return;
      if (typeof PLUGIN_API === 'undefined' || !PLUGIN_API.getQuota) return;
      PLUGIN_API.getQuota(apiToken)
        .then((q) => { if (q && q.limitReached) showReward(); })
        .catch(() => {}); // 查询失败不阻断上传
    });
  }
  function showReward() {
    if (!rewardSection) return;
    rewardSection.classList.remove('hidden');
    rewardQr.src = chrome.runtime.getURL('reward-qrcode.png');
    rewardQr.classList.add('hidden');
    rewardHint.classList.add('hidden');
  }

  // 上传中 -> 轮询 storage 直到 status 变为 done（或超时）
  function pollUntilDone(timeoutMs = 30000) {
    stopPolling();
    const start = Date.now();
    pollTimer = setInterval(() => {
      chrome.storage.local.get('lastUpload', (r) => {
        const last = r.lastUpload;
        if (!last) { // 记录被清除
          clearInterval(pollTimer); pollTimer = null;
          renderNoUpload(currentUsername);
          return;
        }
        if (last.status === 'done') {
          clearInterval(pollTimer); pollTimer = null;
          renderUploadResult(last);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(pollTimer); pollTimer = null;
          statusMsg.textContent = '上传耗时过长，请查看系统通知或重新右键上传';
        }
        // 仍为 uploading：保持「上传中…」展示
      });
    }, 800);
  }

  // 初始化：根据 lastUpload 状态渲染（不再读后即焚，保留记录可反复查看）
  function init() {
    stopPolling();
    chrome.storage.local.get(['apiToken', 'username', 'lastUpload'], (result) => {
      if (result.apiToken) tokenInput.value = result.apiToken;
      if (result.username) userIdInput.value = result.username;

      const last = result.lastUpload;
      if (!last) {
        renderNoUpload(result.username);
      } else if (last.status === 'uploading') {
        renderUploading(last);
        pollUntilDone();
      } else if (last.status === 'done') {
        renderUploadResult(last);
      } else {
        renderNoUpload(result.username);
      }
      showView('status');
    });
  }

  settingBtn.addEventListener('click', () => showView('config'));
  backBtn.addEventListener('click', () => init());

  // 清除上传状态，回到「尚未上传」
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chrome.storage.local.remove('lastUpload', () => init());
    });
  }

  // 打赏：点击展示管理员微信二维码（未打赏也可继续上传）
  if (rewardBtn) {
    rewardBtn.addEventListener('click', () => rewardQr.classList.remove('hidden'));
  }
  if (rewardQr) {
    rewardQr.addEventListener('error', () => {
      rewardQr.classList.add('hidden');
      rewardHint.classList.remove('hidden');
    });
  }

  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    const username = userIdInput.value.trim();
    if (!token) { showStatus('请输入 API Token', 'error'); return; }
    if (!username) { showStatus('请输入用户名（邮箱）', 'error'); return; }

    // 仅保存配置，不自动上传；实际上传由右键菜单触发
    chrome.storage.local.set({ apiToken: token, username: username }, () => {
      showStatus('配置已保存', 'success');
      setTimeout(() => showView('status'), 800);
    });
  });

  init();
});
