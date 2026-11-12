/* =========================================================================
   PortfolioStore — 可插拔配置层 / 本地草稿存储
   -------------------------------------------------------------------------
   · data/works.js 是永不改写的原始数据（window.PORTFOLIO）
   · data/published.js（可选）是「已发布」配置，导出发布包时生成
   · 后台编辑的草稿保存在 IndexedDB（容量大，可存上传图片）
   · 前台优先级：草稿 > 已发布配置 > 原始数据
   · 上传图片以 media:<id> 引用，值存于 cfg.media 的 data URL
   · 纯静态：没有服务器数据库，所有持久化都发生在当前浏览器或导出文件中
   ========================================================================= */
(function (global) {
  'use strict';

  var VERSION = 1;
  /* 原作品集首页精选的 5 个项目；旧配置缺少 featured 字段时按此补全，保证默认视觉不变 */
  var DEFAULT_FEATURED_IDS = ['haiyu-low-altitude', 'binxiaoxun', 'petora', 'south-pearl', 'font-design'];
  var DB_NAME = 'zwz-portfolio-store';
  var OBJECT_STORE = 'kv';
  var DRAFT_KEY = 'draft';
  var LS_KEY = 'zwz.portfolio.draft.v1';

  /* ----------------------------------------------------------- 默认文案 */
  var SITE_DEFAULT = {
    docTitle: '曾文卓 · 视觉传达设计作品集 2023—2026',
    heroLines: ['VISUAL', 'DESIGN', 'PORTFOLIO'],
    heroMeta: ['VISUAL COMMUNICATION DESIGN', '2023 — 2026', 'BRAND VI / UI / IP / LOGO / FONT'],
    heroMetaHtml: 'SCROLL TO EXPLORE ↓',
    heroLedeHtml: '你好，我是 <strong>曾文卓</strong>。这是一份 2023—2026 年的视觉传达设计作品集，收录品牌 VI、移动端界面、IP 形象、标志与字体共 <strong>9 组</strong> 项目。网站中的每一张作品图都直接取自原始作品集 PDF，未裁切、未重绘。',
    indexLabel: 'INDEX / 作品分类',
    selectedTitle: 'SELECTED<br>IMAGES',
    selectedNote: '五组作品的代表画面，来自 PDF 内嵌的原始图片。点击任意画面进入对应项目。',
    featuredTitle: 'FEATURED<br>WORKS',
    featuredNote: '按项目在作品集中的顺序排列。每个项目都有独立详情页，包含完整的高清作品图与来源页码。',
    allWorksLabel: '查看全部 09 个项目 ↗',
    divider1Title: '海屿低空',
    divider1Note: '01 / 09 · BRAND VI DESIGN · PDF P03—P18',
    divider2Title: 'South Pearl<br>× 滨小讯',
    divider2Note: '04 — 05 / 09 · IP DESIGN',
    aboutTitle: '把设计当作<br>一种观察方式。',
    aboutText1: '从品牌系统的秩序、界面信息的层级，到 IP 的性格与汉字的图形性，这份作品集记录的是同一件事：如何为一个具体的议题，找到恰当且可被使用的视觉形式。',
    aboutText2: '本站为 39 页横版作品集的网页重构版本，采用编辑式排版重新组织封面、项目分类、详情页与视觉过渡，而非逐页嵌入 PDF。',
    worksLead: '9 组项目、5 个类别，按原始作品集《曾文卓作品集2.pdf》的页序编排。每张封面均为 PDF 内嵌原始图片，点击可进入项目详情页查看完整高清图。',
    worksCount: '09 PROJECTS · 39 PAGES IN SOURCE PDF',
    contentsNote: '下表按原 PDF 页码列出项目归属，便于核对与后续替换素材。P15 在原 PDF 中与 P09 内容重复，已去重。',
    aboutPageLead: '本站是 39 页横版 PDF 作品集的响应式网页重构版。所有作品图片均从 PDF 内嵌图像直接提取，保留原始比例与像素，没有裁切、重绘或 AI 生成内容。',
    contactName: '曾文卓 / ZENG WENZHUO',
    contactPeriod: '2023 — 2026',
    contactTel: '19870683884',
    contactEmail: '3288084831@qq.com',
    contactWechat: 'z3288084831y',
    contactSource: '《曾文卓作品集2.pdf》· 39 页'
  };

  var VISUAL_DEFAULT = {
    bg: '#F6F3EC',
    paper2: '#EFEBE2',
    ink: '#141412',
    muted: '#7C7971',
    line: '#D9D4C9',
    accent: '#4B7A34',
    accentSoft: '#E7EEDF',
    fontTitle: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontBody: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
    pad: 88,
    gap: 110
  };

  /* 第二阶段：沉浸式动效。默认开启；系统「减少动态效果」会自动强制关闭 */
  var MOTION_DEFAULT = {
    enabled: true,
    intensity: 'normal'   // 'normal' | 'calm'（轻柔：更短位移、关闭光标与 3D 倾斜）
  };

  /* 中英双语：只保存「覆盖值」，缺省时前台回退到 data/i18n.js 的内置英文。
     default 决定访客首次进入时的语言；enabled=false 时隐藏前台语言切换。 */
  var I18N_DEFAULT = {
    enabled: true,
    default: 'zh',
    site: {},
    projects: {}
  };

  var TYPO_DEFAULT = {
    titleScale: 1,
    titleWeight: 800,
    titleLineHeight: 0.95,
    titleTracking: -0.045,
    bodySize: 16,
    bodyLineHeight: 1.65,
    bodyTracking: 0,
    textColor: '#141412'
  };

  /* ------------------------------------------------------------- 工具 */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }

  function defaults() {
    var base = global.PORTFOLIO || {};
    var cfg = {
      version: VERSION,
      owner: clone(base.owner || {}),
      categories: clone(base.categories || []),
      projects: clone(base.projects || []),
      dividers: clone(base.dividers || {}),
      cover: base.cover || '',
      closing: base.closing || '',
      staticPages: (base.projects || []).map(function (p) { return p.id; }),
      trash: [],
      site: clone(SITE_DEFAULT),
      visual: clone(VISUAL_DEFAULT),
      typography: clone(TYPO_DEFAULT),
      motion: clone(MOTION_DEFAULT),
      i18n: clone(I18N_DEFAULT),
      media: {}
    };
    cfg.projects.forEach(function (p) {
      if (typeof p.featured !== 'boolean') p.featured = DEFAULT_FEATURED_IDS.indexOf(p.id) >= 0;
      /* 为每个项目预留英文覆盖位置，后台编辑时路径一定存在 */
      cfg.i18n.projects[p.id] = {};
    });
    return cfg;
  }

  /* 补齐旧版配置，避免缺字段导致渲染崩溃 */
  function normalize(cfg) {
    var d = defaults();
    if (!isObj(cfg)) return d;
    var out = {
      version: VERSION,
      owner: Object.assign({}, d.owner, isObj(cfg.owner) ? cfg.owner : {}),
      categories: Array.isArray(cfg.categories) ? cfg.categories : d.categories,
      projects: Array.isArray(cfg.projects) ? cfg.projects : d.projects,
      dividers: Object.assign({}, d.dividers, isObj(cfg.dividers) ? cfg.dividers : {}),
      cover: cfg.cover || d.cover,
      closing: cfg.closing || d.closing,
      staticPages: Array.isArray(cfg.staticPages) ? cfg.staticPages : d.staticPages,
      trash: Array.isArray(cfg.trash) ? cfg.trash : [],
      site: Object.assign({}, d.site, isObj(cfg.site) ? cfg.site : {}),
      visual: Object.assign({}, d.visual, isObj(cfg.visual) ? cfg.visual : {}),
      typography: Object.assign({}, d.typography, isObj(cfg.typography) ? cfg.typography : {}),
      motion: Object.assign({}, d.motion, isObj(cfg.motion) ? cfg.motion : {}),
      i18n: {
        enabled: !(isObj(cfg.i18n) && cfg.i18n.enabled === false),
        default: (isObj(cfg.i18n) && cfg.i18n.default === 'en') ? 'en' : 'zh',
        site: isObj(cfg.i18n) && isObj(cfg.i18n.site) ? cfg.i18n.site : {},
        projects: isObj(cfg.i18n) && isObj(cfg.i18n.projects) ? cfg.i18n.projects : {}
      },
      media: isObj(cfg.media) ? cfg.media : {}
    };
    out.projects.forEach(function (p) {
      if (typeof p.featured !== 'boolean') p.featured = DEFAULT_FEATURED_IDS.indexOf(p.id) >= 0;
      p.blocks = Array.isArray(p.blocks) ? p.blocks : [];
      p.meta = Array.isArray(p.meta) ? p.meta : [];
      p.description = Array.isArray(p.description) ? p.description : [];
      if (!p.id) p.id = 'project-' + Math.random().toString(36).slice(2, 9);
      if (!isObj(out.i18n.projects[p.id])) out.i18n.projects[p.id] = {};
      p.blocks.forEach(function (b) {
        if (b.items && !Array.isArray(b.items)) b.items = [];
        if (b.body && !Array.isArray(b.body)) b.body = [String(b.body)];
      });
    });
    return out;
  }

  /* ------------------------------------------------- IndexedDB / 降级 */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('no-idb')); return; }
      var settled = false;
      /* 部分环境（file:// / 隐私模式 / 受限沙箱）会禁用 IndexedDB，
         请求可能既不 success 也不 error。超时后降级到 localStorage，
         保证前台永远能渲染，不会白屏。 */
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true; reject(new Error('idb-timeout'));
      }, 1200);
      var finish = function (fn, val) {
        if (settled) return;
        settled = true; clearTimeout(timer); fn(val);
      };
      var req;
      try { req = global.indexedDB.open(DB_NAME, 1); }
      catch (e) { finish(reject, e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(OBJECT_STORE)) db.createObjectStore(OBJECT_STORE);
      };
      req.onsuccess = function () { finish(resolve, req.result); };
      req.onerror = function () { finish(reject, req.error || new Error('idb-error')); };
      req.onblocked = function () { finish(reject, new Error('idb-blocked')); };
    });
  }
  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(OBJECT_STORE, 'readonly');
        var r = tx.objectStore(OBJECT_STORE).get(key);
        r.onsuccess = function () { resolve(r.result); db.close(); };
        r.onerror = function () { reject(r.error); db.close(); };
      });
    });
  }
  function idbSet(key, val) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(OBJECT_STORE, 'readwrite');
        tx.objectStore(OBJECT_STORE).put(val, key);
        tx.oncomplete = function () { resolve(true); db.close(); };
        tx.onerror = function () { reject(tx.error); db.close(); };
      });
    });
  }
  function idbDel(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(OBJECT_STORE, 'readwrite');
        tx.objectStore(OBJECT_STORE).delete(key);
        tx.oncomplete = function () { resolve(true); db.close(); };
        tx.onerror = function () { reject(tx.error); db.close(); };
      });
    });
  }

  var storageMode = 'idb';
  var lastWritten = null;                 // 同一页面会话内的最新草稿，消除异步写入的读取竞态
  var LS_MIRROR_LIMIT = 2 * 1024 * 1024;  // 体积小的配置额外写一份镜像，避免读写后端不一致

  function readLS() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeLS(cfg) {
    try {
      /* 含大量上传图片时提前跳过，避免对大对象做无谓的 JSON.stringify */
      var media = cfg.media || {}, keys = Object.keys(media), total = 0;
      for (var i = 0; i < keys.length; i++) {
        total += String(media[keys[i]] || '').length;
        if (total > LS_MIRROR_LIMIT) return false;
      }
      var json = JSON.stringify(cfg);
      if (json.length > LS_MIRROR_LIMIT) return false;
      global.localStorage.setItem(LS_KEY, json);
      return true;
    } catch (e) { return false; }
  }

  /* 两个后端可能有一份略旧；按写入时间戳取较新的一份，避免偶发读到旧快照 */
  function newer(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return (Number(b._savedAt) || 0) > (Number(a._savedAt) || 0) ? b : a;
  }
  function readDraft() {
    /* 同会话内刚写过的草稿直接返回，避免 IDB 事务尚未提交时读到旧值 */
    if (lastWritten) return Promise.resolve(lastWritten);
    var mirror = readLS();
    if (storageMode === 'localStorage') return Promise.resolve(mirror);
    return idbGet(DRAFT_KEY).then(function (v) { return newer(v, mirror); })
      .catch(function () {
        return idbGet(DRAFT_KEY).then(function (v) { return newer(v, mirror); })
          .catch(function () {
            storageMode = 'localStorage';
            return mirror;
          });
      });
  }
  /* 写入：给草稿打时间戳，两个后端各存一份，保证后续读取一定拿到最新内容 */
  function writeDraft(cfg) {
    var record = Object.assign({}, cfg, { _savedAt: Date.now() });
    lastWritten = record;
    var mirrorOK = writeLS(record);
    return idbSet(DRAFT_KEY, record).then(function (r) { storageMode = 'idb'; return r; })
      .catch(function () {
        if (mirrorOK) { storageMode = 'localStorage'; return true; }
        var err = new Error('浏览器存储不可用或空间不足：请导出配置 JSON 备份后清理草稿。');
        err.quota = true; throw err;
      });
  }
  function clearDraft() {
    lastWritten = null;
    storageMode = 'idb';
    try { global.localStorage.removeItem(LS_KEY); } catch (e) {}
    return idbDel(DRAFT_KEY).catch(function () { return true; });
  }

  /* ------------------------------------------------------------- 解析 */
  function resolve() {
    var cfg = defaults();
    if (global.PORTFOLIO_PUBLISHED) cfg = normalize(global.PORTFOLIO_PUBLISHED);
    var isAdminPreview = /(?:\?|&)adminPreview=1/.test(global.location ? global.location.search : '');
    if (global.PORTFOLIO_PUBLISHED_LOCK && !isAdminPreview) return Promise.resolve(cfg);
    return readDraft().then(function (draft) {
      if (draft && (draft.version === VERSION || draft.projects)) cfg = normalize(draft);
      return cfg;
    }).catch(function () { return cfg; });
  }
  /* 后台始终以「已发布配置 / 草稿」为编辑起点，不受发布锁影响 */
  function resolveForAdmin() {
    var cfg = defaults();
    if (global.PORTFOLIO_PUBLISHED) cfg = normalize(global.PORTFOLIO_PUBLISHED);
    return readDraft().then(function (draft) {
      return (draft && (draft.version === VERSION || draft.projects)) ? normalize(draft) : cfg;
    }).catch(function () { return cfg; });
  }
  function draftExists() {
    return readDraft().then(function (d) { return !!d; }).catch(function () { return false; });
  }

  /* media: 引用 → data URL；普通路径原样返回（由调用方补 BASE） */
  function asset(path, cfg) {
    if (!path) return '';
    if (typeof path === 'string' && path.indexOf('media:') === 0) {
      var k = path.slice(6);
      return (cfg && cfg.media && cfg.media[k]) || '';
    }
    return path;
  }

  function visibleProjects(cfg) {
    return (cfg.projects || []).filter(function (p) { return !p.hidden; });
  }

  /* ------------------------------------------------- 配置导入 / 导出 */
  function toJSON(cfg) {
    var out = clone(cfg);
    out._type = 'zwz-portfolio-config';
    out._version = VERSION;
    out._exportedAt = new Date().toISOString();
    return JSON.stringify(out, null, 2);
  }
  function fromJSON(text) {
    var obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.projects)) throw new Error('配置文件格式不正确：缺少 projects 数组');
    return normalize(obj);
  }

  /* 把 media: 引用物化为发布包中的文件，返回 {cfg, files} */
  function materialize(cfg) {
    var out = clone(cfg);
    var files = [];
    var map = {};
    Object.keys(out.media || {}).forEach(function (k) {
      var url = out.media[k];
      if (typeof url !== 'string' || url.indexOf('data:image/') !== 0) return;
      var ext = url.indexOf('data:image/png') === 0 ? 'png' : 'jpg';
      var name = 'assets/uploads/' + k + '.' + ext;
      map['media:' + k] = name;
      files.push({ name: name, dataUrl: url });
    });
    function walk(o) {
      if (Array.isArray(o)) { o.forEach(function (v, i) { o[i] = walk(v); }); return o; }
      if (isObj(o)) { Object.keys(o).forEach(function (k) { o[k] = walk(o[k]); }); return o; }
      if (typeof o === 'string' && map[o]) return map[o];
      return o;
    }
    walk(out.projects); walk(out.trash); walk(out.site);
    walk(out.dividers); walk(out.owner);
    out.cover = map[out.cover] || out.cover;
    out.closing = map[out.closing] || out.closing;
    out.media = {};
    return { cfg: out, files: files };
  }

  function decodeDataUrl(url) {
    var comma = url.indexOf(',');
    var head = url.slice(0, comma);
    var body = url.slice(comma + 1);
    var bin;
    if (head.indexOf(';base64') >= 0) {
      var s = atob(body);
      bin = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
    } else {
      var txt = decodeURIComponent(body);
      bin = new Uint8Array(txt.length);
      for (var j = 0; j < txt.length; j++) bin[j] = txt.charCodeAt(j);
    }
    return bin;
  }

  global.PortfolioStore = {
    VERSION: VERSION,
    SITE_DEFAULT: SITE_DEFAULT,
    VISUAL_DEFAULT: VISUAL_DEFAULT,
    TYPO_DEFAULT: TYPO_DEFAULT,
    MOTION_DEFAULT: MOTION_DEFAULT,
    I18N_DEFAULT: I18N_DEFAULT,
    defaults: defaults,
    normalize: normalize,
    resolve: resolve,
    resolveForAdmin: resolveForAdmin,
    draftExists: draftExists,
    readDraft: readDraft,
    saveDraft: writeDraft,
    clearDraft: clearDraft,
    asset: asset,
    visibleProjects: visibleProjects,
    toJSON: toJSON,
    fromJSON: fromJSON,
    materialize: materialize,
    decodeDataUrl: decodeDataUrl,
    clone: clone,
    getStorageMode: function () { return storageMode; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
