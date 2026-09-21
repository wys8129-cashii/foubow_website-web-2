/*
 * Foubow 工作台（基于 workspace-v6 工具书签工作台 + 产出物模块）
 * 左侧：常用网站（工具书签）+ 产出物列表（复用 OutputDocs.allGroups）
 * 右侧分栏：日历/任务（默认）· 工具详情（点击工具）· 产出物详情（点击产出物，复用 OutputDocs.renderPanel）
 */
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  var CATEGORIES = ['开发工具', '设计工具', '协作工具', '效率工具', '其他工具'];

  var iconSvgs = {
    github: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.997.108-.776.418-1.305.762-1.604-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>',
    figma: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 0C10.43 0 12 1.57 12 3.5S10.43 7 8.5 7H5V3.5C5 1.57 6.57 0 8.5 0zM5 7h3.5C10.43 7 12 8.57 12 10.5S10.43 14 8.5 14H5V7zm0 7h3.5C10.43 14 12 15.57 12 17.5S10.43 21 8.5 21C6.57 21 5 19.43 5 17.5V14zm7-14h3.5C17.43 0 19 1.57 19 3.5S17.43 7 15.5 7H12V0zm0 7h3.5c1.93 0 3.5 1.57 3.5 3.5S17.43 14 15.5 14H12V7z"/></svg>',
    notion: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.45 4.11c.44.36.6.33 1.42.28l13.01-1.14c.26-.02.44-.09.44.14v14.98c0 .17-.1.26-.28.24L4.5 17.45c-.22-.03-.32-.14-.32-.33V4.45c0-.2.1-.38.27-.34zM6.93 7.5v9.23l9.82.88V8.2L6.93 7.5zm1.5 7.65l2.37-1.1v-5.4l-2.37-.22v6.72zm4.11.01l2.34-.61v-5.5l-2.34.22v5.89z"/></svg>',
    linear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 17L12 7.5l9.5 9.5"/></svg>',
    vercel: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l11 19H1z"/></svg>',
    chatgpt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l4.59-4.58L17 11l-6 6z"/></svg>',
    gdrive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14l5.5-9.5H6.5L1 14l5.5 9.5h11L23 14h-11z"/></svg>',
    slack: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-8a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm8 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2v-2zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 8a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z"/></svg>',
    default: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
  };

  var defaultTools = [
    { id: 1, title: 'GitHub', url: 'https://github.com', icon: 'github', color: '#333', category: '开发工具' },
    { id: 2, title: 'Figma', url: 'https://figma.com', icon: 'figma', color: '#a259ff', category: '设计工具' },
    { id: 3, title: 'Notion', url: 'https://notion.so', icon: 'notion', color: '#000', category: '协作工具' },
    { id: 4, title: 'Linear', url: 'https://linear.app', icon: 'linear', color: '#5e6ad2', category: '效率工具' },
    { id: 5, title: 'Vercel', url: 'https://vercel.com', icon: 'vercel', color: '#000', category: '开发工具' },
    { id: 6, title: 'ChatGPT', url: 'https://chat.openai.com', icon: 'chatgpt', color: '#10a37f', category: '效率工具' },
    { id: 7, title: 'Google Drive', url: 'https://drive.google.com', icon: 'gdrive', color: '#4285f4', category: '协作工具' },
    { id: 8, title: 'Slack', url: 'https://slack.com', icon: 'slack', color: '#4a154b', category: '协作工具' }
  ];

  function saveData() { try { localStorage.setItem('workspace_data', JSON.stringify({ tools: tools, tasks: tasks, nextId: nextId, nextToolId: nextToolId, theme: document.documentElement.getAttribute('data-theme') })); } catch(e) {} }
  function deepCloneDefaults() { return defaultTools.map(function(t) { return Object.assign({}, t); }); }
  function loadData() {
    try {
      var raw = localStorage.getItem('workspace_data');
      if (raw) {
        var data = JSON.parse(raw);
        var t = data.tools;
        if (Array.isArray(t) && t.length > 0 && typeof t[0].id === 'number') {
          t.forEach(function(x) { if (!x.category) x.category = CATEGORIES[CATEGORIES.length - 1]; });
          return { tools: t, tasks: data.tasks || [], nextId: data.nextId || 1, nextToolId: data.nextToolId || defaultTools.length + 1 };
        }
      }
    } catch(e) {}
    return { tools: deepCloneDefaults(), tasks: [], nextId: 1, nextToolId: defaultTools.length + 1 };
  }

  var loaded = loadData();
  var tools = loaded.tools;
  var tasks = loaded.tasks;
  if (tasks.length === 0) {
    tasks = [
      { id: 1, text: '完成 Q3 设计评审文档', completed: false, date: '2026-06-29', createdAt: Date.now() },
      { id: 2, text: '更新组件库至 v2.4', completed: false, date: '2026-06-29', createdAt: Date.now() - 1000 },
      { id: 3, text: '回复客户邮件', completed: true, date: '2026-06-28', createdAt: Date.now() - 2000 },
      { id: 4, text: '准备周会演示文稿', completed: false, date: '2026-06-30', createdAt: Date.now() - 3000 }
    ];
  }
  var nextId = Math.max(loaded.nextId, tasks.length > 0 ? tasks.reduce(function(m,t){return t.id>m?t.id:m;},0)+1 : 1);
  var nextToolId = loaded.nextToolId;
  var selectedDate = new Date().toISOString().slice(0, 10);
  var calYear = new Date().getFullYear();
  var calMonth = new Date().getMonth();
  var activeToolId = null;
  var activeCat = '__all__';
  var notesSaveTimer = null;

  function updateThemeIcon() { document.getElementById('theme-btn').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; }
  updateThemeIcon();

  var toolsContainer = document.getElementById('tools-container');
  var toolSearch = document.getElementById('tool-search');
  var calendarGrid = document.getElementById('calendar-grid');
  var calMonthLabel = document.getElementById('cal-month-label');
  var taskList = document.getElementById('task-list');
  var taskCountEl = document.getElementById('task-count');
  var taskEmpty = document.getElementById('task-empty');
  var taskBlockTitle = document.getElementById('task-block-title');
  var addTaskInput = document.getElementById('add-task-input');
  var sideDetail = document.getElementById('side-detail');
  var detailIcon = document.getElementById('detail-icon');
  var detailTitle = document.getElementById('detail-title');
  var detailUrl = document.getElementById('detail-url');
  var detailCopy = document.getElementById('detail-copy');
  var detailOpen = document.getElementById('detail-open');
  var detailBack = document.getElementById('detail-back');
  var detailNotes = document.getElementById('detail-notes');
  var detailCategory = document.getElementById('detail-category');
  var notesSaved = document.getElementById('notes-saved');
  var copyToast = document.getElementById('copy-toast');
  var headerTime = document.getElementById('header-time');
  var themeBtn = document.getElementById('theme-btn');

  // 产出物面板相关元素
  var sideOutput = document.getElementById('side-output');
  var outputContainer = document.getElementById('output-doc-container');
  var outputListEl = document.getElementById('output-list');
  var outputCountEl = document.getElementById('output-count');
  var outputBackBtn = document.getElementById('output-back');

  function updateClock() {
    headerTime.textContent = new Date().toLocaleString('zh-CN', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }
  updateClock(); setInterval(updateClock, 30000);

  themeBtn.addEventListener('click', function() {
    var el = document.documentElement;
    el.setAttribute('data-theme', el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    updateThemeIcon(); saveData();
  });

  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ── Category tabs ──
  function renderCatTabs() {
    var counts = {};
    var total = 0;
    tools.forEach(function(t) { counts[t.category] = (counts[t.category] || 0) + 1; total++; });
    var h = '<button class="cat-tab' + (activeCat === '__all__' ? ' active' : '') + '" data-cat="__all__">全部<span class="count">' + total + '</span></button>';
    CATEGORIES.forEach(function(c) {
      var n = counts[c] || 0;
      if (n > 0) h += '<button class="cat-tab' + (activeCat === c ? ' active' : '') + '" data-cat="' + c + '">' + c + '<span class="count">' + n + '</span></button>';
    });
    document.getElementById('cat-tabs').innerHTML = h;
  }

  document.getElementById('cat-tabs').addEventListener('click', function(e) {
    var btn = e.target.closest('.cat-tab');
    if (!btn) return;
    activeCat = btn.getAttribute('data-cat');
    renderCatTabs();
    renderTools();
  });

  // ── Drag & Drop state ──
  var dragData = null;
  var dragOverGrid = null;

  function makeCardHTML(t) {
    var ac = activeToolId === t.id ? ' active' : '';
    return '<div class="tool-card' + ac + '" draggable="true" data-id="' + t.id + '" data-cat="' + t.category + '">' +
      '<div class="tool-drag-handle"><span></span><span></span><span></span></div>' +
      '<div class="tool-icon" style="background:' + t.color + '">' + (iconSvgs[t.icon] || iconSvgs.default) + '</div>' +
      '<div class="tool-info">' +
        '<div class="tool-title">' + escapeHtml(t.title) + '</div>' +
        '<div class="tool-url">' + escapeHtml(t.url) + '</div>' +
      '</div>' +
      '<button class="tool-detail-btn" data-action="detail" data-id="' + t.id + '" title="查看详情">&#8942;</button>' +
    '</div>';
  }

  function renderTools() {
    var filter = (toolSearch.value || '').toLowerCase();
    var filtered = tools.filter(function(t) {
      return t.title.toLowerCase().indexOf(filter) !== -1 && (activeCat === '__all__' || t.category === activeCat);
    });

    var byCat = {};
    filtered.forEach(function(t) {
      if (!byCat[t.category]) byCat[t.category] = [];
      byCat[t.category].push(t);
    });

    var catOrder = activeCat === '__all__' ? CATEGORIES : [activeCat];
    var h = '';
    catOrder.forEach(function(cat) {
      var items = byCat[cat];
      if (!items || items.length === 0) return;
      if (activeCat === '__all__') h += '<div class="cat-group-header">' + cat + '</div>';
      h += '<div class="tools-grid" data-cat="' + cat + '" data-dropzone="true">';
      items.forEach(function(t) { h += makeCardHTML(t); });
      h += '</div>';
    });

    if (!h) h = '<div class="empty-state">暂无工具</div>';
    toolsContainer.innerHTML = h;
    renderCatTabs();
    bindDragEvents();
  }

  // ── Drag & Drop ──
  function bindDragEvents() {
    var cards = toolsContainer.querySelectorAll('.tool-card');
    var grids = toolsContainer.querySelectorAll('.tools-grid[data-dropzone]');

    cards.forEach(function(card) {
      card.addEventListener('dragstart', onDragStart);
      card.addEventListener('dragend', onDragEnd);
      card.addEventListener('dragover', onCardDragOver);
      card.addEventListener('dragleave', onCardDragLeave);
      card.addEventListener('drop', onCardDrop);
    });

    grids.forEach(function(grid) {
      grid.addEventListener('dragover', onGridDragOver);
      grid.addEventListener('dragleave', onGridDragLeave);
      grid.addEventListener('drop', onGridDrop);
    });
  }

  function onDragStart(e) {
    var card = e.target.closest('.tool-card');
    if (!card) return;
    var id = parseInt(card.getAttribute('data-id'), 10);
    var tool = null;
    for (var i = 0; i < tools.length; i++) { if (tools[i].id === id) { tool = tools[i]; break; } }
    if (!tool) return;
    dragData = { id: id, fromCat: tool.category, fromIdx: i };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    setTimeout(function() { card.classList.add('dragging'); }, 0);
  }

  function onDragEnd(e) {
    var card = e.target.closest('.tool-card');
    if (card) card.classList.remove('dragging');
    toolsContainer.querySelectorAll('.tool-card').forEach(function(c) { c.classList.remove('dragging'); });
    toolsContainer.querySelectorAll('.tools-grid').forEach(function(g) { g.classList.remove('drag-over', 'drag-active'); });
    dragData = null;
    dragOverGrid = null;
  }

  function onGridDragOver(e) {
    e.preventDefault();
    var grid = e.currentTarget;
    if (!grid.classList.contains('drag-over')) grid.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
    dragOverGrid = grid;
  }

  function onGridDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    e.currentTarget.classList.remove('drag-over');
    if (dragOverGrid === e.currentTarget) dragOverGrid = null;
  }

  function onGridDrop(e) {
    e.preventDefault();
    var grid = e.currentTarget;
    grid.classList.remove('drag-over');
    if (!dragData) return;
    var targetCat = grid.getAttribute('data-cat');
    moveToolToCategory(dragData.id, targetCat, -1);
    dragData = null;
  }

  function onCardDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragData) return;
    var card = e.currentTarget;
    var cardId = parseInt(card.getAttribute('data-id'), 10);
    if (cardId === dragData.id) return;
    if (dragOverGrid) dragOverGrid.classList.remove('drag-over');
    var grid = card.closest('.tools-grid');
    if (grid && !grid.classList.contains('drag-active')) grid.classList.add('drag-active');
    dragOverGrid = grid;
    card.classList.remove('drop-before', 'drop-after');
    var rect = card.getBoundingClientRect();
    var mid = rect.top + rect.height / 2;
    if (e.clientY < mid) card.classList.add('drop-before');
    else card.classList.add('drop-after');
    e.dataTransfer.dropEffect = 'move';
  }

  function onCardDragLeave(e) {
    var card = e.currentTarget;
    card.classList.remove('drop-before', 'drop-after');
  }

  function onCardDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragData) return;
    var card = e.currentTarget;
    card.classList.remove('drop-before', 'drop-after');
    var grid = card.closest('.tools-grid');
    if (grid) grid.classList.remove('drag-active');
    var cardId = parseInt(card.getAttribute('data-id'), 10);
    if (cardId === dragData.id) return;

    var targetCat = grid ? grid.getAttribute('data-cat') : card.getAttribute('data-cat');
    var targetIdx = -1;
    for (var i = 0; i < tools.length; i++) { if (tools[i].id === cardId) { targetIdx = i; break; } }
    var rect = card.getBoundingClientRect();
    if (e.clientY > rect.top + rect.height / 2) targetIdx++;

    moveToolToCategory(dragData.id, targetCat, targetIdx);
    dragData = null;
  }

  function moveToolToCategory(toolId, newCat, insertAt) {
    var toolIdx = -1;
    var tool = null;
    for (var i = 0; i < tools.length; i++) { if (tools[i].id === toolId) { toolIdx = i; tool = tools[i]; break; } }
    if (!tool) return;

    tools.splice(toolIdx, 1);

    var oldCat = tool.category;
    tool.category = newCat;

    if (insertAt >= 0 && insertAt < tools.length) {
      tools.splice(insertAt, 0, tool);
    } else {
      var lastIdx = -1;
      for (var j = tools.length - 1; j >= 0; j--) {
        if (tools[j].category === newCat) { lastIdx = j; break; }
      }
      if (lastIdx >= 0) tools.splice(lastIdx + 1, 0, tool);
      else tools.push(tool);
    }

    saveData();
    renderTools();
  }

  // ── Detail ──
  function showDetail(tool) {
    activeToolId = tool.id;
    sideDetail.classList.add('visible');
    sideOutput.classList.remove('visible'); // 确保产出物面板隐藏
    detailIcon.innerHTML = iconSvgs[tool.icon] || iconSvgs.default;
    detailIcon.style.background = tool.color;
    detailTitle.textContent = tool.title;
    detailUrl.textContent = tool.url;
    detailOpen.href = tool.url;
    detailCopy.onclick = function() {
      navigator.clipboard.writeText(tool.url);
      copyToast.classList.add('show');
      setTimeout(function() { copyToast.classList.remove('show'); }, 1800);
    };
    detailNotes.value = tool.notes || '';
    detailNotes.dataset.toolId = tool.id;

    var opts = '';
    CATEGORIES.forEach(function(c) {
      opts += '<option value="' + c + '"' + (tool.category === c ? ' selected' : '') + '>' + c + '</option>';
    });
    detailCategory.innerHTML = opts;
    if (!detailCategory._bound) {
      detailCategory._bound = true;
      detailCategory.addEventListener('change', function() {
        var tid = parseInt(detailNotes.dataset.toolId, 10);
        if (isNaN(tid)) return;
        for (var i = 0; i < tools.length; i++) {
          if (tools[i].id === tid) { tools[i].category = this.value; saveData(); renderTools(); break; }
        }
      });
    }

    renderTools();
  }

  function saveCurrentNotes() {
    var rid = detailNotes.dataset.toolId;
    if (!rid) return;
    var tid = parseInt(rid, 10);
    if (isNaN(tid)) return;
    for (var i = 0; i < tools.length; i++) {
      if (tools[i].id === tid) {
        tools[i].notes = detailNotes.value;
        saveData();
        notesSaved.classList.add('show');
        clearTimeout(notesSaveTimer);
        notesSaveTimer = setTimeout(function() { notesSaved.classList.remove('show'); }, 1500);
        break;
      }
    }
  }

  detailNotes.addEventListener('input', function() {
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(saveCurrentNotes, 600);
  });

  function hideDetail() {
    saveCurrentNotes();
    activeToolId = null;
    sideDetail.classList.remove('visible');
    renderTools();
  }
  function hideDetailQuick() { hideDetail(); }
  detailBack.addEventListener('click', hideDetail);

  // ── Calendar ──
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function renderCalendar() {
    var fd = new Date(calYear, calMonth, 1);
    var dow = fd.getDay();
    var dim = new Date(calYear, calMonth + 1, 0).getDate();
    var today = new Date().toISOString().slice(0, 10);
    calMonthLabel.textContent = calYear + '年' + pad2(calMonth + 1) + '月';
    var dw = ['日','一','二','三','四','五','六'];
    var h = '';
    for (var i = 0; i < 7; i++) h += '<div class="day-label">' + dw[i] + '</div>';
    var pmld = new Date(calYear, calMonth, 0).getDate();
    for (var p = dow - 1; p >= 0; p--) h += '<div class="day-cell other-month">' + (pmld - p) + '</div>';
    for (var d = 1; d <= dim; d++) {
      var ds = calYear + '-' + pad2(calMonth + 1) + '-' + pad2(d);
      var ht = tasks.some(function(t){return t.date===ds&&!t.completed;});
      var cls = 'day-cell';
      if (ds===today && ds===selectedDate) cls += ' today selected';
      else if (ds===today) cls += ' today';
      else if (ds===selectedDate) cls += ' selected';
      if (ht) cls += ' has-tasks';
      h += '<div class="' + cls + '" data-date="' + ds + '">' + d + '</div>';
    }
    var rem = 42 - (dow + dim);
    for (var r = 1; r <= rem; r++) h += '<div class="day-cell other-month">' + r + '</div>';
    calendarGrid.innerHTML = h;
  }

  function renderTasks() {
    var dt = tasks.filter(function(t) { return t.date === selectedDate; });
    dt.sort(function(a,b){return b.createdAt-a.createdAt;});
    var h = '';
    for (var i = 0; i < dt.length; i++) {
      var t = dt[i];
      h += '<div class="task-row' + (t.completed ? ' completed' : '') + '">' +
        '<input type="checkbox" class="task-checkbox"' + (t.completed ? ' checked' : '') + ' data-id="' + t.id + '">' +
        '<span class="task-text">' + escapeHtml(t.text) + '</span>' +
        '<span class="task-date-tag">' + t.date.slice(5) + '</span>' +
        '<button class="task-delete" data-id="' + t.id + '" aria-label="删除任务">&times;</button>' +
      '</div>';
    }
    taskList.innerHTML = h;
    var inc = 0; for (var j = 0; j < dt.length; j++) { if (!dt[j].completed) inc++; }
    taskCountEl.textContent = inc;
    taskEmpty.style.display = dt.length === 0 ? 'block' : 'none';
    taskBlockTitle.textContent = selectedDate === new Date().toISOString().slice(0, 10) ? '任务' : '任务 · ' + selectedDate.slice(5);
    renderCalendar();
    saveData();
  }

  addTaskInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var txt = addTaskInput.value.trim();
      if (txt) tasks.push({ id: nextId++, text: txt, completed: false, date: selectedDate, createdAt: Date.now() });
      addTaskInput.value = ''; renderTasks();
    }
  });

  // ── Event Delegation ──
  toolsContainer.addEventListener('click', function(e) {
    var db = e.target.closest('[data-action="detail"]');
    var card = e.target.closest('.tool-card');
    if (!card) return;
    var tid = parseInt(card.getAttribute('data-id'), 10);
    var tool = null;
    for (var i = 0; i < tools.length; i++) { if (tools[i].id === tid) { tool = tools[i]; break; } }
    if (!tool) return;
    if (db) { e.stopPropagation(); showDetail(tool); }
    else { window.open(tool.url, '_blank', 'noopener'); }
  });

  taskList.addEventListener('click', function(e) {
    var cb = e.target.closest('.task-checkbox');
    var del = e.target.closest('.task-delete');
    if (cb) {
      var id = parseInt(cb.getAttribute('data-id'), 10);
      for (var i = 0; i < tasks.length; i++) { if (tasks[i].id === id) { tasks[i].completed = cb.checked; break; } }
      renderTasks();
    }
    if (del) {
      tasks = tasks.filter(function(t){return t.id !== parseInt(del.getAttribute('data-id'), 10);});
      renderTasks();
    }
  });

  calendarGrid.addEventListener('click', function(e) {
    var cell = e.target.closest('.day-cell');
    if (!cell || cell.classList.contains('other-month')) return;
    selectedDate = cell.getAttribute('data-date');
    hideDetailQuick();
    renderTasks();
  });

  document.getElementById('cal-prev').addEventListener('click', function() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', function() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });
  toolSearch.addEventListener('input', function() { renderTools(); });

  // ===== 产出物模块（主区三列分类 + 右侧只读详情） =====
  function escOut(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  function renderOutputList() {
    if (!outputListEl) return;
    var groups = (window.OutputDocs && OutputDocs.allGroups) ? OutputDocs.allGroups() : [];
    var total = 0;
    groups.forEach(function(g) { total += (g.docs || []).length; });
    outputCountEl.textContent = total ? (total + ' 个文档') : '';
    if (!groups.length) {
      outputListEl.innerHTML = '<div class="wb-output-empty">暂无产出物</div>';
      return;
    }
    var h = '';
    groups.forEach(function(g) {
      h += '<div class="wb-output-col" data-col="' + escOut(g.name) + '">';
      h += '<div class="wb-output-col-head">';
      h += '<span class="wb-output-col-name">' + escOut(g.name) + '</span>';
      h += '<span class="wb-output-col-count">' + (g.docs ? g.docs.length : 0) + '</span>';
      h += '</div>';
      h += '<div class="wb-output-docs">';
      (g.docs || []).forEach(function(d) {
        var n = (d.items || []).length;
        h += '<div class="wb-output-doc" data-col="' + escOut(g.name) + '" data-doc="' + escOut(d.id) + '">' +
             '<i data-lucide="file-text" class="ic"></i>' +
             '<span class="t">' + escOut(d.title || '未命名文档') + '</span>' +
             '<span class="m">' + n + ' 项</span></div>';
      });
      h += '</div></div>';
    });
    outputListEl.innerHTML = h;
    if (window.lucide) lucide.createIcons();
  }

  function showPanel(which) {
    if (which === 'tool') {
      sideDetail.classList.add('visible');
      sideOutput.classList.remove('visible');
    } else if (which === 'output') {
      sideDetail.classList.remove('visible');
      sideOutput.classList.add('visible');
    } else {
      sideDetail.classList.remove('visible');
      sideOutput.classList.remove('visible');
    }
  }

  function showToast(msg) {
    if (!copyToast) return;
    copyToast.textContent = msg;
    copyToast.classList.add('show');
    setTimeout(function() { copyToast.classList.remove('show'); }, 1800);
  }

  function addToolFromRef(payload) {
    if (!payload) return;
    var title = payload.title || '收藏卡片';
    var url = payload.url || '';
    var color = '#333333';
    var icon = 'default';
    try {
      if (url) {
        var host = new URL(url).hostname.toLowerCase();
        if (host.indexOf('github') !== -1) icon = 'github';
        else if (host.indexOf('figma') !== -1) icon = 'figma';
        else if (host.indexOf('notion') !== -1) icon = 'notion';
        else if (host.indexOf('linear') !== -1) icon = 'linear';
        else if (host.indexOf('vercel') !== -1) icon = 'vercel';
        else if (host.indexOf('chat') !== -1 && host.indexOf('openai') !== -1) icon = 'chatgpt';
        else if (host.indexOf('drive.google') !== -1) icon = 'gdrive';
        else if (host.indexOf('slack') !== -1) icon = 'slack';
      }
    } catch (e) {}
    var id = nextToolId++;
    tools.push({ id: id, title: title, url: url, icon: icon, color: color, category: '效率工具' });
    saveData();
    renderTools();
    showToast('已收藏到常用网站');
  }

  function wb_openOutputDoc(name, docId) {
    if (!outputContainer || !window.OutputDocs || !OutputDocs.openDoc) return;
    if (OutputDocs.resetView) OutputDocs.resetView();
    OutputDocs.openDoc(outputContainer, name, docId, {
      readOnly: true,
      onFav: addToolFromRef,
      onClose: function() { showPanel('default'); outputContainer.innerHTML = ''; }
    });
    showPanel('output');
  }

  function hideOutputPanel() {
    showPanel('default');
    if (outputContainer) outputContainer.innerHTML = '';
  }

  if (outputListEl) {
    outputListEl.addEventListener('click', function(e) {
      var row = e.target.closest('.wb-output-doc');
      if (!row) return;
      var col = row.getAttribute('data-col');
      var doc = row.getAttribute('data-doc');
      if (col && doc) wb_openOutputDoc(col, doc);
    });
  }
  if (outputBackBtn) outputBackBtn.addEventListener('click', hideOutputPanel);

  // Init
  renderTools();
  renderTasks();
  renderOutputList();
  // 产出物数据可能由云端异步同步，延时重渲染一次以捕获最新数据
  setTimeout(renderOutputList, 1200);
});
