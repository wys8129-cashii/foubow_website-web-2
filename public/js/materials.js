// ===== Data =====
let materials = [];
let collections = [];           // API 返回的合集（用户自己创建的）
let editingCollection = null;
let uploadImages = [];

// ===== State =====
let viewMode = 'all';           // 'all' | 'overview' | 'collection' | 'search'
let activeCollection = 'all';
let selectedId = null;
let panelMode = null;           // null | 'detail' | 'waterfall'
let panelCollection = null;
let searchResults = [];         // 搜索结果列表
let searchKeyword = '';         // 当前搜索关键词

// Helper
function getMaterialsByCollection(name) { return materials.filter(m => m.collection === name); }
function getAllCollections() { return [...collections]; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// 产出物模拟数据
const mockOutputs = {
  '设计灵感': [
    { emoji: '🎨', title: '色彩方案文档' },
    { emoji: '📐', title: '设计规范指南' },
    { emoji: '🖼️', title: '灵感板合集' },
    { emoji: '✏️', title: '手绘草图' },
    { emoji: '📱', title: '交互原型' },
  ],
  '穿着搭配': [
    { emoji: '👗', title: '春季穿搭指南' },
    { emoji: '👔', title: '职场穿搭方案' },
    { emoji: '👜', title: '配饰搭配建议' },
  ],
  'default': [
    { emoji: '📄', title: '分析报告' },
    { emoji: '📊', title: '数据汇总' },
    { emoji: '💡', title: '创意方案' },
    { emoji: '📝', title: '会议纪要' },
  ]
};

function getOutputsByCollection(name) {
  return mockOutputs[name] || mockOutputs['default'];
}

// 备用数据（当 API 调用失败时使用）
const fallbackMaterials = [
  {
    id: '1', collection: '设计灵感', aspectRatio: '3:4',
    previewBg: 'bg-gradient-to-br from-slate-50 to-blue-50',
    title: 'UI Notes：侧边弹窗UI设计灵感素材站',
    url: 'https://uinotes.com/pin?components=9',
    details: {
      summary: ['平台总计收录155660张UI设计截图，为设计师提供设计灵感', '支持多种检索方式：组件功能筛选、关键字搜图、OCR搜图'],
      pageContent: ['展示多个不同产品场景的侧边弹窗UI实例', '每个截图均标注来源产品名称，方便追溯参考'],
      navigation: ['顶部设置搜索栏，可快速搜索截图和App', '支持按组件类型筛选：弹窗、导航栏、卡片、表单等'],
    },
    getPreviewHTML() { return `<div class="flex flex-col items-center justify-center h-full p-4 text-center"><div class="text-xs font-semibold text-slate-700 mb-1">在155660张截图中寻找UI灵感</div><div class="text-[10px] text-slate-500 mb-3 leading-relaxed max-w-[200px]">组件和功能筛选、关键字搜图、OCR搜图，多种方式帮你快速找到灵感</div><div class="flex gap-2">${[1,2,3].map(()=>'<div class="w-14 h-20 bg-white rounded border border-slate-200 shadow-sm flex items-center justify-center"><div class="w-10 h-14 bg-slate-100 rounded-sm"></div></div>').join('')}</div></div>`; }
  },
  {
    id: '2', collection: '穿着搭配', aspectRatio: '9:12',
    previewBg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    title: '苍苍APP广场「这里有好多狗狗呀」收藏夹',
    url: 'https://cangcang.app/square/dogs',
    details: {
      summary: ['苍苍APP广场热门收藏夹，收录大量可爱狗狗图片', '用户互动活跃，包含评论、点赞等社交功能'],
      pageContent: ['展示用户分享的各种狗狗照片', '支持点赞、评论、收藏等互动操作'],
      navigation: ['广场首页可浏览热门收藏夹', '支持搜索和分类浏览不同主题的收藏夹'],
    },
    getPreviewHTML() { return `<div class="flex flex-col items-center justify-center h-full p-3"><div class="text-xs font-semibold text-amber-800 mb-2">「这里有好多狗狗呀」</div><div class="grid grid-cols-3 gap-1.5">${[1,2,3,4,5,6].map(()=>'<div class="w-12 h-12 rounded bg-amber-200 flex items-center justify-center text-lg">🐕</div>').join('')}</div><div class="flex items-center gap-3 mt-2 text-[10px] text-amber-600"><span>💬 128</span><span>❤️ 256</span></div></div>`; }
  },
  {
    id: '3', collection: '设计灵感', aspectRatio: '3:4',
    previewBg: 'bg-gradient-to-br from-purple-50 to-pink-50',
    title: 'Dribbble：全球设计师创意作品展示平台',
    url: 'https://dribbble.com/shots/popular',
    details: {
      summary: ['全球知名设计师社区，汇集海量创意设计作品', '涵盖UI/UX、插画、品牌设计等多个领域'],
      pageContent: ['按热度排序展示设计师作品', '支持按类别、标签筛选作品'],
      navigation: ['顶部导航栏支持分类浏览', '支持搜索设计师和作品关键词'],
    },
    getPreviewHTML() { return `<div class="flex flex-col items-center justify-center h-full p-4 text-center"><div class="text-xs font-semibold text-purple-700 mb-1">Dribbble 设计灵感</div><div class="text-[10px] text-purple-500 mb-3 leading-relaxed max-w-[200px]">全球顶尖设计师作品集，每日更新创意灵感</div><div class="grid grid-cols-2 gap-2">${[1,2,3,4].map(()=>'<div class="w-16 h-12 rounded bg-purple-100 flex items-center justify-center"><div class="w-8 h-6 rounded-sm bg-purple-200"></div></div>').join('')}</div></div>`; }
  },
];

// ===== API =====
async function fetchMaterials() {
  let email = null;
  try { email = localStorage.getItem('userEmail'); } catch (e) { console.warn('无法访问 localStorage:', e.message); }
  if (!email) email = 'guest@foubow.fun';

  try {
    console.log('正在调用 API 获取素材列表，邮箱:', email);
    const response = await fetchWithTimeout('/api/coze/materials', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
    const result = await response.json();
    console.log('API 返回结果:', result);
    if (result.data) {
      const parsed = parseMaterialsData(result.data);
      console.log('解析后的素材数据:', parsed);
      return parsed;
    } else {
      console.warn('API 返回失败或无数据，使用备用数据:', result.msg);
      return fallbackMaterials;
    }
  } catch (error) {
    console.error('获取素材列表错误，使用备用数据:', error.message);
    return fallbackMaterials;
  }
}

function parseMaterialsData(data) {
  try {
    console.log('正在解析素材数据:', data);
    
    let parsedData;
    
    // 如果 data 已经是对象，直接使用
    if (typeof data === 'object') {
      parsedData = data;
    } else {
      // 如果 data 是字符串，尝试解析
      parsedData = JSON.parse(data);
    }
    
    // 处理 Coze API 返回的 output 格式
    if (parsedData.output && Array.isArray(parsedData.output)) {
      console.log('检测到 output 格式，正在转换:', parsedData.output.length, '条数据');
      return parsedData.output.map((item, index) => parseMaterialItem(item, index));
    }
    
    // 如果 data.data 存在（嵌套情况）
    if (parsedData.data) {
      const innerData = typeof parsedData.data === 'string' ? JSON.parse(parsedData.data) : parsedData.data;
      
      // 处理内层的 output 格式
      if (innerData.output && Array.isArray(innerData.output)) {
        console.log('检测到嵌套 output 格式，正在转换:', innerData.output.length, '条数据');
        return innerData.output.map((item, index) => parseMaterialItem(item, index));
      }
      
      // 处理内层的 materials 格式
      if (innerData.materials && Array.isArray(innerData.materials)) {
        return innerData.materials.map((item, index) => parseMaterialItem(item, index));
      }
    }
    
    // 处理 materials 格式
    if (parsedData.materials && Array.isArray(parsedData.materials)) {
      return parsedData.materials.map((item, index) => parseMaterialItem(item, index));
    }
    
    console.warn('未找到有效素材数据，使用备用数据');
    return fallbackMaterials;
  } catch (error) {
    console.error('解析素材数据错误，使用备用数据:', error);
    return fallbackMaterials;
  }
}

// 获取合集列表
async function fetchCollections() {
  let email = null;
  
  // 尝试从 localStorage 获取邮箱
  try {
    email = localStorage.getItem('userEmail');
  } catch (e) {
    console.warn('无法访问 localStorage:', e.message);
  }
  
  if (!email) {
    email = 'wcc';
  }

  try {
    console.log('正在调用 API 获取合集列表，邮箱:', email);
    const response = await fetchWithTimeout('/api/coze/collections', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });

    const result = await response.json();
    console.log('合集列表 API 返回结果:', result);
    
    if (result.data) {
      return parseCollectionsData(result.data);
    }
    
    return [];
  } catch (error) {
    console.error('获取合集列表错误:', error.message);
    return [];
  }
}

// 解析合集数据
function parseCollectionsData(data) {
  try {
    console.log('正在解析合集数据, 原始data:', data);
    
    let parsedData;
    
    if (typeof data === 'object') {
      parsedData = data;
    } else {
      parsedData = JSON.parse(data);
    }
    
    console.log('解析后的parsedData:', parsedData);
    
    // 如果 parsedData 有 data 字段，说明是嵌套结构，需要进一步解析
    let finalData = parsedData;
    if (parsedData.data) {
      console.log('检测到嵌套的 data 字段，正在解析:', parsedData.data);
      if (typeof parsedData.data === 'string') {
        finalData = JSON.parse(parsedData.data);
      } else {
        finalData = parsedData.data;
      }
    }
    
    console.log('最终解析数据:', finalData);
    console.log('finalData.output:', finalData.output);
    
    // 处理 Coze API 返回的 output 格式
    if (finalData.output && Array.isArray(finalData.output)) {
      console.log('检测到 output 格式，合集数量:', finalData.output.length);
      console.log('第一条合集数据:', finalData.output[0]);
      return finalData.output.map((item, index) => ({
        id: String(item.id || index + 1),
        topic: item.topic || item.topic_name || item.title || item.name || '未命名合集',
        count: item.count || item.material_count || 0,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('解析合集数据错误:', error);
    return [];
  }
}

// 获取素材详情
async function fetchMaterialDetail(title) {
  try {
    console.log('正在调用 API 获取素材详情，标题:', title);
    const response = await fetchWithTimeout('/api/coze/material/detail', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });

    const result = await response.json();
    console.log('素材详情 API 返回结果:', result);
    
    // Coze API 返回的 code 可能是 0，只要 data 有值就处理
    if (result.data) {
      return parseMaterialDetailData(result.data);
    }
    
    return null;
  } catch (error) {
    console.error('获取素材详情错误:', error.message);
    return null;
  }
}

// 解析素材详情数据
function parseMaterialDetailData(data) {
  try {
    console.log('正在解析素材详情数据:', data);
    
    let parsedData;
    
    if (typeof data === 'object') {
      parsedData = data;
    } else {
      parsedData = JSON.parse(data);
    }
    
    // 如果 parsedData 有 data 字段，说明是嵌套结构，需要进一步解析
    let finalData = parsedData;
    if (parsedData.data) {
      console.log('检测到嵌套的 data 字段，正在解析:', parsedData.data);
      if (typeof parsedData.data === 'string') {
        finalData = JSON.parse(parsedData.data);
      } else {
        finalData = parsedData.data;
      }
    }
    
    console.log('最终解析到的详情项:', finalData);
    return {
      title: finalData.title || '',
      url: finalData.web_url || finalData.url || '',
      content: finalData.content || '',
      coverUrl: finalData.cover_url || finalData.coverUrl || '',
      tags: finalData.tag || [],
    };
  } catch (error) {
    console.error('解析素材详情数据错误:', error);
    return null;
  }
}

// 按合集筛选素材
async function filterByCollection(topic) {
  let email = null;
  
  try {
    email = localStorage.getItem('userEmail');
  } catch (e) {
    console.warn('无法访问 localStorage:', e.message);
  }
  
  if (!email) {
    email = 'wcc';
  }

  try {
    console.log('正在调用 API 按合集筛选素材，邮箱:', email, '合集:', topic);
    const response = await fetchWithTimeout('/api/coze/materials/filter', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ topic }),
    });

    const result = await response.json();
    console.log('按合集筛选 API 返回结果:', result);
    
    if (result.code === 1 && result.data) {
      return parseMaterialsData(result.data);
    }
    
    return [];
  } catch (error) {
    console.error('按合集筛选素材错误:', error.message);
    return [];
  }
}

function parseMaterialItem(item, index) {
  // 检测图片比例（通过加载图片获取实际尺寸）
  function detectAspectRatio(coverUrl) {
    return new Promise((resolve) => {
      if (!coverUrl) {
        resolve('3:4'); // 默认横图比例
        return;
      }
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        // 横图宽 > 高（ratio > 1），竖图高 > 宽（ratio < 1）
        if (ratio >= 0.8) {
          // 接近正方形或横图，使用 4:3
          resolve('4:3');
        } else {
          // 竖图，使用 3:5
          resolve('3:5');
        }
      };
      img.onerror = () => {
        resolve('4:3'); // 默认横图比例
      };
      img.src = coverUrl;
    });
  }
  
  return {
    id: String(item.id || index + 1),
    collection: item.topic || item.topic_name || item.collection || '未分类',
    aspectRatio: item.aspectRatio || '4:3',
    coverUrl: item.cover_url || item.coverUrl || '',
    coverPos: item.coverpos || null,
    previewBg: item.previewBg || 'bg-gradient-to-br from-slate-50 to-blue-50',
    title: item.title || '素材标题',
    url: item.url || '',
    details: {
      summary: item.summary ? [item.summary] : (item.details?.summary || ['暂无摘要信息']),
      pageContent: item.details?.pageContent || ['暂无页面内容'],
      navigation: item.details?.navigation || ['暂无导航信息'],
    },
    detectAspectRatio: () => detectAspectRatio(item.cover_url || item.coverUrl),
    getPreviewHTML() {
      if (this.coverUrl) {
        const pos = this.coverPos ? ` style="object-position:${this.coverPos}"` : '';
        return `<img src="${this.coverUrl}" alt="${this.title}" class="w-full h-full object-cover" data-cover-id="${this.id}"${pos} />`;
      }
      if (item.previewHTML) {
        return item.previewHTML;
      }
      return `<div class="flex flex-col items-center justify-center h-full p-4 text-center"><div class="text-xs font-semibold text-slate-700 mb-1">${this.title}</div><div class="flex gap-2 mt-3">${[1,2,3].map(()=>'<div class="w-10 h-10 rounded bg-slate-100"></div>').join('')}</div></div>`;
    }
  };
}

// ===== Main Content Rendering =====
function renderMainContent() {
  if (viewMode === 'overview') { renderOverview(); return; }
  if (viewMode === 'all') { renderAllMaterials(); return; }
  if (viewMode === 'collection') { renderCollectionDetail(activeCollection); return; }
  if (viewMode === 'search') { renderSearchResults(); return; }
}

function renderOverview() {
  const container = document.getElementById('main-content');
  let html = '<h1 class="text-base font-semibold text-[#1A1A1A] mb-5">素材总览</h1>';
  const allCollections = getAllCollections();
  if (allCollections.length === 0) {
    html += '<div class="text-sm text-[#9CA3AF] text-center py-12">暂无合集，请先添加合集</div>';
    container.innerHTML = html;
    return;
  }
  html += '<div class="overview-grid">';
  allCollections.forEach(name => {
    const items = getMaterialsByCollection(name);
    const showCards = items.slice(0, 4);
    const escName = escHtml(name);
    const outputs = getOutputsByCollection(name);
    html += `<div class="collection-section">
      <div class="section-header">
        <h2><span class="collection-name-link" onclick="selectCollection('${escName}')">${escName}</span><span class="count">${items.length} 个素材</span><span class="count">${outputs.length} 个产出物</span></h2>
        <span class="more-link" onclick="openWaterfall('${escName}')">查看更多 <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
      </div>`;
    if (items.length === 0) {
      html += '<div class="text-xs text-[#9CA3AF] py-6 text-center">暂无素材</div>';
    } else {
      html += '<div class="mini-cards">';
      showCards.forEach(item => {
                html += `<div class="mini-card" onclick="selectCard('${item.id}')" title="${escHtml(item.title)}">
          <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full aspect-[4/3]">
            ${item.getPreviewHTML().replace(/text-xs/g,'text-[7px]').replace(/text-\[10px\]/g,'text-[7px]').replace(/text-sm/g,'text-[8px]').replace(/text-lg/g,'text-[9px]').replace(/text-2xl/g,'text-xs').replace(/w-14 h-20/g,'w-9 h-12').replace(/w-10 h-14/g,'w-6 h-8').replace(/w-16 h-12/g,'w-10 h-8').replace(/w-8 h-6/g,'w-5 h-4').replace(/w-20 h-16/g,'w-12 h-10').replace(/w-12 h-12/g,'w-7 h-7').replace(/w-10 h-10/g,'w-6 h-6').replace(/gap-2/g,'gap-0.5').replace(/gap-1\.5/g,'gap-0.5').replace(/gap-3/g,'gap-1').replace(/p-4 text-center/g,'p-1.5 text-center').replace(/p-3/g,'p-1.5').replace(/max-w-\[200px\]/g,'max-w-[90px]').replace(/mb-3/g,'mb-1').replace(/mb-2/g,'mb-0.5').replace(/mb-1/g,'mb-0').replace(/mt-2/g,'mt-0.5').replace(/leading-relaxed/g,'leading-tight').replace(/rounded /g,'rounded-sm ').replace(/rounded-lg /g,'rounded-sm ')}
          </div>
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  lucide.createIcons();
}

function renderAllMaterials() {
  const container = document.getElementById('main-content');
  container.innerHTML = `<h1 class="text-base font-semibold text-[#1A1A1A] mb-4">所有素材</h1><div class="cards-grid" id="cards-container"></div>`;
  renderCardsInto('cards-container', materials);
}

function renderCollectionDetail(name) {
  const container = document.getElementById('main-content');
  const items = getMaterialsByCollection(name);
  const outputs = getOutputsByCollection(name);
  const escName = escHtml(name);
  container.innerHTML = `<div class="flex items-center justify-between gap-2 mb-5 flex-wrap">
    <div class="flex items-center gap-2 min-w-0">
      <button onclick="navigateTo('overview')" class="p-1.5 rounded-md hover:bg-[#F3F4F6] transition-colors flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1A1A1A] shrink-0">
        <i data-lucide="arrow-left" class="w-4 h-4"></i> 返回
      </button>
      <h1 class="text-base font-semibold text-[#1A1A1A] truncate">${escName} <span class="text-xs font-normal text-[#9CA3AF] ml-1">${items.length} 个素材</span><span class="text-xs font-normal text-[#9CA3AF] ml-1 cursor-pointer hover:text-[#1A1A1A] underline underline-offset-2" onclick="openCollectionOutputs('${escName}')">${outputs.length} 个产出物</span></h1>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button id="btn-export-collection" onclick="exportCollectionAsMD('${escName}')" class="px-2.5 py-1.5 text-xs rounded-md bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors flex items-center gap-1.5" title="导出当前合集为 Markdown">
        <i data-lucide="download" class="w-3.5 h-3.5"></i>导出
      </button>
      <button id="btn-share-collection" onclick="shareCollection('${escName}')" class="px-2.5 py-1.5 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors flex items-center gap-1.5" title="生成移动端阅览的分享页 HTML">
        <i data-lucide="share-2" class="w-3.5 h-3.5"></i>分享
      </button>
    </div>
  </div><div class="cards-grid" id="cards-container"></div>`;
  if (items.length === 0) {
    document.getElementById('cards-container').innerHTML = '<div class="col-span-full text-sm text-[#9CA3AF] text-center py-12">该合集暂无素材</div>';
  } else {
    renderCardsInto('cards-container', items);
  }
  lucide.createIcons();
}

function renderCardsInto(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map(item => {
        const isActive = item.id === selectedId;
    return `<div><div onclick="selectCard('${item.id}')"
      class="bg-white rounded-[10px] border overflow-hidden cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md ${isActive ? 'border-[#1A1A1A] shadow-md' : 'border-[#E5E7EB]'}">
      <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full aspect-[4/3]">${item.getPreviewHTML()}</div>
      <div class="p-3">
        <h3 class="text-sm font-medium text-[#1A1A1A] leading-snug line-clamp-2 mb-1">${item.title}</h3>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1 text-xs text-[#9CA3AF] truncate flex-1 min-w-0"><i data-lucide="external-link" class="w-2.5 h-2.5 shrink-0"></i><span class="truncate">${item.url}</span></div>
          ${item.url ? `<button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors shrink-0" onclick="event.stopPropagation(); window.open('${item.url}','_blank')" title="新窗口打开链接"><i data-lucide="square-arrow-out-up-right" class="w-3.5 h-3.5 text-[#9CA3AF]"></i></button>` : ''}
        </div>
      </div>
    </div></div>`;
  }).join('');
  lucide.createIcons();
}

// ===== Right Panel =====
function renderRightPanel() {
  const panel = document.getElementById('detail-desktop');
  if (!panelMode) { panel.style.display = 'none'; return; }
  panel.style.display = 'flex';
  const content = document.getElementById('panel-content');
  if (panelMode === 'detail' && selectedId) { renderPanelDetail(content); }
  else if (panelMode === 'waterfall' && panelCollection) { renderPanelWaterfall(content); }
  else if (panelMode === 'collection-output' && panelCollection) { renderCollectionOutputPanel(content); }
  else if (panelMode === 'collection-output' && panelCollection) { renderCollectionOutputPanel(content); }
}

function renderPanelDetail(content) {
  const item = materials.find(m => m.id === selectedId);
  if (!item) return;
  const imgHTML = item.coverUrl
    ? `<div class="w-full relative overflow-hidden" id="detail-cover-frame">
        <img src="${item.coverUrl}" alt="${escHtml(item.title)}" id="detail-cover-img" class="w-full h-auto cursor-zoom-in" style="object-position:${item.coverPos||'50% 50%'}" onclick="openLightbox('${item.coverUrl}')" />
      </div>`
    : `<div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full aspect-[4/3]">${item.getPreviewHTML()}</div>`;
  content.innerHTML = `<div class="flex flex-col h-full">
    <div class="panel-header">
      <span class="text-sm font-medium text-[#1A1A1A]">素材详情</span>
      <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" onclick="closeRightPanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
    </div>
    <div class="sticky top-0 z-10 bg-white relative" id="detail-cover-wrap">
      ${imgHTML}
      <div class="absolute bottom-2 right-2 flex gap-2 z-20" id="detail-cover-tools">
        <button type="button" id="btn-cover-fit" class="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F3F4F6] transition-colors" title="查看图片核心信息"><i data-lucide="eye" class="w-4 h-4 text-[#4B5563]"></i></button>
        <button type="button" id="btn-cover-crop" class="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F3F4F6] transition-colors" title="拖动调整裁剪区域"><i data-lucide="move-vertical" class="w-4 h-4 text-[#4B5563]"></i></button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto scrollbar-thin">
      <div class="p-4 space-y-4">
        <h2 class="text-sm font-semibold text-[#1A1A1A] leading-snug">${item.title}</h2>
        <div class="flex items-center justify-between">
          <span class="inline-block px-2.5 py-1 text-[11px] rounded-md bg-[#F3F4F6] text-[#6B7280] cursor-pointer hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors" onclick="showChangeCollectionModal('${item.id}')">${escHtml(item.collection)}</span>
          <button class="inline-flex items-center gap-0.5 px-2.5 py-1 text-[11px] rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" onclick="deleteMaterial('${item.id}')"><i data-lucide="trash-2" class="w-3 h-3"></i>删除</button>
        </div>
        <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">核心信息</h3><ul class="space-y-1">${item.details.summary.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">•</span>${s}</li>`).join('')}</ul></div>
      </div>
    </div>
    <div class="shrink-0 px-4 py-3 border-t border-[#E5E7EB]">
      <div class="flex items-center gap-1.5 text-[11px] text-[#6B7280] mb-2.5 truncate"><i data-lucide="external-link" class="w-2.5 h-2.5 shrink-0"></i><span class="truncate">${item.url}</span></div>
      <div class="flex items-center gap-1.5">
        <button class="flex-1 py-2 px-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] text-sm text-[#4B5563] transition-colors flex items-center justify-center gap-1" onclick="copyLink('${item.url}')"><i data-lucide="copy" class="w-3.5 h-3.5"></i> 复制链接</button>
        <button class="flex-1 py-2 px-3 rounded-lg bg-[#1A1A1A] text-white text-sm hover:bg-[#333] transition-colors flex items-center justify-center gap-1" onclick="window.open('${item.url}','_blank')"><i data-lucide="external-link" class="w-3.5 h-3.5"></i> 打开</button>
      </div>
    </div>
  </div>`;
  lucide.createIcons();
  bindCoverEdit(item);
}

function bindCoverEdit(item) {
  const frame = document.getElementById('detail-cover-frame');
  const img = document.getElementById('detail-cover-img');
  const btnFit = document.getElementById('btn-cover-fit');
  const btnCrop = document.getElementById('btn-cover-crop');
  if (!frame || !img) return;

  let fitMode = false;
  let cropMode = false;

  const exitFit = () => {
    fitMode = false;
    frame.classList.remove('bg-transparent', 'flex', 'justify-center');
    img.classList.add('w-full');
    img.classList.remove('max-h-[27vh]', 'shadow-2xl', 'rounded-xl');
    img.style.objectPosition = item.coverPos || '50% 50%';
  };
  const enterFit = () => {
    frame.classList.add('bg-transparent', 'flex', 'justify-center');
    img.classList.remove('w-full');
    img.classList.add('max-h-[27vh]', 'shadow-2xl', 'rounded-xl');
    img.style.objectPosition = '50% 50%';
  };
  btnFit?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cropMode) exitCrop();
    fitMode = !fitMode;
    if (fitMode) enterFit(); else exitFit();
  });

  // ===== 裁剪：拖动 4:3 显示区域（裁剪框），而非拖动图片本身 =====
  const cropWin = document.createElement('div');
  cropWin.id = 'cover-crop-window';
  cropWin.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);width:100%;aspect-ratio:4/3;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.5);cursor:ns-resize;display:none;touch-action:none;z-index:5;';
  frame.appendChild(cropWin);

  // 计算 frame 当前宽高比（详情页 w-full h-auto，frame 实际比例 ≈ 图片自然比例）
  function getAlpha() {
    const r = frame.getBoundingClientRect();
    return r.width / r.height;
  }

  // cropWin 中心在 frame (即图片) 坐标里的纵向比例 c
  //   列表卡片 4:3 容器，image object-cover：要把图片的某个 4:3 区域摆到容器中央，
  //   用 object-position: 50% Y%。视觉上 Y% 决定 image 顶端往下偏移多少。
  // 反推/正推公式（设 α = image_w / image_h）：
  //   Y = (c − 3α/8) / (1 − 3α/4) × 100,   当 α < 4/3（竖图，会上下溢出）；
  //   α ≥ 4/3 时图片完全 fit 容器，Y 在视觉上无效（任何值都一样），用 50%。
  function centerFracToPosY(c, alpha) {
    const denom = 1 - 3 * alpha / 4;
    if (denom <= 0.01) return 50; // 横图：完全 fit，object-position 不影响可见区域
    const y = (c - 3 * alpha / 8) / denom * 100;
    return Math.max(0, Math.min(100, y));
  }
  function posYToCenterFrac(y, alpha) {
    const denom = 1 - 3 * alpha / 4;
    if (denom <= 0.01) return 0.5;
    return (y / 100) * denom + 3 * alpha / 8;
  }

  const setCropFromPointer = (clientY) => {
    const rect = frame.getBoundingClientRect();
    const winH = cropWin.offsetHeight || (rect.width * 3 / 4);
    let top = (clientY - rect.top) - winH / 2;
    top = Math.max(0, Math.min(rect.height - winH, top));
    cropWin.style.top = top + 'px';
    const centerFrac = (top + winH / 2) / rect.height; // 0(顶) → 1(底)，frame 坐标系
    const alpha = getAlpha();
    const posY = centerFracToPosY(centerFrac, alpha);
    const pos = `50% ${Math.round(posY)}%`;
    item.coverPos = pos;
    refreshCoverInLists(item.id, pos);
  };

  let dragging = false;
  const onDown = (e) => {
    if (!cropMode) return;
    dragging = true;
    setCropFromPointer(e.touches ? e.touches[0].clientY : e.clientY);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    setCropFromPointer(e.touches ? e.touches[0].clientY : e.clientY);
    e.preventDefault();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchend', onUp);
    // 拖动结束不保存——只有点击"确定"按钮才保存
  };

  const enterCrop = () => {
    cropMode = true;
    if (fitMode) exitFit();
    // 确保显示完整原图用于选择裁剪区域
    frame.classList.remove('flex', 'justify-center');
    img.classList.add('w-full');
    img.classList.remove('max-h-[27vh]', 'shadow-2xl', 'rounded-xl');
    img.style.objectPosition = '50% 50%';
    img.style.pointerEvents = 'none'; // 防止点遮罩区误触开放大
    // 定位裁剪框到当前 coverPos：先反推 frame 中心比例，再换算 top
    const rect = frame.getBoundingClientRect();
    const alpha = getAlpha();
    const m = (item.coverPos || '50% 50%').match(/(\d+(?:\.\d+)?)%/g);
    const yPct = (m && m[1]) ? parseFloat(m[1]) : 50;
    const centerFrac = posYToCenterFrac(yPct, alpha);
    const winH = cropWin.offsetHeight || (rect.width * 3 / 4);
    let top = centerFrac * rect.height - winH / 2;
    top = Math.max(0, Math.min(rect.height - winH, top));
    cropWin.style.top = top + 'px';
    cropWin.style.display = 'block';
    // 裁剪按钮变身：绿底白色对勾 + "确定"标题
    // 必须移除 bg-white，否则 CSS 中靠后的 bg-white 会覆盖 bg-emerald-500（两者 specificity 相同）
    btnCrop?.classList.remove('bg-white', 'hover:bg-[#F3F4F6]');
    btnCrop?.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
    btnCrop.title = '确定并保存裁剪';
    const ic = btnCrop.querySelector('i');
    if (ic) {
      ic.setAttribute('data-lucide', 'check');
      ic.classList.remove('text-[#4B5563]');
      ic.classList.add('text-white');
      if (window.lucide) window.lucide.createIcons();
    }
  };
  const exitCrop = () => {
    cropMode = false;
    cropWin.style.display = 'none';
    img.style.pointerEvents = '';
    // 还原裁剪按钮：白底灰 move-vertical
    btnCrop?.classList.add('bg-white', 'hover:bg-[#F3F4F6]');
    btnCrop?.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
    btnCrop.title = '拖动调整裁剪区域';
    const ic = btnCrop.querySelector('i');
    if (ic) {
      ic.setAttribute('data-lucide', 'move-vertical');
      ic.classList.add('text-[#4B5563]');
      ic.classList.remove('text-white');
      if (window.lucide) window.lucide.createIcons();
    }
  };

  cropWin.addEventListener('mousedown', onDown);
  cropWin.addEventListener('touchstart', onDown, { passive: false });
  btnCrop?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cropMode) {
      // 当前是"确定"按钮形态：保存并退出裁剪
      saveCoverPos(item);
      exitCrop();
    } else {
      enterCrop();
    }
  });
}

let _coverSaveTimer = null;
function saveCoverPos(item) {
  if (!item || !item.coverPos) return;
  const payload = { title: item.title, coverPos: item.coverPos };
  clearTimeout(_coverSaveTimer);
  _coverSaveTimer = setTimeout(async () => {
    try {
      const res = await fetchWithTimeout('/api/coze/materials/cover', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const r = await res.json();
      if (r.code !== 1) console.warn('保存封面裁剪位置失败:', r.msg);
    } catch (e) {
      console.warn('保存封面裁剪位置异常:', e.message);
    }
  }, 400);
}

function refreshCoverInLists(id, pos) {
  document.querySelectorAll(`img[data-cover-id="${id}"]`).forEach(el => {
    el.style.objectPosition = pos;
  });
}

function renderPanelWaterfall(content) {
  const items = getMaterialsByCollection(panelCollection);
  const escPanel = escHtml(panelCollection);
  let html = `<div class="flex flex-col h-full">
    <div class="panel-header">
      <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" onclick="closeRightPanel()"><i data-lucide="x" class="w-3.5 h-3.5 text-[#6B7280]"></i></button>
      <span class="text-sm font-semibold text-[#1A1A1A]">${escPanel}</span>
      <span class="text-xs text-[#9CA3AF]">${items.length} 个素材</span>
    </div>
    <div class="flex-1 overflow-y-auto scrollbar-thin">`;
  if (items.length === 0) { html += '<div class="text-sm text-[#9CA3AF] text-center py-12">该合集暂无素材</div>'; }
  else {
    html += '<div class="panel-grid">';
    items.forEach(item => {
      const isActive = item.id === selectedId;
            html += `<div class="panel-card ${isActive ? 'ring-2 ring-[#1A1A1A]' : ''}" onclick="selectCard('${item.id}')">
        <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full aspect-[4/3]">${item.getPreviewHTML().replace(/text-xs/g,'text-[7px]').replace(/text-\[10px\]/g,'text-[7px]').replace(/text-sm/g,'text-[8px]').replace(/text-lg/g,'text-[9px]').replace(/text-2xl/g,'text-xs').replace(/w-14 h-20/g,'w-8 h-11').replace(/w-10 h-14/g,'w-5 h-7').replace(/w-16 h-12/g,'w-9 h-7').replace(/w-8 h-6/g,'w-4 h-3').replace(/w-20 h-16/g,'w-10 h-8').replace(/w-12 h-12/g,'w-6 h-6').replace(/w-10 h-10/g,'w-5 h-5').replace(/gap-2/g,'gap-0.5').replace(/gap-1\.5/g,'gap-0.5').replace(/gap-3/g,'gap-1').replace(/p-4 text-center/g,'p-1 text-center').replace(/p-3/g,'p-1').replace(/max-w-\[200px\]/g,'max-w-[80px]').replace(/mb-3/g,'mb-0.5').replace(/mb-2/g,'mb-0').replace(/mb-1/g,'mb-0').replace(/mt-2/g,'mt-0.5').replace(/leading-relaxed/g,'leading-tight')}</div>
        <div class="p-2"><div class="text-[10px] font-medium text-[#1A1A1A] leading-snug line-clamp-2">${escHtml(item.title)}</div></div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div></div>';
  content.innerHTML = html;
  lucide.createIcons();
}

function renderCollectionOutputPanel(content) {
  const outputs = getOutputsByCollection(panelCollection);
  const escCol = escHtml(panelCollection);
  let html = `<div class="flex flex-col h-full">
    <div class="panel-header">
      <span class="text-sm font-medium text-[#1A1A1A]">产出物</span>
      <div class="flex items-center gap-2">
        <button class="px-2 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" onclick="alert('AI 总结功能即将上线')">AI 总结</button>
        <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" onclick="closeRightPanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto scrollbar-thin">`;
  if (outputs.length === 0) {
    html += '<div class="text-sm text-[#9CA3AF] text-center py-12">暂无产出物</div>';
  } else {
    html += '<div class="p-3 space-y-2">';
    outputs.forEach(o => {
      html += `<div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#F8F9FA] border border-[#EAECF0] hover:bg-[#F0F1F3] transition-colors cursor-pointer">
        <span class="text-lg">${o.emoji}</span>
        <span class="text-sm text-[#1A1A1A] font-medium">${escHtml(o.title)}</span>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div></div>';
  content.innerHTML = html;
  lucide.createIcons();
}

function renderCollectionOutputPanel(content) {
  const outputs = getOutputsByCollection(panelCollection);
  const escCol = escHtml(panelCollection);
  let html = `<div class="flex flex-col h-full">
    <div class="panel-header">
      <span class="text-sm font-medium text-[#1A1A1A]">产出物</span>
      <div class="flex items-center gap-2">
        <button class="px-2 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" onclick="alert('AI 总结功能即将上线')">AI 总结</button>
        <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" onclick="closeRightPanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto scrollbar-thin">`;
  if (outputs.length === 0) {
    html += '<div class="text-sm text-[#9CA3AF] text-center py-12">暂无产出物</div>';
  } else {
    html += '<div class="p-3 space-y-2">';
    outputs.forEach(o => {
      html += `<div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#F8F9FA] border border-[#EAECF0] hover:bg-[#F0F1F3] transition-colors cursor-pointer"><span class="text-lg">${o.emoji}</span><span class="text-sm text-[#1A1A1A] font-medium">${escHtml(o.title)}</span></div>`;
    });
    html += '</div>';
  }
  html += '</div></div>';
  content.innerHTML = html;
  lucide.createIcons();
}

// ===== Collection Export & Share =====
// 导出当前合集素材为 Markdown 文件（含封面图链接）
function exportCollectionAsMD(name) {
  const items = getMaterialsByCollection(name);
  if (!items.length) { alert('该合集暂无素材，无法导出'); return; }
  const lines = [];
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(`> 共收录 **${items.length}** 个素材`);
  lines.push('');
  lines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  items.forEach((item, i) => {
    lines.push(`## ${i + 1}. ${item.title || '未命名素材'}`);
    lines.push('');
    if (item.coverUrl) {
      lines.push(`![封面图](${item.coverUrl})`);
      lines.push('');
    }
    if (item.url) {
      lines.push(`**来源**：[${item.url}](${item.url})`);
      lines.push('');
    }
    const summary = item.details?.summary || [];
    if (summary.length) {
      lines.push('### 说明');
      summary.forEach(s => lines.push(`- ${s}`));
      lines.push('');
    }
    const pageContent = item.details?.pageContent || [];
    if (pageContent.length) {
      lines.push('### 页面内容');
      pageContent.forEach(s => lines.push(`- ${s}`));
      lines.push('');
    }
    const navigation = item.details?.navigation || [];
    if (navigation.length) {
      lines.push('### 功能导航');
      navigation.forEach(s => lines.push(`- ${s}`));
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });
  const md = lines.join('\n');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${name}_合集_${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

// 生成移动端阅览的分享页 HTML（背景渐变 / 卡片列表 = 完整封面图 + 小标题）
function generateShareHTML(name, items) {
  const cards = items.map(item => {
    const title = escHtml(item.title || '未命名素材');
    const href = item.url ? escHtml(item.url) : '#';
    const img = item.coverUrl
      ? `<img src="${escHtml(item.coverUrl)}" alt="${title}" loading="lazy" />`
      : `<div class="placeholder">${title}</div>`;
    return `<a class="card" href="${href}" target="_blank" rel="noopener noreferrer">
      <div class="image-wrap">${img}</div>
      <div class="title">${title}</div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(name)} · Foubow 合集</title>
<style>
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif;background:linear-gradient(135deg,#fce7f3 0%,#fbcfe8 25%,#ddd6fe 60%,#c7d2fe 100%);min-height:100vh;color:#1a1a1a;-webkit-font-smoothing:antialiased;}
  .container{max-width:560px;margin:0 auto;padding:42px 18px 80px;}
  .header{text-align:center;margin-bottom:36px;}
  .header .label{font-size:11px;color:rgba(0,0,0,.5);letter-spacing:3px;font-weight:500;}
  .header h1{font-size:28px;font-weight:700;margin:12px 0 8px;letter-spacing:.5px;}
  .header .meta{font-size:12px;color:rgba(0,0,0,.55);}
  .cards{display:flex;flex-direction:column;gap:22px;}
  .card{background:#fff;border-radius:18px;box-shadow:0 8px 28px rgba(60,40,120,.10);overflow:hidden;text-decoration:none;color:inherit;display:block;transition:transform .2s ease,box-shadow .2s ease;}
  .card:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(60,40,120,.16);}
  .card:active{transform:scale(.99);}
  .image-wrap{background:linear-gradient(135deg,#fafafa,#efefef);padding:14px;display:flex;align-items:center;justify-content:center;}
  .image-wrap img{display:block;width:100%;height:auto;max-height:82vh;object-fit:contain;border-radius:10px;}
  .image-wrap .placeholder{font-size:13px;color:rgba(0,0,0,.4);min-height:220px;display:flex;align-items:center;justify-content:center;padding:36px;text-align:center;}
  .title{padding:14px 18px 18px;font-size:15px;line-height:1.55;color:#1a1a1a;text-align:center;font-weight:500;}
  .footer{text-align:center;margin-top:60px;font-size:11px;color:rgba(0,0,0,.45);letter-spacing:1.5px;}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="label">COLLECTION</div>
      <h1>${escHtml(name)}</h1>
      <div class="meta">${items.length} 个素材</div>
    </div>
    <div class="cards">
      ${cards}
    </div>
    <div class="footer">Foubow.fun</div>
  </div>
</body>
</html>`;
}

let sharePreviewState = null;
// 打开分享预览弹窗：iframe 渲染生成的 HTML，可下载 / 复制
function shareCollection(name) {
  const items = getMaterialsByCollection(name);
  if (!items.length) { alert('该合集暂无素材，无法生成'); return; }
  if (document.getElementById('share-preview-overlay')) return;
  const html = generateShareHTML(name, items);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  sharePreviewState = { name, html, blobUrl };

  const overlay = document.createElement('div');
  overlay.id = 'share-preview-overlay';
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-[920px] max-h-[96vh] overflow-hidden flex flex-col">
      <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#E5E7EB] shrink-0 flex-wrap">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="eye" class="w-4 h-4 text-[#6B7280] shrink-0"></i>
          <span class="text-sm font-medium text-[#1A1A1A] truncate">分享预览 · ${escHtml(name)}</span>
        </div>
        <div class="flex items-center gap-1 shrink-0 flex-wrap">
          <button id="share-btn-link" class="px-2.5 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors flex items-center gap-1" title="生成分享链接并复制">
            <i data-lucide="link" class="w-3 h-3"></i><span>以链接方式分享</span>
          </button>
          <button id="share-btn-download" class="px-2.5 py-1 text-xs rounded-md bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors flex items-center gap-1" title="下载HTML文件">
            <i data-lucide="download" class="w-3 h-3"></i><span>下载HTML</span>
          </button>
          <button id="share-btn-copy" data-orig="复制源码" class="px-2.5 py-1 text-xs rounded-md bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors flex items-center gap-1" title="复制HTML源码">
            <i data-lucide="copy" class="w-3 h-3"></i><span>复制源码</span>
          </button>
          <button id="share-btn-close" class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" title="关闭">
            <i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i>
          </button>
        </div>
      </div>
      <iframe id="share-preview-iframe" class="w-full flex-1 border-0 bg-[#F3F4F6]" src="${blobUrl}"></iframe>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSharePreview(); });
  document.getElementById('share-btn-link').addEventListener('click', (e) => copyShareLink(e.currentTarget));
  document.getElementById('share-btn-download').addEventListener('click', downloadShareHTML);
  document.getElementById('share-btn-copy').addEventListener('click', (e) => copyShareHTML(e.currentTarget));
  document.getElementById('share-btn-close').addEventListener('click', closeSharePreview);
}

function closeSharePreview() {
  const overlay = document.getElementById('share-preview-overlay');
  if (overlay) overlay.remove();
  if (sharePreviewState?.blobUrl) {
    setTimeout(() => URL.revokeObjectURL(sharePreviewState.blobUrl), 500);
  }
  sharePreviewState = null;
}

function downloadShareHTML() {
  if (!sharePreviewState) return;
  const { name, html } = sharePreviewState;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_分享页_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyShareHTML(btn) {
  if (!sharePreviewState) return;
  if (!navigator.clipboard?.writeText) { alert('当前浏览器不支持一键复制'); return; }
  try {
    await navigator.clipboard.writeText(sharePreviewState.html);
    const orig = btn.dataset.orig || btn.textContent;
    btn.dataset.orig = orig;
    const span = btn.querySelector('span');
    if (span) span.textContent = '✓ 已复制';
    btn.disabled = true;
    setTimeout(() => { if (span) span.textContent = orig; btn.disabled = false; }, 1500);
  } catch (e) {
    alert('复制失败：' + e.message);
  }
}

// 以链接方式分享：把生成的 HTML 存到后端临时文件，返回 URL 并自动复制
async function copyShareLink(btn) {
  if (!sharePreviewState) return;
  if (!navigator.clipboard?.writeText) { alert('当前浏览器不支持一键复制，请在下载HTML后手动分享'); return; }
  const span = btn.querySelector('span');
  const origLabel = span ? span.textContent : btn.textContent;
  if (span) span.textContent = '生成中…';
  btn.disabled = true;
  try {
    const res = await fetchWithTimeout('/api/share/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sharePreviewState.name, html: sharePreviewState.html }),
    });
    const data = await res.json();
    if (!res.ok || !data.code) { throw new Error(data.msg || `HTTP ${res.status}`); }
    const url = data.data.url;
    await navigator.clipboard.writeText(url);
    if (span) span.textContent = '✓ 已复制链接';
    showShareToast(`已复制到剪贴板：${url}`);
    setTimeout(() => { if (span) span.textContent = origLabel; btn.disabled = false; }, 2200);
  } catch (e) {
    if (span) span.textContent = origLabel;
    btn.disabled = false;
    alert('生成链接失败：' + e.message + '\n（如部署在 serverless 环境请改用下载HTML）');
  }
}

// 弹一个轻量 toast 显示链接
let shareToastTimer = null;
function showShareToast(text) {
  let el = document.getElementById('share-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'share-toast';
    el.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg bg-[#1A1A1A] text-white text-xs shadow-2xl max-w-[80vw] break-all';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
  if (shareToastTimer) clearTimeout(shareToastTimer);
  shareToastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ===== Mobile Panel =====
function renderMobilePanel() {
  const overlay = document.getElementById('detail-overlay');
  const panel = document.getElementById('detail-mobile');
  if (!panelMode) return;

  if (panelMode === 'detail' && selectedId) {
    const item = materials.find(m => m.id === selectedId);
    if (!item) return;
    const imgHTML = item.coverUrl
      ? `<img src="${item.coverUrl}" alt="${escHtml(item.title)}" class="w-full h-auto cursor-zoom-in" onclick="openLightbox('${item.coverUrl}')" />`
      : `<div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full aspect-[4/3]">${item.getPreviewHTML()}</div>`;
    panel.innerHTML = `<div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] shrink-0 bg-white sticky top-0 z-10">
        <span class="text-sm font-medium text-[#1A1A1A]">素材详情</span>
        <button class="p-1 rounded-md hover:bg-[#F3F4F6]" onclick="closeMobilePanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
      </div>
      <div class="sticky top-[49px] z-10 bg-white relative" id="detail-cover-wrap">
        ${imgHTML}
        <div class="absolute bottom-2 right-2 flex gap-2 z-20" id="detail-cover-tools">
          <button type="button" id="btn-cover-fit" class="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F3F4F6] transition-colors" title="查看图片核心信息"><i data-lucide="eye" class="w-4 h-4 text-[#4B5563]"></i></button>
          <button type="button" id="btn-cover-crop" class="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#F3F4F6] transition-colors" title="拖动调整裁剪区域"><i data-lucide="move-vertical" class="w-4 h-4 text-[#4B5563]"></i></button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin">
        <div class="p-4 space-y-4">
          <h2 class="text-sm font-semibold text-[#1A1A1A] leading-snug">${item.title}</h2>
          <div class="flex items-center gap-2">
            <span class="inline-block px-2 py-0.5 text-[11px] rounded-md bg-[#F3F4F6] text-[#6B7280] cursor-pointer hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors" onclick="showChangeCollectionModal('${item.id}')">${escHtml(item.collection)}</span>
            <button class="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" onclick="deleteMaterial('${item.id}')"><i data-lucide="trash-2" class="w-3 h-3"></i>删除</button>
          </div>
          <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">核心信息</h3><ul class="space-y-1">${item.details.summary.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">•</span>${s}</li>`).join('')}</ul></div>
                  </div>
      </div>
      <div class="shrink-0 px-4 py-3 border-t border-[#E5E7EB]">
        <div class="flex items-center gap-1.5 text-[11px] text-[#6B7280] mb-2.5 truncate"><i data-lucide="external-link" class="w-2.5 h-2.5 shrink-0"></i><span class="truncate">${item.url}</span></div>
        <div class="flex items-center gap-1.5">
          <button class="flex-1 py-2 px-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] text-sm text-[#4B5563] transition-colors flex items-center justify-center gap-1" onclick="copyLink('${item.url}')"><i data-lucide="copy" class="w-3.5 h-3.5"></i> 复制链接</button>
          <button class="flex-1 py-2 px-3 rounded-lg bg-[#1A1A1A] text-white text-sm hover:bg-[#333] transition-colors flex items-center justify-center gap-1" onclick="window.open('${item.url}','_blank')"><i data-lucide="external-link" class="w-3.5 h-3.5"></i> 打开</button>
        </div>
      </div>
    </div>`;
  bindCoverEdit(item);
  } else if (panelMode === 'waterfall' && panelCollection) {
    const items = getMaterialsByCollection(panelCollection);
    let html = `<div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] shrink-0 bg-white sticky top-0 z-10">
        <span class="text-sm font-semibold text-[#1A1A1A]">${panelCollection} <span class="text-xs font-normal text-[#9CA3AF]">${items.length} 个素材</span></span>
        <button class="p-1 rounded-md hover:bg-[#F3F4F6]" onclick="closeMobilePanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin p-4">`;
    if (items.length === 0) { html += '<div class="text-sm text-[#9CA3AF] text-center py-12">该合集暂无素材</div>'; }
    else {
      html += '<div class="collection-grid">';
      items.forEach(item => {
        const isActive = item.id === selectedId;
                html += `<div><div onclick="selectCard('${item.id}')" class="bg-white rounded-[10px] border overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isActive ? 'border-[#1A1A1A] shadow-md' : 'border-[#E5E7EB]'}">
          <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full aspect-[4/3]">${item.getPreviewHTML()}</div>
          <div class="p-3"><div class="text-sm font-medium text-[#1A1A1A] leading-snug line-clamp-2 mb-1">${item.title}</div></div>
        </div></div>`;
      });
      html += '</div>';
    }
    html += '</div></div>';
    panel.innerHTML = html;
  } else if (panelMode === 'collection-output' && panelCollection) {
    const outputs = getOutputsByCollection(panelCollection);
    let html = `<div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] shrink-0 bg-white sticky top-0 z-10">
        <span class="text-sm font-medium text-[#1A1A1A]">产出物</span>
        <div class="flex items-center gap-2"><button class="px-2 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" onclick="alert('AI 总结功能即将上线')">AI 总结</button><button class="p-1 rounded-md hover:bg-[#F3F4F6]" onclick="closeMobilePanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button></div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin">`;
    if (outputs.length === 0) { html += '<div class="text-sm text-[#9CA3AF] text-center py-12">暂无产出物</div>'; }
    else {
      html += '<div class="p-3 space-y-2">';
      outputs.forEach(o => {
        html += `<div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#F8F9FA] border border-[#EAECF0] hover:bg-[#F0F1F3] transition-colors cursor-pointer"><span class="text-lg">${o.emoji}</span><span class="text-sm text-[#1A1A1A] font-medium">${escHtml(o.title)}</span></div>`;
      });
      html += '</div>';
    }
    html += '</div></div>';
    panel.innerHTML = html;
  }
  panel.classList.add('open');
  overlay.classList.add('open');
  lucide.createIcons();
}

// ===== Panel Controls =====
async function selectCard(id) {
  selectedId = id;
  
  // 调用 API 获取详情
  const currentItem = materials.find(m => String(m.id) === String(id));
  if (currentItem) {
    showLoading('正在加载详情...');
    const detail = await fetchMaterialDetail(currentItem.title);
    hideLoading();
    if (detail) {
      const contentLines = detail.content ? detail.content.split('\n').filter(line => line.trim()) : [];
      currentItem.details = {
        summary: contentLines.length > 0 ? contentLines : currentItem.details?.summary || ['暂无摘要'],
        pageContent: currentItem.details?.pageContent || ['暂无页面内容'],
        navigation: currentItem.details?.navigation || ['暂无导航信息'],
      };
      if (detail.coverUrl) currentItem.coverUrl = detail.coverUrl;
      if (detail.url) currentItem.url = detail.url;
    }
  }

  panelMode = 'detail';
  if (window.innerWidth >= 1024) {
    renderRightPanel();
    renderMainContent();
  } else {
    renderMobilePanel();
  }
}

function openWaterfall(collection) {
  panelCollection = collection;
  panelMode = 'waterfall';
  selectedId = null;
  if (window.innerWidth >= 1024) {
    renderRightPanel();
    renderMainContent();
  } else {
    renderMobilePanel();
  }
}

function closeRightPanel() {
  panelMode = null;
  panelCollection = null;
  selectedId = null;
  document.getElementById('detail-desktop').style.display = 'none';
  renderMainContent();
}

function openCollectionOutputs(collection) {
  panelCollection = collection;
  panelMode = 'collection-output';
  selectedId = null;
  if (window.innerWidth >= 1024) {
    renderRightPanel();
  } else {
    renderMobilePanel();
  }
}

function closeMobilePanel() {
  panelMode = null;
  panelCollection = null;
  selectedId = null;
  document.getElementById('detail-mobile').classList.remove('open');
  document.getElementById('detail-overlay').classList.remove('open');
  renderMainContent();
}

// ===== Navigation =====
function navigateTo(mode, collection) {
  viewMode = mode;
  if (collection !== undefined) activeCollection = collection;
  panelMode = null; panelCollection = null; selectedId = null;
  document.getElementById('detail-desktop').style.display = 'none';

  const navAll = document.getElementById('nav-all');
  navAll.className = (mode === 'all' && activeCollection === 'all')
    ? 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 bg-white text-[#1A1A1A] font-medium shadow-sm'
    : 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 text-[#6B7280] hover:bg-white/60 hover:text-[#1A1A1A]';

  const btnOv = document.getElementById('btn-overview');
  btnOv.className = mode === 'overview'
    ? 'px-2.5 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors'
    : 'px-2.5 py-1 text-xs rounded-md bg-[#E5E7EB] text-[#6B7280] hover:bg-[#D1D5DB] hover:text-[#1A1A1A] transition-colors';

  renderMainContent();
  renderCollections();
}

async function selectCollection(name) {
  if (name === 'all') { navigateTo('all', 'all'); }
  else { navigateTo('collection', name); }
  closeSidebar();
}

function copyLink(url) { navigator.clipboard.writeText(url).then(() => alert('链接已复制')); }

// ===== Delete Material =====
async function deleteMaterial(id) {
  const item = materials.find(m => m.id === id);
  if (!item) return;
  if (!confirm(`确定要删除素材「${item.title}」吗？\n此操作不可撤销。`)) return;

  try {
    showLoading('正在删除素材...');
    const response = await fetchWithTimeout('/api/coze/materials/delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ input: item.title }),
    });
    const result = await response.json();
    if (result.code !== 1) { hideLoading(); alert('删除素材失败：' + (result.msg || '未知错误')); return; }

    // 从列表中移除
    materials = materials.filter(m => m.id !== id);
    selectedId = null; panelMode = null;
    document.getElementById('detail-desktop').style.display = 'none';
    document.getElementById('detail-mobile').classList.remove('open');
    document.getElementById('detail-overlay').classList.remove('open');
    renderMainContent();
    renderCollections();
    hideLoading();
  } catch (error) {
    console.error('删除素材错误:', error);
    hideLoading();
    alert('删除失败：' + error.message);
  }
}

// ===== Search =====
async function searchMaterials(keyword) {
  if (!keyword.trim()) return;
  searchKeyword = keyword.trim();
  viewMode = 'search';

  try {
    showLoading('正在搜索素材...');
    const response = await fetchWithTimeout('/api/coze/materials/search', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ input: searchKeyword }),
    });
    const result = await response.json();
    hideLoading();

    if (result.data) {
      searchResults = parseMaterialsData(result.data);
      if (searchResults.length === 0) searchResults = materials.filter(m =>
        m.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        m.url.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    } else {
      // API 返回失败时使用前端搜索
      searchResults = materials.filter(m =>
        m.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        m.url.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }
    // 异步检测封面图比例
    const ratioPromises = searchResults.map(async (m) => {
      if (m.coverUrl && m.detectAspectRatio) {
        m.aspectRatio = await m.detectAspectRatio();
      }
    });
    await Promise.all(ratioPromises);

    panelMode = null; selectedId = null;
    document.getElementById('detail-desktop').style.display = 'none';
    renderMainContent();
  } catch (error) {
    console.error('搜索素材错误:', error);
    hideLoading();
    // 前端兜底搜索
    searchResults = materials.filter(m =>
      m.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      m.url.toLowerCase().includes(searchKeyword.toLowerCase())
    );
    panelMode = null; selectedId = null;
    document.getElementById('detail-desktop').style.display = 'none';
    renderMainContent();
  }
}

function renderSearchResults() {
  const container = document.getElementById('main-content');
  container.innerHTML = `<div class="flex items-center gap-2 mb-4">
    <button onclick="navigateTo('all','all')" class="p-1.5 rounded-md hover:bg-[#F3F4F6] transition-colors flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1A1A1A]">
      <i data-lucide="arrow-left" class="w-4 h-4"></i> 返回
    </button>
    <h1 class="text-base font-semibold text-[#1A1A1A]">搜索「${escHtml(searchKeyword)}」 <span class="text-xs font-normal text-[#9CA3AF] ml-1">${searchResults.length} 个结果</span></h1>
  </div><div class="cards-grid" id="cards-container"></div>`;
  if (searchResults.length === 0) {
    document.getElementById('cards-container').innerHTML = '<div class="col-span-full text-sm text-[#9CA3AF] text-center py-12">未找到匹配的素材</div>';
  } else {
    renderCardsInto('cards-container', searchResults);
  }
  lucide.createIcons();
}

// ===== Collections =====
function renderCollections() {
  const container = document.getElementById('collection-buttons');
  let html = '';
  // 第一部分：API 返回的合集（用户自己创建的）
  collections.forEach(name => {
    const isActive = viewMode !== 'overview' && activeCollection === name;
    const escName = escHtml(name);
    html += `<div class="collection-item">
      <button onclick="selectCollection('${escName}')"
        class="w-full px-3 py-2 rounded-lg text-sm text-left transition-colors duration-150 ${
          isActive ? 'bg-white text-[#1A1A1A] font-medium shadow-sm'
                   : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-white/60 hover:text-[#1A1A1A]'
        }">${escName}</button>
      <button class="collection-edit-btn absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#E5E7EB]"
        onclick="event.stopPropagation(); openEditModal('${escName}')" title="编辑合集">
        <i data-lucide="pencil" class="w-3 h-3 text-[#9CA3AF]"></i>
      </button>
    </div>`;
  });
  html += `<button onclick="openAddModal()"
    class="px-3 py-2 rounded-lg text-sm text-left text-[#9CA3AF] border border-dashed border-[#D1D5DB] hover:border-[#9CA3AF] hover:text-[#6B7280] transition-colors duration-150 flex items-center gap-1.5">
    <i data-lucide="plus" class="w-3.5 h-3.5"></i>添加合集</button>`;
  container.innerHTML = html;
  lucide.createIcons();
}

// ===== Sidebar =====
function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }

// ===== Collection Modal =====
function openAddModal() {
  editingCollection = null;
  document.getElementById('modal-title').textContent = '添加合集';
  document.getElementById('modal-input').value = '';
  document.getElementById('modal-delete-btn').classList.add('hidden');
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-input').focus(), 100);
}
function openEditModal(name) {
  editingCollection = name;
  document.getElementById('modal-title').textContent = '编辑合集';
  document.getElementById('modal-input').value = name;
  document.getElementById('modal-delete-btn').classList.remove('hidden');
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => { const inp = document.getElementById('modal-input'); inp.focus(); inp.select(); }, 100);
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); editingCollection = null; }
async function saveCollection() {
  const name = document.getElementById('modal-input').value.trim();
  if (!name) { alert('请输入合集名称'); return; }

  const userEmail = localStorage.getItem('userEmail') || 'guest@foubow.fun';

  try {
    showLoading(editingCollection ? '正在修改合集...' : '正在添加合集...');
    if (editingCollection) {
      if (name === editingCollection) { hideLoading(); closeModal(); return; }

      const response = await fetchWithTimeout('/api/coze/collections/update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ input: name, old_name: editingCollection }),
      });
      const result = await response.json();
      if (result.code !== 1) { hideLoading(); alert('修改合集失败：' + (result.msg || '未知错误')); return; }

      const idx = collections.indexOf(editingCollection);
      if (idx !== -1) collections[idx] = name;
      materials.forEach(m => { if (m.collection === editingCollection) m.collection = name; });
      if (activeCollection === editingCollection) activeCollection = name;
      if (panelCollection === editingCollection) panelCollection = name;
    } else {
      const response = await fetchWithTimeout('/api/coze/collections/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ input: name }),
      });
      const result = await response.json();
      if (result.code !== 1) { hideLoading(); alert('新增合集失败：' + (result.msg || '未知错误')); return; }

      if (!collections.includes(name)) {
        collections.push(name);
      }
    }

    renderCollections();
    renderMainContent();
    if (panelMode) renderRightPanel();
    hideLoading();
    closeModal();
  } catch (error) {
    console.error('合集操作错误:', error);
    hideLoading();
    alert('操作失败：' + error.message);
  }
}
async function deleteCollection() {
  if (!editingCollection) return;
  if (!confirm(`确定要删除合集「${editingCollection}」吗？\n该合集下的素材将移至「未分类」。`)) return;

  const userEmail = localStorage.getItem('userEmail') || 'guest@foubow.fun';

  try {
    showLoading('正在删除合集...');
    const response = await fetchWithTimeout('/api/coze/collections/delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ input: editingCollection }),
    });
    const result = await response.json();
    if (result.code !== 1) { hideLoading(); alert('删除合集失败：' + (result.msg || '未知错误')); return; }

    if (!collections.includes('未分类')) collections.push('未分类');
    materials.forEach(m => { if (m.collection === editingCollection) m.collection = '未分类'; });
    collections = collections.filter(c => c !== editingCollection);
    if (activeCollection === editingCollection) { activeCollection = 'all'; viewMode = 'all'; }
    if (panelCollection === editingCollection) { panelMode = null; document.getElementById('detail-desktop').style.display = 'none'; }
    selectedId = null; panelMode = null;
    renderCollections(); renderMainContent();
    hideLoading();
    closeModal();
  } catch (error) {
    console.error('删除合集错误:', error);
    hideLoading();
    alert('删除失败：' + error.message);
  }
}

let changingItemId = null;
function showChangeCollectionModal(itemId) {
  changingItemId = itemId;
  const select = document.getElementById('collection-select');
  const item = materials.find(m => m.id === itemId);
  select.innerHTML = getAllCollections().map(c => `<option value="${escHtml(c)}" ${c === item.collection ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
  document.getElementById('collection-select-overlay').classList.add('open');
}
function closeCollectionSelect() {
  document.getElementById('collection-select-overlay').classList.remove('open');
  changingItemId = null;
}
async function changeCollection() {
  const newCollection = document.getElementById('collection-select').value;
  const item = materials.find(m => m.id === changingItemId);
  if (!item) return;
  const userEmail = localStorage.getItem('userEmail') || 'guest@foubow.fun';
  try {
    showLoading('正在移动素材...');
    const response = await fetchWithTimeout('/api/coze/materials/move', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: item.title, topic: newCollection }),
    });
    const result = await response.json();
    if (result.code === 1) {
      item.collection = newCollection;
      renderMainContent();
      renderRightPanel();
      renderMobilePanel();
      hideLoading();
      closeCollectionSelect();
    } else {
      hideLoading();
      alert('更新合集失败：' + (result.msg || '未知错误'));
    }
  } catch (error) {
    console.error('更新合集错误:', error);
    hideLoading();
    alert('更新失败：' + error.message);
  }
}

// ===== Upload =====
function openUploadModal() { uploadImages = []; document.getElementById('upload-overlay').classList.add('open'); renderUploadList(); setTimeout(() => lucide.createIcons(), 100); }
function closeUploadModal() { document.getElementById('upload-overlay').classList.remove('open'); }
function handleUploadFiles(files) {
  const MAX_IMAGES = 20;
  const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (validFiles.length === 0) return;

  const remaining = MAX_IMAGES - uploadImages.length;
  if (remaining <= 0) { alert(`最多上传 ${MAX_IMAGES} 张图片`); return; }

  const toAdd = validFiles.slice(0, remaining);
  if (validFiles.length > remaining) {
    alert(`最多上传 ${MAX_IMAGES} 张，本次仅保留前 ${remaining} 张`);
  }

  let loaded = 0;
  toAdd.forEach(file => {
    const reader = new FileReader();
    const id = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    reader.onload = (e) => {
      uploadImages.push({ id, file, dataUrl: e.target.result, name: file.name });
      loaded++;
      if (loaded === toAdd.length) renderUploadList();
    };
    reader.readAsDataURL(file);
  });
}
function removeUploadImage(id) { uploadImages = uploadImages.filter(img => img.id !== id); renderUploadList(); }
function moveUp(id) { const idx = uploadImages.findIndex(img => img.id === id); if (idx <= 0) return; [uploadImages[idx-1], uploadImages[idx]] = [uploadImages[idx], uploadImages[idx-1]]; renderUploadList(); }
function moveDown(id) { const idx = uploadImages.findIndex(img => img.id === id); if (idx >= uploadImages.length-1) return; [uploadImages[idx], uploadImages[idx+1]] = [uploadImages[idx+1], uploadImages[idx]]; renderUploadList(); }
async function confirmUpload() {
  if (uploadImages.length === 0) { alert('请先添加图片'); return; }

  const userEmail = localStorage.getItem('userEmail') || 'guest@foubow.fun';

  try {
    showLoading(`正在上传 ${uploadImages.length} 张素材...`);
    const formData = new FormData();
    formData.append('user', userEmail);
    uploadImages.forEach(img => formData.append('images', img.file));

    const response = await fetchWithTimeout('/api/coze/materials/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      body: formData,
    });

    const result = await response.json();
    hideLoading();

    if (result.code === 1) {
      alert(`上传成功！共 ${uploadImages.length} 张素材`);
    } else {
      alert('上传失败：' + (result.msg || '未知错误'));
    }
    uploadImages = [];
    closeUploadModal();
    renderUploadList();
    materials = await fetchMaterials();
    renderMainContent();
  } catch (error) {
    console.error('上传错误:', error);
    hideLoading();
    alert('上传失败：' + error.message);
  }
}
function renderUploadList() {
  const c = document.getElementById('upload-image-list');
  document.getElementById('upload-count').textContent = uploadImages.length;
  if (uploadImages.length===0) { c.innerHTML='<div class="col-span-full text-center text-sm text-[#9CA3AF] py-8">暂无图片，请拖拽或点击上方区域添加</div>'; return; }
  c.innerHTML = uploadImages.map((img,idx) => `<div class="upload-image-item"><img src="${img.dataUrl}" class="upload-thumb" alt="${escHtml(img.name)}"><div class="file-name" title="${escHtml(img.name)}">${escHtml(img.name)}</div><div class="flex items-center gap-1 mt-auto"><button onclick="moveUp('${img.id}')" ${idx===0?'disabled':''} class="flex-1 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-[#F3F4F6] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">↑</button><button onclick="moveDown('${img.id}')" ${idx===uploadImages.length-1?'disabled':''} class="flex-1 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-[#F3F4F6] disabled:opacity-25 disabled:cursor-not-allowed transition-colors">↓</button><button onclick="removeUploadImage('${img.id}')" class="flex-1 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">×</button></div></div>`).join('');
}

// ===== 图片灯箱 =====
function openLightbox(url) {
  let lb = document.getElementById('image-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'image-lightbox';
    lb.innerHTML = `
      <style>
        @keyframes lightbox-in { from{opacity:0} to{opacity:1} }
        #image-lightbox {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,0.92); display: none;
          align-items: center; justify-content: center; cursor: zoom-out;
        }
        #image-lightbox.show { display: flex; animation: lightbox-in 0.2s ease; }
        #image-lightbox img { max-width: 95vw; max-height: 95vh; object-fit: contain; }
        #lightbox-close {
          position: absolute; top: 20px; right: 20px; color: #fff; font-size: 28px;
          cursor: pointer; width: 44px; height: 44px; display: flex; align-items: center;
          justify-content: center; border-radius: 50%; background: rgba(255,255,255,0.15);
          transition: background 0.2s; line-height: 1;
        }
        #lightbox-close:hover { background: rgba(255,255,255,0.25); }
      </style>
      <img id="lightbox-img" src="" alt="" />
      <div id="lightbox-close">&times;</div>`;
    document.body.appendChild(lb);
    lb.querySelector('#lightbox-close').onclick = (e) => { e.stopPropagation(); closeLightbox(); };
    lb.onclick = closeLightbox;
  }
  lb.querySelector('#lightbox-img').src = url;
  lb.classList.add('show');
}
function closeLightbox() {
  document.getElementById('image-lightbox').classList.remove('show');
}

// ===== Init =====
async function init() {
  // 登录守卫：未登录直接跳转，避免加载弹窗卡住
  const isLogin = localStorage.getItem('isLogin') === 'true';
  if (!isLogin) {
    window.location.replace('/login.html');
    return;
  }

  showLoading('正在加载素材...');

  // 1. 从 localStorage 填充用户信息
  const nickname = localStorage.getItem('userNickname') || '昵称';
  const avatar = localStorage.getItem('userAvatar') || '';
  const nicknameEl = document.getElementById('header-nickname');
  const avatarEl = document.getElementById('header-avatar');
  if (nicknameEl) nicknameEl.textContent = nickname;
  if (avatarEl && avatar) {
    avatarEl.innerHTML = `<img src="${avatar}" alt="头像" class="w-full h-full object-cover" />`;
  }

  // 2. 加载合集列表
  const apiCollections = await fetchCollections();
  if (apiCollections.length > 0) {
    collections = apiCollections.map(c => c.topic || c.name || '未命名合集');
    collections = [...new Set(collections)];
  }

  // 3. 加载素材数据
  materials = await fetchMaterials();

  // 4. 异步检测封面图比例
  const ratioPromises = materials.map(async (m) => {
    if (m.coverUrl && m.detectAspectRatio) {
      m.aspectRatio = await m.detectAspectRatio();
    }
  });
  await Promise.all(ratioPromises);

  if (!collections.includes('未分类')) collections.push('未分类');

  renderMainContent();
  renderCollections();
  lucide.createIcons();
  hideLoading();
}

document.addEventListener('DOMContentLoaded', init);