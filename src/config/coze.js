require('dotenv').config();

const config = {
  token: process.env.COZE_TOKEN,
  appId: process.env.COZE_APP_ID,
  registerWorkflowId: process.env.COZE_REGISTER_WF,
  loginWorkflowId: process.env.COZE_LOGIN_WF,
  materialsWorkflowId: process.env.COZE_MATERIALS_WF || '7635623512946737206',
  uploadWorkflowId: '7654990166079602703',
  createCollectionWorkflowId: '7654970692107026478',
  updateCollectionWorkflowId: '7654970749027090441',
  deleteCollectionWorkflowId: '7654970789695717412',
  baseUrl: process.env.COZE_BASE_URL || 'https://api.coze.cn/v1/workflow/run',
  streamBaseUrl: process.env.COZE_STREAM_BASE_URL || 'https://api.coze.cn/v1/workflow/stream_run'
};

console.log('Coze 配置加载:', {
  materialsWorkflowId: config.materialsWorkflowId,
  appId: config.appId,
  token: config.token ? '已配置' : '未配置'
});

module.exports = config;