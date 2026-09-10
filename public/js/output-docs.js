/* output-docs.js  v2.2
 * 产出物文档：文件列表 + 在线文档（幕布/飞书风格）两级视图
 * 改造要点：
 *   - 头部按钮统一样式化（图标按钮 + ⋯ 气泡菜单）
 *   - 列表底部"查看全部产出物"，全部视图按合集分组 + 虚线分割
 *   - ⋯ 菜单：[AI 总结] [分享] [删除/分享当前合集]
 *   - 分享：生成 #share=base64url 链接，material.html 检测 hash 进入只读分享模式
 *   - 跨合集打开 doc：用 _view.collectionName 而非 container.__obName，保证 save 写回正确
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'foubow-output-docs-v2';
  const CARD_MIME = 'application/x-foubow-card';
  const BLOCK_DRAG_MIME = 'application/x-foubow-block';

  let state = loadState();
  let _view = { mode: 'list', docId: null, collectionName: null };
  let _pendingFocus = -1;

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

  // 统计：所有合集的文档总数 + 全合集分组的快照
  function totalDocCount() {
    let n = 0;
    Object.keys(state).forEach(k => { if (Array.isArray(state[k])) n += state[k].length; });
    return n;
  }
  function allGroups() {
    const groups = [];
    Object.keys(state).forEach(col => {
      const docs = state[col] || [];
      if (docs.length > 0) groups.push({ name: col, docs });
    });
    return groups;
  }

  // -------- 工具 --------
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(name, cls) { return `<i data-lucide="${name}" class="${cls || 'w-4 h-4'}"></i>`; }
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

  // -------- 分享：base64url 编码/解码 --------
  function b64urlEncode(str) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(str)));
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { return ''; }
  }
  function b64urlDecode(s) {
    try {
      const b64 = (s.replace(/-/g, '+').replace(/_/g, '/')) + '==='.slice((s.length + 3) % 4);
      return decodeURIComponent(escape(atob(b64)));
    } catch (e) { return null; }
  }
  // 生成可分享的真实 URL：material.html#share=base64url({collection, doc})
  function buildShareUrl(name, docId) {
    let payload = { kind: 'collection', name };
    if (docId) {
      const doc = getDocs(name).find(d => d.id === docId);
      if (doc) payload = { kind: 'doc', name, doc };
    } else {
      // 当前合集所有文档
      payload.docs = getDocs(name);
    }
    const data = b64urlEncode(JSON.stringify(payload));
    return `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/')}material.html#share=${data}`;
  }
  function readShareFromHash() {
    try {
      const h = location.hash || '';
      const m = h.match(/#share=([^&]+)/);
      if (!m) return null;
      const json = b64urlDecode(m[1]);
      return json ? JSON.parse(json) : null;
    } catch (e) { return null; }
  }

  // -------- 渲染：总入口 --------
  function renderPanel(opts) {
    const { container, collection, onClose, onAi } = opts || {};
    if (!container) return;
    container.__obName = collection;
    container.__obOpts = { onClose, onAi };
    if (!container.dataset.obBound) bindPanel(container);
    container.dataset.obBound = '1';
    renderAll(container);
  }

  function renderAll(container) {
    const curName = container.__obName;
    const opts = container.__obOpts || {};
    // 检测分享模式
    const share = readShareFromHash();
    if (share) {
      renderShareView(container, share);
    } else if (_view.mode === 'doc' && _view.docId) {
      const targetName = _view.collectionName || curName;
      const doc = getDocs(targetName).find(d => d.id === _view.docId);
      if (doc) renderDocView(container, targetName, _view.docId, opts);
      else { _view = { mode: 'list', docId: null, collectionName: null }; renderListView(container, curName, opts); }
    } else if (_view.mode === 'all') {
      renderAllView(container, curName, opts);
    } else {
      renderListView(container, curName, opts);
    }
    if (window.lucide) window.lucide.createIcons();
    if (_pendingFocus >= 0) { focusBlock(container, _pendingFocus); _pendingFocus = -1; }
  }

  // ============ 头部组件（统一风格化）============
  function headerLeft(label, extra) {
    return `<div class="flex items-center gap-2 min-w-0 flex-1">${extra || ''}<span class="text-sm font-medium text-[#1A1A1A] truncate">${label}</span></div>`;
  }
  // ⋯ 菜单按钮 + 气泡内容
  function menuButton(menuId, tooltip, items) {
    return `<div class="hdr-menu-wrap" data-menu="${menuId}">
      <button class="hdr-icon-btn" data-act="menu-toggle" data-menu="${menuId}" title="${tooltip}" aria-label="${tooltip}">${icon('more-horizontal')}</button>
      <div class="hdr-menu" data-menu="${menuId}" role="menu">
        ${items.map((it, i) =>
          it.divider
            ? '<div class="hdr-menu-divider"></div>'
            : `<button class="hdr-menu-item ${it.danger ? 'danger' : ''}" data-act="${it.act}" ${it.docAttr ? `data-doc="${escHtml(it.docAttr)}"` : ''} ${it.dataAttrs || ''} role="menuitem">
                ${it.icon ? icon(it.icon, 'w-3.5 h-3.5') : ''}<span>${it.label}</span>
              </button>`
        ).join('')}
      </div>
    </div>`;
  }

  // ============ 视图 A：当前合集列表 ============
  function renderListView(container, name, opts) {
    const docs = getDocs(name);
    const total = totalDocCount();
    const escName = escHtml(name);
    const shareUrl = buildShareUrl(name);

    let html = `<div class="flex flex-col h-full">
      <div class="panel-header">
        ${headerLeft(`产出物`)}
        <div class="flex items-center gap-1 shrink-0">
          <button class="hdr-icon-btn" data-act="add-output" title="新建文档" aria-label="新建文档">${icon('plus')}</button>
          ${menuButton('list-menu', '更多', [
            { act: 'menu-ai-summary-list', label: 'AI 总结', icon: 'sparkles' },
            { act: 'menu-share-list', label: '分享当前合集', icon: 'share-2' },
          ])}
          <button class="hdr-icon-btn" data-act="close" title="关闭" aria-label="关闭">${icon('x')}</button>
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
      html += '<div class="px-3 pt-3 space-y-2">';
      docs.forEach(d => { html += renderDocRow(d, name); });
      html += '</div>';
    }
    html += '</div>';

    // 底部"查看全部产出物"（doc 数 > 0 或者列表空但有其他合集有产出）
    if (total > docs.length || (docs.length === 0 && total > 0) || docs.length > 0) {
      html += `<div class="doc-view-all-wrap">
        <button class="doc-view-all" data-act="view-all-docs" title="查看所有合集的产出物">
          ${icon('layout-grid', 'w-3.5 h-3.5')}
          <span>查看全部产出物</span>
          <span class="doc-view-all-count">${total}</span>
        </button>
      </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
    // 暴露分享 URL 给"分享"菜单项事件用
    container.__shareUrl = shareUrl;
    container.__shareScope = { name, docId: null };
  }

  function renderDocRow(d, col) {
    const count = (d.items || []).length;
    return `<div class="doc-row" data-act="open-doc" data-doc="${escHtml(d.id)}" data-col="${escHtml(col || '')}">
      <span class="doc-row-icon">${icon('file-text', 'w-4 h-4 text-[#6B7280]')}</span>
      <div class="doc-row-main">
        <div class="doc-row-title">${escHtml(d.title || '未命名文档')}</div>
        <div class="doc-row-meta">${count} 项 · ${fmtTime(d.createdAt)}</div>
      </div>
      <span class="doc-row-arrow">${icon('chevron-right', 'w-4 h-4 text-[#9CA3AF]')}</span>
    </div>`;
  }

  // ============ 视图 A2：全部产出物（按合集分组 + 虚线分割）============
  function renderAllView(container, currentName, opts) {
    const groups = allGroups();
    const total = groups.reduce((s, g) => s + g.docs.length, 0);

    let html = `<div class="flex flex-col h-full">
      <div class="panel-header">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <button class="hdr-icon-btn" data-act="back-current" title="返回当前合集" aria-label="返回">${icon('arrow-left')}</button>
          <span class="text-sm font-medium text-[#1A1A1A] truncate">全部产出物</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${menuButton('all-menu', '更多', [
            { act: 'menu-ai-summary-list', label: 'AI 总结全部', icon: 'sparkles' },
            { act: 'menu-share-list', label: '分享全部', icon: 'share-2' },
          ])}
          <button class="hdr-icon-btn" data-act="close" title="关闭" aria-label="关闭">${icon('x')}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin">`;

    if (groups.length === 0) {
      html += `<div class="doc-empty">
        ${icon('inbox', 'w-10 h-10 text-[#9CA3AF]')}
        <p class="text-sm text-[#9CA3AF] mt-3">还没有任何产出物</p>
      </div>`;
    } else {
      html += '<div class="py-3">';
      groups.forEach((g, gi) => {
        if (gi > 0) html += '<div class="doc-group-divider"></div>';
        html += `<div class="doc-group">
          <div class="doc-group-header">
            <span class="doc-group-name">${escHtml(g.name)}</span>
            <span class="doc-group-count">${g.docs.length} 个文档</span>
          </div>
          <div class="px-3 space-y-2">`;
        g.docs.forEach(d => { html += renderDocRow(d, g.name); });
        html += '</div></div>';
      });
      html += '</div>';
    }
    html += '</div></div>';

    container.innerHTML = html;
    container.__shareUrl = buildShareUrl(null); // 全部分享
    container.__shareScope = { name: null, docId: null };
  }

  // ============ 视图 B：在线文档 ============
  function renderDocView(container, name, docId, opts) {
    const doc = getDocs(name).find(d => d.id === docId);
    if (!doc) { _view = { mode: 'list', docId: null, collectionName: null }; return renderListView(container, name, opts); }
    const isOl = doc.type === 'ol';
    const escId = escHtml(doc.id);
    const escTitle = escHtml(doc.title || '未命名文档');

    let html = `<div class="flex flex-col h-full">
      <div class="panel-header">
        <div class="flex items-center gap-1 min-w-0 flex-1">
          <button class="hdr-icon-btn" data-act="back-list" title="返回" aria-label="返回">${icon('arrow-left')}</button>
          <input class="ob-doc-title" data-doc="${escId}" value="${escTitle}" placeholder="文档标题…" />
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <div class="output-type-toggle" data-doc="${escId}" title="切换列表类型">
            <button class="${!isOl ? 'active' : ''}" data-type="ul" data-doc="${escId}" title="无序列表">${icon('list')}</button>
            <button class="${isOl ? 'active' : ''}" data-type="ol" data-doc="${escId}" title="有序列表">${icon('list-ordered')}</button>
          </div>
          ${menuButton('doc-menu', '更多', [
            { act: 'menu-ai-summary-doc', label: 'AI 总结', icon: 'sparkles' },
            { act: 'menu-share-doc', label: '分享', icon: 'share-2' },
            { divider: true },
            { act: 'menu-del-doc', label: '删除', icon: 'trash-2', danger: true, docAttr: docId },
          ])}
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin ob-body" data-doc="${escId}">`;

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

    container.__shareUrl = buildShareUrl(name, doc.id);
    container.__shareScope = { name, docId: doc.id };
  }

  function renderTextBlock(it, idx, isOl, num) {
    const level = it.level || 0;
    const collapsed = it.collapsed ? ' ob-collapsed' : '';
    const bulletCls = isOl ? 'ob-bullet ob-bullet-num' : 'ob-bullet';
    const marker = isOl ? `<span class="ob-num">${num}.</span>` : '';
    return `<div class="ob-block ob-text${collapsed}" data-idx="${idx}" style="margin-left:${level * 22}px">
      <button class="${bulletCls} ob-drag-handle" draggable="true" data-act="ob-fold" data-idx="${idx}" title="拖动可排序 · 点击折叠/展开">${marker}</button>
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
      <button class="${bulletCls} ob-drag-handle" draggable="true" data-act="ob-fold" data-idx="${idx}" title="拖动可排序 · 点击折叠/展开">${marker}</button>
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

  // ============ 分享：弹窗（链接 + 复制 + 新窗口预览）============
  function openShareModal(container) {
    const url = container.__shareUrl || buildShareUrl(container.__obName);
    const scope = container.__shareScope || { name: null, docId: null };
    const scopeLabel = scope.docId
      ? `分享《${escHtml(getDocs(scope.name).find(d=>d.id===scope.docId)?.title || '未命名文档')}》`
      : (scope.name ? `分享合集「${escHtml(scope.name)}」` : '分享全部产出物');

    // 移除旧的
    document.getElementById('share-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'share-modal-overlay';
    overlay.className = 'share-modal-overlay';
    overlay.innerHTML = `
      <div class="share-modal" onclick="event.stopPropagation()">
        <div class="share-modal-head">
          <h3>${scopeLabel}</h3>
          <button class="hdr-icon-btn" onclick="document.getElementById('share-modal-overlay').remove()" title="关闭">${icon('x')}</button>
        </div>
        <p class="share-modal-sub">任何人通过下方链接可以预览该页面</p>
        <div class="share-link-box">
          <input class="share-link-input" readonly value="${escHtml(url)}" onfocus="this.select()" />
          <button class="share-copy-btn" data-act="share-copy">${icon('copy', 'w-3.5 h-3.5')}<span>复制</span></button>
        </div>
        <div class="share-actions">
          <button class="share-action-btn" data-act="share-open">${icon('external-link', 'w-3.5 h-3.5')}<span>新窗口预览</span></button>
        </div>
        <p class="share-modal-tip">链接内含文档内容（无需登录即可访问），长度约 ${Math.ceil(url.length/100)*100} 字符</p>
      </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="share-copy"]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        const btn = overlay.querySelector('[data-act="share-copy"]');
        const original = btn.innerHTML;
        btn.innerHTML = `${icon('check', 'w-3.5 h-3.5')}<span>已复制</span>`;
        setTimeout(() => { btn.innerHTML = original; if (window.lucide) window.lucide.createIcons(); }, 1500);
      } catch (e) {
        const inp = overlay.querySelector('.share-link-input'); inp.select(); document.execCommand('copy');
      }
    });
    overlay.querySelector('[data-act="share-open"]').addEventListener('click', () => {
      window.open(url, '_blank');
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // ============ 分享模式（只读）============
  function renderShareView(container, share) {
    const escT = escHtml((share.doc && share.doc.title) || share.name || '分享预览');
    let items = [];
    let title = share.name ? `合集：${share.name}` : '分享预览';
    let type = 'ul';
    if (share.kind === 'doc' && share.doc) {
      title = share.doc.title || '未命名文档';
      items = share.doc.items || [];
      type = share.doc.type || 'ul';
    } else if (share.kind === 'collection') {
      // 全部文档合并展示
      const docs = share.docs || [];
      docs.forEach((d, di) => {
        items.push({ kind: 'text', level: 0, value: '— ' + (d.title || '未命名文档') + ' —', __heading: true });
        items = items.concat((d.items || []).map(it => Object.assign({}, it)));
      });
    }
    const isOl = type === 'ol';

    const stack = [];
    const visible = [];
    items.forEach(it => {
      while (stack.length && (it.level||0) <= stack[stack.length-1].level) stack.pop();
      if (stack.length > 0) return;
      if (it.collapsed) stack.push(it);
      visible.push(it);
    });

    let body = '';
    let num = 0;
    visible.forEach((it) => {
      const indent = (it.level || 0) * 22;
      const bulletCls = isOl ? 'ob-bullet ob-bullet-num' : 'ob-bullet';
      let marker = '';
      if (isOl && (it.level || 0) === 0) { num++; marker = `<span class="ob-num">${num}.</span>`; }
      else if (isOl) marker = `<span class="ob-num">↳</span>`;
      else marker = '';
      if (it.kind === 'text') {
        body += `<div class="ob-block" style="margin-left:${indent}px">
          <div class="${bulletCls}">${marker}</div>
          <div class="ob-edit">${escHtml(it.value || '')}</div>
        </div>`;
      } else {
        const p = it.payload || {};
        const refUrl = p.url || '#';
        const cardTitle = escHtml(p.title || '未命名素材');
        let domain = '';
        try { if (p.url) domain = escHtml(new URL(p.url).hostname.replace(/^www\./, '')); } catch (e) {}
        const coverInner = p.previewHTML
          ? `<div class="share-gallery-cover-inner ${escHtml(p.previewBg || '')}">${p.previewHTML}</div>`
          : '';
        const cover = p.previewHTML
          ? `<div class="share-gallery-cover">${coverInner}</div>`
          : `<div class="share-gallery-cover share-gallery-cover-empty">暂无预览</div>`;
        body += `<div class="ob-block ob-ref" style="margin-left:${indent}px">
          <div class="${bulletCls}">${marker}</div>
          <a class="share-gallery-card" href="${escHtml(refUrl)}" target="_blank" rel="noopener">
            ${cover}
            <div class="share-gallery-meta">
              <div class="share-gallery-title">${cardTitle}</div>
              ${domain ? `<div class="share-gallery-domain"><i data-lucide="link" class="w-3 h-3"></i><span>${domain}</span></div>` : ''}
            </div>
          </a>
        </div>`;
      }
    });

    const ctxLabel = share.kind === 'doc' && share.doc
      ? escHtml(share.name || '合集')
      : (share.kind === 'collection' ? escHtml(share.name || '全部产出物') : '分享预览');
    const metaLine = share.kind === 'doc' && share.doc
      ? `${escHtml(share.name || '')} · ${visible.length} 项 · ${fmtTime(share.doc.createdAt || share.doc.updatedAt || '')}`
      : (share.kind === 'collection' ? `合集 · ${visible.length} 项` : '只读分享');

    const html = `<div class="flex flex-col h-full">
      <div class="panel-header share-head">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="hdr-badge">${icon('eye', 'w-3 h-3')}<span>分享预览</span></span>
          <span class="text-xs text-[#9CA3AF] truncate">${ctxLabel}</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button class="hdr-icon-btn" data-act="close" title="关闭分享预览">${icon('x')}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin share-body">
        <div class="share-doc-head">
          <h1 class="share-doc-title">${escT}</h1>
          <div class="share-doc-meta">${metaLine}</div>
        </div>
        <div class="share-blocks">${body}</div>
        <a class="share-footer" href="https://foubow.fun" target="_blank" rel="noopener">来自 foubow.fun →</a>
      </div>
    </div>`;
    container.innerHTML = html;
  }

  // ============ 事件 ============
  function bindPanel(container) {
    function close() { if (typeof (container.__obOpts || {}).onClose === 'function') (container.__obOpts).onClose(); }

    container.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-type]');
      if (!t) return;
      const act = t.dataset.act;
      const docId = t.dataset.doc;
      const opts = container.__obOpts || {};

      // ---- 顶栏主操作 ----
      if (act === 'add-output') {
        const d = addDoc(container.__obName, { title: '未命名文档', type: 'ul', items: [] });
        _view = { mode: 'doc', docId: d.id, collectionName: container.__obName };
        renderAll(container);
        const title = container.querySelector('.ob-doc-title'); if (title) { title.focus(); title.select(); }
        return;
      }
      if (act === 'close') { close(); return; }
      if (act === 'view-all-docs') {
        _view = { mode: 'all', docId: null, collectionName: null };
        renderAll(container); return;
      }
      if (act === 'back-current') {
        _view = { mode: 'list', docId: null, collectionName: null };
        renderAll(container); return;
      }
      if (act === 'back-list') {
        // 从文档返回的判断：是回到当前合集列表还是全部视图？
        const cameFromAll = _view.prevMode === 'all';
        _view = { mode: cameFromAll ? 'all' : 'list', docId: null, collectionName: null };
        renderAll(container); return;
      }

      // ---- ⋯ 菜单切换 ----
      if (act === 'menu-toggle') {
        e.stopPropagation();
        const menuId = t.dataset.menu;
        // 关其他
        container.querySelectorAll('.hdr-menu.open').forEach(m => { if (m.dataset.menu !== menuId) m.classList.remove('open'); });
        const m = container.querySelector(`.hdr-menu[data-menu="${menuId}"]`);
        if (m) m.classList.toggle('open');
        return;
      }

      // ---- ⋯ 菜单项 ----
      if (act === 'menu-ai-summary-list') {
        closeMenu(container);
        const scope = container.__shareScope || {};
        if (typeof opts.onAi === 'function') opts.onAi(scope.name, scope.docId, _view.mode);
        else alert('AI 总结功能即将上线');
        return;
      }
      if (act === 'menu-ai-summary-doc') {
        closeMenu(container);
        const scope = container.__shareScope || {};
        if (typeof opts.onAi === 'function') opts.onAi(scope.name, scope.docId, _view.mode);
        else alert('AI 总结功能即将上线');
        return;
      }
      if (act === 'menu-share-list' || act === 'menu-share-doc') {
        closeMenu(container);
        openShareModal(container);
        return;
      }
      if (act === 'menu-del-doc') {
        closeMenu(container);
        if (!confirm('确认删除该文档？')) return;
        const scope = container.__shareScope || {};
        if (scope.name && scope.docId) deleteDoc(scope.name, scope.docId);
        _view.prevMode = _view.mode;
        _view = { mode: 'list', docId: null, collectionName: null };
        renderAll(container);
        return;
      }

      // ---- 旧路径兼容（暂无）：直接 ai-summary / doc-del 等保留 ----
      if (act === 'ai-summary') {
        if (typeof opts.onAi === 'function') opts.onAi();
        else alert('AI 总结功能即将上线');
        return;
      }
      if (act === 'doc-del') {
        if (!confirm('确认删除该文档？')) return;
        deleteDoc(container.__obName, docId);
        _view = { mode: 'list', docId: null, collectionName: null };
        renderAll(container);
        return;
      }

      // ---- 打开 doc ----
      if (act === 'open-doc') {
        const colForOpen = t.dataset.col || container.__obName;
        _view.prevMode = _view.mode;
        _view = { mode: 'doc', docId, collectionName: colForOpen };
        renderAll(container);
        return;
      }

      // ---- 文档内操作 ----
      if (act === 'ob-fold') {
        const name = _view.collectionName || container.__obName;
        const d = getDocs(name).find(x => x.id === _view.docId); if (!d) return;
        const it = d.items[+t.dataset.idx]; if (!it) return;
        it.collapsed = !it.collapsed; saveState();
        renderAll(container);
        return;
      }
      if (act === 'ob-del') {
        const name = _view.collectionName || container.__obName;
        removeItem(name, _view.docId, +t.dataset.idx);
        renderAll(container);
        return;
      }
      if (act === 'ob-add-text') {
        const name = _view.collectionName || container.__obName;
        const d = getDocs(name).find(x => x.id === _view.docId); if (!d) return;
        const idx = (d.items || []).length;
        addItem(name, _view.docId, { kind: 'text', value: '', level: 0 });
        _pendingFocus = idx;
        renderAll(container);
        return;
      }
      if (t.dataset.type) {
        const name = _view.collectionName || container.__obName;
        setType(name, docId, t.dataset.type);
        renderAll(container);
        return;
      }
    });

    function closeMenu(container) {
      container.querySelectorAll('.hdr-menu.open').forEach(m => m.classList.remove('open'));
    }
    // 全局 click 关闭气泡菜单（仅响应 container 内的）
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) return;
      if (e.target.closest('[data-act="menu-toggle"]')) return;
      if (e.target.closest('.hdr-menu')) return;
      closeMenu(container);
    });

    // 输入
    container.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('ob-doc-title')) {
        const name = _view.collectionName || container.__obName;
        setTitle(name, t.dataset.doc, t.value);
        return;
      }
      if (t.classList.contains('ob-edit')) {
        const name = _view.collectionName || container.__obName;
        const d = getDocs(name).find(x => x.id === _view.docId);
        if (d) {
          const idx = +t.dataset.idx;
          d.items[idx] = Object.assign(d.items[idx] || {}, { kind: 'text', value: t.innerText, level: d.items[idx] ? d.items[idx].level || 0 : 0 });
          saveState();
        }
      }
    });

    // 键盘
    container.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('ob-edit')) return;
      const name = _view.collectionName || container.__obName;
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

    // 拖入
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
      const name = _view.collectionName || container.__obName;
      const d = getDocs(name).find(x => x.id === _view.docId);
      if (!d) return;
      addItem(name, _view.docId, { kind: 'ref', payload: payload, level: 0 });
      _pendingFocus = -1;
      renderAll(container);
    });

    // ===== 块级拖动排序（手柄 = 无序/有序标记，整行作放置目标）=====
    let draggingIdx = -1;
    function clearDropIndicators() {
      container.querySelectorAll('.ob-drop-before, .ob-drop-after').forEach(el => el.classList.remove('ob-drop-before', 'ob-drop-after'));
    }
    function clearAllBlockUI() {
      clearDropIndicators();
      const d = container.querySelector('.ob-dragging');
      if (d) d.classList.remove('ob-dragging');
    }
    container.addEventListener('dragstart', (e) => {
      const handle = e.target.closest && e.target.closest('.ob-drag-handle');
      if (!handle || _view.mode !== 'doc') return;
      draggingIdx = parseInt(handle.dataset.idx, 10);
      try {
        e.dataTransfer.setData(BLOCK_DRAG_MIME, String(draggingIdx));
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) {}
      const block = handle.closest('.ob-block');
      if (block) block.classList.add('ob-dragging');
      e.stopPropagation();
    });
    container.addEventListener('dragover', (e) => {
      if (_view.mode !== 'doc' || draggingIdx < 0) return;
      if (!e.dataTransfer || Array.from(e.dataTransfer.types).indexOf(BLOCK_DRAG_MIME) < 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDropIndicators();
      const block = e.target.closest('.ob-block');
      if (block) {
        const rect = block.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        block.classList.add(after ? 'ob-drop-after' : 'ob-drop-before');
      }
    });
    container.addEventListener('dragleave', (e) => {
      if (_view.mode !== 'doc' || draggingIdx < 0) return;
      const block = e.target.closest && e.target.closest('.ob-block');
      if (block) block.classList.remove('ob-drop-before', 'ob-drop-after');
    });
    container.addEventListener('drop', (e) => {
      if (_view.mode !== 'doc' || draggingIdx < 0) return;
      if (!e.dataTransfer || Array.from(e.dataTransfer.types).indexOf(BLOCK_DRAG_MIME) < 0) return;
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData(BLOCK_DRAG_MIME), 10);
      if (isNaN(from)) return;
      const name = _view.collectionName || container.__obName;
      const d = getDocs(name).find(x => x.id === _view.docId);
      if (!d) { clearAllBlockUI(); draggingIdx = -1; return; }
      const block = e.target.closest('.ob-block');
      let to;
      if (block) {
        const rect = block.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        to = parseInt(block.dataset.idx, 10) + (after ? 1 : 0);
      } else {
        const body = e.target.closest('.ob-body');
        if (!body) { clearAllBlockUI(); draggingIdx = -1; return; }
        to = d.items.length;
      }
      clearAllBlockUI();
      const arr = d.items;
      if (from < 0 || from >= arr.length) { draggingIdx = -1; return; }
      const [moved] = arr.splice(from, 1);
      let insertAt = to;
      if (from < to) insertAt = to - 1;
      insertAt = Math.max(0, Math.min(arr.length, insertAt));
      arr.splice(insertAt, 0, moved);
      saveState();
      draggingIdx = -1;
      renderAll(container);
    });
    container.addEventListener('dragend', () => {
      clearAllBlockUI();
      draggingIdx = -1;
    });
  }

  // 全局 delegation：素材卡 dragstart
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-fb-drag="material"]');
    if (!el) return;
    try {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).indexOf(CARD_MIME) >= 0) return;
      const id = el.dataset.materialId || '';
      const payload = {
        kind: 'material',
        id,
        title: el.dataset.materialTitle || el.getAttribute('title') || '',
        collection: el.dataset.materialCollection || '',
        url: el.dataset.materialUrl || '',
      };
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
    buildShareUrl, readShareFromHash,
    renderPanel,
  };

  // 首次访问：seed 演示文档
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
