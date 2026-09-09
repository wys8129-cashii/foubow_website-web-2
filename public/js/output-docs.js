/* output-docs.js
 * 产出物文档（v2，重构为两级视图）：
 *   1) 文件列表：一个合集下有多个文档文件，点击进入
 *   2) 在线文档（幕布/飞书风格）：块级编辑，可加文字、缩进层级、折叠，可拖入卡片
 * 卡片引用在文档内以「缩略图 + 链接 + 标题」呈现（不再是图标+文件名）。
 * - 持久化：localStorage key `foubow-output-docs-v2`
 * - 拖入数据：MIME `application/x-foubow-card` = JSON.stringify(payload)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'foubow-output-docs-v2';
  const CARD_MIME = 'application/x-foubow-card';

  let state = loadState();
  let _view = { mode: 'list', docId: null };
  let _pendingFocus = -1; // 重渲染后需要聚焦的块 idx

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const p = JSON.parse(raw);
      return (p && typeof p === 'object') ? p : {};
    } catch (e) { return {}; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
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
      title: init.title || '未命名文档',
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
  function setTitle(name, id, title) { return updateDoc(name, id, { title: title || '未命名文档' }); }
  function setType(name, id, type) { return updateDoc(name, id, { type: type === 'ol' ? 'ol' : 'ul' }); }
  function addItem(name, id, item) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d) return null; d.items.push(item); saveState(); return d;
  }
  function addItemAt(name, id, idx, item) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d) return null; d.items.splice(idx, 0, item); saveState(); return d;
  }
  function removeItem(name, id, idx) {
    const d = getDocs(name).find(x => x.id === id);
    if (!d || !d.items[idx]) return null; d.items.splice(idx, 1); saveState(); return d;
  }

  // -------- 工具 --------
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(name, cls) { return `<i data-lucide="${name}" class="${cls || 'w-3.5 h-3.5'}"></i>`; }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts); const n = new Date();
    const sameDay = d.toDateString() === n.toDateString();
    const pad = x => String(x).padStart(2, '0');
    if (sameDay) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function parseCardPayload(e) {
    let raw = '';
    if (e.dataTransfer) raw = e.dataTransfer.getData(CARD_MIME) || e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      if (raw.trim().startsWith('{')) {
        const p = JSON.parse(raw);
        if (p && (p.kind === 'collection' || p.kind === 'material')) return p;
      }
      return null;
    } catch (err) { return null; }
  }

  // -------- 渲染：总入口 --------
  function renderPanel(opts) {
    const { container, collection, onClose, onAi, isMobile } = opts;
    if (!container) return;
    container.__obName = collection;
    container.__obOpts = { onClose, onAi, isMobile };
    if (!container.dataset.obBound) bindPanel(container);
    container.dataset.obBound = '1';
    renderAll(container);
  }

  function renderAll(container) {
    const name = container.__obName;
    const opts = container.__obOpts || {};
    if (_view.mode === 'doc' && getDocs(name).some(d => d.id === _view.docId)) {
      renderDocView(container, name, _view.docId, opts);
    } else {
      _view = { mode: 'list', docId: null };
      renderListView(container, name, opts);
    }
    if (window.lucide) window.lucide.createIcons();
    if (_pendingFocus >= 0) { focusBlock(container, _pendingFocus); _pendingFocus = -1; }
  }

  // -------- 视图 A：文件列表 --------
  function renderListView(container, name, opts) {
    const docs = getDocs(name);
    const escCol = escHtml(name);
    let html = `<div class="flex flex-col h-full">
      <div class="panel-header">
        <span class="text-sm font-medium text-[#1A1A1A]">产出物</span>
        <div class="flex items-center gap-1.5">
          <button class="px-2 py-1 text-xs rounded-md bg-[#F3F4F6] text-[#1A1A1A] hover:bg-[#E5E7EB] active:scale-95 transition-all flex items-center gap-1" data-act="add-output" title="新建文档">${icon('plus', 'w-3.5 h-3.5')}<span>新增</span></button>
          <button class="px-2 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" data-act="ai-summary">AI 总结</button>
          <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" data-act="close" title="关闭">${icon('x', 'w-4 h-4 text-[#6B7280]')}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin doc-list-body">`;

    if (docs.length === 0) {
      html += `<div class="doc-empty">
        ${icon('file-plus-2', 'w-10 h-10 text-[#9CA3AF]')}
        <p class="text-sm text-[#9CA3AF] mt-3">还没有文档</p>
        <button class="mt-4 px-4 py-2 text-xs rounded-lg bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" data-act="add-output">${icon('plus', 'w-3.5 h-3.5 inline -mt-0.5 mr-1')}新建第一份文档</button>
      </div>`;
    } else {
      html += '<div class="p-3 space-y-2">';
      docs.forEach(d => { html += renderDocRow(d); });
      html += '</div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
  }

  function renderDocRow(d) {
    const count = (d.items || []).length;
    return `<div class="doc-row" data-act="open-doc" data-doc="${escHtml(d.id)}">
      <span class="doc-row-icon">${icon('file-text', 'w-4 h-4 text-[#6B7280]')}</span>
      <div class="doc-row-main">
        <div class="doc-row-title">${escHtml(d.title || '未命名文档')}</div>
        <div class="doc-row-meta">${count} 项 · ${fmtTime(d.createdAt)}</div>
      </div>
      <span class="doc-row-arrow">${icon('chevron-right', 'w-4 h-4 text-[#9CA3AF]')}</span>
    </div>`;
  }

  // -------- 视图 B：在线文档（幕布/飞书风格）--------
  function renderDocView(container, name, docId, opts) {
    const doc = getDocs(name).find(d => d.id === docId);
    if (!doc) { _view = { mode: 'list', docId: null }; return renderListView(container, name, opts); }
    const isOl = doc.type === 'ol';
    const escId = escHtml(doc.id);
    const escTitle = escHtml(doc.title || '未命名文档');

    let html = `<div class="flex flex-col h-full">
      <div class="panel-header">
        <div class="flex items-center gap-1.5 min-w-0">
          <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors shrink-0" data-act="back-list" title="返回列表">${icon('arrow-left', 'w-4 h-4 text-[#6B7280]')}</button>
          <input class="ob-doc-title" data-doc="${escId}" value="${escTitle}" placeholder="文档标题…" />
        </div>
        <div class="flex items-center gap-1.5">
          <div class="output-type-toggle" data-doc="${escId}">
            <button class="${!isOl ? 'active' : ''}" data-type="ul" data-doc="${escId}" title="无序列表">${icon('list')}</button>
            <button class="${isOl ? 'active' : ''}" data-type="ol" data-doc="${escId}" title="有序列表">${icon('list-ordered')}</button>
          </div>
          <button class="px-2 py-1 text-xs rounded-md bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors" data-act="ai-summary">AI 总结</button>
          <button class="p-1 rounded-md hover:bg-[#F3F4F6] transition-colors" data-act="doc-del" data-doc="${escId}" title="删除文档">${icon('trash-2', 'w-4 h-4 text-[#6B7280]')}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin ob-body" data-doc="${escId}">`;

    // 折叠栈：collapsed 块之后的更高层级块隐藏
    const items = doc.items || [];
    const stack = [];
    const blocks = items.map((it, i) => {
      while (stack.length && (it.level || 0) <= stack[stack.length - 1].level) stack.pop();
      const hide = stack.length > 0;
      if (it.collapsed) stack.push(it);
      return { it, i, hide };
    });
    const numList = [];
    let curNum = 0;
    blocks.forEach((b, i) => {
      if (b.hide) return;
      const level = b.it.level || 0;
      if (isOl) { if (level === 0) { curNum++; numList[i] = curNum; } else numList[i] = numList[i - 1] != null ? numList[i - 1] : 0; }
      html += b.it.kind === 'ref'
        ? renderRefBlock(b.it, b.i, doc.id, isOl, isOl ? numList[i] : null)
        : renderTextBlock(b.it, b.i, isOl, isOl ? numList[i] : null);
    });

    html += `<div class="ob-add">
      <button class="ob-add-btn" data-act="ob-add-text" data-doc="${escId}">${icon('plus', 'w-3.5 h-3.5 inline -mt-0.5 mr-1')}添加文字</button>
    </div>
    <div class="ob-drop-hint" data-doc="${escId}">把左侧合集卡片或中间素材卡片拖到这里，可作为卡片引用插入</div>
    </div></div>`;
    container.innerHTML = html;
  }

  function renderTextBlock(it, idx, isOl, num) {
    const level = it.level || 0;
    const collapsed = it.collapsed ? ' ob-collapsed' : '';
    const bulletCls = isOl ? 'ob-bullet ob-bullet-num' : 'ob-bullet';
    const marker = isOl ? `<span class="ob-num">${num}.</span>` : '';
    return `<div class="ob-block ob-text${collapsed}" data-idx="${idx}" style="margin-left:${level * 22}px">
      <button class="${bulletCls}" data-act="ob-fold" data-idx="${idx}" title="折叠/展开">${marker}</button>
      <div class="ob-edit" contenteditable="true" data-idx="${idx}" spellcheck="false">${escHtml(it.value || '')}</div>
    </div>`;
  }

  function renderRefBlock(it, idx, docId, isOl, num) {
    const p = it.payload || {};
    const level = it.level || 0;
    const thumb = p.previewHTML
      ? `<div class="ob-thumb ${escHtml(p.previewBg || '')}">${p.previewHTML}</div>`
      : `<div class="ob-thumb ${escHtml(p.previewBg || 'ob-thumb-empty')}"></div>`;
    const link = p.url || (p.collection ? '合集 · ' + p.collection : (p.kind === 'collection' ? '合集 · ' + (p.name || '') : ''));
    const bulletCls = isOl ? 'ob-bullet ob-bullet-num' : 'ob-bullet';
    const marker = isOl ? `<span class="ob-num">${num}.</span>` : '';
    return `<div class="ob-block ob-ref" data-idx="${idx}" style="margin-left:${level * 22}px">
      <button class="${bulletCls}" data-act="ob-fold" data-idx="${idx}" title="折叠/展开">${marker}</button>
      <div class="ob-ref-card">
        ${thumb}
        <div class="ob-ref-meta">
          <a class="ob-ref-title" href="${escHtml(p.url || '#')}" target="_blank" rel="noopener">${escHtml(p.title || '未命名素材')}</a>
          ${link ? `<a class="ob-ref-link" href="${escHtml(p.url || '#')}" target="_blank" rel="noopener">${escHtml(link)}</a>` : ''}
        </div>
        <button class="ob-block-del" data-act="ob-del" data-idx="${idx}" title="删除">${icon('x')}</button>
      </div>
    </div>`;
  }

  function focusBlock(container, idx) {
    const el = container.querySelector(`.ob-edit[data-idx="${idx}"]`);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
  }

  // -------- 事件 --------
  function bindPanel(container) {
    container.addEventListener('click', (e) => {
      const name = container.__obName;
      const opts = container.__obOpts || {};
      const t = e.target.closest('[data-act],[data-type]');
      if (!t) return;
      const act = t.dataset.act;
      const docId = t.dataset.doc;

      if (act === 'add-output') {
        const d = addDoc(name, { title: '未命名文档', type: 'ul', items: [] });
        _view = { mode: 'doc', docId: d.id };
        renderAll(container);
        const title = container.querySelector('.ob-doc-title'); if (title) { title.focus(); title.select(); }
        return;
      }
      if (act === 'close') { if (typeof opts.onClose === 'function') opts.onClose(); return; }
      if (act === 'ai-summary') { if (typeof opts.onAi === 'function') opts.onAi(); else alert('AI 总结功能即将上线'); return; }
      if (act === 'open-doc') { _view = { mode: 'doc', docId: docId }; renderAll(container); return; }
      if (act === 'back-list') { _view = { mode: 'list', docId: null }; renderAll(container); return; }
      if (act === 'doc-del') {
        if (!confirm('确认删除该文档？')) return;
        deleteDoc(name, docId);
        _view = { mode: 'list', docId: null };
        renderAll(container);
        return;
      }
      if (act === 'ob-fold') {
        const d = getDocs(name).find(x => x.id === _view.docId); if (!d) return;
        const it = d.items[+t.dataset.idx]; if (!it) return;
        it.collapsed = !it.collapsed; saveState();
        renderAll(container);
        return;
      }
      if (act === 'ob-del') {
        removeItem(name, _view.docId, +t.dataset.idx);
        renderAll(container);
        return;
      }
      if (act === 'ob-add-text') {
        const d = getDocs(name).find(x => x.id === _view.docId); if (!d) return;
        const idx = (d.items || []).length;
        addItem(name, _view.docId, { kind: 'text', value: '', level: 0 });
        _pendingFocus = idx;
        renderAll(container);
        return;
      }
      if (t.dataset.type) {
        setType(name, docId, t.dataset.type);
        renderAll(container);
        return;
      }
    });

    // 输入：标题 / 文字块（不重渲染，避免丢光标）
    container.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('ob-doc-title')) { setTitle(container.__obName, t.dataset.doc, t.value); return; }
      if (t.classList.contains('ob-edit')) {
        const d = getDocs(container.__obName).find(x => x.id === _view.docId);
        if (d) { d.items[+t.dataset.idx] = Object.assign(d.items[+t.dataset.idx] || {}, { kind: 'text', value: t.innerText, level: d.items[+t.dataset.idx] ? d.items[+t.dataset.idx].level || 0 : 0 }); saveState(); }
      }
    });

    // 键盘：Enter 新建 / Tab 缩进 / Backspace 删空块
    container.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('ob-edit')) return;
      const name = container.__obName;
      const docId = _view.docId;
      const idx = +t.dataset.idx;
      const d = getDocs(name).find(x => x.id === docId);
      if (!d) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const level = (d.items[idx] && d.items[idx].level) || 0;
        addItemAt(name, docId, idx + 1, { kind: 'text', value: '', level });
        _pendingFocus = idx + 1;
        renderAll(container);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const it = d.items[idx]; if (!it) return;
        it.level = e.shiftKey ? Math.max(0, it.level - 1) : Math.min(6, it.level + 1);
        saveState();
        _pendingFocus = idx;
        renderAll(container);
        return;
      }
      if (e.key === 'Backspace') {
        if (t.innerText.trim() === '' && idx > 0) {
          e.preventDefault();
          removeItem(name, docId, idx);
          _pendingFocus = idx - 1;
          renderAll(container);
        }
      }
    });

    // 拖入卡片
    container.addEventListener('dragover', (e) => {
      if (_view.mode !== 'doc') return;
      const ok = e.dataTransfer && (Array.from(e.dataTransfer.types).indexOf(CARD_MIME) >= 0 || Array.from(e.dataTransfer.types).indexOf('text/plain') >= 0);
      if (!ok) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const body = e.target.closest('.ob-body');
      if (body) body.classList.add('drag-over');
    });
    container.addEventListener('dragleave', (e) => {
      const body = e.target.closest('.ob-body');
      if (body) body.classList.remove('drag-over');
    });
    container.addEventListener('drop', (e) => {
      if (_view.mode !== 'doc') return;
      const body = e.target.closest('.ob-body');
      if (!body) return;
      e.preventDefault();
      body.classList.remove('drag-over');
      const payload = parseCardPayload(e);
      if (!payload) return;
      const d = getDocs(container.__obName).find(x => x.id === _view.docId);
      if (!d) return;
      addItem(container.__obName, _view.docId, { kind: 'ref', payload: payload, level: 0 });
      _pendingFocus = -1;
      renderAll(container);
    });
  }

  // 全局 delegation：素材卡 dragstart 时注入 payload（含缩略图）
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-fb-drag="material"]');
    if (!el) return;
    try {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).indexOf(CARD_MIME) >= 0) return;
      const id = el.dataset.materialId || '';
      const payload = {
        kind: 'material',
        id: id,
        title: el.dataset.materialTitle || el.getAttribute('title') || '',
        collection: el.dataset.materialCollection || '',
        url: el.dataset.materialUrl || '',
      };
      // 补充缩略图（previewBg + previewHTML）
      try {
        const item = (typeof getMaterialById === 'function') ? getMaterialById(id) : null;
        if (item) {
          payload.previewBg = item.previewBg || '';
          payload.previewHTML = item.getPreviewHTML ? item.getPreviewHTML() : '';
        } else if (typeof materials !== 'undefined') {
          const m = materials.find(x => String(x.id) === String(id));
          if (m) { payload.previewBg = m.previewBg || ''; payload.previewHTML = m.getPreviewHTML ? m.getPreviewHTML() : ''; }
        }
      } catch (_) {}
      e.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', payload.title || payload.id);
    } catch (err) {}
  });

  window.OutputDocs = {
    STORAGE_KEY, CARD_MIME,
    getDocs, addDoc, deleteDoc, updateDoc,
    addItem, addItemAt, removeItem,
    setTitle, setType,
    parseCardPayload,
    renderPanel,
  };

  // 首次访问：seed 演示文档（列表 + 在线文档 + 缩略图卡片引用）
  try {
    if (localStorage.getItem('foubow-output-docs-v2-seeded') !== '1') {
      const names = ['Agent搭建', '设计灵感', '穿着搭配'];
      let sample = null;
      try { if (typeof materials !== 'undefined' && materials.length) sample = materials[0]; } catch (_) {}
      const refPayload = sample
        ? { kind: 'material', id: sample.id, title: sample.title, collection: sample.collection, url: sample.url || '', previewBg: sample.previewBg || '', previewHTML: sample.getPreviewHTML ? sample.getPreviewHTML() : '' }
        : { kind: 'material', title: '示例素材', collection: '设计灵感', url: '' };
      names.forEach(name => {
        if (getDocs(name).length === 0) {
          addDoc(name, { title: '分析报告', type: 'ul', items: [
            { kind: 'text', value: '本页素材的核心要点摘要', level: 0 },
            { kind: 'text', value: '典型使用场景与适用人群', level: 1 },
            { kind: 'ref', payload: refPayload, level: 0 },
          ]});
          addDoc(name, { title: '执行步骤', type: 'ol', items: [
            { kind: 'text', value: '第一步：归类当前合集素材', level: 0 },
            { kind: 'text', value: '第二步：按主题或时间排序', level: 0 },
            { kind: 'text', value: '第三步：输出可复用模板', level: 0 },
          ]});
        }
      });
      localStorage.setItem('foubow-output-docs-v2-seeded', '1');
    }
  } catch (e) {}
})();
