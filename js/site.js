/* =========================================================================
   曾文卓 · 视觉传达设计作品集 — 交互与数据渲染
   纯原生 JS，无依赖、无构建，双击 HTML 即可运行
   -------------------------------------------------------------------------
   数据源优先级（由 js/portfolio-store.js 决定）：
     本地草稿 > data/published.js 已发布配置 > data/works.js 原始数据
   默认状态下不注入任何覆盖样式，原有页面与视觉 100% 保留。
   ========================================================================= */

(function () {
  'use strict';

  var CFG = null;
  var DATA = null;
  var BASE = document.body.dataset.base || '.';
  var Store = window.PortfolioStore;

  /* media:xxx → data URL；assets/... → 补上相对基础路径 */
  var AS = function (p) {
    if (!p) return '';
    var r = Store ? Store.asset(p, CFG) : p;
    if (!r) return '';
    if (r.indexOf('data:') === 0 || r.indexOf('blob:') === 0 || /^https?:\/\//.test(r)) return r;
    return BASE + '/' + r;
  };
  var P = function (p) { return BASE === '.' ? p : '../' + p; };
  var PR = function (id) {
    var isStatic = CFG && CFG.staticPages && CFG.staticPages.indexOf(id) >= 0;
    if (BASE === '.') return isStatic ? 'projects/' + id + '.html' : 'projects/project.html?id=' + encodeURIComponent(id);
    return isStatic ? id + '.html' : 'project.html?id=' + encodeURIComponent(id);
  };
  var VIS = function () { return Store.visibleProjects(CFG); };
  var TOTAL = function () { return VIS().length; };
  var numOf = function (p) { return String(VIS().indexOf(p) + 1).padStart(2, '0'); };
  var esc = function (s) { return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };

  /* ------------------------------------------------------------ 中英双语
     只切换导航、个人介绍、项目标题与说明，以及少量界面标签。
     作品图片、图注与版式保持不变；英文缺失时回退中文，绝不出现空白。 */
  var I18N = window.PORTFOLIO_I18N || { ui: {}, site: {}, projects: {}, categories: {}, categoryLabels: {} };
  var LANG_KEY = 'zwz.lang';
  var LANG = 'zh';

  function cfgI18n() { return (CFG && CFG.i18n) || {}; }
  function langEnabled() { return !(cfgI18n().enabled === false); }
  function savedLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'zh') return q;
    } catch (e) {}
    try {
      var v = localStorage.getItem(LANG_KEY);
      if (v === 'en' || v === 'zh') return v;
    } catch (e) {}
    return cfgI18n().default === 'en' ? 'en' : 'zh';
  }
  function isEN() { return LANG === 'en'; }
  function t(key, zh) {
    if (!isEN()) return zh;
    var en = I18N.ui && I18N.ui[key];
    return (en == null || en === '') ? zh : en;
  }
  function siteText(key, zh) {
    if (!isEN() || zh == null) return zh;
    var own = (cfgI18n().site || {})[key];
    if (own == null || own === '') own = (I18N.site || {})[key];
    return (own == null || own === '') ? zh : own;
  }
  /* 内置英文 + 后台覆盖：覆盖值为空时视为「未填写」，继续使用内置英文 */
  function projEN(p) {
    var base = (I18N.projects || {})[p.id] || {};
    var own = (cfgI18n().projects || {})[p.id] || {};
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(own).forEach(function (k) {
      var v = own[k];
      if (Array.isArray(v)) { if (v.filter(function (x) { return String(x || '').trim(); }).length) out[k] = v; }
      else if (v != null && String(v).trim() !== '') out[k] = v;
    });
    return out;
  }
  function pTitle(p) {
    if (!isEN()) return p.title;
    var e = projEN(p);
    return (e.title && String(e.title).trim()) || p.en || p.title;
  }
  function pTagline(p) {
    if (!isEN()) return p.tagline;
    var e = projEN(p);
    return (e.tagline && String(e.tagline).trim()) || p.tagline;
  }
  function pSummary(p) {
    if (!isEN()) return p.summary;
    var e = projEN(p);
    return (e.summary && String(e.summary).trim()) || p.summary;
  }
  function pDescription(p) {
    if (!isEN()) return p.description || [];
    var e = projEN(p);
    return (Array.isArray(e.description) && e.description.length) ? e.description : (p.description || []);
  }
  function pMeta(p) {
    if (!isEN()) return p.meta || [];
    var e = projEN(p);
    return (Array.isArray(e.meta) && e.meta.length) ? e.meta : (p.meta || []);
  }
  function catLabel(p) {
    if (!isEN()) return p.categoryLabel;
    return (I18N.categoryLabels && I18N.categoryLabels[p.category]) || p.categoryLabel;
  }
  function catName(c) {
    if (!isEN()) return c.label;
    return (I18N.categories && I18N.categories[c.id]) || c.en || c.label;
  }

  /* 首页精选与拼贴：保留原有选取，项目隐藏/删除时自动过滤并补齐 */
  var COLLAGE = [
    { id: 'haiyu-low-altitude', src: 'assets/haiyu-low-altitude/09-key-visual.jpg', cap: 'HAIYU / 主视觉海报', capEn: 'HAIYU / KEY VISUAL POSTER', bg: '#101A0C' },
    { id: 'binxiaoxun',         src: 'assets/binxiaoxun/01-cover.jpg',              cap: 'BIN XIAO XUN / 政务 IP', capEn: 'BIN XIAO XUN / GOVERNMENT IP', bg: '#DCE8FB' },
    { id: 'petora',             src: 'assets/petora/01-hero.jpg',                   cap: 'PETORA / AI 宠物平台', capEn: 'PETORA / AI PET PLATFORM', bg: '#0B1730' },
    { id: 'south-pearl',        src: 'assets/south-pearl/01-cover.jpg',             cap: 'SOUTH PEARL / 南珠 IP', capEn: 'SOUTH PEARL / PEARL IP', bg: '#FCE6E6' },
    { id: 'font-design',        src: 'assets/font-design/02-future-cyber.jpg',      cap: 'FUTURE CYBER / 字体海报', capEn: 'FUTURE CYBER / TYPE POSTER', bg: '#1B2B24' }
  ];
  function pickProjects(defs) {
    var list = VIS(), used = {}, out = [];
    defs.forEach(function (d) {
      var p = list.find(function (x) { return x.id === d.id; });
      if (p) { used[p.id] = true; out.push({ p: p, def: d }); }
    });
    list.forEach(function (p) {
      if (out.length >= 5) return;
      if (used[p.id]) return;
      used[p.id] = true;
      out.push({ p: p, def: { src: p.cover, cap: p.title, bg: p.accentSoft || '#EFEBE2' } });
    });
    return out.slice(0, 5);
  }

  /* ------------------------------------------------------------ 配置生效 */
  function hexToRgba(hex, a) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return 'rgba(246,243,236,' + a + ')';
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  }

  function applyVisual() {
    var v = CFG.visual, t = CFG.typography;
    var VD = Store.VISUAL_DEFAULT, TD = Store.TYPO_DEFAULT;
    var rootLines = [], bodyLines = [], titleLines = [], extra = [];

    var vars = {
      '--paper': ['bg', ''], '--paper-2': ['paper2', ''], '--ink': ['ink', ''],
      '--muted': ['muted', ''], '--line': ['line', ''], '--accent': ['accent', ''],
      '--accent-soft': ['accentSoft', ''],
      '--font-title': ['fontTitle', ''], '--font-body': ['fontBody', ''], '--font-sans': ['fontBody', ''],
      '--pad': ['pad', 'clamp(20px, 5vw, VALpx)'],
      '--gap': ['gap', 'VALpx'],
      '--title-scale': ['titleScale', '']  // typography，下面单独处理
    };
    Object.keys(vars).forEach(function (name) {
      var def = vars[name];
      var val = name === '--title-scale' ? t.titleScale : v[def[0]];
      var dflt = name === '--title-scale' ? TD.titleScale : VD[def[0]];
      if (val === dflt) return;
      var out = def[1] ? def[1].replace('VAL', Number(val)) : val;
      rootLines.push('  ' + name + ':' + out + ';');
    });
    if (t.bodySize !== TD.bodySize) bodyLines.push('font-size:' + t.bodySize + 'px;');
    if (t.bodyLineHeight !== TD.bodyLineHeight) bodyLines.push('line-height:' + t.bodyLineHeight + ';');
    if (t.bodyTracking !== TD.bodyTracking) bodyLines.push('letter-spacing:' + t.bodyTracking + 'em;');
    if (t.textColor !== TD.textColor) bodyLines.push('color:' + t.textColor + ';');
    if (t.titleWeight !== TD.titleWeight) titleLines.push('font-weight:' + t.titleWeight + ';');
    if (t.titleLineHeight !== TD.titleLineHeight) titleLines.push('line-height:' + t.titleLineHeight + ';');
    if (t.titleTracking !== TD.titleTracking) titleLines.push('letter-spacing:' + t.titleTracking + 'em;');

    if (v.bg !== VD.bg) {
      extra.push('.header{background:' + hexToRgba(v.bg, .92) + ';}');
      extra.push('.filters{background:' + hexToRgba(v.bg, .94) + ';}');
      extra.push('.nav{background:' + v.bg + ';}');
    }
    if (v.ink !== VD.ink) {
      extra.push('.footer,.closing{background:' + v.ink + ';}');
      extra.push('.footer{color:' + v.bg + ';}');
      extra.push('::selection{background:' + v.ink + ';color:' + v.bg + ';}');
    }

    var css = '';
    if (rootLines.length) css += ':root{\n' + rootLines.join('\n') + '\n}\n';
    if (bodyLines.length) css += 'body{' + bodyLines.join('') + '}\n';
    if (titleLines.length) {
      css += '.hero__display h1,.section-head h2,.page-head h1,.project-hero__head h1,' +
             '.divider-band__text h3,.footer__big,.feat-row__title,.next-project h2,' +
             '.pblock-text h2,.pblock-band h3,.pblock-note h3,.about-grid h2{' + titleLines.join('') + '}\n';
    }
    css += extra.join('\n');
    var el = document.getElementById('cfg-style');
    if (!el) { el = document.createElement('style'); el.id = 'cfg-style'; document.head.appendChild(el); }
    el.textContent = css;
  }

  function setText(id, value, html) {
    var el = document.getElementById(id);
    if (!el || value == null) return;
    if (html) el.innerHTML = value; else el.textContent = value;
  }
  function setSrc(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.src = AS(value);
  }

  function applySiteText() {
    var s = CFG.site;
    var V = function (k) { return siteText(k, s[k]); };
    if (s.docTitle && document.body.dataset.page === 'home') document.title = V('docTitle');
    (s.heroLines || []).forEach(function (v, i) { setText('hero-line-' + i, v); });
    (s.heroMeta || []).forEach(function (v, i) { setText('hero-meta-' + i, v); });
    setText('hero-scroll-label', s.heroMetaHtml);
    setText('hero-lede', V('heroLedeHtml'), true);
    setText('index-label', V('indexLabel'));
    setText('selected-title', s.selectedTitle, true);
    setText('selected-note', V('selectedNote'));
    setText('divider1-title', V('divider1Title'), true);
    setText('divider1-note', V('divider1Note'));
    setText('featured-title', s.featuredTitle, true);
    setText('featured-note', V('featuredNote'));
    setText('all-works-label', V('allWorksLabel'));
    setText('all-works-label-2', V('allWorksLabel'));
    setText('divider2-title', V('divider2Title'), true);
    setText('divider2-note', V('divider2Note'));
    setText('about-title', V('aboutTitle'), true);
    setText('about-text-1', V('aboutText1'));
    setText('about-text-2', V('aboutText2'));
    setText('works-lead', V('worksLead'));
    setText('works-count', V('worksCount'));
    setText('contents-note', V('contentsNote'));
    setText('about-page-lead', V('aboutPageLead'));
    setText('contact-name', V('contactName'));
    setText('contact-period', V('contactPeriod'));
    setText('contact-tel', V('contactTel'));
    setText('contact-email', V('contactEmail'));
    setText('contact-wechat', V('contactWechat'));
    setText('contact-source', V('contactSource'));
    var tel = document.getElementById('contact-tel');
    if (tel && tel.tagName === 'A') tel.href = 'tel:' + s.contactTel;
    var mail = document.getElementById('contact-email');
    if (mail && mail.tagName === 'A') mail.href = 'mailto:' + s.contactEmail;
    setSrc('closing-img', CFG.closing);
    setSrc('divider1-img', CFG.dividers['brand-vi']);
    setSrc('divider2-img', CFG.dividers['ip']);
    setSrc('divider3-img', CFG.dividers['font']);
    applyStaticBilingual();
  }

  /* about.html / works.html 中的固定段落：用 data-en 提供英文，切换时原地替换，
     结构与版式完全不变。首次运行时把中文记在 data-zh 里，来回切换无损。 */
  function applyStaticBilingual() {
    var nodes = document.querySelectorAll('[data-en]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-zh') == null) el.setAttribute('data-zh', el.innerHTML);
      var next = isEN() ? el.getAttribute('data-en') : el.getAttribute('data-zh');
      if (next != null && el.innerHTML !== next) el.innerHTML = next;
    });
    var nodes2 = document.querySelectorAll('[data-en-label]');
    Array.prototype.forEach.call(nodes2, function (el) {
      if (el.getAttribute('data-zh-label') == null) el.setAttribute('data-zh-label', el.getAttribute('aria-label') || '');
      var next = isEN() ? el.getAttribute('data-en-label') : el.getAttribute('data-zh-label');
      if (next != null) el.setAttribute('aria-label', next);
    });
  }

  /* ------------------------------------------------------------ 导航骨架 */
  function buildHeader() {
    var header = document.getElementById('site-header');
    if (!header) return;
    var page = document.body.dataset.page || '';
    var links = [
      { key: 'home',  label: t('navHome', '首页'), href: P('index.html') },
      { key: 'works', label: t('navWorks', '作品'), href: P('works.html') },
      { key: 'about', label: t('navAbout', '关于'), href: P('about.html') }
    ];
    var langHTML = langEnabled()
      ? '<div class="lang" id="lang-switch" role="group" aria-label="' + esc(t('langGroup', '切换语言')) + '">' +
          '<button type="button" data-lang="zh" class="' + (isEN() ? '' : 'is-on') + '">中</button>' +
          '<i>/</i>' +
          '<button type="button" data-lang="en" class="' + (isEN() ? 'is-on' : '') + '">EN</button>' +
        '</div>'
      : '';
    header.innerHTML =
      '<div class="header__inner">' +
        '<a class="brand" href="' + P('index.html') + '">' +
          '<span class="brand__cn">' + esc(DATA.owner.name) + '</span>' +
          '<span class="brand__en">' + esc(DATA.owner.en) + '</span>' +
        '</a>' +
        '<nav class="nav" id="main-nav">' +
          links.map(function (l) { return '<a href="' + l.href + '" class="' + (page === l.key ? 'is-active' : '') + '">' + l.label + '</a>'; }).join('') +
        '</nav>' +
        '<span class="header__tag">PORTFOLIO ' + esc(DATA.owner.period) + '</span>' +
        langHTML +
        '<button class="menu-btn" id="menu-btn" aria-label="' + esc(t('menuOpen', '打开菜单')) + '"><span></span><span></span><span></span></button>' +
      '</div>';
    var btn = document.getElementById('menu-btn');
    var nav = document.getElementById('main-nav');
    btn.addEventListener('click', function () { nav.classList.toggle('is-open'); });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') nav.classList.remove('is-open'); });
  }

  function buildFooter() {
    var el = document.getElementById('site-footer');
    if (!el) return;
    var role = DATA.owner.role || '';
    if (isEN()) role = role.split('/').pop().trim();
    el.innerHTML =
      '<div class="wrap">' +
        '<div class="footer__big">THANK<br>YOU.</div>' +
        '<div class="footer__row">' +
          '<span>© ' + new Date().getFullYear() + ' ' + esc(DATA.owner.name) + ' · ' + esc(role) + '</span>' +
          '<span>' + esc(siteText('contactSource', DATA.owner.source)) + ' · ' + t('footerExtracted', '全部图片为原作提取') + '</span>' +
          '<span><a href="' + P('works.html') + '">' + t('footerAllWorks', 'ALL WORKS ↑') + '</a></span>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------ 通用交互 */
  function initScroll() {
    var bar = document.getElementById('progress');
    var header = document.getElementById('site-header');
    var last = window.scrollY;
    var onScroll = function () {
      var y = window.scrollY;
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      }
      if (header) {
        if (y > 140 && y > last + 4) header.classList.add('is-hidden');
        else if (y < last - 4 || y < 140) header.classList.remove('is-hidden');
      }
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || !items.length) {
      items.forEach(function (i) { i.classList.add('is-in'); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (i) { io.observe(i); });
  }

  /* ------------------------------------------------------------ 灯箱 */
  function initLightbox() {
    var box = document.getElementById('lightbox');
    if (!box) return;
    var imgEl = box.querySelector('.lightbox__img');
    var capEl = box.querySelector('.lightbox__caption');
    var cntEl = box.querySelector('.lightbox__counter');
    var group = [], at = 0;
    var collect = function () { return Array.from(document.querySelectorAll('[data-zoom]')); };
    var show = function (i) {
      if (!group.length) return;
      at = (i + group.length) % group.length;
      var el = group[at];
      imgEl.src = el.dataset.zoom;
      imgEl.alt = el.dataset.caption || '';
      capEl.textContent = el.dataset.caption || '';
      cntEl.textContent = String(at + 1).padStart(2, '0') + ' / ' + String(group.length).padStart(2, '0');
    };
    var open = function (el) { group = collect(); show(group.indexOf(el)); box.classList.add('is-open'); document.body.classList.add('is-locked'); };
    var close = function () { box.classList.remove('is-open'); document.body.classList.remove('is-locked'); imgEl.removeAttribute('src'); };
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-zoom]');
      if (el && !e.target.closest('a')) { open(el); return; }
      if (e.target.closest('[data-lightbox-close]')) close();
      if (e.target.closest('[data-lightbox-prev]')) show(at - 1);
      if (e.target.closest('[data-lightbox-next]')) show(at + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
  }

  /* ------------------------------------------------------------ 图片块 */
  function figure(item, opts) {
    opts = opts || {};
    var src = AS(item.src);
    var full = item.hd ? AS(item.hd) : src;
    var cap = item.caption || '';
    var inner =
      '<div class="figure__frame" data-zoom="' + esc(full) + '" data-caption="' + esc(cap) + '">' +
        '<img src="' + esc(src) + '" alt="' + esc(cap) + '" loading="lazy" decoding="async">' +
      '</div>' +
      (opts.tile
        ? '<div class="tile-cap">' + esc(cap) + '</div>'
        : '<figcaption class="figure__cap"><span>' + esc(cap) + '</span>' + (item.note ? '<em>' + esc(item.note) + '</em>' : '') + '</figcaption>');
    return '<figure class="figure" data-reveal>' + inner + '</figure>';
  }

  function blockHTML(b, project) {
    switch (b.kind) {
      case 'text':
        return '<div class="pblock pblock-text" data-reveal>' +
          '<div><span class="eyebrow">' + esc(b.eyebrow) + '</span><h2>' + esc(b.title) + '</h2></div>' +
          '<div>' + (b.body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div></div>';
      case 'full':
        return '<div class="pblock" data-reveal>' + figure(b) + '</div>';
      case 'pair':
        return '<div class="pblock" data-reveal><div class="pblock-pair">' +
          b.items.map(function (i) { return figure(i); }).join('') + '</div>' +
          (b.caption ? '<div class="figure__cap"><span>' + esc(b.caption) + '</span></div>' : '') + '</div>';
      case 'grid':
      case 'posters':
        return '<div class="pblock" data-reveal><div class="pblock-' + b.kind + (b.kind === 'grid' ? ' is-' + (b.cols || 4) : '') + '">' +
          b.items.map(function (i) { return figure(i, { tile: true }); }).join('') + '</div>' +
          (b.caption ? '<div class="figure__cap" style="margin-top:22px"><span>' + esc(b.caption) + '</span><em>' + esc(t('embeddedNote', '原作 PDF 内嵌独立图片')) + '</em></div>' : '') + '</div>';
      case 'band':
        return '<div class="pblock pblock-band" style="--accent:' + esc(project.accent) + ';color:#fff" data-reveal>' +
          '<span class="eyebrow">' + esc(b.eyebrow) + '</span><h3>' + esc(b.title) + '</h3>' +
          '<p>' + esc(b.text) + '</p>' + (b.note ? '<small>' + esc(b.note) + '</small>' : '') + '</div>';
      case 'note':
        return '<div class="pblock pblock-note" data-reveal><h3>' + esc(b.title) + '</h3><p>' + esc(b.text) + '</p></div>';
      default: return '';
    }
  }

  /* ------------------------------------------------------------ 首页 */
  function renderHome() {
    var cats = document.getElementById('home-cats');
    if (cats) {
      cats.innerHTML = DATA.categories.filter(function (c) { return c.id !== 'all'; }).map(function (c, i) {
        return '<a href="' + P('works.html') + '?cat=' + c.id + '"><span>' + String(i + 1).padStart(2, '0') + ' &nbsp; ' + esc(isEN() ? catName(c) : c.label) + '</span><em>' + esc(isEN() ? c.label : c.en) + '</em></a>';
      }).join('');
    }
    var col = document.getElementById('home-collage');
    if (col) {
      col.innerHTML = pickProjects(COLLAGE).map(function (it, i) {
        var cap = (isEN() && it.def.capEn) ? it.def.capEn : it.def.cap;
        return '<a class="collage__item ' + 'abcde'[i] + '" href="' + PR(it.p.id) + '" data-reveal data-delay="' + (i % 4) + '"' +
          ' style="background:' + esc(it.def.bg) + '">' +
          '<img src="' + AS(it.def.src) + '" alt="' + esc(cap) + '" loading="lazy" style="object-fit:contain">' +
          '<span class="collage__label">' + numOf(it.p) + '</span><span class="collage__cap">' + esc(cap) + '</span></a>';
      }).join('');
    }
    var feat = document.getElementById('home-featured');
    if (feat) {
      /* 首页精选由后台的「首页精选」开关控制；原始 5 个项目默认勾选，视觉不变 */
      var picked = VIS().filter(function (p) { return p.featured; });
      if (!picked.length) picked = VIS().slice(0, 5);
      feat.innerHTML = picked.map(function (p) {
        return '<a class="feat-row" href="' + PR(p.id) + '" data-reveal style="--accent:' + esc(p.accent) + '">' +
          '<span class="feat-row__num">' + numOf(p) + ' / ' + String(TOTAL()).padStart(2, '0') + '</span>' +
          '<span class="feat-row__title">' + esc(pTitle(p)) + '<small>' + esc(catLabel(p)) + ' · ' + esc(p.pages) + '</small></span>' +
          '<span class="feat-row__img"><img src="' + AS(p.cover) + '" alt="' + esc(pTitle(p)) + '" loading="lazy"></span>' +
          '<span class="feat-row__arrow">↗</span></a>';
      }).join('');
    }
  }

  /* ------------------------------------------------------------ 作品总览 */
  function renderWorks() {
    var grid = document.getElementById('work-grid');
    if (!grid) return;
    var params = new URLSearchParams(location.search);
    var initial = params.get('cat') || 'all';
    var list = VIS();
    var unit = isEN() ? ' ' + t('projectUnit', 'PROJECTS') : ' 个项目';

    var bar = document.getElementById('filter-bar');
    if (bar) {
      bar.innerHTML = DATA.categories.map(function (c) {
        var n = c.id === 'all' ? list.length : list.filter(function (p) { return p.category === c.id; }).length;
        return '<button data-cat="' + c.id + '" class="' + (c.id === initial ? 'is-active' : '') + '">' +
          esc(catName(c)) + '<small>' + String(n).padStart(2, '0') + unit + '</small></button>';
      }).join('') + '<span class="filters__spacer"></span><span class="filters__note" id="filter-count"></span>';
    }

    grid.innerHTML = list.map(function (p) {
      return '<a class="work-card" href="' + PR(p.id) + '" data-cat="' + esc(p.category) + '" data-reveal style="--accent:' + esc(p.accent) + '">' +
        '<div class="work-card__media"><span class="work-card__tag">' + esc(catLabel(p)) + '</span>' +
        '<img src="' + AS(p.cover) + '" alt="' + esc(pTitle(p)) + '" loading="lazy"></div>' +
        '<div class="work-card__info"><span class="work-card__num">' + numOf(p) + '</span>' +
        '<span class="work-card__title">' + esc(pTitle(p)) + '</span>' +
        '<span class="work-card__en">' + esc(isEN() ? p.title : p.en) + '</span></div>' +
        '<p class="work-card__desc">' + esc(pSummary(p)) + '</p>' +
        '<div class="work-card__bar"><i></i></div></a>';
    }).join('');

    var apply = function (cat, push) {
      var cards = Array.from(grid.querySelectorAll('.work-card'));
      var n = 0;
      cards.forEach(function (c) {
        var ok = cat === 'all' || c.dataset.cat === cat;
        c.classList.toggle('is-hidden', !ok);
        if (ok) { n++; c.classList.add('is-in'); }
      });
      if (bar) bar.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.cat === cat); });
      var cnt = document.getElementById('filter-count');
      if (cnt) cnt.textContent = t('showing', 'SHOWING') + ' ' + String(n).padStart(2, '0') + ' / ' + String(TOTAL()).padStart(2, '0');
      if (push) {
        try {
          var u = new URL(location.href);
          cat === 'all' ? u.searchParams.delete('cat') : u.searchParams.set('cat', cat);
          history.replaceState(null, '', u);
        } catch (err) { /* file:// 下不改写历史 */ }
      }
      initReveal();
    };
    /* 用 onclick 覆盖，避免语言切换重渲染时重复叠加监听 */
    if (bar) bar.onclick = function (e) {
      var b = e.target.closest('button[data-cat]');
      if (b) apply(b.dataset.cat, true);
    };
    apply(initial, false);
  }

  /* ------------------------------------------------------------ 作品目录 */
  function renderContents() {
    var box = document.getElementById('contents-table');
    if (!box) return;
    box.innerHTML = VIS().map(function (p) {
      return '<a class="catalog-row" href="' + PR(p.id) + '">' +
        '<span class="mono" style="color:var(--muted)">' + numOf(p) + '</span>' +
        '<strong style="font-weight:700">' + esc(pTitle(p)) + '</strong>' +
        '<span class="c-cat" style="color:var(--muted);font-size:12px">' + esc(catLabel(p)) + '</span>' +
        '<span class="c-pages mono" style="color:var(--muted)">' + esc(p.pages) + '</span>' +
        '<span>↗</span></a>';
    }).join('');
  }

  /* ------------------------------------------------------------ 项目详情 */
  function renderProject() {
    var root = document.getElementById('project-root');
    if (!root) return;
    var id = root.dataset.project || new URLSearchParams(location.search).get('id') || '';
    var p = DATA.projects.find(function (x) { return x.id === id; });
    if (!p) {
      root.innerHTML = '<div class="wrap" style="padding:160px 0"><h1>' + esc(t('notFoundTitle', '项目不存在或已被移除')) + '</h1>' +
        '<p><a class="btn-outline" href="' + P('works.html') + '">' + esc(t('backToWorks', '返回作品总览 ↗')) + '</a></p></div>';
      return;
    }
    var list = VIS();
    var pos = list.indexOf(p);
    var next = list.length ? list[(pos < 0 ? 0 : pos + 1) % list.length] : p;
    document.title = isEN()
      ? (pTitle(p) + ' — ZENG WENZHUO Portfolio')
      : (p.title + ' — ' + DATA.owner.name + ' 作品集');
    document.documentElement.style.setProperty('--accent', p.accent);
    document.documentElement.style.setProperty('--accent-soft', p.accentSoft || '');

    var heroFull = p.coverHd ? AS('assets/hd/page-' + String(p.coverHd).padStart(4, '0') + '.jpg') : AS(p.cover);
    var meta = pMeta(p);

    root.innerHTML =
      '<section class="project-hero"><div class="wrap">' +
        '<div class="project-hero__head" data-reveal><div><h1>' + esc(pTitle(p)) + '</h1>' +
          '<div class="en">' + esc(isEN() ? p.title : p.en) + '</div></div>' +
          '<div class="idx">' + numOf(p) + ' / ' + String(TOTAL()).padStart(2, '0') + '<br>' + esc(catLabel(p)) + '<br>' + esc(p.pages) + '</div></div>' +
        '<div class="project-hero__media" data-reveal>' +
          '<div data-zoom="' + esc(heroFull) + '" data-caption="' + esc(pTitle(p)) + (isEN() ? ' · COVER' : ' · 项目封面') + '" style="width:100%;height:100%;cursor:zoom-in">' +
          '<img src="' + AS(p.cover) + '" alt="' + esc(pTitle(p)) + '" fetchpriority="high" decoding="async"></div>' +
          '<span class="zoom-hint">' + esc(t('zoomHint', '点击放大 · 高清原页')) + '</span></div>' +
        '<div class="project-hero__strap"><span>' + esc(pTagline(p)) + '</span><span>' + esc(p.slogan) + '</span></div>' +
        '<dl class="project-meta" data-reveal>' + meta.map(function (m) {
          return '<div><dt>' + esc(m.k) + '</dt><dd>' + esc(m.v) + '</dd></div>';
        }).join('') + '</dl>' +
      '</div></section>' +
      '<section class="wrap pblocks">' +
        '<div class="pblock project-lede" data-reveal>' +
          '<span class="eyebrow">' + esc(t('overviewLabel', 'PROJECT OVERVIEW')) + ' / ' + numOf(p) + ' — ' + esc(catLabel(p)) + '</span>' +
          pDescription(p).map(function (text) { return '<p>' + esc(text) + '</p>'; }).join('') + '</div>' +
        p.blocks.map(function (b) { return blockHTML(b, p); }).join('') +
      '</section>' +
      '<a class="next-project" href="' + PR(next.id) + '" style="--next-accent:' + esc(next.accent) + '">' +
        '<span class="next-project__label">' + esc(t('nextLabel', 'NEXT PROJECT')) + ' / ' + numOf(next) + ' — ' + esc(catLabel(next)) + '</span>' +
        '<div class="next-project__row"><h2>' + esc(pTitle(next)) + ' ↗</h2>' +
        '<span class="next-project__img"><img src="' + AS(next.cover) + '" alt="' + esc(pTitle(next)) + '" loading="lazy"></span></div>' +
        '<div class="next-project__en">' + esc(isEN() ? next.title : next.en) + ' · ' + esc(next.pages) + '</div></a>';
  }

  /* ------------------------------------------------------------ 语言切换 */
  function setLang(next, silent) {
    if (next !== 'en' && next !== 'zh') return;
    if (!langEnabled()) next = 'zh';
    if (next === LANG) return;
    LANG = next;
    try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
    /* 手动切换后去掉 ?lang=，让本次选择在刷新后仍然生效 */
    try {
      var u = new URL(location.href);
      if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(null, '', u); }
    } catch (e) {}
    document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
    var y = window.scrollY || window.pageYOffset || 0;
    applySiteText();
    buildHeader();
    buildFooter();
    renderHome();
    renderWorks();
    renderContents();
    renderProject();
    initReveal();
    window.scrollTo(0, y);
    document.dispatchEvent(new CustomEvent('portfolio:langchange', { detail: { lang: LANG, config: CFG } }));
    if (!silent) {
      var btn = document.getElementById('lang-switch');
      if (btn) btn.setAttribute('data-current', LANG);
    }
  }

  /* ------------------------------------------------------------ 启动 */
  function boot() {
    if (!Store) { console.error('portfolio-store.js 未加载'); return; }
    /* 双保险：即使存储层异常挂起，也用原始数据渲染，绝不白屏 */
    var fallback = new Promise(function (res) { setTimeout(function () { res(Store.defaults()); }, 2000); });
    Promise.race([Store.resolve(), fallback]).then(function (cfg) {
      CFG = cfg; DATA = cfg;
      LANG = langEnabled() ? savedLang() : 'zh';
      document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
      var root = document.getElementById('project-root');
      if (root && !root.dataset.project) root.dataset.project = new URLSearchParams(location.search).get('id') || '';
      applyVisual();
      applySiteText();
      buildHeader();
      buildFooter();
      renderHome();
      renderWorks();
      renderContents();
      renderProject();
      initScroll();
      initReveal();
      initLightbox();
      /* 语言切换：事件委托，header 重渲染后依然有效 */
      document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-lang]') : null;
        if (b) { e.preventDefault(); setLang(b.getAttribute('data-lang')); }
      });
      /* 供动效层挂接：前台内容已按最新配置渲染完毕 */
      window.__PORTFOLIO_RENDERED__ = cfg;
      document.dispatchEvent(new CustomEvent('portfolio:rendered', { detail: { config: cfg } }));
    }).catch(function (err) { console.error('配置加载失败', err); });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
