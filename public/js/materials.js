// ===== Data =====
let materials = [];
let collections = [];
let editingCollection = null;
let uploadImages = [];

// ===== State =====
let viewMode = 'all';           // 'all' | 'overview' | 'collection'
let activeCollection = 'all';
let selectedId = null;
let panelMode = null;           // null | 'detail' | 'waterfall'
let panelCollection = null;

// Helper
function getMaterialsByCollection(name) { return materials.filter(m => m.collection === name); }
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
    const response = await fetch('/api/coze/materials', {
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
    const response = await fetch('/api/coze/collections', {
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
    const response = await fetch('/api/coze/material/detail', {
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
    const response = await fetch('/api/coze/materials/filter', {
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
        return `<img src="${this.coverUrl}" alt="${this.title}" class="w-full h-full object-cover" />`;
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
}

function renderOverview() {
  const container = document.getElementById('main-content');
  let html = '<h1 class="text-base font-semibold text-[#1A1A1A] mb-5">素材总览</h1>';
  if (collections.length === 0) {
    html += '<div class="text-sm text-[#9CA3AF] text-center py-12">暂无合集，请先添加合集</div>';
    container.innerHTML = html;
    return;
  }
  html += '<div class="overview-grid">';
  collections.forEach(name => {
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
        const isPortrait = item.aspectRatio === '3:5';
        html += `<div class="mini-card" onclick="selectCard('${item.id}')" title="${escHtml(item.title)}">
          <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full ${isPortrait ? 'aspect-[3/5]' : 'aspect-[4/3]'}">
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
  container.innerHTML = `<div class="flex items-center gap-2 mb-5">
    <button onclick="navigateTo('overview')" class="p-1.5 rounded-md hover:bg-[#F3F4F6] transition-colors flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1A1A1A]">
      <i data-lucide="arrow-left" class="w-4 h-4"></i> 返回
    </button>
    <h1 class="text-base font-semibold text-[#1A1A1A]">${name} <span class="text-xs font-normal text-[#9CA3AF] ml-1">${items.length} 个素材</span><span class="text-xs font-normal text-[#9CA3AF] ml-1 cursor-pointer hover:text-[#1A1A1A] underline underline-offset-2" onclick="openCollectionOutputs('${name.replace(/'/g, "\\'")}')">${outputs.length} 个产出物</span></h1>
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
    const isPortrait = item.aspectRatio === '3:5';
    const isActive = item.id === selectedId;
    return `<div><div onclick="selectCard('${item.id}')"
      class="bg-white rounded-[10px] border overflow-hidden cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md ${isActive ? 'border-[#1A1A1A] shadow-md' : 'border-[#E5E7EB]'}">
      <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full ${isPortrait ? 'aspect-[3/5]' : 'aspect-[4/3]'}">${item.getPreviewHTML()}</div>
      <div class="p-3">
        <h3 class="text-sm font-medium text-[#1A1A1A] leading-snug line-clamp-2 mb-1">${item.title}</h3>
        <div class="flex items-center gap-1 text-xs text-[#9CA3AF] truncate"><i data-lucide="external-link" class="w-2.5 h-2.5 shrink-0"></i><span class="truncate">${item.url}</span></div>
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
  const isPortrait = item.aspectRatio === '3:5';
  content.innerHTML = `<div class="flex flex-col h-full">
    <div class="panel-header">
      <span class="text-sm font-medium text-[#1A1A1A]">素材详情</span>
      <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" onclick="closeRightPanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
    </div>
    <div class="sticky top-0 z-10 bg-white">
      <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full ${isPortrait ? 'aspect-[3/5]' : 'aspect-[4/3]'}">${item.getPreviewHTML()}</div>
    </div>
    <div class="flex-1 overflow-y-auto scrollbar-thin">
      <div class="p-4 space-y-4">
        <h2 class="text-sm font-semibold text-[#1A1A1A] leading-snug">${item.title}</h2>
        <span class="inline-block px-2 py-0.5 text-[11px] rounded-md bg-[#F3F4F6] text-[#6B7280] cursor-pointer hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors" onclick="showChangeCollectionModal('${item.id}')">${escHtml(item.collection)}</span>
        <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">核心信息</h3><ul class="space-y-1">${item.details.summary.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">•</span>${s}</li>`).join('')}</ul></div>
        <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">页面内容</h3><ul class="space-y-1">${item.details.pageContent.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">-</span>${s}</li>`).join('')}</ul></div>
        <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">功能导航</h3><ul class="space-y-1">${item.details.navigation.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">-</span>${s}</li>`).join('')}</ul></div>
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
      const isPortrait = item.aspectRatio === '3:5';
      html += `<div class="panel-card ${isActive ? 'ring-2 ring-[#1A1A1A]' : ''}" onclick="selectCard('${item.id}')">
        <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full ${isPortrait ? 'aspect-[3/5]' : 'aspect-[4/3]'}">${item.getPreviewHTML().replace(/text-xs/g,'text-[7px]').replace(/text-\[10px\]/g,'text-[7px]').replace(/text-sm/g,'text-[8px]').replace(/text-lg/g,'text-[9px]').replace(/text-2xl/g,'text-xs').replace(/w-14 h-20/g,'w-8 h-11').replace(/w-10 h-14/g,'w-5 h-7').replace(/w-16 h-12/g,'w-9 h-7').replace(/w-8 h-6/g,'w-4 h-3').replace(/w-20 h-16/g,'w-10 h-8').replace(/w-12 h-12/g,'w-6 h-6').replace(/w-10 h-10/g,'w-5 h-5').replace(/gap-2/g,'gap-0.5').replace(/gap-1\.5/g,'gap-0.5').replace(/gap-3/g,'gap-1').replace(/p-4 text-center/g,'p-1 text-center').replace(/p-3/g,'p-1').replace(/max-w-\[200px\]/g,'max-w-[80px]').replace(/mb-3/g,'mb-0.5').replace(/mb-2/g,'mb-0').replace(/mb-1/g,'mb-0').replace(/mt-2/g,'mt-0.5').replace(/leading-relaxed/g,'leading-tight')}</div>
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

// ===== Mobile Panel =====
function renderMobilePanel() {
  const overlay = document.getElementById('detail-overlay');
  const panel = document.getElementById('detail-mobile');
  if (!panelMode) return;

  if (panelMode === 'detail' && selectedId) {
    const item = materials.find(m => m.id === selectedId);
    if (!item) return;
    const isPortrait = item.aspectRatio === '3:5';
    panel.innerHTML = `<div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] shrink-0 bg-white sticky top-0 z-10">
        <span class="text-sm font-medium text-[#1A1A1A]">素材详情</span>
        <button class="p-1 rounded-md hover:bg-[#F3F4F6]" onclick="closeMobilePanel()"><i data-lucide="x" class="w-4 h-4 text-[#6B7280]"></i></button>
      </div>
      <div class="sticky top-[49px] z-10 bg-white">
        <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full ${isPortrait ? 'aspect-[3/5]' : 'aspect-[4/3]'}">${item.getPreviewHTML()}</div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin">
        <div class="p-4 space-y-4">
          <h2 class="text-sm font-semibold text-[#1A1A1A] leading-snug">${item.title}</h2>
          <span class="inline-block px-2 py-0.5 text-[11px] rounded-md bg-[#F3F4F6] text-[#6B7280] cursor-pointer hover:bg-[#E5E7EB] hover:text-[#1A1A1A] transition-colors" onclick="showChangeCollectionModal('${item.id}')">${escHtml(item.collection)}</span>
          <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">核心信息</h3><ul class="space-y-1">${item.details.summary.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">•</span>${s}</li>`).join('')}</ul></div>
          <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">页面内容</h3><ul class="space-y-1">${item.details.pageContent.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">-</span>${s}</li>`).join('')}</ul></div>
          <div><h3 class="text-xs font-medium text-[#1A1A1A] mb-1.5">功能导航</h3><ul class="space-y-1">${item.details.navigation.map(s=>`<li class="text-xs text-[#4B5563] leading-relaxed flex gap-1.5"><span class="text-[#9CA3AF] shrink-0">-</span>${s}</li>`).join('')}</ul></div>
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
        const isPortrait = item.aspectRatio === '3:5';
        html += `<div><div onclick="selectCard('${item.id}')" class="bg-white rounded-[10px] border overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isActive ? 'border-[#1A1A1A] shadow-md' : 'border-[#E5E7EB]'}">
          <div class="${item.previewBg} flex items-center justify-center overflow-hidden w-full ${isPortrait ? 'aspect-[3/5]' : 'aspect-[4/3]'}">${item.getPreviewHTML()}</div>
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

// ===== Collections =====
function renderCollections() {
  const container = document.getElementById('collection-buttons');
  let html = '';
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

      const response = await fetch('/api/coze/collections/update', {
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
      const response = await fetch('/api/coze/collections/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ input: name }),
      });
      const result = await response.json();
      if (result.code !== 1) { hideLoading(); alert('新增合集失败：' + (result.msg || '未知错误')); return; }

      if (!collections.includes(name)) collections.push(name);
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
    const response = await fetch('/api/coze/collections/delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ input: name }),
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
  select.innerHTML = collections.map(c => `<option value="${escHtml(c)}" ${c === item.collection ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
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
    const response = await fetch('/api/coze/materials/move', {
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
  const file = files[0];
  if (!file || !file.type.startsWith('image/')) return;
  uploadImages = [];
  const reader = new FileReader();
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  reader.onload = (e) => { uploadImages.push({ id, file, dataUrl: e.target.result, name: file.name }); renderUploadList(); };
  reader.readAsDataURL(file);
}
function removeUploadImage(id) { uploadImages = uploadImages.filter(img => img.id !== id); renderUploadList(); }
function moveUp(id) { const idx = uploadImages.findIndex(img => img.id === id); if (idx <= 0) return; [uploadImages[idx-1], uploadImages[idx]] = [uploadImages[idx], uploadImages[idx-1]]; renderUploadList(); }
function moveDown(id) { const idx = uploadImages.findIndex(img => img.id === id); if (idx >= uploadImages.length-1) return; [uploadImages[idx], uploadImages[idx+1]] = [uploadImages[idx+1], uploadImages[idx]]; renderUploadList(); }
async function confirmUpload() {
  if (uploadImages.length === 0) { alert('请先添加图片'); return; }

  const userEmail = localStorage.getItem('userEmail') || 'guest@foubow.fun';

  try {
    showLoading('正在上传素材...');
    const formData = new FormData();
    formData.append('user', userEmail);
    formData.append('image', uploadImages[0].file);

    const response = await fetch('/api/coze/materials/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      body: formData,
    });

    const result = await response.json();

    if (result.code === 1) {
      hideLoading();
      alert('上传成功！');
      uploadImages = [];
      closeUploadModal();
      renderUploadList();
      materials = await fetchMaterials();
      renderMainContent();
    } else {
      hideLoading();
      alert('上传失败：' + (result.msg || '未知错误'));
    }
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
  const email = localStorage.getItem('userEmail') || 'yourEmail@foubow.fun';
  const avatar = localStorage.getItem('userAvatar') || '';
  const nicknameEl = document.getElementById('header-nickname');
  const emailEl = document.getElementById('header-email');
  const avatarEl = document.getElementById('header-avatar');
  if (nicknameEl) nicknameEl.textContent = nickname;
  if (emailEl) emailEl.textContent = email;
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

  // 5. 从素材中提取合集名称
  materials.forEach(m => {
    if (m.collection && !collections.includes(m.collection)) {
      collections.push(m.collection);
    }
  });

  if (!collections.includes('未分类')) collections.push('未分类');

  renderMainContent();
  renderCollections();
  lucide.createIcons();
  hideLoading();
}

document.addEventListener('DOMContentLoaded', init);