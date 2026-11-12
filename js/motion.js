/* =========================================================================
   第二阶段 · 沉浸式交互逻辑
   -------------------------------------------------------------------------
   · 完全独立于后台与数据层；不修改任何作品图片或项目内容
   · 默认不接管页面：只有启用动效时才给 <html> 加 motion-ready
   · 系统「减少动态效果」或后台关闭 → 立即降级为原始静态页面
   · 滚动相关统一走一个 rAF 循环；pointer 相关只在精确指针设备启用
   ========================================================================= */
(function () {
  'use strict';

  var html = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var isTouch = !fine.matches;
  var cfg = null, calm = false, domInited = false;
  var rafPending = false;
  var parallaxTargets = [], magnetTargets = [];
  var cursor = null, cursorDot = null, readout = null, narrative = null, overlay = null;
  var mx = -100, my = -100, cx = -100, cy = -100;

  /* ------------------------------------------------------------ 工具 */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function addClass(el, c) { if (el) el.classList.add(c); }
  function make(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  /* ------------------------------------------------------------ 启动 */
  function decide(c) {
    cfg = c || cfg;
    var m = (cfg && cfg.motion) || { enabled: true, intensity: 'normal' };
    if (reduced.matches || m.enabled === false) {
      html.classList.add('motion-off');
      html.classList.remove('motion-ready', 'motion-calm', 'motion-cursor');
      return false;
    }
    html.classList.remove('motion-off');
    html.classList.add('motion-ready');
    calm = m.intensity === 'calm';
    if (calm) html.classList.add('motion-calm'); else html.classList.remove('motion-calm');
    return true;
  }

  function initDom() {
    if (domInited || html.classList.contains('motion-off')) return;
    domInited = true;
    if (fine.matches && !calm) { initCursor(); initMagnetic(); initTilt(); }
    if (!isTouch) { initParallax(); initNarrative(); initReadout(); }
    initTransition();
    initLightboxTouch();
    startScrollLoop();
    window.addEventListener('resize', refreshRects, { passive: true });
  }

  /* ------------------------------------------------------------ 自定义光标 */
  function initCursor() {
    cursor = make('div', 'm-cursor');
    cursorDot = make('div', 'm-cursor-dot');
    body.appendChild(cursor); body.appendChild(cursorDot);
    html.classList.add('motion-cursor');

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      addClass(cursor, 'is-visible'); addClass(cursorDot, 'is-visible');
    }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('a, button, [data-zoom], [data-cursor]') : null;
      if (cursor) cursor.classList.toggle('is-hover', !!t);
      if (cursorDot) cursorDot.classList.toggle('is-hover', !!t);
    }, { passive: true });
    document.addEventListener('pointerleave', function () {
      if (cursor) cursor.classList.remove('is-visible');
      if (cursorDot) cursorDot.classList.remove('is-visible');
    }, { passive: true });
  }

  /* ------------------------------------------------------------ 磁吸按钮 */
  function initMagnetic() {
    var els = Array.from(document.querySelectorAll('.btn-outline, .nav a, .feat-row__arrow, .work-card__bar'));
    els.forEach(function (el) { el.classList.add('magnetic'); });
    magnetTargets = els.map(function (el) { return { el: el, rect: null }; });
    refreshRects();
  }
  function refreshRects() {
    /* 只缓存数量很少的磁吸元素；视差目标在 rAF 里按需取 rect，避免每帧重复布局计算 */
    magnetTargets.forEach(function (t) { t.rect = t.el.getBoundingClientRect(); });
  }

  /* ------------------------------------------------------------ 作品墙 3D 倾斜 */
  function initTilt() {
    Array.from(document.querySelectorAll('.work-card')).forEach(function (card) {
      card.addEventListener('pointerenter', function () { card.classList.add('is-tilting'); }, { passive: true });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        card.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-py * 4).toFixed(2) + 'deg');
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      }, { passive: true });
    });
  }

  /* ------------------------------------------------------------ 视差目标 */
  function initParallax() {
    var push = function (sel, prop, amp) {
      Array.from(document.querySelectorAll(sel)).forEach(function (img) {
        parallaxTargets.push({ el: img, prop: prop, amp: amp, rect: null, host: img.closest('.work-card__media, .project-hero__media, .divider-band') || img.parentElement });
      });
    };
    push('.work-card__media img', '--py', 10);
    push('.project-hero__media img', '--hero-py', 26);
    push('.divider-band img', '--band-py', 22);
    refreshRects();
  }

  /* ------------------------------------------------------------ 滚动叙事 */
  function initNarrative() {
    var blocksWrap = document.querySelector('.pblocks');
    if (!blocksWrap) return;
    var blocks = Array.from(blocksWrap.querySelectorAll('.pblock'));
    if (!blocks.length) return;

    narrative = make('div', 'm-narrative',
      '<span class="m-narrative__label">SCROLL / NARRATIVE</span>' +
      '<span class="m-narrative__track"><span class="m-narrative__fill"></span></span>' +
      '<span class="m-narrative__count">00 / ' + String(blocks.length).padStart(2, '0') + '</span>');
    body.appendChild(narrative);
    var fill = narrative.querySelector('.m-narrative__fill');
    var count = narrative.querySelector('.m-narrative__count');

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-narrating'); });
      }, { threshold: 0.12 });
      blocks.forEach(function (b) { io.observe(b); });
    } else {
      blocks.forEach(function (b) { b.classList.add('is-narrating'); });
    }

    narrative.update = function (y) {
      var r = blocksWrap.getBoundingClientRect();
      var total = Math.max(1, r.height);
      var p = clamp((window.innerHeight * .55 - r.top) / total, 0, 1);
      fill.style.height = (p * 150) + 'px';
      var idx = 0;
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].getBoundingClientRect().top < window.innerHeight * .55) idx = i + 1;
      }
      count.textContent = String(idx).padStart(2, '0') + ' / ' + String(blocks.length).padStart(2, '0');
      narrative.classList.toggle('is-visible', r.top < window.innerHeight * .5 && r.bottom > 0);
    };
  }

  /* ------------------------------------------------------------ 滚动读数 */
  function initReadout() {
    readout = make('div', 'm-scroll-readout', 'SCROLL / <b>000%</b>');
    body.appendChild(readout);
    readout.update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      readout.querySelector('b').textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
      readout.classList.toggle('is-visible', window.scrollY > 90);
    };
  }

  /* ------------------------------------------------------------ 单一滚动循环 */
  function startScrollLoop() {
    var tick = function () {
      rafPending = false;
      var y = window.scrollY || window.pageYOffset;
      // 光标插值
      if (cursor) {
        cx = lerp(cx, mx, .18); cy = lerp(cy, my, .18);
        cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
        cursorDot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      }
      // 磁吸
      if (magnetTargets.length && fine.matches) {
        magnetTargets.forEach(function (t) {
          if (!t.rect) return;
          var dx = mx - (t.rect.left + t.rect.width / 2);
          var dy = my - (t.rect.top + t.rect.height / 2);
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            t.el.classList.add('is-magnet');
            t.el.style.setProperty('--mx', (dx * .16).toFixed(1) + 'px');
            t.el.style.setProperty('--my', (dy * .16).toFixed(1) + 'px');
          } else if (t.el.classList.contains('is-magnet')) {
            t.el.classList.remove('is-magnet');
            t.el.style.setProperty('--mx', '0px');
            t.el.style.setProperty('--my', '0px');
          }
        });
      }
      // 图片视差
      if (!isTouch) {
        parallaxTargets.forEach(function (t) {
          var h = t.host || t.el.parentElement;
          var r = h.getBoundingClientRect();
          if (r.bottom < -100 || r.top > window.innerHeight + 100) return;
          var center = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
          t.el.style.setProperty(t.prop, (-clamp(center, -1, 1) * t.amp).toFixed(1) + 'px');
        });
      }
      if (narrative && narrative.update) narrative.update(y);
      if (readout && readout.update) readout.update();
      // 光标未收敛时继续插值，收敛后自动停止，避免常驻 rAF 耗电
      if (cursor && (Math.abs(cx - mx) > .4 || Math.abs(cy - my) > .4)) {
        rafPending = true;
        requestAnimationFrame(tick);
      }
    };
    var kick = function () {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(tick);
    };
    var onScroll = function () {
      /* 磁吸目标只随滚动改变位置，放在这里刷新可避免每帧强制布局 */
      if (magnetTargets.length) refreshRects();
      kick();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', function () { if (cursor) kick(); }, { passive: true });
    tick();
  }

  /* ------------------------------------------------------------ 页面转场 */
  function initTransition() {
    var KEY = 'zwz:transition';
    overlay = make('div', 'm-transition', '<span class="m-transition__label">ZENG WENZHUO / PORTFOLIO</span>');
    body.appendChild(overlay);

    var arriving = false;
    try { arriving = !!sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {}
    if (arriving) {
      // 新页面：从覆盖状态向上滑出，形成连续的纯色块过渡
      overlay.style.transition = 'none';
      overlay.classList.add('is-covering');
      requestAnimationFrame(function () {
        overlay.style.transition = '';
        overlay.classList.add('is-leaving');
        setTimeout(function () { overlay.classList.remove('is-covering', 'is-leaving'); }, 620);
      });
    }

    var navigating = false;
    document.addEventListener('click', function (e) {
      if (navigating || !overlay) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript|data):/i.test(href)) return;
      var url;
      try { url = new URL(href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      // 后台实时预览时保留 adminPreview 参数，确保 iframe 内仍读取草稿
      if (/adminPreview=1/.test(location.search) && !url.searchParams.has('adminPreview')) {
        url.searchParams.set('adminPreview', '1');
      }
      e.preventDefault();
      navigating = true;
      var label = overlay.querySelector('.m-transition__label');
      if (label) label.textContent = (a.getAttribute('data-transition-label') || 'ZENG WENZHUO / PORTFOLIO');
      try { sessionStorage.setItem(KEY, url.href); } catch (err2) {}
      overlay.classList.add('is-covering');
      setTimeout(function () { location.href = url.href; }, isTouch ? 280 : 460);
      // 导航失败兜底，避免遮罩卡住页面
      setTimeout(function () {
        if (navigating) { navigating = false; overlay.classList.remove('is-covering'); }
      }, 3000);
    }, false);

    /* 浏览器前进/后退时清掉遮罩；刚到达的页面不打断退出动画 */
    window.addEventListener('pageshow', function () {
      if (!arriving && overlay) overlay.classList.remove('is-covering', 'is-leaving');
    });
  }

  /* ------------------------------------------------------------ 灯箱触控 */
  function initLightboxTouch() {
    var box = document.getElementById('lightbox');
    if (!box) return;
    var sx = 0, sy = 0;
    box.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (!e.changedTouches || !e.changedTouches[0] || !box.classList.contains('is-open')) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
        var b = box.querySelector(dx < 0 ? '[data-lightbox-next]' : '[data-lightbox-prev]');
        if (b) b.click();
      } else if (dy > 95 && Math.abs(dy) > Math.abs(dx)) {
        var c = box.querySelector('[data-lightbox-close]');
        if (c) c.click();
      }
    }, { passive: true });
  }

  /* ------------------------------------------------------------ 语言切换后重绑
     切换中英时前台会原地重渲染列表与详情，元素被替换；这里把倾斜 / 视差 /
     磁吸 / 叙事进度重新绑到新节点上，避免动效在切换后失效。 */
  function rebindDynamic() {
    if (html.classList.contains('motion-off')) return;
    magnetTargets = [];
    parallaxTargets = [];
    Array.prototype.forEach.call(document.querySelectorAll('.magnetic'), function (el) {
      el.classList.remove('magnetic', 'is-magnet');
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    });
    if (fine.matches && !calm) { initMagnetic(); initTilt(); }
    if (!isTouch) {
      if (narrative && narrative.parentNode) narrative.parentNode.removeChild(narrative);
      narrative = null;
      initParallax();
      initNarrative();
    }
    refreshRects();
  }

  /* ------------------------------------------------------------ 生命周期 */
  function boot() {
    if (!window.PortfolioStore) { html.classList.add('motion-off'); return; }
    PortfolioStore.resolve().then(function (c) {
      /* 先只切换 <html> 状态类，让 CSS 尽早生效；DOM 相关初始化必须等 site.js 渲染完 */
      decide(c);
      var onRendered = function (ev) {
        var conf = (ev && ev.detail && ev.detail.config) || window.__PORTFOLIO_RENDERED__ || c;
        if (decide(conf)) initDom();
      };
      document.addEventListener('portfolio:rendered', onRendered);
      document.addEventListener('portfolio:langchange', rebindDynamic);
      if (window.__PORTFOLIO_RENDERED__) onRendered({ detail: { config: window.__PORTFOLIO_RENDERED__ } });
      /* 事件丢失兜底：确认前台内容已渲染才初始化，避免空列表 */
      setTimeout(function () {
        if (domInited) return;
        var ready = document.querySelector('#home-collage .collage__item, #work-grid .work-card, #project-root .pblocks, .about-grid');
        if (ready) initDom();
      }, 1200);
    }).catch(function () { html.classList.add('motion-off'); });
  }

  if (reduced.addEventListener) {
    reduced.addEventListener('change', function () {
      if (reduced.matches) {
        html.classList.add('motion-off');
        html.classList.remove('motion-ready', 'motion-calm');
      }
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
