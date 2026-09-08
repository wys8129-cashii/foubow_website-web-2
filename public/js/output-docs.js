/* output-docs.js
 * 产出物文档：每个合集可有多个文档（无序/有序列表 + 拖入的卡片引用）。
 * - 持久化：localStorage key `foubow-output-docs-v1`
 * - 拖入数据：MIME `application/x-foubow-card` = JSON.stringify(payload)
 *   payload: { kind: 'collection' | 'material', ... }
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'foubow-output-docs-v1';
  const CARD_MIME = 'application/x-foubow-card';
  const DEFAULT_EMOJI = ''; // 改用 lucide 图标，不写 emoji

  // -------- 状态 --------
  let state = loadState();
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) { return {}; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 容量/隐私模式 */ }
  }
  function uid() { return 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // -------- CRUD --------
  function getDocs(name) {
    if (!state[name]) state[name] = [];
    return state[name];
  }
  function addDoc(name, init) {
    init = init || {};
    const doc = {
      id: uid(),
      title: init.title || '新文档',
      type: init.type === 'ol' ? 'ol' : 'ul',
      items: Array.isArray(init.items) ? init.items : [],
      createdAt: Date.now(),
    };
    getDocs(name).push(doc);
    saveState();
    return doc;
  }
  function deleteDoc(name, id) {
    const list = getDocs(name);
    const idx = list.findIndex(d => d.id === id);
    if (idx >= 0) { list.splice(idx, 1); saveState(); return true; }
    return false;
  }
  function updateDoc(name, id, patch) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d) return null;
    Object.assign(d, patch);
    saveState();
    return d;
  }
  function addItem(name, id, item) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d) return null;
    d.items.push(item);
    saveState();
    return d;
  }
  function removeItem(name, id, idx) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d || !d.items[idx]) return null;
    d.items.splice(idx, 1);
    saveState();
    return d;
  }
  function reorderItem(name, id, from, to) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d || !d.items[from]) return null;
    const [m] = d.items.splice(from, 1);
    d.items.splice(to, 0, m);
    saveState();
    return d;
  }
  function setTitle(name, id, title) { return updateDoc(name, id, { title: title || '未命名文档' }); }
  function setType(name, id, type) { return updateDoc(name, id, { type: type === 'ol' ? 'ol' : 'ul' }); }

  // -------- 拖拽载荷 --------
  function parseCardPayload(e) {
    let raw = '';
    if (e.dataTransfer) {
      raw = e.dataTransfer.getData(CARD_MIME) || e.dataTransfer.getData('text/plain');
    }
    if (!raw) return null;
    try {
      // 优先 JSON，失败则视为合集名（合集排序的兼容）
      if (raw.trim().startsWith('{')) {
        const p = JSON.parse(raw);
        if (p && (p.kind === 'collection' || p.kind === 'material')) return p;
      }
      // 不在文档拖放目标里视作有效载荷
      return null;
    } catch (err) { return null; }
  }

  // -------- 渲染 --------
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(name, cls) { return `<i data-lucide="${name}" class="${cls || 'w-3.5 h-3.5'}"></i>`; }
  function payloadLabel(p) {
    if (!p) return '未知';
    if (p.kind === 'collection') {
      return '合集 · ' + (p.name || '') + (p.count != null ? ' · ' + p.count + ' 个素材' : '');
    }
    if (p.kind === 'material') {
      return (p.title || '素材') + (p.collection ? ' · ' + p.collection : '');
    }
    return '卡片';
  }
  function payloadIcon(p) {
    if (p && p.kind === 'collection') return 'folder';
    if (p && p.kind === 'material') return 'file-image';
    return 'paperclip';
  }

  function renderItem(item, idx, docId, name) {
    if (!item || !item.kind) return '';
    if (item.kind === 'text') {
      return `<li class="output-item group" data-doc="${escHtml(docId)}" data-idx="${idx}">
        <span class="output-marker"></span>
        <input class="output-text-input" data-doc="${escHtml(docId)}" data-idx="${idx}" value="${escHtml(item.value || '')}" placeholder="列表项…" />
        <button class="output-item-del" data-doc="${escHtml(docId)}" data-idx="${idx}" title="删除">${icon('x')}</button>
      </li>`;
    }
    if (item.kind === 'ref') {
      const p = item.payload || {};
      return `<li class="output-item output-ref group" draggable="true" data-doc="${escHtml(docId)}" data-idx="${idx}" data-kind="ref">
        <span class="output-marker"></span>
        <span class="output-ref-chip">
          ${icon(payloadIcon(p), 'w-3.5 h-3.5 text-[#1A1A1A] shrink-0')}
          <span class="output-ref-text">${escHtml(payloadLabel(p))}</span>
        </span>
        <button class="output-item-del" data-doc="${escHtml(docId)}" data-idx="${idx}" title="删除">${icon('x')}</button>
      </li>`;
    }
    return '';
  }

  function renderDoc(name, doc, opts) {
    opts = opts || {};
    const expanded = opts.expanded !== false;
    const escName = escHtml(name);
    const escId = escHtml(doc.id);
    const escTitle = escHtml(doc.title || '未命名文档');
    const isOl = doc.type === 'ol';

    const itemsHtml = (doc.items || []).map((it, i) => renderItem(it, i, doc.id, name)).join('');
    const listTag = isOl ? 'ol' : 'ul';
    const listClass = isOl ? 'output-list output-list-ol' : 'output-list output-list-ul';

    return `<div class="output-doc ${expanded ? 'expanded' : 'collapsed'}" data-doc="${escId}">
      <header class="output-doc-head" data-doc="${escId}">
        <div class="output-doc-title-wrap">
          <span class="output-doc-emoji">${icon('file-text', 'w-4 h-4 text-[#6B7280]')}</span>
          <input class="output-doc-title" data-doc="${escId}" value="${escTitle}" placeholder="文档标题…" />
        </div>
        <div class="output-doc-actions">
          <div class="output-type-toggle" data-doc="${escId}">
            <button class="${!isOl ? 'active' : ''}" data-type="ul" data-doc="${escId}" title="无序列表">${icon('list')}</button>
            <button class="${isOl ? 'active' : ''}" data-type="ol" data-doc="${escId}" title="有序列表">${icon('list-ordered')}</button>
          </div>
          <button class="output-doc-collapse" data-doc="${escId}" title="展开/收起">${icon(expanded ? 'chevron-up' : 'chevron-down')}</button>
          <button class="output-doc-del" data-doc="${escId}" title="删除文档">${icon('trash-2')}</button>
        </div>
      </header>
      <div class="output-doc-body" data-doc="${escId}">
        <${listTag} class="${listClass}" data-doc="${escId}">${itemsHtml}</${listTag}>
        <div class="output-add-row" data-doc="${escId}">
          <input class="output-add-input" data-doc="${escId}" placeholder="${isOl ? '输入第 ' + ((doc.items || []).length + 1) + ' 项…（回车添加）' : '输入列表项…（回车添加）'}" />
          <button class="output-add-btn" data-doc="${escId}" title="添加">${icon('plus')}</button>
        </div>
        <div class="output-drop-hint" data-doc="${escId}">把左侧合集卡片或中间素材卡片拖到这里</div>
      </div>
    </div>`;
  }

  // 渲染整个分栏内容到容器
  function renderPanel(opts) {
    const { container, collection, onClose, onAi, isMobile } = opts;
    if (!container) return;
    const docs = getDocs(collection);
    const escCol = escHtml(collection);
    let html = `<div class="flex flex-col h-full">
      <div class="panel-header">
        <span class="text-sm font-medium text-[#1A1A1A]">产出物</span>
        <div class="flex items-center gap-1.5">
          <button class="px-2 py-1 text-xs rounded-md bg-[#F3F4F6] text-[#1A1A1A] hover:bg-[#E5E7EB] active:scale-95 transition-all flex items-center gap-1" data-act="add-output" title="新增产出物">${icon('plus', 'w-3.5 h-3.5')}<span>新增</span></button>
          <button class="px-2 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" data-act="ai-summary">AI 总结</button>
          <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" data-act="close">${icon('x', 'w-4 h-4 text-[#6B7280]')}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin output-panel-body" data-collection="${escCol}">`;

    if (docs.length === 0) {
      html += `<div class="output-empty">
        ${icon('file-plus', 'w-10 h-10 text-[#9CA3AF]')}
        <p class="text-sm text-[#9CA3AF] mt-3">还没有产出物</p>
        <button class="mt-4 px-4 py-2 text-xs rounded-lg bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" data-act="add-output">${icon('plus', 'w-3.5 h-3.5 inline -mt-0.5 mr-1')}新建第一份文档</button>
      </div>`;
    } else {
      html += '<div class="p-3 space-y-3">';
      docs.forEach((d, i) => { html += renderDoc(collection, d, { expanded: i === 0 }); });
      html += '</div>';
    }
    html += '</div></div>';

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    bindPanel(container, collection, { onClose, onAi, isMobile });
  }

  // 局部刷新：只重渲某个文档
  function rerenderDoc(container, name, docId) {
    const doc = getDocs(name).find(d => d.id === docId);
    if (!doc) return;
    const old = container.querySelector(`.output-doc[data-doc="${cssEsc(docId)}"]`);
    if (!old) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = renderDoc(name, doc, { expanded: !old.classList.contains('collapsed') });
    old.replaceWith(wrap.firstElementChild);
    if (window.lucide) window.lucide.createIcons();
  }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }

  // -------- 事件绑定 --------
  function bindPanel(container, name, opts) {
    const escName = escHtml(name);

    container.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-doc]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'add-output') {
        addDoc(name);
        renderPanel({ container, collection: name, ...opts });
        // 自动聚焦新文档标题
        const first = container.querySelector('.output-doc:last-child .output-doc-title');
        if (first) { first.focus(); first.select(); }
        return;
      }
      if (act === 'ai-summary') {
        if (typeof opts.onAi === 'function') opts.onAi();
        else alert('AI 总结功能即将上线');
        return;
      }
      if (act === 'close') {
        if (typeof opts.onClose === 'function') opts.onClose();
        return;
      }
    }, { once: false });

    // 文档标题编辑
    container.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList && t.classList.contains('output-doc-title')) {
        setTitle(name, t.dataset.doc, t.value);
      } else if (t.classList && t.classList.contains('output-text-input')) {
        const d = getDocs(name).find(x => x.id === t.dataset.doc);
        if (d) { d.items[+t.dataset.idx] = { kind: 'text', value: t.value }; saveState(); }
      }
    });

    // 类型切换 / 收起 / 删除
    container.addEventListener('click', (e) => {
      const t = e.target.closest('[data-type],[data-act^="doc-"]');
      if (!t) return;
      const docId = t.dataset.doc;
      if (t.dataset.type) {
        setType(name, docId, t.dataset.type);
        rerenderDoc(container, name, docId);
        // 重新聚焦输入框
        const input = container.querySelector(`.output-doc[data-doc="${cssEsc(docId)}"] .output-add-input`);
        if (input) input.focus();
        return;
      }
      if (t.classList.contains('output-doc-collapse')) {
        const docEl = container.querySelector(`.output-doc[data-doc="${cssEsc(docId)}"]`);
        if (docEl) {
          docEl.classList.toggle('collapsed');
          const expanded = !docEl.classList.contains('collapsed');
          const ico = t.querySelector('i');
          if (ico) {
            ico.setAttribute('data-lucide', expanded ? 'chevron-up' : 'chevron-down');
            if (window.lucide) window.lucide.createIcons({ nameAttr: 'data-lucide' });
          }
        }
        return;
      }
      if (t.classList.contains('output-doc-del')) {
        if (!confirm('确认删除该文档？')) return;
        deleteDoc(name, docId);
        renderPanel({ container, collection: name, ...opts });
        return;
      }
    });

    // 添加列表项（回车 / 按钮）
    container.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t.classList && t.classList.contains('output-add-input') && e.key === 'Enter') {
        e.preventDefault();
        const v = t.value.trim();
        if (!v) return;
        addItem(name, t.dataset.doc, { kind: 'text', value: v });
        t.value = '';
        rerenderDoc(container, name, t.dataset.doc);
        // 重聚焦
        const next = container.querySelector(`.output-doc[data-doc="${cssEsc(t.dataset.doc)}"] .output-add-input`);
        if (next) next.focus();
      }
    });
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.output-add-btn');
      if (!btn) return;
      const docId = btn.dataset.doc;
      const input = container.querySelector(`.output-doc[data-doc="${cssEsc(docId)}"] .output-add-input`);
      if (!input) return;
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      addItem(name, docId, { kind: 'text', value: v });
      input.value = '';
      rerenderDoc(container, name, docId);
      input.focus();
    });

    // 删除列表项 / 引用
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.output-item-del');
      if (!btn) return;
      const docId = btn.dataset.doc;
      const idx = +btn.dataset.idx;
      removeItem(name, docId, idx);
      rerenderDoc(container, name, docId);
    });

    // 拖入（drop）
    container.addEventListener('dragover', (e) => {
      const docEl = e.target.closest('.output-doc');
      if (!docEl) return;
      if (Array.from(e.dataTransfer.types).indexOf(CARD_MIME) < 0 &&
          Array.from(e.dataTransfer.types).indexOf('text/plain') < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      docEl.classList.add('drag-over');
    });
    container.addEventListener('dragleave', (e) => {
      const docEl = e.target.closest('.output-doc');
      if (docEl) docEl.classList.remove('drag-over');
    });
    container.addEventListener('drop', (e) => {
      const docEl = e.target.closest('.output-doc');
      if (!docEl) return;
      e.preventDefault();
      docEl.classList.remove('drag-over');
      const docId = docEl.dataset.doc;
      const payload = parseCardPayload(e);
      if (!payload) return;
      addItem(name, docId, { kind: 'ref', payload: payload });
      rerenderDoc(container, name, docId);
    });
  }

  // 辅助：把 payload 写到 dragstart 事件
  function attachDragSource(el, payload) {
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (e) => {
      try {
        e.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', payload.kind === 'collection' ? (payload.name || '') : (payload.title || ''));
        e.dataTransfer.effectAllowed = 'copyMove';
      } catch (err) { /* 忽略 */ }
    });
  }

  // 全局 delegation：素材卡（带 data-fb-drag="material"）dragstart 时注入 payload
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-fb-drag="material"]');
    if (!el) return;
    try {
      const types = e.dataTransfer && e.dataTransfer.types;
      if (types && types.indexOf(CARD_MIME) >= 0) return; // 已有
      const payload = {
        kind: 'material',
        id: el.dataset.materialId || '',
        title: el.dataset.materialTitle || el.getAttribute('title') || '',
        collection: el.dataset.materialCollection || '',
        url: el.dataset.materialUrl || '',
      };
      e.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
      // 文本 fallback：让浏览器显示拖动光标
      e.dataTransfer.setData('text/plain', payload.title || payload.id);
    } catch (err) { /* 忽略 */ }
  });

  window.OutputDocs = {
    STORAGE_KEY, CARD_MIME,
    getDocs, addDoc, deleteDoc, updateDoc,
    addItem, removeItem, reorderItem,
    setTitle, setType,
    parseCardPayload, attachDragSource,
    renderPanel, renderDoc, rerenderDoc,
  };

  // 首次访问：seed 演示文档（含无序/有序列表与卡片引用样例）
  try {
    if (localStorage.getItem('foubow-output-docs-seeded') !== '1') {
      const names = ['Agent搭建', '设计灵感', '穿着搭配'];
      names.forEach(name => {
        if (getDocs(name).length === 0) {
          addDoc(name, { title: '分析报告', type: 'ul', items: [
            { kind: 'text', value: '本页素材的核心要点摘要' },
            { kind: 'text', value: '典型使用场景与适用人群' },
            { kind: 'ref', payload: { kind: 'collection', name: '设计灵感', count: 4 } },
          ]});
          addDoc(name, { title: '数据汇总', type: 'ol', items: [
            { kind: 'text', value: '第一步：归类当前合集素材' },
            { kind: 'text', value: '第二步：按主题或时间排序' },
            { kind: 'text', value: '第三步：输出可复用模板' },
          ]});
        }
      });
      localStorage.setItem('foubow-output-docs-seeded', '1');
    }
    if (typeof window !== 'undefined') window.__seededDocs = state; // debug 可读
  } catch (e) { /* 容量/隐私模式 */ }
})();
