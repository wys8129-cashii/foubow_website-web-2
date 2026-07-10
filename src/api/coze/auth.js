const axios = require("axios");
const cozeConfig = require("../../../config/coze");

/**
 * 统一记录 Coze API 响应信息
 */
function logCozeResponse(label, response) {
  console.log(`Coze ${label} 响应:`, response.data);
  const headers = response.headers;
  const costInfo = {
    'x-tt-logid': headers['x-tt-logid'],
    'x-ratelimit-remaining': headers['x-ratelimit-remaining'] || headers['ratelimit-remaining'],
    'x-ratelimit-reset': headers['x-ratelimit-reset'] || headers['ratelimit-reset'],
    'x-request-id': headers['x-request-id'],
  };
  const filtered = Object.entries(costInfo).filter(([, v]) => v !== undefined);
  if (filtered.length > 0) {
    console.log(`Coze ${label} 头部信息:`, Object.fromEntries(filtered));
  }
}

/**
 * 调用 Coze API 获取素材列表
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeGetMaterials(params) {
  try {
    const workflowId = cozeConfig.materialsWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.baseUrl;
    const token = cozeConfig.token;
    
    console.log('调用 Coze 获取素材列表 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email
    });
    
    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
      },
    };
    
    console.log('完整请求体:', JSON.stringify(requestData, null, 2));

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('获取素材列表', response);
    return response.data;
  } catch (error) {
    console.error("Coze 获取素材列表接口调用失败：", error.message);
    throw new Error(`获取素材列表失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 获取合集列表
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeGetCollections(params) {
  try {
    const workflowId = cozeConfig.collectionsWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.baseUrl;
    
    console.log('调用 Coze 获取合集列表 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email
    });
    
    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('获取合集列表', response);
    return response.data;
  } catch (error) {
    console.error("Coze 获取合集列表接口调用失败：", error.message);
    throw new Error(`获取合集列表失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 获取素材详情
 * @param {Object} params 参数
 * @param {string} params.title 素材标题
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeGetMaterialDetail(params) {
  try {
    const workflowId = cozeConfig.materialDetailWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.baseUrl;
    
    console.log('调用 Coze 获取素材详情 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      title: params.title
    });
    
    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        title: params.title,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('获取素材详情', response);
    return response.data;
  } catch (error) {
    console.error("Coze 获取素材详情接口调用失败：", error.message);
    throw new Error(`获取素材详情失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 按合集筛选素材
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @param {string} params.topic 合集名称
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeFilterByCollection(params) {
  try {
    const workflowId = cozeConfig.filterByCollectionWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.baseUrl;
    
    console.log('调用 Coze 按合集筛选素材 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email,
      topic: params.topic
    });
    
    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
        topic: params.topic,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('按合集筛选素材', response);
    return response.data;
  } catch (error) {
    console.error("Coze 按合集筛选素材接口调用失败：", error.message);
    throw new Error(`按合集筛选失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 上传文件到 Coze 文件存储，获取文件 URL
 * @param {Buffer} fileBuffer 文件二进制数据
 * @param {string} fileName 文件名
 * @returns {Promise<string>} 文件 URL
 */
async function cozeUploadFile(fileBuffer, fileName) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName });

    const uploadUrl = 'https://api.coze.cn/v1/files/upload';
    console.log('上传文件到 Coze 文件存储:', { fileName });

    const response = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
        "Authorization": `Bearer ${cozeConfig.token}`,
      },
    });

    logCozeResponse('文件上传', response);

    if (response.data && response.data.data && response.data.data.url) {
      return response.data.data.url;
    }

    if (response.data && response.data.data && response.data.data.id) {
      return response.data.data.id;
    }

    throw new Error('文件上传成功但未获取到 URL: ' + JSON.stringify(response.data));
  } catch (error) {
    console.error('Coze 文件上传失败:', error.message);
    throw new Error(`文件上传失败：${error.response?.data?.msg || error.message}`);
  }
}

/**
 * 调用 Coze API 上传素材
 * @param {Object} params 参数
 * @param {string} params.screenshot 图片 URL
 * @param {string} params.user 用户邮箱
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeUploadMaterial(params) {
  try {
    const workflowId = cozeConfig.uploadWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.streamBaseUrl;

    console.log('调用 Coze 上传素材 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      user: params.user
    });

    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        screenshot: params.screenshot,
        user: params.user,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('上传素材', response);
    return response.data;
  } catch (error) {
    console.error("Coze 上传素材接口调用失败：", error.message);
    throw new Error(`上传素材失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 新增合集
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @param {string} params.input 合集名称
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeCreateCollection(params) {
  try {
    const workflowId = cozeConfig.createCollectionWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.streamBaseUrl;

    console.log('调用 Coze 新增合集 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email,
      input: params.input
    });

    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
        input: params.input,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('新增合集', response);
    return response.data;
  } catch (error) {
    console.error("Coze 新增合集接口调用失败：", error.message);
    throw new Error(`新增合集失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 修改合集
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @param {string} params.input 新合集名称
 * @param {string} params.oldName 旧合集名称
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeUpdateCollection(params) {
  try {
    const workflowId = cozeConfig.updateCollectionWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.streamBaseUrl;

    console.log('调用 Coze 修改合集 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email,
      old_name: params.oldName,
      input: params.input
    });

    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
        input: params.input,
        old_name: params.oldName,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('修改合集', response);
    return response.data;
  } catch (error) {
    console.error("Coze 修改合集接口调用失败：", error.message);
    throw new Error(`修改合集失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 修改素材所属合集
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @param {string} params.title 素材标题
 * @param {string} params.topic 目标合集名称
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeMoveMaterial(params) {
  try {
    const workflowId = cozeConfig.moveMaterialWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.streamBaseUrl;

    console.log('调用 Coze 修改素材所属合集 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email,
      title: params.title,
      topic: params.topic
    });

    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
        title: params.title,
        topic: params.topic,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('修改素材所属合集', response);
    return response.data;
  } catch (error) {
    console.error("Coze 修改素材所属合集接口调用失败：", error.message);
    throw new Error(`修改素材所属合集失败：${error.response?.data?.message || error.message}`);
  }
}

/**
 * 调用 Coze API 删除合集
 * @param {Object} params 参数
 * @param {string} params.email 用户邮箱
 * @param {string} params.input 合集名称
 * @returns {Promise<any>} Coze 接口返回结果
 */
async function cozeDeleteCollection(params) {
  try {
    const workflowId = cozeConfig.deleteCollectionWorkflowId;
    const appId = cozeConfig.appId;
    const baseUrl = cozeConfig.streamBaseUrl;

    console.log('调用 Coze 删除合集 API:', {
      url: baseUrl,
      workflow_id: workflowId,
      app_id: appId,
      email: params.email,
      input: params.input
    });

    const requestData = {
      workflow_id: workflowId,
      app_id: appId,
      parameters: {
        email: params.email,
        input: params.input,
      },
    };

    const response = await axios.post(
      baseUrl,
      requestData,
      {
        headers: {
          "Authorization": `Bearer ${cozeConfig.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logCozeResponse('删除合集', response);
    return response.data;
  } catch (error) {
    console.error("Coze 删除合集接口调用失败：", error.message);
    throw new Error(`删除合集失败：${error.response?.data?.message || error.message}`);
  }
}

// 导出方法
module.exports = {
  cozeGetMaterials,
  cozeGetCollections,
  cozeGetMaterialDetail,
  cozeFilterByCollection,
  cozeUploadFile,
  cozeUploadMaterial,
  cozeCreateCollection,
  cozeUpdateCollection,
  cozeDeleteCollection,
  cozeMoveMaterial,
};