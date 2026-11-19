/* =========================================================================
   可视化管理后台 — 交互逻辑
   纯原生 JS；所有编辑写入 IndexedDB 本地草稿，导出后才是「已发布」内容。
   ========================================================================= */
(function () {
  'use strict';

  var Store = window.PortfolioStore;
  var cfg = null;
  var history = [], hIndex = -1;
  var selectedId = null;
  var textProjectId = null;
  var currentView = 'projects';
  var previewPage = 'index.html';
  var previewDevice = 'desktop';
  var trashOpen = false;
  var saveTimer = null, previewTimer = null, toastTimer = null;
  var MAX_HISTORY = 40;

  var VIEW_META = {
    projects: ['作品管理', 'PROJECTS / 增删改 · 排序 · 图片'],
    text:     ['文字编辑', 'COPY & TYPOGRAPHY / 文案 · 排版'],
    visual:   ['视觉设置', 'VISUAL / 颜色 · 字体 · 间距'],
    preview:  ['实时预览', 'LIVE PREVIEW / 桌面 · 手机'],
    data:     ['数据安全', 'DATA / 备份 · 导入导出 · 发布'],
    cloud:    ['云端管理', 'CLOUD / 登录 · 草稿同步 · 云端发布'],
    help:     ['使用说明', 'GUIDE / 保存机制与发布流程']
  };

  /* ------------------------------------------------------------ 工具 */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function stamp() {
    var d = new Date(), z = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes());
  }
  function toast(msg, isError) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, isError ? 6000 : 3000);
  }
  function download(blob, name) {
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }
  function downloadText(text, name, mime) {
    download(new Blob([text], { type: mime || 'application/json;charset=utf-8' }), name);
  }
  function getPath(obj, path) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setPath(obj, path, val) {
    var parts = String(path).split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null) return;
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  function move(arr, from, to) {
    if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
    var it = arr.splice(from, 1)[0];
    arr.splice(to, 0, it);
  }
  function thumbSrc(path) {
    if (!path) return '';
    if (path.indexOf('media:') === 0) return (cfg.media && cfg.media[path.slice(6)]) || '';
    return path;
  }
  function projectIndex(id) { return cfg.projects.findIndex(function (p) { return p.id === id; }); }
  function visible() { return Store.visibleProjects(cfg); }
  function categoryOptions(sel) {
    return cfg.categories.filter(function (c) { return c.id !== 'all'; }).map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.label) + '</option>';
    }).join('');
  }
  function categoryLabel(id) {
    var c = cfg.categories.find(function (x) { return x.id === id; });
    return c ? c.label : '未分类';
  }

  /* ------------------------------------------------------------ 状态 / 历史 */
  function setStatus(text, dirty) {
    $('#status-text').textContent = text;
    $('#status-dot').classList.toggle('is-dirty', !!dirty);
    $('#status-detail').textContent = '存储：' + (Store.getStorageMode() === 'idb' ? 'IndexedDB' : 'localStorage') +
      ' · 草稿 ' + (JSON.stringify(cfg).length / 1024 / 1024).toFixed(2) + ' MB';
  }
  function updateHistoryButtons() {
    $('#btn-undo').disabled = hIndex <= 0;
    $('#btn-redo').disabled = hIndex >= history.length - 1;
  }
  function commit(msg) {
    history = history.slice(0, hIndex + 1);
    history.push(clone(cfg));
    if (history.length > MAX_HISTORY) history.shift();
    hIndex = history.length - 1;
    updateHistoryButtons();
    setStatus('草稿已保存', false);
    scheduleSave();
    render();
    schedulePreview();
    if (msg) toast(msg);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    setStatus('保存中…', true);
    saveTimer = setTimeout(saveNow, 300);
  }
  function saveNow() {
    return Store.saveDraft(cfg).then(function () {
      setStatus('草稿已保存', false);
      /* 本地先落盘，再异步同步云端（云端失败不影响本地） */
      if (window.CloudAdmin) window.CloudAdmin.onLocalSave();
    })
      .catch(function (err) { setStatus('保存失败', true); toast(err.message || '保存失败', true); });
  }
  function undo() {
    if (hIndex <= 0) return;
    hIndex--; cfg = clone(history[hIndex]); afterHistory('已撤销');
  }
  function redo() {
    if (hIndex >= history.length - 1) return;
    hIndex++; cfg = clone(history[hIndex]); afterHistory('已重做');
  }
  function afterHistory(msg) {
    updateHistoryButtons(); scheduleSave(); render(); schedulePreview(); toast(msg);
  }

  /* ------------------------------------------------------------ 视图切换 */
  function switchView(name) {
    currentView = name;
    $$('#side-nav button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === name); });
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.id === 'view-' + name); });
    $('#view-title').textContent = VIEW_META[name][0];
    $('#view-sub').textContent = VIEW_META[name][1];
    render();
    if (name === 'preview') refreshPreview(true);
  }

  function render() {
    if (!cfg) return;
    if (currentView === 'projects') renderProjects();
    else if (currentView === 'text') renderText();
    else if (currentView === 'visual') renderVisual();
    else if (currentView === 'data') renderData();
    else if (currentView === 'help') renderHelp();
    else if (currentView === 'preview') renderPreviewOptions();
    else if (currentView === 'cloud' && window.CloudAdmin) window.CloudAdmin.renderView();
    if (currentView !== 'projects') { /* 其他视图无项目列表 */ }
  }

  /* ------------------------------------------------------------ 字段渲染助手 */
  function fInput(label, path, value, opts) {
    opts = opts || {};
    var kind = opts.kind || 'text';
    var v = value == null ? '' : value;
    var input;
    if (opts.area) {
      input = '<textarea class="textarea" data-bind="' + path + '" data-kind="' + kind + '" rows="' + (opts.rows || 3) + '">' + esc(kind === 'lines' ? (Array.isArray(v) ? v.join('\n') : v) : v) + '</textarea>';
    } else if (kind === 'bool' || kind === 'invert') {
      var checked = kind === 'invert' ? !v : !!v;
      input = '<label class="switch"><input type="checkbox" data-bind="' + path + '" data-kind="' + kind + '"' + (checked ? ' checked' : '') + '><span class="track"></span><span>' + (opts.onLabel || '启用') + '</span></label>';
    } else if (kind === 'select') {
      input = '<select class="select" data-bind="' + path + '" data-kind="text">' + opts.options + '</select>';
    } else if (kind === 'color') {
      input = '<div class="range-row"><input type="color" data-bind="' + path + '" data-kind="text" value="' + esc(v) + '">' +
        '<input class="input" data-bind="' + path + '" data-kind="text" value="' + esc(v) + '" style="max-width:130px"></div>';
    } else if (kind === 'range') {
      input = '<div class="range-row"><input type="range" data-bind="' + path + '" data-kind="number" min="' + opts.min + '" max="' + opts.max + '" step="' + opts.step + '" value="' + Number(v) + '">' +
        '<output>' + Number(v) + '</output></div>';
    } else {
      input = '<input class="input" data-bind="' + path + '" data-kind="' + kind + '" value="' + esc(kind === 'lines' ? (Array.isArray(v) ? v.join('\n') : v) : v) + '">';
    }
    return '<div class="field"><label>' + esc(label) + (opts.tip ? ' <small>' + esc(opts.tip) + '</small>' : '') + '</label>' + input +
      (opts.hint ? '<div class="hint">' + esc(opts.hint) + '</div>' : '') + '</div>';
  }

  /* ------------------------------------------------------------ 01 作品管理 */
  function countImages(p) {
    var n = p.cover ? 1 : 0;
    p.blocks.forEach(function (b) {
      if (b.src) n++;
      if (b.items) n += b.items.filter(function (i) { return i.src; }).length;
    });
    return n;
  }

  function renderProjects() {
    $('#stat-total').textContent = cfg.projects.length;
    $('#stat-visible').textContent = visible().length;
    $('#stat-images').textContent = cfg.projects.reduce(function (a, p) { return a + countImages(p); }, 0);
    $('#stat-trash').textContent = cfg.trash.length;

    $('#project-list').innerHTML = cfg.projects.map(function (p, i) {
      return '<div class="project-item' + (p.id === selectedId ? ' is-active' : '') + (p.hidden ? ' is-hidden-item' : '') + '"' +
        ' data-select="' + esc(p.id) + '" data-drag="project" data-i="' + i + '" draggable="true">' +
        '<span class="project-item__handle" title="拖动排序">⠿</span>' +
        '<div><div class="project-item__name">' + esc(p.title || '未命名项目') + '</div>' +
        '<div class="project-item__meta">' + pad2(i + 1) + ' · ' + esc(categoryLabel(p.category)) + ' · ' + countImages(p) + ' 图' + (p.featured ? ' · 首页精选' : '') + '</div></div>' +
        '<div class="project-item__ops">' +
          '<button data-act="toggle" data-id="' + esc(p.id) + '" title="' + (p.hidden ? '显示' : '隐藏') + '">' + (p.hidden ? '◌' : '◉') + '</button>' +
          '<button data-act="duplicate" data-id="' + esc(p.id) + '" title="复制">⧉</button>' +
          '<button data-act="up" data-i="' + i + '" title="上移">↑</button>' +
          '<button data-act="down" data-i="' + i + '" title="下移">↓</button>' +
        '</div></div>';
    }).join('') || '<div class="empty">暂无项目，点击「＋ 新增」创建</div>';

    var box = $('#trash-box');
    box.style.display = trashOpen ? 'block' : 'none';
    if (trashOpen) {
      box.innerHTML = cfg.trash.length ? cfg.trash.map(function (p, i) {
        return '<div class="project-item" style="margin-bottom:6px"><span></span><div>' +
          '<div class="project-item__name">' + esc(p.title) + '</div>' +
          '<div class="project-item__meta">原项目 · ' + esc(p.id) + '</div></div>' +
          '<div class="project-item__ops"><button data-act="restore" data-i="' + i + '" title="恢复">↩ 恢复</button></div></div>';
      }).join('') : '<div class="empty">回收站为空。删除的项目会完整保留在这里，可随时恢复。</div>';
    }

    var i = projectIndex(selectedId);
    $('#project-editor').innerHTML = i < 0
      ? '<div class="empty">从左侧选择一个项目开始编辑</div>'
      : projectEditorHTML(cfg.projects[i], i);
  }

  function projectEditorHTML(p, i) {
    var pre = 'projects.' + i + '.';
    return '' +
    '<div class="card">' +
      '<div class="card__head"><h2>基本信息 · ' + esc(p.title) + '</h2><div class="right">' +
        '<label class="switch"><input type="checkbox" data-bind="' + pre + 'hidden" data-kind="invert"' + (p.hidden ? '' : ' checked') + '><span class="track"></span><span>前台显示</span></label>' +
        '<label class="switch"><input type="checkbox" data-bind="' + pre + 'featured" data-kind="bool"' + (p.featured ? ' checked' : '') + '><span class="track"></span><span>首页精选</span></label>' +
        '<button class="btn btn--sm" data-act="duplicate" data-id="' + esc(p.id) + '">复制项目</button>' +
        '<button class="btn btn--sm btn--danger" data-act="remove" data-id="' + esc(p.id) + '">删除（移入回收站）</button>' +
      '</div></div>' +
      '<div class="grid2">' +
        fInput('项目名称', pre + 'title', p.title) +
        fInput('英文名称', pre + 'en', p.en) +
        fInput('分类', pre + 'category', p.category, { kind: 'select', options: categoryOptions(p.category) }) +
        fInput('来源页码', pre + 'pages', p.pages, { tip: '如 P03 — P18' }) +
        fInput('标语', pre + 'tagline', p.tagline) +
        fInput('口号', pre + 'slogan', p.slogan) +
        fInput('品牌主色', pre + 'accent', p.accent, { kind: 'color' }) +
        fInput('辅助色', pre + 'accentSoft', p.accentSoft, { kind: 'color' }) +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="grid2">' +
        fInput('一句话简介', pre + 'summary', p.summary, { area: true, rows: 3 }) +
        fInput('设计说明', pre + 'description', p.description, { area: true, kind: 'lines', rows: 5, tip: '每行一段', hint: '显示在详情页顶部的「PROJECT OVERVIEW」区域。' }) +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="eyebrow" style="margin-bottom:12px">项目封面 / COVER</div>' +
      '<div class="cover-box">' +
        '<img class="cover-box__img" src="' + esc(thumbSrc(p.cover)) + '" alt="封面">' +
        '<div class="cover-box__ops">' +
          '<button class="btn btn--sm btn--primary" data-act="upload-cover" data-i="' + i + '">↑ 上传并替换封面</button>' +
          '<button class="btn btn--sm" data-act="pick-cover" data-i="' + i + '">从已有图片中选择</button>' +
          '<button class="btn btn--sm" data-act="reset-cover" data-i="' + i + '">恢复原始封面</button>' +
          '<div class="hint">上传的图片会以新文件写入发布包，不会覆盖 assets/ 中的原始图片。</div>' +
        '</div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="eyebrow" style="margin-bottom:12px">元信息 / META（每行一项，格式：标签 | 内容）</div>' +
      fInput('元信息', pre + 'meta', (p.meta || []).map(function (m) { return m.k + ' | ' + m.v; }).join('\n'), { area: true, kind: 'meta', rows: 5 }) +
    '</div>' +
    '<div class="card">' +
      '<div class="card__head"><h2>项目图片与详情</h2><div class="right">' +
        '<select class="select" id="add-block-kind" style="max-width:170px">' +
          '<option value="full">单张图片</option><option value="pair">双图并排</option>' +
          '<option value="grid">图片网格</option><option value="posters">竖版海报</option>' +
          '<option value="text">文字段落</option><option value="band">口号色带</option>' +
          '<option value="note">说明块</option>' +
        '</select>' +
        '<button class="btn btn--sm btn--primary" data-act="add-block" data-i="' + i + '">＋ 新增详情</button>' +
      '</div></div>' +
      '<div class="card__desc">拖动块左侧手柄调整详情页顺序；多图块内的图片可单独拖拽、替换、删除与排序。所有图片条目均支持上传替换。</div>' +
      '<div id="block-list">' + p.blocks.map(function (b, bi) { return blockHTML(b, bi, i); }).join('') + '</div>' +
    '</div>';
  }

  var BLOCK_NAMES = { full: '单图', pair: '双图', grid: '网格', posters: '海报', text: '文字', band: '色带', note: '说明' };

  function blockHTML(b, bi, pi) {
    var base = 'projects.' + pi + '.blocks.' + bi + '.';
    var body = '';
    if (b.kind === 'full') {
      body = '<div class="cover-box" style="margin-bottom:12px">' +
        '<img class="cover-box__img" src="' + esc(thumbSrc(b.src)) + '" alt="">' +
        '<div class="cover-box__ops">' +
          '<button class="btn btn--sm btn--primary" data-act="upload-shot" data-b="' + bi + '" data-i="-1">↑ 上传 / 替换图片</button>' +
          '<button class="btn btn--sm" data-act="pick-shot" data-b="' + bi + '" data-i="-1">选择已有图片</button>' +
        '</div></div>' +
        '<div class="grid2">' + fInput('图片说明', base + 'caption', b.caption) + fInput('备注', base + 'note', b.note) + '</div>';
    } else if (b.kind === 'pair' || b.kind === 'grid' || b.kind === 'posters') {
      body = '<div class="grid2" style="margin-bottom:12px">' +
        fInput('组标题', base + 'caption', b.caption) +
        (b.kind === 'grid' ? fInput('每行列数', base + 'cols', b.cols || 4, { kind: 'number', tip: '2 / 3 / 4' }) : '') + '</div>' +
        '<div class="thumbs">' + b.items.map(function (it, ii) {
          return '<div class="thumb" data-drag="item" data-b="' + bi + '" data-i="' + ii + '" draggable="true">' +
            '<img class="thumb__img" src="' + esc(thumbSrc(it.src)) + '" alt="">' +
            '<div class="thumb__body">' +
              '<input class="input" data-bind="' + base + 'items.' + ii + '.caption" data-kind="text" value="' + esc(it.caption || '') + '" placeholder="图片说明">' +
              '<div class="thumb__ops">' +
                '<button data-act="upload-shot" data-b="' + bi + '" data-i="' + ii + '">替换</button>' +
                '<button data-act="pick-shot" data-b="' + bi + '" data-i="' + ii + '">选用</button>' +
                '<button data-act="item-up" data-b="' + bi + '" data-i="' + ii + '">↑</button>' +
                '<button data-act="item-down" data-b="' + bi + '" data-i="' + ii + '">↓</button>' +
                '<button class="danger" data-act="item-del" data-b="' + bi + '" data-i="' + ii + '">删除</button>' +
              '</div></div></div>';
        }).join('') + '</div>' +
        '<button class="btn btn--sm" style="margin-top:12px" data-act="item-add" data-b="' + bi + '">＋ 添加图片</button>';
    } else if (b.kind === 'text') {
      body = '<div class="grid2">' + fInput('小标签', base + 'eyebrow', b.eyebrow) + fInput('标题', base + 'title', b.title) + '</div>' +
        '<div style="margin-top:12px">' + fInput('正文', base + 'body', b.body, { area: true, kind: 'lines', rows: 4, tip: '每行一段' }) + '</div>';
    } else if (b.kind === 'band') {
      body = '<div class="grid2">' + fInput('小标签', base + 'eyebrow', b.eyebrow) + fInput('口号', base + 'title', b.title) + '</div>' +
        '<div class="grid2" style="margin-top:12px">' + fInput('英文 / 副文案', base + 'text', b.text) + fInput('备注', base + 'note', b.note) + '</div>';
    } else if (b.kind === 'note') {
      body = '<div class="grid2">' + fInput('标题', base + 'title', b.title) + fInput('说明', base + 'text', b.text, { area: true, rows: 3 }) + '</div>';
    }
    return '<div class="block-item" data-drag="block" data-i="' + bi + '" draggable="true">' +
      '<div class="block-item__head">' +
        '<span class="handle">⠿</span><span class="tag">' + esc(BLOCK_NAMES[b.kind] || b.kind) + '</span>' +
        '<span class="name">' + esc(b.caption || b.title || ('内容块 ' + pad2(bi + 1))) + '</span>' +
        '<span class="ops">' +
          '<button class="btn btn--icon" data-act="block-up" data-i="' + bi + '" title="上移">↑</button>' +
          '<button class="btn btn--icon" data-act="block-down" data-i="' + bi + '" title="下移">↓</button>' +
          '<button class="btn btn--icon" data-act="block-dup" data-i="' + bi + '" title="复制">⧉</button>' +
          '<button class="btn btn--icon btn--danger" data-act="block-del" data-i="' + bi + '" title="删除">×</button>' +
        '</span></div>' +
      '<div class="block-item__body">' + body + '</div></div>';
  }

  /* ------------------------------------------------------------ 02 文字编辑 */
  var I18N_DEFAULT_DATA = window.PORTFOLIO_I18N || { ui: {}, site: {}, projects: {}, categories: {}, categoryLabels: {} };

  /* 英文覆盖值优先，其次内置英文；后台显示「实际会生效」的值，避免误以为空白 */
  function enSiteValue(key) {
    var own = cfg.i18n && cfg.i18n.site ? cfg.i18n.site[key] : '';
    if (own != null && String(own).trim() !== '') return own;
    return (I18N_DEFAULT_DATA.site || {})[key] || '';
  }
  function enProject(p) {
    var base = (I18N_DEFAULT_DATA.projects || {})[p.id] || {};
    var own = (cfg.i18n && cfg.i18n.projects && cfg.i18n.projects[p.id]) || {};
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(own).forEach(function (k) {
      var v = own[k];
      if (Array.isArray(v)) { if (v.filter(function (x) { return String(x || '').trim(); }).length) out[k] = v; }
      else if (v != null && String(v).trim() !== '') out[k] = v;
    });
    return out;
  }
  function languageHTML() {
    var i = cfg.i18n || Store.I18N_DEFAULT;
    return '<div class="card"><div class="card__head"><h2>语言 / LANGUAGE</h2><span class="hint">CN / EN · 只切换文字，图片与版式不变</span></div>' +
      '<div class="grid2">' +
        fInput('前台显示语言切换', 'i18n.enabled', i.enabled !== false, { kind: 'bool', onLabel: '显示 中 / EN 按钮' }) +
        fInput('访客默认语言', 'i18n.default', i.default === 'en' ? 'en' : 'zh', { kind: 'select', options:
          '<option value="zh"' + (i.default === 'en' ? '' : ' selected') + '>中文（CN）</option>' +
          '<option value="en"' + (i.default === 'en' ? ' selected' : '') + '>English（EN）</option>' }) +
      '</div>' +
      '<div class="hint" style="margin-top:12px">切换内容仅限：导航、个人介绍、项目标题与说明、界面按钮标签。作品图片、图注与原作排版不随语言改变。' +
      '访客的手动选择会记在浏览器里，再次访问保持上次语言；关闭切换后全站固定为中文。</div></div>';
  }
  function englishCopyHTML() {
    var p = cfg.projects[projectIndex(textProjectId)];
    var i = cfg.i18n || {};
    var pEN = p ? enProject(p) : {};
    return '<div class="card"><div class="card__head"><h2>英文文案 / ENGLISH COPY</h2><span class="hint">留空即使用内置英文</span></div>' +
      '<div class="grid2">' +
        fInput('首页导语', 'i18n.site.heroLedeHtml', enSiteValue('heroLedeHtml'), { area: true, rows: 4, hint: '支持 HTML，例如 <strong>加粗</strong>。' }) +
        fInput('关于标题', 'i18n.site.aboutTitle', enSiteValue('aboutTitle'), { hint: '支持 <br> 换行' }) +
        fInput('个人介绍 · 第 1 段', 'i18n.site.aboutText1', enSiteValue('aboutText1'), { area: true, rows: 4 }) +
        fInput('个人介绍 · 第 2 段', 'i18n.site.aboutText2', enSiteValue('aboutText2'), { area: true, rows: 4 }) +
        fInput('作品总览 · 导语', 'i18n.site.worksLead', enSiteValue('worksLead'), { area: true, rows: 3 }) +
        fInput('关于页 · 导语', 'i18n.site.aboutPageLead', enSiteValue('aboutPageLead'), { area: true, rows: 3 }) +
        fInput('姓名', 'i18n.site.contactName', enSiteValue('contactName')) +
        fInput('来源说明', 'i18n.site.contactSource', enSiteValue('contactSource')) +
      '</div>' +
      (p ? '<div class="divider"></div><div class="eyebrow" style="margin-bottom:12px">当前项目 · ' + esc(p.title) + '</div><div class="grid2">' +
        fInput('英文标题', 'i18n.projects.' + p.id + '.title', pEN.title || '') +
        fInput('英文标语', 'i18n.projects.' + p.id + '.tagline', pEN.tagline || '') +
        fInput('英文简介', 'i18n.projects.' + p.id + '.summary', pEN.summary || '', { area: true, rows: 3 }) +
        fInput('英文说明', 'i18n.projects.' + p.id + '.description', pEN.description || [], { area: true, kind: 'lines', rows: 5, tip: '每行一段' }) +
        fInput('英文元信息', 'i18n.projects.' + p.id + '.meta', (pEN.meta || []).map(function (m) { return m.k + ' | ' + m.v; }).join('\n'), { area: true, kind: 'meta', rows: 4, tip: '标签 | 内容' }) +
      '</div>' : '') +
      '<div class="hint" style="margin-top:12px">项目英文说明只影响详情页顶部的项目概述与卡片简介；作品图内的图注属于原作内容，保持原样。' +
      '切换「项目文案」下拉框会同步这里的当前项目（与本页上方选择一致）。</div></div>';
  }

  function renderText() {
    var s = cfg.site, t = cfg.typography;
    var idx = projectIndex(textProjectId);
    if (idx < 0) { idx = 0; textProjectId = cfg.projects[0] ? cfg.projects[0].id : null; }
    var p = cfg.projects[idx];
    var pp = p ? 'projects.' + idx + '.' : '';

    $('#view-text').innerHTML =
    languageHTML() +
    '<div class="card"><div class="card__head"><h2>首页文案</h2><span class="hint">修改后首页与实时预览立即生效</span></div>' +
      '<div class="grid3">' +
        fInput('主标题 · 第 1 行', 'site.heroLines.0', s.heroLines[0]) +
        fInput('主标题 · 第 2 行', 'site.heroLines.1', s.heroLines[1]) +
        fInput('主标题 · 第 3 行', 'site.heroLines.2', s.heroLines[2]) +
      '</div><div class="divider"></div><div class="grid2">' +
        fInput('副标题 / 顶部信息', 'site.heroMeta', s.heroMeta, { area: true, kind: 'lines', rows: 3, tip: '每行一项' }) +
        fInput('首页导语', 'site.heroLedeHtml', s.heroLedeHtml, { area: true, rows: 5, hint: '支持 HTML，例如 <strong>加粗</strong>。' }) +
      '</div><div class="divider"></div><div class="grid2">' +
        fInput('精选区标题', 'site.featuredTitle', s.featuredTitle, { hint: '支持 <br> 换行' }) +
        fInput('精选区说明', 'site.featuredNote', s.featuredNote, { area: true, rows: 3 }) +
        fInput('拼贴区标题', 'site.selectedTitle', s.selectedTitle) +
        fInput('拼贴区说明', 'site.selectedNote', s.selectedNote, { area: true, rows: 3 }) +
      '</div></div>' +

    '<div class="card"><div class="card__head"><h2>个人介绍与联系方式</h2></div>' +
      '<div class="grid2">' +
        fInput('关于标题', 'site.aboutTitle', s.aboutTitle, { hint: '支持 <br> 换行' }) +
        fInput('姓名', 'site.contactName', s.contactName) +
        fInput('个人介绍 · 第 1 段', 'site.aboutText1', s.aboutText1, { area: true, rows: 4 }) +
        fInput('个人介绍 · 第 2 段', 'site.aboutText2', s.aboutText2, { area: true, rows: 4 }) +
        fInput('作品集周期', 'site.contactPeriod', s.contactPeriod) +
        fInput('电话', 'site.contactTel', s.contactTel) +
        fInput('邮箱', 'site.contactEmail', s.contactEmail) +
        fInput('微信', 'site.contactWechat', s.contactWechat) +
      '</div></div>' +

    '<div class="card"><div class="card__head"><h2>其他页面文案</h2></div><div class="grid2">' +
      fInput('作品总览 · 导语', 'site.worksLead', s.worksLead, { area: true, rows: 3 }) +
      fInput('作品总览 · 计数标签', 'site.worksCount', s.worksCount) +
      fInput('目录说明', 'site.contentsNote', s.contentsNote, { area: true, rows: 3 }) +
      fInput('关于页 · 导语', 'site.aboutPageLead', s.aboutPageLead, { area: true, rows: 3 }) +
      fInput('过渡带 1 · 标题', 'site.divider1Title', s.divider1Title) +
      fInput('过渡带 1 · 说明', 'site.divider1Note', s.divider1Note) +
      fInput('过渡带 2 · 标题', 'site.divider2Title', s.divider2Title) +
      fInput('过渡带 2 · 说明', 'site.divider2Note', s.divider2Note) +
    '</div></div>' +

    '<div class="card"><div class="card__head"><h2>项目文案</h2><div class="right">' +
      '<select class="select" id="text-project-select" style="max-width:250px">' +
        cfg.projects.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === textProjectId ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') +
      '</select></div></div>' +
      (p ? '<div class="grid2">' +
        fInput('项目标题', pp + 'title', p.title) +
        fInput('英文名称', pp + 'en', p.en) +
        fInput('标语', pp + 'tagline', p.tagline) +
        fInput('口号', pp + 'slogan', p.slogan) +
        fInput('简介', pp + 'summary', p.summary, { area: true, rows: 3 }) +
        fInput('设计说明', pp + 'description', p.description, { area: true, kind: 'lines', rows: 5, tip: '每行一段' }) +
      '</div>' : '<div class="empty">暂无项目</div>') +
    '</div>' +

    '<div class="card"><div class="card__head"><h2>文字排版</h2><span class="hint">标题与正文的字号、粗细、行距、字间距、颜色</span></div>' +
      '<div class="grid2">' +
        fInput('标题大小', 'typography.titleScale', t.titleScale, { kind: 'range', min: 0.6, max: 1.6, step: 0.05, tip: '相对原始尺寸的倍数' }) +
        fInput('标题粗细', 'typography.titleWeight', t.titleWeight, { kind: 'select', options: [400,500,600,700,800,900].map(function (w) { return '<option value="' + w + '"' + (Number(t.titleWeight) === w ? ' selected' : '') + '>' + w + '</option>'; }).join('') }) +
        fInput('标题行距', 'typography.titleLineHeight', t.titleLineHeight, { kind: 'range', min: 0.85, max: 1.5, step: 0.01 }) +
        fInput('标题字间距 (em)', 'typography.titleTracking', t.titleTracking, { kind: 'range', min: -0.1, max: 0.1, step: 0.005 }) +
        fInput('正文字号 (px)', 'typography.bodySize', t.bodySize, { kind: 'range', min: 12, max: 24, step: 1 }) +
        fInput('正文行距', 'typography.bodyLineHeight', t.bodyLineHeight, { kind: 'range', min: 1.2, max: 2.2, step: 0.05 }) +
        fInput('正文字间距 (em)', 'typography.bodyTracking', t.bodyTracking, { kind: 'range', min: -0.05, max: 0.1, step: 0.005 }) +
        fInput('正文颜色', 'typography.textColor', t.textColor, { kind: 'color' }) +
      '</div></div>' +
    englishCopyHTML();
  }

  /* ------------------------------------------------------------ 03 视觉设置 */
  var FONT_PRESETS = [
    { label: '系统默认（原网站字体）', value: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif' },
    { label: '苹方 / 中文黑体', value: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
    { label: '思源宋体 / 宋体', value: '"Songti SC", "SimSun", "Noto Serif SC", serif' },
    { label: 'Georgia 衬线', value: 'Georgia, "Times New Roman", "Songti SC", serif' },
    { label: 'Helvetica / Arial', value: '"Helvetica Neue", Arial, "PingFang SC", sans-serif' },
    { label: '等宽字体', value: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' }
  ];
  function fontOptions(cur) {
    var found = FONT_PRESETS.some(function (f) { return f.value === cur; });
    return FONT_PRESETS.map(function (f) { return '<option value="' + esc(f.value) + '"' + (f.value === cur ? ' selected' : '') + '>' + esc(f.label) + '</option>'; }).join('') +
      (found ? '' : '<option value="' + esc(cur) + '" selected>自定义字体</option>');
  }

  function renderVisual() {
    $('#view-visual').innerHTML = visualHTML();
  }

  function visualHTML() {
    var v = cfg.visual;
    var mo = cfg.motion || Store.MOTION_DEFAULT;
    return '' +
    '<div class="card"><div class="card__head"><h2>基础颜色</h2><span class="hint">默认值即原网站配色；修改后实时覆盖</span></div>' +
      '<div class="grid3">' +
        fInput('网站背景色', 'visual.bg', v.bg, { kind: 'color' }) +
        fInput('卡片 / 图片底色', 'visual.paper2', v.paper2, { kind: 'color' }) +
        fInput('主文字 / 深黑色', 'visual.ink', v.ink, { kind: 'color' }) +
        fInput('次要文字 · 中性灰', 'visual.muted', v.muted, { kind: 'color' }) +
        fInput('分隔线颜色', 'visual.line', v.line, { kind: 'color' }) +
        fInput('主题强调色', 'visual.accent', v.accent, { kind: 'color' }) +
        fInput('强调色 · 浅色', 'visual.accentSoft', v.accentSoft, { kind: 'color' }) +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="eyebrow" style="margin-bottom:10px">配色预览</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        ['bg','paper2','ink','muted','line','accent','accentSoft'].map(function (k) {
          return '<div style="flex:1;min-width:92px"><div style="height:46px;border-radius:7px;border:1px solid #E3DED4;background:' + esc(v[k]) + '"></div>' +
            '<div class="eyebrow" style="margin-top:6px">' + k + '</div></div>';
        }).join('') + '</div>' +
    '</div>' +
    '<div class="card"><div class="card__head"><h2>字体</h2></div><div class="grid2">' +
      fInput('标题字体', 'visual.fontTitle', v.fontTitle, { kind: 'select', options: fontOptions(v.fontTitle) }) +
      fInput('正文字体', 'visual.fontBody', v.fontBody, { kind: 'select', options: fontOptions(v.fontBody) }) +
    '</div>' +
      '<div class="grid2" style="margin-top:12px">' +
        fInput('标题字体 · 自定义 CSS 值', 'visual.fontTitle', v.fontTitle) +
        fInput('正文字体 · 自定义 CSS 值', 'visual.fontBody', v.fontBody) +
      '</div>' +
      '<div class="hint" style="margin-top:10px">可填写本机已安装的字体名或 CSS font-family 列表，例如 <code>"Songti SC", serif</code>。</div>' +
    '</div>' +
    '<div class="card"><div class="card__head"><h2>间距与边距</h2><div class="right">' +
      '<button class="btn btn--sm" data-act="reset-visual">恢复默认视觉设置</button></div></div>' +
      '<div class="grid2">' +
        fInput('页面左右边距 (px)', 'visual.pad', v.pad, { kind: 'range', min: 20, max: 160, step: 2 }) +
        fInput('模块间距 (px)', 'visual.gap', v.gap, { kind: 'range', min: 40, max: 240, step: 5 }) +
      '</div></div>' +
    '<div class="card"><div class="card__head"><h2>沉浸式动效</h2><span class="hint">第二阶段 · 默认开启</span></div>' +
      '<div class="grid2">' +
        fInput('启用沉浸式交互', 'motion.enabled', mo.enabled, { kind: 'bool', onLabel: '启用' }) +
        fInput('动效强度', 'motion.intensity', mo.intensity, { kind: 'select', options:
          '<option value="normal"' + (mo.intensity === 'normal' ? ' selected' : '') + '>标准</option>' +
          '<option value="calm"' + (mo.intensity === 'calm' ? ' selected' : '') + '>轻柔（更短位移，关闭自定义光标与 3D 倾斜）</option>' }) +
      '</div>' +
      '<div class="hint" style="margin-top:14px">包含首页动态开场、自定义光标与磁吸、作品墙轻微 3D 倾斜与视差、详情页滚动叙事与全屏灯箱、纯色遮罩页面转场、滚动进度与章节渐显。' +
      '系统开启「减少动态效果」时自动全部关闭；手机端自动降级为触控交互（按下反馈、灯箱左右滑动切换 / 下拉关闭），不显示鼠标效果。' +
      '后台本身不加载动效，实时预览 iframe 中可以看到前台效果。</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------ 04 预览 */
  function previewOptions() {
    var opts = [{ v: 'index.html', t: '首页' }, { v: 'works.html', t: '作品总览' }, { v: 'about.html', t: '关于' }];
    visible().forEach(function (p) {
      var isStatic = cfg.staticPages.indexOf(p.id) >= 0;
      opts.push({ v: isStatic ? 'projects/' + p.id + '.html' : 'projects/project.html?id=' + encodeURIComponent(p.id), t: '项目 · ' + p.title });
    });
    return opts;
  }
  function renderPreviewOptions() {
    var sel = $('#preview-page');
    var opts = previewOptions();
    sel.innerHTML = opts.map(function (o) { return '<option value="' + esc(o.v) + '"' + (o.v === previewPage ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('');
    $$('[data-device]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.device === previewDevice); });
    $('#preview-frame').classList.toggle('is-mobile', previewDevice === 'mobile');
  }
  function refreshPreview(force) {
    var f = $('#preview-frame');
    var target = previewPage + (previewPage.indexOf('?') >= 0 ? '&' : '?') + 'adminPreview=1';
    if (force || !f.src || f.getAttribute('data-current') !== target) {
      f.setAttribute('data-current', target);
      f.src = target;
    } else {
      try { f.contentWindow.location.reload(); } catch (e) { f.src = target; }
    }
  }
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      if (currentView === 'preview') refreshPreview(false);
    }, 800);
  }

  /* ------------------------------------------------------------ 05 数据安全 */
  function renderData() {
    var size = (JSON.stringify(cfg).length / 1024 / 1024).toFixed(2);
    var mediaCount = Object.keys(cfg.media || {}).length;
    $('#view-data').innerHTML =
    '<div class="card"><div class="card__head"><h2>保存机制说明</h2></div>' +
      '<div class="help-block">' +
        '<div class="warn"><b>请务必区分三种状态：</b><br>' +
        '① <b>本地草稿</b>：所有编辑保存在<b>当前浏览器的 IndexedDB</b>，前台页面与预览立即生效；<b>不会写入网站文件，也不会影响其他设备或访客</b>。<br>' +
        '② <b>已发布内容</b>：只有导出「发布包 ZIP」并把它解压上传到静态托管后，修改才对访客生效。发布包内写入 <code>data/published.js</code> 并锁定，独立可运行。<br>' +
        '③ <b>原始数据</b>：<code>data/works.js</code>、<code>data/original-backup.json</code> 与 <code>assets/</code> 中的原始图片<b>永不被修改或覆盖</b>；上传的图片写到独立的 <code>assets/uploads/</code>。' +
        '</div>' +
        '<div>删除项目采用<b>软删除</b>：项目完整移入回收站，随时可恢复，不会丢失任何原始项目资料。</div>' +
      '</div></div>' +

    '<div class="card"><div class="card__head"><h2>当前草稿</h2></div>' +
      '<div class="stat-grid" style="margin-bottom:0">' +
        '<div class="stat"><b>' + size + '</b><span>草稿大小 (MB)</span></div>' +
        '<div class="stat"><b>' + mediaCount + '</b><span>已上传图片</span></div>' +
        '<div class="stat"><b>' + cfg.projects.length + '</b><span>项目</span></div>' +
        '<div class="stat"><b>' + cfg.trash.length + '</b><span>回收站</span></div>' +
      '</div></div>' +

    '<div class="card"><div class="card__head"><h2>配置导入 / 导出</h2><span class="hint">配置 JSON 含全部文字、设置与上传图片，可跨设备恢复</span></div>' +
      '<div class="chips">' +
        '<button class="btn" data-act="export-config">↓ 导出完整配置 JSON</button>' +
        '<button class="btn" data-act="import-config">↑ 导入配置 JSON</button>' +
        '<button class="btn" data-act="export-backup">↓ 导出原始数据备份</button>' +
        '<button class="btn btn--danger" data-act="restore-backup">↺ 恢复原始数据</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:12px">导入配置会替换当前草稿（可撤销）。原始数据备份是从 <code>data/works.js</code> 生成的完整快照。</div>' +
    '</div>' +

    '<div class="card"><div class="card__head"><h2>发布与清理</h2></div>' +
      '<div class="chips">' +
        '<button class="btn btn--accent" data-act="export-release">↓ 导出完整发布包 ZIP</button>' +
        '<button class="btn" data-act="clean-media">清理未引用图片</button>' +
        '<button class="btn btn--danger" data-act="clear-draft">清空本地草稿</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:12px">发布包包含所有 HTML / CSS / JS、原始素材、上传图片、发布配置，以及每个项目对应的详情页文件；解压后双击 <code>index.html</code> 即可独立运行。</div>' +
      '<div id="release-proto" style="margin-top:10px"></div>' +
    '</div>' +

    '<div class="card"><div class="card__head"><h2>回收站 · 原始项目保护</h2></div>' +
      (cfg.trash.length ? cfg.trash.map(function (p, i) {
        return '<div class="project-item" style="margin-bottom:6px"><span></span><div>' +
          '<div class="project-item__name">' + esc(p.title) + '</div><div class="project-item__meta">' + esc(p.id) + ' · ' + countImages(p) + ' 张图</div></div>' +
          '<div class="project-item__ops"><button class="btn btn--sm" data-act="restore" data-i="' + i + '">↩ 恢复</button></div></div>';
      }).join('') : '<div class="empty">回收站为空</div>') +
    '</div>';
    var proto = $('#release-proto');
    if (location.protocol === 'file:') {
      proto.innerHTML = '<div class="help-block warn">当前以 <code>file://</code> 打开。<b>完整发布包需要静态服务器</b>才能读取站点文件：' +
        '在网站目录执行 <code>python3 -m http.server 8765</code>，然后用 <code>http://127.0.0.1:8765/admin.html</code> 打开后台。<br>' +
        '在 file:// 下，编辑、预览、保存草稿、配置 JSON 导入导出与备份恢复均可正常使用。</div>';
    }
  }

  /* ------------------------------------------------------------ 06 帮助 */
  function renderHelp() {
    $('#help-content').innerHTML =
      '<h3>快速开始</h3><ul>' +
        '<li>左侧切换「作品管理 / 文字编辑 / 视觉设置 / 实时预览 / 数据安全」。</li>' +
        '<li>任何修改都会自动保存为<b>本地草稿</b>，并在前台与预览里立刻生效。</li>' +
        '<li>顶部「撤销 / 重做」支持最近 40 步；「保存草稿」可手动立即落盘。</li>' +
      '</ul>' +
      '<h3>作品管理</h3><ul>' +
        '<li><b>新增 / 复制 / 删除</b>：删除是软删除，项目进回收站，可完整恢复。</li>' +
        '<li><b>排序</b>：拖动项目左侧手柄，或用 ↑ ↓ 按钮；序号会同步到首页、总览、目录与详情页。</li>' +
        '<li><b>显示 / 隐藏</b>：隐藏后从所有前台列表移除，详情页本身仍可访问；新建项目默认隐藏，设置封面后打开即可。</li>' +
        '<li><b>首页精选</b>：控制项目是否出现在首页 FEATURED WORKS。原始 5 个精选默认勾选，新建项目默认勾选，设为显示后即上首页。</li>' +
        '<li><b>图片</b>：封面与每个内容块都支持上传替换、从已有图片选用、删除、拖拽排序。上传图片压缩后存入草稿，导出时物化为 <code>assets/uploads/</code> 文件，绝不覆盖原图。</li>' +
        '<li><b>新增项目详情</b>：可选单图、双图、图片网格、竖版海报、文字段落、口号色带、说明块。</li>' +
      '</ul>' +
      '<h3>文字与视觉</h3><ul>' +
        '<li>文字编辑里可改首页标题、副标题、个人介绍、联系方式、各项目标题与设计说明。</li>' +
        '<li>排版区可改标题大小 / 粗细 / 行距 / 字间距，以及正文字号 / 行距 / 字间距 / 颜色。</li>' +
        '<li>视觉设置里可改背景、主题色、强调色、标题与正文字体、页面边距与模块间距；支持一键恢复默认。</li>' +
      '</ul>' +
      '<h3>中英双语（CN / EN）</h3><ul>' +
        '<li>「文字编辑 → 语言 / LANGUAGE」可以开关前台右上角的「中 / EN」按钮，并设置访客默认语言。</li>' +
        '<li>「英文文案 / ENGLISH COPY」编辑首页导语、关于介绍、联系方式，以及当前项目的英文标题、标语、简介、说明与元信息。</li>' +
        '<li>切换只影响导航、个人介绍、项目标题与说明、少量界面标签；作品图片、图注与版式完全不变。</li>' +
        '<li>英文留空会自动使用内置英文，不会出现空白；关闭语言切换后全站固定为中文。</li>' +
      '</ul>' +
      '<h3>第二阶段 · 沉浸式交互</h3><ul>' +
        '<li>首页动态开场、跟随光标与磁吸按钮、作品墙轻微 3D 倾斜与视差、详情页滚动叙事与全屏灯箱、纯色遮罩转场、滚动进度与章节渐显。</li>' +
        '<li>在「视觉设置 → 沉浸式动效」可开关或切换「标准 / 轻柔」；系统开启「减少动态效果」时自动全部关闭。</li>' +
        '<li>手机端不加载鼠标效果，改为按下反馈、灯箱左右滑动切换与下拉关闭；后台本身不加载动效，用「实时预览」查看。</li>' +
      '</ul>' +
      '<h3>保存与发布（重要）</h3>' +
      '<div class="warn">这是<b>纯静态网站，没有服务器数据库</b>。编辑只存在于当前浏览器。' +
      '要让修改对外生效，必须点「导出发布包 ZIP」，把解压后的整个目录上传到静态托管；' +
      '发布包里的 <code>data/published.js</code> 会锁定为已发布内容，不依赖任何后台或浏览器草稿。' +
      '「导出完整配置 JSON」用于备份 / 换设备继续编辑，导入到任意一份本站后台即可恢复。</div>' +
      '<h3>建议运行环境</h3><ul>' +
        '<li>用本地静态服务器打开后台可获得全部功能：<code>python3 -m http.server 8765</code> → <code>http://127.0.0.1:8765/admin.html</code>。</li>' +
        '<li><code>file://</code> 直接双击也能编辑、预览、保存草稿与导入导出配置；仅「导出完整发布包」需要服务器读取站点文件。</li>' +
      '</ul>' +
      '<h3>原始数据保护</h3><ul>' +
        '<li><code>data/works.js</code> 与 <code>data/original-backup.json</code> 保存 9 个原始项目的完整快照。</li>' +
        '<li><code>assets/</code> 内 97 张原始与高清图片永远只读；后台不写入该目录。</li>' +
        '<li>任何时候都可「恢复原始数据」或清空草稿，回到最初状态。</li>' +
      '</ul>';
  }

  /* ------------------------------------------------------------ 图片处理 */
  function compressImage(file, cb) {
    var fr = new FileReader();
    fr.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 1600, scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        var ctx = c.getContext('2d');
        if (file.type !== 'image/png') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        cb(file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = function () { toast('无法读取该图片', true); };
      img.src = e.target.result;
    };
    fr.onerror = function () { toast('文件读取失败', true); };
    fr.readAsDataURL(file);
  }
  function pickImage(cb) {
    var input = $('#hidden-file');
    input.value = '';
    input.onchange = function () {
      if (!input.files || !input.files[0]) return;
      compressImage(input.files[0], function (url) {
        var k = uid('img');
        cfg.media[k] = url;
        /* 云端登录时自动上传到私有桶并登记 media_assets */
        if (window.CloudAdmin) window.CloudAdmin.onMediaAdded(k, url);
        cb('media:' + k);
      });
    };
    input.click();
  }
  function setShot(pi, bi, ii, value) {
    var p = cfg.projects[pi], b = p.blocks[bi];
    if (ii < 0) { b.src = value; b.hd = null; }
    else { b.items[ii].src = value; b.items[ii].hd = null; }
    commit('图片已更新');
  }
  function openPicker(cb) {
    var list = [];
    cfg.projects.forEach(function (p) {
      if (p.cover) list.push(p.cover);
      p.blocks.forEach(function (b) {
        if (b.src) list.push(b.src);
        (b.items || []).forEach(function (it) { if (it.src) list.push(it.src); });
      });
    });
    Object.keys(cfg.media || {}).forEach(function (k) { list.push('media:' + k); });
    [cfg.cover, cfg.closing].concat(Object.keys(cfg.dividers || {}).map(function (k) { return cfg.dividers[k]; })).forEach(function (x) { if (x) list.push(x); });
    list = list.filter(function (v, i, a) { return v && a.indexOf(v) === i; });

    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:350;background:rgba(15,15,13,.78);display:flex;align-items:center;justify-content:center;padding:30px';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:900px;width:100%;max-height:86vh;overflow:auto;padding:22px">' +
      '<div style="display:flex;align-items:center;margin-bottom:16px"><b style="font-size:15px">选择已有图片</b>' +
      '<button class="btn btn--sm" style="margin-left:auto" data-close>关闭</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">' +
      list.map(function (v, i) {
        return '<div data-pick="' + i + '" style="cursor:pointer;border:1px solid #E3DED4;border-radius:8px;overflow:hidden">' +
          '<img src="' + esc(thumbSrc(v)) + '" style="width:100%;aspect-ratio:1.414;object-fit:cover;display:block">' +
          '<div style="font-size:9px;padding:5px;color:#7C7971;word-break:break-all">' + esc(v.length > 30 ? v.slice(0, 30) + '…' : v) + '</div></div>';
      }).join('') + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || e.target === ov) { ov.remove(); return; }
      var el = e.target.closest('[data-pick]');
      if (el) { var v = list[Number(el.dataset.pick)]; ov.remove(); cb(v); }
    });
  }

  /* ------------------------------------------------------------ 操作分发 */
  function handleAction(act, el) {
    var i = Number(el.dataset.i), b = Number(el.dataset.b), id = el.dataset.id;
    var pi = projectIndex(selectedId);
    switch (act) {
      case 'toggle': {
        var p0 = cfg.projects.find(function (x) { return x.id === id; });
        if (p0) { p0.hidden = !p0.hidden; commit(p0.hidden ? '项目已隐藏' : '项目已显示'); }
        break;
      }
      case 'duplicate': {
        var src = cfg.projects.find(function (x) { return x.id === id; });
        if (!src) break;
        var copy = clone(src);
        copy.id = uid('project');
        copy.title = src.title + '（副本）';
        copy.hidden = true;
        var srcEN = (cfg.i18n && cfg.i18n.projects && cfg.i18n.projects[src.id]) ? clone(cfg.i18n.projects[src.id]) : {};
        if (srcEN.title) srcEN.title = srcEN.title + ' (Copy)';
        if (cfg.i18n) {
          if (!cfg.i18n.projects) cfg.i18n.projects = {};
          cfg.i18n.projects[copy.id] = srcEN;
        }
        cfg.projects.splice(cfg.projects.indexOf(src) + 1, 0, copy);
        selectedId = copy.id;
        commit('已复制项目（副本默认隐藏）');
        break;
      }
      case 'remove': {
        var idx = cfg.projects.findIndex(function (x) { return x.id === id; });
        if (idx < 0) break;
        if (!confirm('确定删除「' + cfg.projects[idx].title + '」？\n项目会完整移入回收站，可随时恢复，原始数据不会丢失。')) break;
        cfg.trash.push(clone(cfg.projects[idx]));
        cfg.projects.splice(idx, 1);
        selectedId = cfg.projects[0] ? cfg.projects[0].id : null;
        commit('已移入回收站');
        break;
      }
      case 'restore': {
        var t = cfg.trash[i];
        if (!t) break;
        cfg.trash.splice(i, 1);
        cfg.projects.push(clone(t));
        commit('项目已恢复');
        break;
      }
      case 'up': move(cfg.projects, i, i - 1); commit('顺序已调整'); break;
      case 'down': move(cfg.projects, i, i + 1); commit('顺序已调整'); break;
      case 'upload-cover': pickImage(function (v) { cfg.projects[Number(el.dataset.i)].cover = v; cfg.projects[Number(el.dataset.i)].coverHd = null; commit('封面已替换'); }); break;
      case 'pick-cover': openPicker(function (v) { cfg.projects[Number(el.dataset.i)].cover = v; cfg.projects[Number(el.dataset.i)].coverHd = null; commit('封面已更换'); }); break;
      case 'reset-cover': {
        var orig = Store.defaults().projects.find(function (x) { return x.id === cfg.projects[Number(el.dataset.i)].id; });
        if (!orig) { toast('这是新增项目，没有原始封面', true); break; }
        cfg.projects[Number(el.dataset.i)].cover = orig.cover;
        cfg.projects[Number(el.dataset.i)].coverHd = orig.coverHd;
        commit('已恢复原始封面');
        break;
      }
      case 'upload-shot': pickImage(function (v) { setShot(projectIndex(selectedId), b, i, v); }); break;
      case 'pick-shot': openPicker(function (v) { setShot(projectIndex(selectedId), b, i, v); }); break;
      case 'item-add': {
        cfg.projects[pi].blocks[b].items.push({ src: '', caption: '新图片' });
        commit('已添加图片条目，请上传或选用图片');
        break;
      }
      case 'item-del': cfg.projects[pi].blocks[b].items.splice(i, 1); commit('图片已删除'); break;
      case 'item-up': move(cfg.projects[pi].blocks[b].items, i, i - 1); commit('图片顺序已调整'); break;
      case 'item-down': move(cfg.projects[pi].blocks[b].items, i, i + 1); commit('图片顺序已调整'); break;
      case 'block-up': move(cfg.projects[pi].blocks, i, i - 1); commit('详情顺序已调整'); break;
      case 'block-down': move(cfg.projects[pi].blocks, i, i + 1); commit('详情顺序已调整'); break;
      case 'block-dup': cfg.projects[pi].blocks.splice(i + 1, 0, clone(cfg.projects[pi].blocks[i])); commit('已复制详情块'); break;
      case 'block-del': cfg.projects[pi].blocks.splice(i, 1); commit('详情块已删除'); break;
      case 'add-block': {
        var kind = $('#add-block-kind').value;
        var nb = { kind: kind, caption: '', items: [], body: [], eyebrow: '', title: '', text: '', note: '' };
        if (kind === 'full') nb.src = '';
        if (kind === 'grid') nb.cols = 4;
        if (['pair', 'grid', 'posters'].indexOf(kind) >= 0) nb.items = [{ src: '', caption: '图片 1' }];
        if (kind === 'text') { nb.eyebrow = 'SECTION'; nb.title = '新段落'; nb.body = ['在这里输入说明文字。']; }
        if (kind === 'band') { nb.eyebrow = 'BRAND SLOGAN'; nb.title = '把生活还给风'; nb.text = 'GIVE LIFE BACK TO THE WIND'; }
        if (kind === 'note') { nb.title = '补充说明'; nb.text = '在这里输入补充说明。'; }
        cfg.projects[pi].blocks.push(nb);
        commit('已新增详情块');
        break;
      }
      case 'reset-visual': {
        cfg.visual = clone(Store.VISUAL_DEFAULT);
        commit('已恢复默认视觉设置');
        break;
      }
      case 'export-config': {
        downloadText(Store.toJSON(cfg), 'portfolio-config-' + stamp() + '.json');
        toast('完整配置已导出（含上传图片）');
        break;
      }
      case 'import-config': {
        var ji = $('#hidden-json'); ji.value = '';
        ji.onchange = function () {
          var f = ji.files && ji.files[0]; if (!f) return;
          var fr = new FileReader();
          fr.onload = function (e) {
            try { cfg = Store.fromJSON(e.target.result); commit('配置已导入'); }
            catch (err) { toast('导入失败：' + err.message, true); }
          };
          fr.readAsText(f);
        };
        ji.click();
        break;
      }
      case 'export-backup': {
        downloadText(JSON.stringify(Store.defaults(), null, 2), 'portfolio-original-backup-' + stamp() + '.json');
        toast('原始数据备份已导出');
        break;
      }
      case 'restore-backup': {
        if (!confirm('确定恢复到 9 个原始项目与默认视觉设置？\n当前本地草稿将被清空（此操作会先进入历史，可用撤销找回）。')) break;
        cfg = Store.defaults();
        Store.clearDraft();
        selectedId = cfg.projects[0] ? cfg.projects[0].id : null;
        commit('已恢复原始数据');
        break;
      }
      case 'export-release': buildRelease(); break;
      case 'clean-media': {
        var used = {};
        function scan(o) {
          if (Array.isArray(o)) { o.forEach(scan); return; }
          if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { scan(o[k]); }); return; }
          if (typeof o === 'string' && o.indexOf('media:') === 0) used[o.slice(6)] = true;
        }
        scan(cfg.projects); scan(cfg.trash); scan(cfg.site); scan(cfg.dividers); scan(cfg.owner);
        if (cfg.cover && cfg.cover.indexOf('media:') === 0) used[cfg.cover.slice(6)] = true;
        if (cfg.closing && cfg.closing.indexOf('media:') === 0) used[cfg.closing.slice(6)] = true;
        var before = Object.keys(cfg.media).length;
        Object.keys(cfg.media).forEach(function (k) { if (!used[k]) delete cfg.media[k]; });
        commit('已清理 ' + (before - Object.keys(cfg.media).length) + ' 张未引用图片（原始文件不受影响）');
        break;
      }
      case 'clear-draft': {
        if (!confirm('清空本地草稿后，前台将回到原始 / 已发布内容。配置 JSON 若未导出将无法找回。确定继续？')) break;
        Store.clearDraft().then(function () {
          cfg = Store.defaults();
          selectedId = cfg.projects[0] ? cfg.projects[0].id : null;
          history = [clone(cfg)]; hIndex = 0;
          updateHistoryButtons(); setStatus('草稿已清空', false);
          render(); refreshPreview(true);
          toast('本地草稿已清空');
        });
        break;
      }
    }
  }

  /* ------------------------------------------------------------ 发布包 */
  function projectShell(p) {
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + esc(p.title) + ' — ' + esc(cfg.owner.name) + '作品集</title>\n' +
      '<link rel="stylesheet" href="../css/style.css">\n<link rel="stylesheet" href="../css/motion.css">\n</head>\n' +
      '<body data-base=".." data-page="works">\n' +
      '<div class="progress" id="progress"></div>\n<header class="header" id="site-header"></header>\n' +
      '<main id="project-root" data-project="' + esc(p.id) + '"></main>\n' +
      '<footer class="footer" id="site-footer"></footer>\n' +
      '<div class="lightbox" id="lightbox" role="dialog" aria-label="高清作品图">' +
      '<button class="lightbox__close" data-lightbox-close aria-label="关闭">×</button>' +
      '<button class="lightbox__nav prev" data-lightbox-prev aria-label="上一张">‹</button>' +
      '<img class="lightbox__img" alt="">' +
      '<button class="lightbox__nav next" data-lightbox-next aria-label="下一张">›</button>' +
      '<div class="lightbox__bar"><span class="lightbox__caption"></span><span class="lightbox__counter"></span></div></div>\n' +
      '<script src="../data/i18n.js"><\/script>\n' +
      '<script src="../data/works.js"><\/script>\n' +
      '<script src="../data/published.js"><\/script>\n' +
      '<script src="../js/portfolio-store.js"><\/script>\n' +
      '<script src="../js/site.js"><\/script>\n' +
      '<script src="../js/motion.js"><\/script>\n</body>\n</html>\n';
  }

  async function buildRelease() {
    if (location.protocol === 'file:') {
      toast('完整发布包需通过本地静态服务器打开后台；file:// 下可先导出配置 JSON。详见「数据安全」与「使用说明」。', true);
      return;
    }
    var btn = $('#btn-release'); btn.disabled = true;
    toast('正在收集站点文件…');
    try {
      var manifest = await fetch('data/file-manifest.json?_=' + Date.now()).then(function (r) {
        if (!r.ok) throw new Error('清单读取失败'); return r.json();
      });
      var zip = new ZipWriter();
      var skipped = [];
      /* 发布包内一律使用 ASCII 文件名：部分系统自带 unzip 对 UTF-8 中文名兼容不佳 */
      var NAME_MAP = {
        '后台使用说明.md': 'ADMIN-GUIDE.md',
        '部署说明.md': 'DEPLOY.md',
        '测试报告.md': 'TEST-REPORT.md',
        '交付清单.md': 'DELIVERY.md'
      };
      for (var n = 0; n < manifest.files.length; n++) {
        var name = manifest.files[n];
        if (name === 'data/published.js') continue;
        var outName = NAME_MAP[name] || name;
        try {
          var res = await fetch(name + '?_=' + Date.now());
          if (!res.ok) { skipped.push(name); continue; }
          zip.add(outName, new Uint8Array(await res.arrayBuffer()));
        } catch (e) { skipped.push(name); }
      }
      var m = Store.materialize(cfg);
      var pub = m.cfg;
      pub.staticPages = Store.visibleProjects(pub).map(function (p) { return p.id; });
      pub._publishedAt = new Date().toISOString();
      zip.add('data/published.js',
        '/* 已发布配置 · 由可视化后台导出 · ' + pub._publishedAt + ' */\n' +
        'window.PORTFOLIO_PUBLISHED = ' + JSON.stringify(pub) + ';\n' +
        'window.PORTFOLIO_PUBLISHED_LOCK = true;\n');
      m.files.forEach(function (f) { zip.add(f.name, Store.decodeDataUrl(f.dataUrl)); });
      Store.visibleProjects(pub).forEach(function (p) { zip.add('projects/' + p.id + '.html', projectShell(p)); });
      zip.add('RELEASE-NOTES.txt',
        '曾文卓作品集 · 发布包\n' +
        '导出时间：' + new Date().toLocaleString('zh-CN') + '\n\n' +
        '本目录是完整、独立、可运行的静态网站：\n' +
        '· 直接双击 index.html 即可浏览（无需后台、无需数据库、无需联网）\n' +
        '· data/published.js 保存已发布内容并锁定，前台不会读取浏览器草稿\n' +
        '· assets/uploads/ 保存后台上传的图片，assets/ 其余为原始素材（未被覆盖）\n' +
        '· admin.html 为可视化后台；如需继续编辑，请用本地静态服务器打开\n' +
        '· 中英双语由 data/i18n.js 提供内置英文，语言开关与默认语言随本配置发布\n' +
        '· 把整个目录上传到任意静态托管即可对外发布（见 DEPLOY.md）\n' +
        '· 原始数据在 data/works.js 与 data/original-backup.json，可随时恢复\n' +
        '· 文档：ADMIN-GUIDE.md 后台说明 / DEPLOY.md 部署 / TEST-REPORT.md 测试 / DELIVERY.md 清单\n\n' +
        '项目数：' + Store.visibleProjects(pub).length + '\n' +
        '打包文件数：' + (zip.count() + Store.visibleProjects(pub).length + 1) + '\n' +
        (skipped.length ? '\n未读取到的文件（已跳过）：' + skipped.join(', ') + '\n' : ''));

      var blob = zip.build();
      download(blob, 'portfolio-release-' + stamp() + '.zip');
      toast('发布包已导出：' + (blob.size / 1024 / 1024).toFixed(1) + ' MB，含 ' + m.files.length + ' 张上传图片');
    } catch (err) {
      toast('导出失败：' + err.message, true);
      console.error(err);
    } finally { btn.disabled = false; }
  }

  /* ------------------------------------------------------------ 事件绑定 */
  function convert(el) {
    var kind = el.dataset.kind || 'text', raw = el.type === 'checkbox' ? el.checked : el.value;
    if (kind === 'number') return Number(raw);
    if (kind === 'bool') return !!raw;
    if (kind === 'invert') return !raw;
    if (kind === 'lines') return String(raw).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (kind === 'meta') return String(raw).split('\n').map(function (line) {
      var parts = line.split('|'); return { k: (parts[0] || '').trim(), v: (parts.slice(1).join('|') || '').trim() };
    }).filter(function (m) { return m.k || m.v; });
    return raw;
  }
  function bindValue(el) {
    if (!el.dataset.bind) return;
    setPath(cfg, el.dataset.bind, convert(el));
    /* 分类改变时同步中文标签，保证筛选与卡片文字一致 */
    var cm = /^projects\.(\d+)\.category$/.exec(el.dataset.bind);
    if (cm && cfg.projects[Number(cm[1])]) {
      var c = cfg.categories.find(function (x) { return x.id === cfg.projects[Number(cm[1])].category; });
      cfg.projects[Number(cm[1])].categoryLabel = c ? c.label : '未分类';
    }
    setStatus('未保存…', true);
    scheduleSave();
    schedulePreview();
  }
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.bind) {
      bindValue(el);
      if (el.type === 'range') {
        var out = el.parentElement.querySelector('output');
        if (out) out.textContent = el.value;
      }
      if (el.type === 'color') {
        var pair = el.parentElement.querySelector('input.input');
        if (pair && pair !== el) pair.value = el.value;
      } else if (el.classList.contains('input') && /^#[0-9a-fA-F]{6}$/.test(el.value)) {
        var color = el.parentElement.querySelector('input[type=color]');
        if (color && color !== el) color.value = el.value;
      }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'text-project-select') { textProjectId = el.value; renderText(); return; }
    if (el.id === 'preview-page') { previewPage = el.value; refreshPreview(true); return; }
    if (el.id === 'add-block-kind') return;
    if (el.dataset && el.dataset.bind) {
      bindValue(el);
      history = history.slice(0, hIndex + 1);
      history.push(clone(cfg));
      if (history.length > MAX_HISTORY) history.shift();
      hIndex = history.length - 1;
      updateHistoryButtons();
      /* 开关 / 下拉等离散操作立刻落盘，避免用户在 300ms 防抖窗口内跳转导致改动丢失 */
      setStatus('保存中…', true);
      clearTimeout(saveTimer);
      saveNow();
      render();
    }
  });

  document.addEventListener('click', function (e) {
    var nav = e.target.closest('#side-nav button');
    if (nav) { switchView(nav.dataset.view); return; }
    var sel = e.target.closest('[data-select]');
    if (sel && !e.target.closest('[data-act]')) { selectedId = sel.dataset.select; renderProjects(); return; }
    var act = e.target.closest('[data-act]');
    if (act) { handleAction(act.dataset.act, act); return; }
    var dev = e.target.closest('[data-device]');
    if (dev) { previewDevice = dev.dataset.device; renderPreviewOptions(); return; }
    if (e.target.closest('#btn-undo')) undo();
    if (e.target.closest('#btn-redo')) redo();
    if (e.target.closest('#btn-save')) saveNow().then(function () { toast('草稿已保存'); });
    if (e.target.closest('#btn-release')) buildRelease();
    if (e.target.closest('#btn-add-project')) {
      var np = {
        id: uid('project'), title: '新项目', en: 'NEW PROJECT', category: 'brand-vi',
        categoryLabel: '品牌 VI 设计', pages: '—', accent: '#4B7A34', accentSoft: '#E7EEDF',
        tagline: '项目标语', slogan: 'SLOGAN', summary: '在这里填写项目简介。',
        description: ['在这里填写设计说明。'], meta: [{ k: '类别', v: '品牌 VI 设计' }],
        cover: '', coverHd: null, blocks: [], hidden: true, featured: true
      };
      cfg.projects.push(np);
      if (cfg.i18n) {
        if (!cfg.i18n.projects) cfg.i18n.projects = {};
        cfg.i18n.projects[np.id] = {};
      }
      selectedId = np.id;
      commit('已新增项目（默认隐藏，设置封面后可显示）');
    }
    if (e.target.closest('#btn-trash-toggle')) { trashOpen = !trashOpen; renderProjects(); }
    if (e.target.closest('#btn-preview-refresh')) refreshPreview(true);
    if (e.target.closest('#btn-preview-open')) window.open(previewPage + (previewPage.indexOf('?') >= 0 ? '&' : '?') + 'adminPreview=1', '_blank');
    if (e.target.closest('#notice-close')) $('#notice').style.display = 'none';
  });

  /* ------------------------------------------------------------ 拖拽 */
  var dragInfo = null;
  document.addEventListener('dragstart', function (e) {
    var el = e.target.closest('[data-drag]');
    if (!el) return;
    dragInfo = { type: el.dataset.drag, i: Number(el.dataset.i), b: Number(el.dataset.b) };
    el.classList.add('is-dragging');
    try { e.dataTransfer.setData('text/plain', '1'); } catch (err) {}
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', function (e) {
    var el = e.target.closest('[data-drag]');
    if (!el || !dragInfo) return;
    if (el.dataset.drag !== dragInfo.type) return;
    e.preventDefault();
    $$('.is-drop-target').forEach(function (x) { x.classList.remove('is-drop-target'); });
    el.classList.add('is-drop-target');
  });
  document.addEventListener('drop', function (e) {
    var el = e.target.closest('[data-drag]');
    if (!el || !dragInfo) return;
    e.preventDefault();
    var to = Number(el.dataset.i), tb = Number(el.dataset.b);
    var pi = projectIndex(selectedId);
    if (dragInfo.type === 'project' && el.dataset.drag === 'project') {
      move(cfg.projects, dragInfo.i, to);
    } else if (dragInfo.type === 'block' && el.dataset.drag === 'block' && pi >= 0) {
      move(cfg.projects[pi].blocks, dragInfo.i, to);
    } else if (dragInfo.type === 'item' && el.dataset.drag === 'item' && pi >= 0 && dragInfo.b === tb) {
      move(cfg.projects[pi].blocks[tb].items, dragInfo.i, to);
    } else {
      dragInfo = null;
      $$('.is-drop-target,.is-dragging').forEach(function (x) { x.classList.remove('is-drop-target', 'is-dragging'); });
      toast('仅支持同组内拖拽排序', true);
      return;
    }
    dragInfo = null;
    $$('.is-drop-target,.is-dragging').forEach(function (x) { x.classList.remove('is-drop-target', 'is-dragging'); });
    commit('顺序已调整');
  });
  document.addEventListener('dragend', function () {
    dragInfo = null;
    $$('.is-drop-target,.is-dragging').forEach(function (x) { x.classList.remove('is-drop-target', 'is-dragging'); });
  });

  /* ------------------------------------------------------------ 快捷键 */
  document.addEventListener('keydown', function (e) {
    var mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow().then(function () { toast('草稿已保存'); }); }
  });

  /* ------------------------------------------------------------ 启动 */
  function boot() {
    var fallback = new Promise(function (res) { setTimeout(function () { res(Store.defaults()); }, 2000); });
    Promise.race([Store.resolveForAdmin(), fallback]).then(function (c) {
      cfg = c;
      selectedId = cfg.projects[0] ? cfg.projects[0].id : null;
      textProjectId = selectedId;
      history = [clone(cfg)]; hIndex = 0;
      updateHistoryButtons();
      setStatus('已载入草稿', false);
      /* 打开后台即建立一份明确的本地草稿，避免「前台用原始数据、后台编辑另起一份」的歧义 */
      Store.saveDraft(cfg).catch(function () {});
      if (location.protocol === 'file:') {
        $('#proto-hint').innerHTML = ' <b>当前为 file:// 模式</b>：完整发布包导出需改用本地静态服务器（见「使用说明」）。';
      }
      switchView('projects');
      /* 云端模块（admin-cloud.js）等待草稿就绪后自动拉取云端状态 */
      if (window.CloudAdmin) window.CloudAdmin.onDraftLoaded();
    }).catch(function (err) { toast('载入失败：' + err.message, true); });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();

  /* ------------------------------------------------------------ 云端模块桥
     admin-cloud.js 通过此桥读写后台内部状态（getCfg / replaceCfg 等），
     避免云逻辑侵入编辑器本体。 */
  window.ZwzAdmin = {
    getCfg: function () { return cfg; },
    replaceCfg: function (c, msg) {
      cfg = clone(c);
      selectedId = cfg.projects[0] ? cfg.projects[0].id : null;
      textProjectId = selectedId;
      commit(msg || '草稿已载入');
    },
    saveLocal: function () { return saveNow(); },
    toast: toast,
    getView: function () { return currentView; }
  };
})();
