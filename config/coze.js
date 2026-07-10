require('dotenv').config();

module.exports = {
  // ── 敏感信息（来自 .env）──
  token: process.env.COZE_TOKEN,
  appId: process.env.COZE_APP_ID,

  // ── 工作流 ID ──
  materialsWorkflowId:           '7635623512946737206',  // 获取素材列表
  collectionsWorkflowId:         '7635623652596121640',  // 获取合集列表
  materialDetailWorkflowId:      '7635623569224957986',  // 获取素材详情
  filterByCollectionWorkflowId:  '7650828923094695979',  // 按合集筛选素材
  uploadWorkflowId:              '7654990166079602703',  // 上传素材（流式）
  createCollectionWorkflowId:    '7654970692107026478',  // 新增合集（流式）
  updateCollectionWorkflowId:    '7654970749027090441',  // 修改合集（流式）
  deleteCollectionWorkflowId:    '7654970789695717412',  // 删除合集（流式）
  moveMaterialWorkflowId:        '7655030742292283419',  // 修改素材所属合集（流式）

  // ── API 地址 ──
  baseUrl:       process.env.COZE_BASE_URL        || 'https://api.coze.cn/v1/workflow/run',
  streamBaseUrl: process.env.COZE_STREAM_BASE_URL || 'https://api.coze.cn/v1/workflow/stream_run'
};