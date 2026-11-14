/* =========================================================================
   admin-cloud.js — 管理后台云端接入（第四阶段）
   -------------------------------------------------------------------------
   职责（全部走 Supabase 公开 API，浏览器仅持有 anon key + 登录用户 JWT）：
   1. 管理员登录 / 会话管理（GoTrue REST：登录、刷新、校验、退出）
   2. 云端草稿读写（site_config.draft，revision 乐观锁，冲突绝不静默覆盖）
   3. 图片上传（私有桶 portfolio-uploads + media_assets 登记）
   4. 接入已部署的 publish Edge Function（test / production 两档）
   5. 发布状态 / 版本历史 / GitHub Actions 运行结果展示

   安全边界：
   - 本文件不出现任何 service_role / sb_secret_ / GitHub Token。
   - 未登录或非白名单账号：所有云端按钮禁用，本地编辑不受影响。
   - 云端保存失败时本地草稿已经落盘（先本地后云端），不会丢失修改。
   ========================================================================= */
(function () {
  'use strict';

  var CC = window.ZWZ_CLOUD;
  var Store = window.PortfolioStore;
  var LS_SESSION = 'zwz-cloud-session';
  var SS_MODE = 'zwz-cloud-mode';

  /* ------------------------------------------------------------ 状态 */
  var session = null;        /* {access_token, refresh_token, expMs, user:{id,email}} */
  var cloud = null;          /* {revision, published_revision, updated_at, updated_by, admin, draftEmpty} */
  var adminReady = false;    /* admin.js 草稿已载入 */
  var cloudReadyRan = false;
  var suspendAutoSync = false; /* 载入云端草稿后跳过一次回写，避免空转 */
  var state = {
    offline: false,
    publishing: null,        /* {version_id, revision, mode, trigger, startedAt} */
    watch: null,             /* 正在轮询的 version_id */
    pollTimer: null,
    pollTicks: 0,
    lastSync: null,          /* {ok, at, message, revision, reason} */
    syncing: false,
    pendingSave: false,
    mediaQueue: {},          /* key -> dataURL，待上传 */
    mediaErrors: {},         /* key -> 错误信息 */
    mediaTotal: 0,
    versions: [],
    publishMode: 'test',
    gateBusy: false
  };

  /* ------------------------------------------------------------ 工具 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    } catch (e) { return String(iso); }
  }
  function toast(msg, isErr) { if (window.ZwzAdmin) window.ZwzAdmin.toast(msg, isErr); else { var t = $('#toast'); if (t) { t.textContent = msg; t.classList.add('is-on'); } } }
  function isActive() { return !!session && !!cloud && !!cloud.admin && !state.offline; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dataUrlParts(dataUrl) {
    var m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(String(dataUrl));
    if (!m) return null;
    var bin;
    try { bin = atob(m[2]); } catch (e) { return null; }
    var len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    var extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    return { mime: m[1].toLowerCase(), bytes: bytes, ext: extMap[m[1].toLowerCase()] || 'jpg' };
  }
  function bytesToDataUrl(bytes, mime) {
    var bin = '';
    var CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return 'data:' + mime + ';base64,' + btoa(bin);
  }
  /* 键序无关的深度比较：云端 jsonb 往返会重排键序，不能用字符串比较 */
  function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== typeof b) return false;
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) { if (!deepEqual(a[i], b[i])) return false; }
      return true;
    }
    if (typeof a !== 'object') return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[j])) return false;
      if (!deepEqual(a[ka[j]], b[ka[j]])) return false;
    }
    return true;
  }
  function blobToDataUrl(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function (e) { res(e.target.result); };
      fr.onerror = function () { rej(new Error('图片读取失败')); };
      fr.readAsDataURL(blob);
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ------------------------------------------------------------ Auth */
  function authHeaders(tok) {
    return { apikey: CC.anonKey, Authorization: 'Bearer ' + tok };
  }
  function parseRes(res) {
    return res.text().then(function (t) {
      var b = null;
      try { b = t ? JSON.parse(t) : null; } catch (e) { b = t; }
      return { status: res.status, ok: res.ok, body: b };
    });
  }
  function saveSession() {
    try { localStorage.setItem(LS_SESSION, JSON.stringify(session)); } catch (e) {}
  }
  function clearSession() {
    session = null;
    try { localStorage.removeItem(LS_SESSION); } catch (e) {}
  }

  function login(email, password) {
    return fetch(CC.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: CC.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, gotrue_meta_security: { captcha_token: '' } })
    }).then(parseRes).then(function (r) {
      if (!r.ok) {
        var msg = (r.body && (r.body.msg || r.body.error_description || r.body.error)) || ('登录失败 HTTP ' + r.status);
        throw new Error(String(msg));
      }
      var b = r.body;
      session = {
        access_token: b.access_token,
        refresh_token: b.refresh_token,
        expMs: Date.now() + (Number(b.expires_in) || 3600) * 1000 - 60000,
        user: { id: b.user && b.user.id, email: b.user && b.user.email }
      };
      saveSession();
      return session;
    });
  }

  function refreshToken() {
    if (!session || !session.refresh_token) return Promise.reject(new Error('登录已过期，请重新登录'));
    return fetch(CC.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: CC.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(parseRes).then(function (r) {
      if (!r.ok) { clearSession(); showGate('登录已过期，请重新登录'); throw new Error('登录已过期'); }
      var b = r.body;
      session.access_token = b.access_token || session.access_token;
      if (b.refresh_token) session.refresh_token = b.refresh_token;
      session.expMs = Date.now() + (Number(b.expires_in) || 3600) * 1000 - 60000;
      saveSession();
      return session.access_token;
    });
  }

  function ensureToken() {
    if (!session) return Promise.reject(new Error('未登录'));
    if (session.expMs > Date.now()) return Promise.resolve(session.access_token);
    return refreshToken();
  }

  function validateSession() {
    return fetch(CC.url + '/auth/v1/user', { headers: authHeaders(session.access_token) })
      .then(parseRes).then(function (r) {
        if (!r.ok) return false;
        if (r.body && r.body.id) { session.user = { id: r.body.id, email: r.body.email }; saveSession(); }
        return true;
      });
  }

  function logout() {
    var tok = session && session.access_token;
    stopPolling();
    if (tok) {
      fetch(CC.url + '/auth/v1/logout', { method: 'POST', headers: authHeaders(tok) }).catch(function () {});
    }
    clearSession();
    cloud = null;
    state.lastSync = null; state.publishing = null; state.versions = [];
    state.mediaQueue = {}; state.mediaErrors = {};
    try { sessionStorage.removeItem(SS_MODE); } catch (e) {}
    renderChip();
    renderCloudIfActive();
    showGate();
    toast('已退出云端登录（本地草稿与离线编辑不受影响）');
  }

  /* ------------------------------------------------------------ REST */
  function rest(method, rel, body, extraHeaders) {
    return ensureToken().then(function (tok) {
      var h = { apikey: CC.anonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
      if (extraHeaders) Object.keys(extraHeaders).forEach(function (k) { h[k] = extraHeaders[k]; });
      return fetch(CC.url + '/rest/v1/' + rel, {
        method: method,
        headers: h,
        body: body == null ? undefined : JSON.stringify(body)
      });
    }).then(parseRes);
  }

  /* site_config 状态（不含 draft，轻量） */
  function fetchConfigStatus(withDraft) {
    var sel = withDraft
      ? 'id,draft,revision,published_revision,updated_at,updated_by'
      : 'id,revision,published_revision,updated_at,updated_by';
    return rest('GET', 'site_config?select=' + sel + '&id=eq.main').then(function (r) {
      if (!r.ok) throw new Error('读取云端配置失败 HTTP ' + r.status + (r.body && r.body.code ? ' (' + r.body.code + ')' : ''));
      var rows = Array.isArray(r.body) ? r.body : [];
      return rows[0] || null; /* 非白名单：RLS 过滤为空数组 */
    });
  }

  /* ------------------------------------------------------------ 登录门 / 初始化 */
  function injectGate() {
    if ($('#cloud-gate')) return;
    var el = document.createElement('div');
    el.className = 'cloud-gate';
    el.id = 'cloud-gate';
    el.innerHTML =
      '<div class="cloud-gate__box">' +
        '<div class="cloud-gate__brand">作品集管理后台 · ADMIN</div>' +
        '<div class="cloud-gate__title">管理员登录</div>' +
        '<div class="cloud-gate__sub">云端草稿同步与发布需要管理员账号；所有编辑仍会先保存到本地草稿。</div>' +
        '<div class="field"><label>邮箱 EMAIL</label>' +
          '<input class="input" id="gate-email" type="email" autocomplete="username" placeholder="admin@example.com"></div>' +
        '<div class="field"><label>密码 PASSWORD</label>' +
          '<input class="input" id="gate-pass" type="password" autocomplete="current-password" placeholder="••••••••"></div>' +
        '<div class="cloud-gate__msg" id="gate-msg"></div>' +
        '<button class="btn btn--primary btn--wide" id="gate-login">登录云端后台</button>' +
        '<button class="btn btn--wide" id="gate-offline">暂不登录 · 进入离线本地模式</button>' +
        '<div class="cloud-gate__hint">离线模式：全部原有本地功能可用（编辑 / 预览 / 导入导出 / 导出发布包 ZIP），' +
          '但云端草稿读写与云端发布不可用。云端故障时可随时用此模式继续编辑，本地备份即恢复手段。</div>' +
      '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('#gate-login')) submitGate();
      else if (e.target.closest('#gate-offline')) enterOffline();
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.target.id === 'gate-email' || e.target.id === 'gate-pass')) submitGate();
    });
  }

  function showGate(msg) {
    injectGate();
    var el = $('#cloud-gate');
    var m = $('#gate-msg');
    m.textContent = msg || '';
    m.classList.toggle('is-error', !!msg);
    el.style.display = 'flex';
    if (!state.gateBusy) { var em = $('#gate-email'); if (em) em.focus(); }
  }
  function hideGate() { var el = $('#cloud-gate'); if (el) el.style.display = 'none'; }

  function submitGate() {
    var email = ($('#gate-email') || {}).value || '';
    var password = ($('#gate-pass') || {}).value || '';
    if (!email || !password) { showGate('请输入邮箱与密码'); return; }
    state.gateBusy = true;
    $('#gate-login').disabled = true;
    $('#gate-msg').textContent = '正在登录…';
    $('#gate-msg').classList.remove('is-error');
    login(email.trim(), password).then(function () {
      return enterCloud();
    }).catch(function (err) {
      showGate(err.message || '登录失败');
    }).finally(function () {
      state.gateBusy = false;
      var b = $('#gate-login'); if (b) b.disabled = false;
    });
  }

  function enterOffline() {
    state.offline = true;
    try { sessionStorage.setItem(SS_MODE, 'offline'); } catch (e) {}
    hideGate();
    renderChip();
    renderCloudIfActive();
    toast('已进入离线本地模式：云端功能停用，本地编辑与备份导出可用');
  }

  /* 登录成功后：校验白名单 → 自动读云端草稿 */
  function enterCloud() {
    return fetchConfigStatus(true).then(function (row) {
      if (!row) {
        clearSession();
        showGate('该账号不在管理员白名单内，无法管理云端数据');
        throw new Error('not admin');
      }
      cloud = {
        revision: Number(row.revision) || 1,
        published_revision: row.published_revision,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
        admin: true,
        draft: row.draft
      };
      hideGate();
      renderChip();
      cloudReady();
      renderCloudIfActive();
      toast('已登录：' + (session.user.email || '管理员') + '（云端 r' + cloud.revision + '）');
      return true;
    }).catch(function (err) {
      if (String(err.message) === 'not admin') return false;
      /* 网络失败：保留登录态，允许离线编辑，云端稍后可用「刷新状态」重试 */
      hideGate();
      renderChip();
      toast('登录成功，但云端配置读取失败（' + (err.message || '网络错误') + '）。可先离线编辑，稍后在云端管理页刷新。', true);
      return false;
    });
  }

  function init() {
    injectGate();
    /* 侧栏云状态芯片 */
    var side = $('#side-status');
    if (side && !$('#cloud-chip')) {
      var chip = document.createElement('div');
      chip.id = 'cloud-chip';
      chip.className = 'cloud-chip';
      side.insertBefore(chip, side.firstChild);
    }
    var mode = null;
    try { mode = sessionStorage.getItem(SS_MODE); } catch (e) {}
    if (mode === 'offline') { state.offline = true; renderChip(); renderCloudIfActive(); return; }
    var raw = null;
    try { raw = localStorage.getItem(LS_SESSION); } catch (e) {}
    if (raw) {
      try { session = JSON.parse(raw); } catch (e) { session = null; clearSession(); }
    }
    if (session && session.access_token) {
      showGate('');
      $('#gate-msg').textContent = '正在恢复登录…';
      validateSession().then(function (ok) {
        if (ok) return enterCloud();
        return refreshToken().then(function () { return enterCloud(); }).catch(function () {
          clearSession(); showGate('登录已过期，请重新登录');
        });
      }).catch(function () { showGate('登录恢复失败，请重新登录'); });
    } else {
      showGate();
    }
    /* 云端视图的事件代理（section 节点常驻，innerHTML 重建不影响） */
    var view = $('#view-cloud');
    if (view) {
      view.addEventListener('click', onCloudClick);
      view.addEventListener('change', onCloudChange);
    }
  }

  /* ------------------------------------------------------------ admin.js 桥回调 */
  function onDraftLoaded() { adminReady = true; cloudReady(); }

  function cloudReady() {
    if (cloudReadyRan || !adminReady || !isActive()) return;
    cloudReadyRan = true;
    var draft = cloud && cloud.draft;
    var hasCloud = draft && Array.isArray(draft.projects) && draft.projects.length > 0;
    if (!hasCloud) {
      var local = draftPayload();
      var hasLocal = local && Array.isArray(local.projects) && local.projects.length > 0;
      if (hasLocal) {
        dialog('云端草稿为空',
          '云端还没有保存过草稿（revision r' + cloud.revision + '）。是否把<b>当前本地草稿</b>上传到云端？<br>' +
          '<span class="hint">上传后其他设备登录即可读取；本地草稿保持不变。</span>',
          [
            { label: '上传到云端', act: 'ed-upload', cls: 'btn--primary' },
            { label: '暂不', act: 'ed-skip' }
          ]);
      }
      auditMedia();
    } else {
      var same = deepEqual(draft, draftPayload());
      if (same) { state.lastSync = { ok: true, at: new Date().toISOString(), revision: cloud.revision, message: '云端草稿与本地一致' }; renderCloudIfActive(); auditMedia(); }
      else {
        dialog('检测到云端草稿',
          '云端保存有草稿（r' + cloud.revision + '，更新于 ' + esc(fmtTime(cloud.updated_at)) + '），与当前本地草稿不一致。<br>' +
          '<span class="hint">载入云端会替换本地草稿（替换前自动进入撤销历史，可撤销）；保留本地则下次保存时会覆盖云端。</span>',
          [
            { label: '载入云端草稿', act: 'pd-load', cls: 'btn--primary' },
            { label: '保留本地草稿', act: 'pd-keep' }
          ]);
      }
    }
  }

  /* ------------------------------------------------------------ 云端草稿读写 */
  function draftPayload() {
    if (!window.ZwzAdmin) return null;
    var c = clone(window.ZwzAdmin.getCfg());
    if (!c) return null;
    /* 云端草稿不携带 dataURL 图片：图片存私有桶 + media_assets，
       发布时由 Actions 下载并物化为 assets/uploads/<key>.<ext> */
    c.media = {};
    delete c._savedAt;
    return c;
  }

  function onLocalSave() {
    if (suspendAutoSync) { suspendAutoSync = false; return; }
    if (!isActive()) return;
    clearTimeout(onLocalSave._t);
    onLocalSave._t = setTimeout(function () { saveDraftToCloud('auto'); }, 1500);
  }

  function saveDraftToCloud(reason) {
    if (!isActive()) { toast('未登录云端，草稿仅保存在本地', true); return Promise.resolve({ skipped: true }); }
    if (state.syncing) { state.pendingSave = true; return Promise.resolve({ queued: true }); }
    state.syncing = true;
    renderCloudIfActive();
    var myRev = cloud.revision;
    var payload = draftPayload();
    if (!payload) { state.syncing = false; return Promise.resolve({ skipped: true }); }
    return rest('PATCH',
      'site_config?id=eq.main&revision=eq.' + myRev,
      { draft: payload, revision: myRev + 1, updated_by: session.user.id, updated_at: new Date().toISOString() },
      { Prefer: 'return=representation' }
    ).then(function (r) {
      if (r.status === 401) { /* token 失效：置 pending 由 finally 统一重试，避免同步并发 */ state.pendingSave = true; return { ok: false, retry: true }; }
      if (r.status === 42501 || r.status === 403) throw new Error('无云端写入权限（账号可能已被移出白名单）');
      var rows = Array.isArray(r.body) ? r.body : [];
      if (r.ok && rows.length > 0) {
        cloud.revision = Number(rows[0].revision) || (myRev + 1);
        cloud.updated_at = rows[0].updated_at || new Date().toISOString();
        state.lastSync = { ok: true, at: new Date().toISOString(), revision: cloud.revision, reason: reason };
        renderCloudIfActive(); renderChip();
        if (reason !== 'auto') toast('草稿已保存到云端（r' + cloud.revision + '）');
        return { ok: true, revision: cloud.revision };
      }
      /* 0 行 = revision 乐观锁冲突：绝不静默覆盖 */
      return fetchConfigStatus(false).then(function (row) {
        if (!row) throw new Error('云端配置读取失败');
        var newRev = Number(row.revision) || (myRev + 1);
        return new Promise(function (res) {
          state.conflict = { remote: newRev, remoteAt: row.updated_at };
          dialog('版本冲突',
            '云端草稿已被其他设备更新：<b>r' + newRev + '</b>（' + esc(fmtTime(row.updated_at)) + '），' +
            '本地基于 r' + myRev + '。<br><span class="hint">不会自动覆盖。请选择：载入云端（丢弃本地未同步修改，可先在「数据安全」导出配置 JSON 备份）、或以本地为准覆盖云端。</span>',
            [
              { label: '载入云端草稿', act: 'cf-load', cls: 'btn--primary' },
              { label: '用本地覆盖云端', act: 'cf-overwrite' },
              { label: '取消', act: 'cf-cancel' }
            ]);
          res({ ok: false, conflict: true });
        });
      });
    }).catch(function (err) {
      state.lastSync = { ok: false, at: new Date().toISOString(), message: err.message || '网络错误' };
      renderCloudIfActive();
      toast('云端保存失败：' + (err.message || '网络错误') + '。本地草稿已保存，不会丢失。', true);
      return { ok: false, error: err.message };
    }).finally(function () {
      state.syncing = false;
      if (state.pendingSave) { state.pendingSave = false; saveDraftToCloud('auto'); }
    });
  }

  /* 载入云端草稿（含媒体重建） */
  function loadCloudDraft() {
    if (!isActive()) { toast('未登录云端', true); return; }
    toast('正在从云端载入草稿…');
    fetchConfigStatus(true).then(function (row) {
      if (!row || !row.draft || !Array.isArray(row.draft.projects) || row.draft.projects.length === 0) {
        toast('云端草稿为空，没有可载入的内容', true);
        return;
      }
      cloud.revision = Number(row.revision) || cloud.revision;
      var obj = row.draft;
      obj.media = obj.media || {};
      var keys = collectMediaRefs(obj);
      var missing = keys.filter(function (k) {
        return !(typeof obj.media[k] === 'string' && obj.media[k].indexOf('data:image/') === 0);
      });
      var finish = function () {
        try {
          var cfgObj = Store.fromJSON(JSON.stringify(obj));
          suspendAutoSync = true;
          window.ZwzAdmin.replaceCfg(cfgObj, '已载入云端草稿（r' + cloud.revision + '）');
          state.lastSync = { ok: true, at: new Date().toISOString(), revision: cloud.revision, message: '已载入云端草稿' };
          renderCloudIfActive();
        } catch (err) {
          toast('云端草稿解析失败：' + err.message, true);
        }
      };
      if (missing.length === 0) { finish(); return; }
      toast('正在下载 ' + missing.length + ' 张云端图片…');
      var inFilter = missing.map(function (k) { return '"' + k + '"'; }).join(',');
      rest('GET', 'media_assets?select=media_key,storage_path,mime&media_key=in.(' + encodeURIComponent(inFilter) + ')')
        .then(function (r) {
          var rows = (r.ok && Array.isArray(r.body)) ? r.body : [];
          var byKey = {};
          rows.forEach(function (x) { byKey[x.media_key] = x; });
          var chain = Promise.resolve();
          var got = 0, fail = 0;
          missing.forEach(function (k) {
            var row = byKey[k];
            if (!row) { fail++; return; }
            chain = chain.then(function () {
              return downloadObject(row.storage_path).then(function (blob) {
                return blobToDataUrl(blob).then(function (dataUrl) {
                  obj.media[k] = dataUrl; got++;
                });
              }).catch(function () { fail++; });
            });
          });
          return chain.then(function () {
            if (fail) toast('有 ' + fail + ' 张云端图片下载失败（对应位置将显示占位），可稍后重试', true);
            finish();
          });
        }).catch(function () { finish(); });
    }).catch(function (err) {
      toast('云端草稿读取失败：' + (err.message || '网络错误'), true);
    });
  }

  function downloadObject(storagePath) {
    return ensureToken().then(function (tok) {
      var enc = String(storagePath).split('/').map(encodeURIComponent).join('/');
      return fetch(CC.url + '/storage/v1/object/' + CC.bucket + '/' + enc, {
        headers: { apikey: CC.anonKey, Authorization: 'Bearer ' + tok }
      });
    }).then(function (res) {
      if (!res.ok) throw new Error('Storage 下载失败 HTTP ' + res.status);
      return res.blob();
    });
  }

  /* ------------------------------------------------------------ 媒体同步 */
  function collectMediaRefs(cfg) {
    var used = {};
    function scan(o) {
      if (Array.isArray(o)) { o.forEach(scan); return; }
      if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { scan(o[k]); }); return; }
      if (typeof o === 'string' && o.indexOf('media:') === 0) used[o.slice(6)] = true;
    }
    scan(cfg.projects); scan(cfg.trash); scan(cfg.site); scan(cfg.dividers); scan(cfg.owner);
    if (cfg.cover && cfg.cover.indexOf('media:') === 0) used[cfg.cover.slice(6)] = true;
    if (cfg.closing && cfg.closing.indexOf('media:') === 0) used[cfg.closing.slice(6)] = true;
    return Object.keys(used);
  }

  /* 新上传图片钩子：本地已存 dataURL，排队异步上云 */
  function onMediaAdded(key, dataUrl) {
    if (!isActive()) return;
    state.mediaQueue[key] = dataUrl;
    delete state.mediaErrors[key];
    clearTimeout(onMediaAdded._t);
    onMediaAdded._t = setTimeout(syncMedia, 800);
  }

  /* 登录后审计：本地引用了但云端未登记的图片 → 补传 */
  function auditMedia() {
    if (!isActive() || !window.ZwzAdmin) return;
    var cfg = window.ZwzAdmin.getCfg();
    if (!cfg) return;
    var refs = collectMediaRefs(cfg);
    var candidates = refs.filter(function (k) {
      return typeof cfg.media[k] === 'string' && cfg.media[k].indexOf('data:image/') === 0;
    });
    if (candidates.length === 0) return;
    var inFilter = candidates.map(function (k) { return '"' + k + '"'; }).join(',');
    rest('GET', 'media_assets?select=media_key&media_key=in.(' + encodeURIComponent(inFilter) + ')').then(function (r) {
      var rows = (r.ok && Array.isArray(r.body)) ? r.body : [];
      var reg = {};
      rows.forEach(function (x) { reg[x.media_key] = true; });
      var added = 0;
      candidates.forEach(function (k) {
        if (!reg[k] && !state.mediaQueue[k]) { state.mediaQueue[k] = cfg.media[k]; added++; }
      });
      if (added) { toast('正在同步 ' + added + ' 张图片到云端…'); syncMedia(); }
    }).catch(function () { /* 审计失败不阻塞编辑 */ });
  }

  function syncMedia() {
    if (!isActive()) return;
    var keys = Object.keys(state.mediaQueue);
    if (keys.length === 0) { renderCloudIfActive(); return; }
    state.mediaTotal = keys.length;
    var chain = Promise.resolve();
    var done = 0, failed = 0;
    keys.forEach(function (key) {
      chain = chain.then(function () {
        var dataUrl = state.mediaQueue[key];
        var parts = dataUrlParts(dataUrl);
        if (!parts) { delete state.mediaQueue[key]; return Promise.resolve(); }
        var path = 'u/' + key + '.' + parts.ext;
        var enc = path.split('/').map(encodeURIComponent).join('/');
        return ensureToken().then(function (tok) {
          return fetch(CC.url + '/storage/v1/object/' + CC.bucket + '/' + enc, {
            method: 'POST',
            headers: {
              apikey: CC.anonKey,
              Authorization: 'Bearer ' + tok,
              'Content-Type': parts.mime,
              'x-upsert': 'true'
            },
            body: new Blob([parts.bytes], { type: parts.mime })
          });
        }).then(function (res) {
          if (!res.ok) throw new Error('Storage 上传 HTTP ' + res.status);
          /* 登记到 media_assets（published 列前端无权也无需写） */
          return rest('POST', 'media_assets', {
            media_key: key, storage_path: path, mime: parts.mime,
            bytes: parts.bytes.length, uploaded_by: session.user.id
          }, { Prefer: 'return=representation' }).then(function (r) {
            if (r.status === 409) {
              /* 已登记（如另一设备传过）→ 仅刷新元数据 */
              return rest('PATCH', 'media_assets?media_key=eq.' + encodeURIComponent(key),
                { storage_path: path, mime: parts.mime, bytes: parts.bytes.length });
            }
            if (!r.ok && r.status !== 201) throw new Error('media_assets 登记 HTTP ' + r.status);
            return r;
          });
        }).then(function () {
          delete state.mediaQueue[key];
          delete state.mediaErrors[key];
          done++;
        }).catch(function (err) {
          state.mediaErrors[key] = err.message || '上传失败';
          failed++;
        }).then(function () {
          renderCloudIfActive();
        });
      });
    });
    chain.then(function () {
      if (done && !failed) toast('已同步 ' + done + ' 张图片到云端私有桶');
      else if (failed) toast('图片同步：成功 ' + done + ' 张，失败 ' + failed + ' 张（可在本页重试）', true);
      renderCloudIfActive();
    });
  }

  /* ------------------------------------------------------------ 云端发布 */  function prechecks(mode) {
    var list = [];
    list.push({ name: '管理员登录', pass: isActive(), note: isActive() ? (session.user.email || '已登录') : '未登录云端' });
    list.push({ name: '本地草稿完整', pass: !!(window.ZwzAdmin && window.ZwzAdmin.getCfg() && window.ZwzAdmin.getCfg().projects.length), note: '本地草稿先落盘' });
    var syncOk = !!(state.lastSync && state.lastSync.ok);
    list.push({ name: '云端草稿已同步', pass: syncOk, note: syncOk ? 'r' + state.lastSync.revision : '发布前会先保存云端草稿' });
    var mediaOk = Object.keys(state.mediaQueue).length === 0 && Object.keys(state.mediaErrors).length === 0;
    list.push({ name: '图片全部同步', pass: mediaOk, note: mediaOk ? '无待同步图片' : (Object.keys(state.mediaQueue).length + Object.keys(state.mediaErrors).length + ' 张待同步/失败') });
    list.push({ name: '模式确认', pass: true, note: mode === 'production' ? 'production：发布到 main，影响正式站点' : 'test：cloud-test 分支隔离验证' });
    return list;
  }

  function startPublish() {
    var mode = state.publishMode || 'test';
    if (!isActive()) { toast('请先登录管理员账号', true); return; }
    if (state.syncing) { toast('草稿正在同步，请稍候', true); return; }

    var run = function () {
      var checks = prechecks(mode);
      state.lastChecks = checks;
      var bad = checks.filter(function (c) { return !c.pass && c.name !== '云端草稿已同步' && c.name !== '图片全部同步'; });
      if (bad.length) { toast('发布前检查未通过：' + bad.map(function (c) { return c.name; }).join('、'), true); renderCloudIfActive(); return; }

      var pendingMedia = Object.keys(state.mediaQueue).length + Object.keys(state.mediaErrors).length;
      if (pendingMedia > 0) {
        dialog('有图片未同步',
          '还有 ' + pendingMedia + ' 张图片未同步到云端。未同步的图片不会出现在线上站点。' +
          '<br><span class="hint">建议先同步图片再发布。</span>',
          [
            { label: '先同步图片', act: 'pub-sync-media', cls: 'btn--primary' },
            { label: '跳过并继续发布', act: 'pub-force', cls: 'btn--danger' }
          ]);
        return;
      }
      if (mode === 'production') {
        dialog('⚠️ 正式发布确认',
          'production 模式会把当前云端草稿发布到 <b>main 分支并更新正式站点</b>。<br>' +
          '<span class="hint">本阶段约定：production 发布前必须获得项目所有者明确确认。</span>',
          [
            { label: '确认正式发布', act: 'pub-force', cls: 'btn--danger' },
            { label: '取消', act: 'dlg-close' }
          ]);
      } else {
        dialog('发布确认（test 模式）',
          '将触发云端构建：<b>cloud-test 分支隔离验证</b>，不影响正式站点。<br>' +
          '<span class="hint">Actions 会下载私有桶图片、生成静态产物并回写状态，全程约 1-3 分钟。</span>',
          [
            { label: '开始发布', act: 'pub-force', cls: 'btn--primary' },
            { label: '取消', act: 'dlg-close' }
          ]);
      }
    };
    run();
  }

  /* ------------------------------------------------------------ 版本历史 / 轮询 */
  function refreshVersions() {
    if (!isActive()) return Promise.resolve([]);
    return rest('GET', 'site_versions?select=id,revision,status,created_at,finished_at,github_run_id,error,triggered_by&order=created_at.desc&limit=10')
      .then(function (r) {
        state.versions = (r.ok && Array.isArray(r.body)) ? r.body : [];
        renderCloudIfActive();
        return state.versions;
      }).catch(function () { return state.versions; });
  }

  function stopPolling() {
    state.watch = null; state.pollTicks = 0;
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function watchVersion(vid) {
    stopPolling();
    state.watch = vid;
    state.pollTimer = setInterval(function () {
      if (!state.watch || !isActive()) { stopPolling(); return; }
      state.pollTicks++;
      if (state.pollTicks > 120) { stopPolling(); toast('发布状态轮询超时（12 分钟），请稍后手动刷新版本列表', true); return; }
      rest('GET', 'site_versions?select=id,revision,status,created_at,finished_at,github_run_id,error,triggered_by&id=eq.' + encodeURIComponent(vid))
        .then(function (r) {
          var row = (r.ok && Array.isArray(r.body)) ? r.body[0] : null;
          if (!row) return;
          var idx = state.versions.findIndex(function (v) { return v.id === vid; });
          if (idx >= 0) state.versions[idx] = row; else state.versions.unshift(row);
          if (state.publishing && state.publishing.version_id === vid) state.publishing.status = row.status;
          if (row.status === 'success' || row.status === 'failed') {
            stopPolling();
            if (state.publishing && state.publishing.version_id === vid) {
              if (row.status === 'success') toast('云端发布成功 ✓（r' + row.revision + '，Actions run ' + (row.github_run_id || '—') + '）');
              else toast('云端发布失败：' + (row.error || '构建失败'), true);
              state.publishing.finished = true;
            }
          }
          renderCloudIfActive();
        }).catch(function () { /* 网络抖动，下次再试 */ });
    }, 6000);
  }

  /* ------------------------------------------------------------ 云端视图渲染 */
  function statusBadge(s) {
    var map = {
      pending: ['待处理', 'b-muted'],
      building: ['构建中', 'b-build'],
      success: ['成功', 'b-ok'],
      failed: ['失败', 'b-err']
    };
    var m = map[s] || [s || '—', 'b-muted'];
    return '<span class="vbadge ' + m[1] + '">' + esc(m[0]) + '</span>';
  }

  function syncStateHtml() {
    if (!isActive()) return '<span class="sync-off">离线 / 未登录</span>';
    if (state.syncing) return '<span class="sync-busy">正在同步…</span>';
    if (!state.lastSync) return '<span class="sync-off">尚未同步</span>';
    if (state.lastSync.ok) return '<span class="sync-ok">已同步 · r' + state.lastSync.revision + ' · ' + esc(fmtTime(state.lastSync.at)) + '</span>';
    return '<span class="sync-err">同步失败 · ' + esc(state.lastSync.message || '未知错误') + ' · ' + esc(fmtTime(state.lastSync.at)) + '</span>';
  }

  function renderCloudIfActive() {
    if (window.ZwzAdmin && window.ZwzAdmin.getView() === 'cloud') renderView();
  }

  function renderView() {
    var box = $('#view-cloud');
    if (!box) return;
    var html = '';

    /* —— 登录状态 —— */
    html += '<div class="card"><div class="card__head"><h2>云端登录</h2><span class="hint">Supabase Auth · 白名单管理员</span></div>';
    if (state.offline || !session) {
      html += '<div class="kv">' +
        '<span class="k">当前状态</span><b>' + (state.offline ? '离线本地模式' : '未登录') + '</b>' +
        '<span class="k">说明</span><span>云端草稿读写与云端发布需要管理员账号。本地编辑不受影响。</span>' +
        '</div><div class="chips" style="margin-top:14px">' +
        '<button class="btn btn--primary" data-cloudact="login">登录云端后台</button></div>';
    } else {
      html += '<div class="kv">' +
        '<span class="k">账号</span><b>' + esc(session.user.email || session.user.id) + '</b>' +
        '<span class="k">身份</span><span>' + (isActive() ? '<span class="sync-ok">管理员（白名单）</span>' : '<span class="sync-err">非白名单，云端功能停用</span>') + '</span>' +
        '<span class="k">云端项目</span><span class="mono">' + esc(CC.url.replace('https://', '')) + '</span>' +
        '</div><div class="chips" style="margin-top:14px">' +
        '<button class="btn" data-cloudact="refresh">↻ 刷新云端状态</button>' +
        '<button class="btn btn--danger" data-cloudact="logout">退出登录</button></div>';
    }
    html += '</div>';

    if (isActive()) {
      /* —— 云端草稿 —— */
      html += '<div class="card"><div class="card__head"><h2>云端草稿</h2><span class="hint">' + syncStateHtml() + '</span>' +
        '<div class="right"><button class="btn btn--sm" data-cloudact="refresh">↻</button></div></div>' +
        '<div class="kv">' +
          '<span class="k">云端 revision</span><b>r' + cloud.revision + '</b>' +
          '<span class="k">已发布 revision</span><span>' + (cloud.published_revision == null ? '未发布' : 'r' + cloud.published_revision) + '</span>' +
          '<span class="k">云端更新时间</span><span>' + esc(fmtTime(cloud.updated_at)) + '</span>' +
          '<span class="k">草稿内容</span><span>文字 / 排序 / 分类 / 视觉设置 / 显示状态（图片存私有桶，不占草稿体积）</span>' +
        '</div>' +
        '<div class="chips" style="margin-top:14px">' +
          '<button class="btn btn--primary" data-cloudact="save-now" ' + (state.syncing ? 'disabled' : '') + '>☁ 立即保存到云端</button>' +
          '<button class="btn" data-cloudact="load-cloud">↓ 从云端载入草稿</button>' +
        '</div>' +
        '<div class="hint" style="margin-top:12px">每次本地保存后会自动同步云端（带 1.5 秒防抖）。' +
        '保存失败时本地草稿已先落盘，不会丢失；多设备并发修改由 revision 乐观锁保护，冲突时会弹窗让你选择，绝不静默覆盖。</div>' +
        '</div>';

      /* —— 图片同步 —— */
      var qn = Object.keys(state.mediaQueue).length;
      var en = Object.keys(state.mediaErrors).length;
      html += '<div class="card"><div class="card__head"><h2>图片云端同步</h2><span class="hint">私有桶 ' + esc(CC.bucket) + ' · media_assets 登记</span></div>';
      if (qn === 0 && en === 0) {
        html += '<div class="kv"><span class="k">状态</span><span class="sync-ok">全部同步完成</span></div>';
      } else {
        html += '<div class="kv"><span class="k">待上传</span><b>' + qn + ' 张</b>' +
          '<span class="k">失败</span><span class="sync-err">' + en + ' 张</span></div>';
        if (en) {
          html += '<div class="media-err-list">' + Object.keys(state.mediaErrors).map(function (k) {
            return '<div class="media-err-row"><span class="mono">' + esc(k) + '</span><span>' + esc(state.mediaErrors[k]) + '</span></div>';
          }).join('') + '</div>';
        }
        html += '<div class="chips" style="margin-top:14px"><button class="btn btn--primary" data-cloudact="media-retry">↻ 重试图片同步</button></div>';
      }
      html += '<div class="hint" style="margin-top:12px">上传的图片保存在云端私有桶，浏览器不持有任何 service 密钥；' +
        '发布时由 GitHub Actions 用服务端密钥下载并物化为 <code>assets/uploads/</code> 静态文件。本地备份 / 配置 JSON 导出仍是故障恢复手段。</div></div>';

      /* —— 云端发布 —— */
      html += '<div class="card"><div class="card__head"><h2>云端发布</h2><span class="hint">publish Edge Function · GitHub Actions</span></div>';
      var p = state.publishing;
      if (p) {
        var secs = Math.max(0, Math.round((Date.now() - p.startedAt) / 1000));
        html += '<div class="publish-live ' + (p.finished ? (p.status === 'success' ? 'is-ok' : 'is-err') : 'is-busy') + '">' +
          '<div class="publish-live__row"><b>' + (p.mode === 'production' ? 'PRODUCTION' : 'TEST') + ' 发布</b>' +
          statusBadge(p.status || 'building') + '<span class="mono">r' + p.revision + ' · ' + esc(String(p.version_id).slice(0, 8)) + '…</span></div>' +
          '<div class="publish-live__row hint">触发方式：' + esc(p.trigger) + ' · 已进行 ' + secs + ' 秒 · 每 6 秒自动刷新状态</div>' +
          '</div>';
      }
      html += '<div class="field" style="max-width:340px"><label>发布模式 MODE</label>' +
        '<select class="select" id="publish-mode">' +
        '<option value="test"' + (state.publishMode !== 'production' ? ' selected' : '') + '>test — cloud-test 分支隔离验证（不影响正式站点）</option>' +
        '<option value="production"' + (state.publishMode === 'production' ? ' selected' : '') + '>production — 发布 main 分支 / 正式站点（需二次确认）</option>' +
        '</select></div>';
      if (state.lastChecks) {
        html += '<div class="precheck-list">' + state.lastChecks.map(function (c) {
          return '<div class="precheck-item"><span>' + (c.pass ? '✓' : '✗') + '</span><b>' + esc(c.name) + '</b><span class="hint">' + esc(c.note) + '</span></div>';
        }).join('') + '</div>';
      }
      html += '<div class="chips" style="margin-top:14px">' +
        '<button class="btn btn--accent" data-cloudact="publish"' + (state.syncing ? ' disabled' : '') + '>🚀 开始云端发布</button>' +
        '<button class="btn" data-cloudact="refresh-versions">↻ 刷新版本历史</button>' +
        '<a class="btn" href="' + esc(CC.pagesUrl) + '" target="_blank" rel="noopener">在线站点 ↗</a>' +
        '</div>' +
        '<div class="hint" style="margin-top:12px">发布前会自动：保存本地草稿 → 同步云端草稿 → 检查图片同步 → 调用已部署的 publish 函数（服务端验证白名单与防重复）。' +
        '本阶段验收使用 test 模式；<b>production 发布到 main 需项目所有者明确确认后才会执行</b>。</div>' +
        '</div>';

      /* —— 版本历史 —— */
      html += '<div class="card"><div class="card__head"><h2>发布版本历史</h2><span class="hint">site_versions · 最近 10 条</span>' +
        '<div class="right"><button class="btn btn--sm" data-cloudact="refresh-versions">↻ 刷新</button></div></div>';
      if (!state.versions.length) {
        html += '<div class="empty">暂无发布版本记录</div>';
      } else {
        html += '<div class="ver-table">' + state.versions.map(function (v) {
          var runLink = v.github_run_id
            ? '<a href="https://github.com/' + esc(CC.githubOwner) + '/' + esc(CC.githubRepo) + '/actions/runs/' + esc(String(v.github_run_id)) + '" target="_blank" rel="noopener">run ' + esc(String(v.github_run_id)) + ' ↗</a>'
            : '<span class="hint">—</span>';
          var err = v.status === 'failed' && v.error ? '<div class="ver-err">' + esc(v.error) + '</div>' : '';
          var watchBtn = (v.status === 'pending' || v.status === 'building')
            ? ' <button class="btn btn--sm" data-cloudact="watch" data-vid="' + esc(v.id) + '">跟踪</button>' : '';
          return '<div class="ver-row">' +
            '<div class="ver-row__main"><b class="mono">r' + v.revision + '</b>' + statusBadge(v.status) +
            '<span class="hint mono">' + esc(String(v.id).slice(0, 8)) + '…</span>' + watchBtn + '</div>' +
            '<div class="ver-row__meta hint">' + esc(fmtTime(v.created_at)) + ' → ' + esc(fmtTime(v.finished_at)) + ' · ' + runLink + '</div>' +
            err + '</div>';
        }).join('') + '</div>';
      }
      html += '</div>';

      if (location.protocol === 'file:') {
        html += '<div class="card"><div class="help-block warn"><b>当前以 file:// 打开：</b>登录与草稿同步可用，' +
          '但云端发布函数会拒绝 file:// 来源（Origin 校验）。请用本地静态服务器打开后台：<code>python3 -m http.server 8765</code>。</div></div>';
      }
    }

    /* —— 说明 —— */
    html += '<div class="card"><div class="card__head"><h2>云端链路说明</h2></div><div class="help-block">' +
      '<div>保存链路：后台编辑 → 本地草稿（IndexedDB，先落盘）→ Supabase <code>site_config.draft</code>（revision 乐观锁）。</div>' +
      '<div>发布链路：publish Edge Function（服务端白名单校验）→ 版本快照 <code>site_versions</code> → GitHub Actions 构建 → 状态回写。</div>' +
      '<div>密钥边界：浏览器只持有 anon key 与登录 JWT；service 密钥与 GitHub Token 仅存在于服务端运行环境。</div>' +
      '</div></div>';

    box.innerHTML = html;
  }

  /* ------------------------------------------------------------ 侧栏芯片 */
  function renderChip() {
    var chip = $('#cloud-chip');
    if (!chip) return;
    if (state.offline || !session) {
      chip.className = 'cloud-chip is-off';
      chip.textContent = state.offline ? '☁ 离线本地模式' : '☁ 未登录云端';
    } else if (isActive()) {
      chip.className = 'cloud-chip is-on';
      chip.textContent = '☁ 云端在线 · r' + (cloud ? cloud.revision : '?');
    } else {
      chip.className = 'cloud-chip is-err';
      chip.textContent = '☁ 已登录 · 非管理员';
    }
  }

  /* ------------------------------------------------------------ 对话框 */
  function dialog(title, bodyHtml, buttons) {
    var old = $('.cloud-dlg'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.className = 'cloud-dlg';
    ov.innerHTML = '<div class="cloud-dlg__box">' +
      '<div class="cloud-dlg__title">' + title + '</div>' +
      '<div class="cloud-dlg__body">' + bodyHtml + '</div>' +
      '<div class="cloud-dlg__ops">' + buttons.map(function (b, i) {
        return '<button class="btn ' + (b.cls || '') + '" data-dlg="' + i + '">' + esc(b.label) + '</button>';
      }).join('') + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-dlg]');
      if (btn) {
        var act = buttons[Number(btn.dataset.dlg)].act;
        ov.remove();
        onDialog(act);
      } else if (e.target === ov) {
        ov.remove();
      }
    });
  }
  function onDialog(act) {
    switch (act) {
      case 'ed-upload': saveDraftToCloud('initial-upload').then(function () { auditMedia(); }); break;
      case 'ed-skip': break;
      case 'pd-load': loadCloudDraft(); break;
      case 'pd-keep': break; /* 保留本地：下次保存覆盖云端（用户已知情） */
      case 'cf-load': loadCloudDraft(); break;
      case 'cf-overwrite':
        fetchConfigStatus(false).then(function (row) {
          if (row) cloud.revision = Number(row.revision) || cloud.revision;
          saveDraftToCloud('overwrite');
        });
        break;
      case 'cf-cancel': break;
      case 'pub-force': forcePublish(); break;
      case 'pub-sync-media': syncMedia(); break;
      case 'dlg-close': break;
    }
  }
  function forcePublish() {
    /* startPublish 里确认后的实际执行（绕过二次确认） */
    var mode = state.publishMode || 'test';
    toast('正在保存云端草稿并触发发布…');
    saveDraftToCloud('pre-publish').then(function (r) {
      if (!r || !r.ok) { renderCloudIfActive(); return; }
      ensureToken().then(function (tok) {
        return fetch(CC.publishEndpoint, {
          method: 'POST',
          headers: { apikey: CC.anonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: mode })
        });
      }).then(parseRes).then(function (r2) {
        if (r2.ok && r2.body && r2.body.ok) {
          state.publishing = {
            version_id: r2.body.version_id, revision: r2.body.revision, mode: r2.body.mode,
            trigger: r2.body.trigger, assets: r2.body.assets, startedAt: Date.now()
          };
          state.lastSync = { ok: true, at: new Date().toISOString(), revision: r2.body.revision, reason: 'pre-publish' };
          toast('已触发云端发布（' + (mode === 'production' ? 'PRODUCTION' : 'TEST') + '）');
          refreshVersions().then(function () { watchVersion(r2.body.version_id); });
          renderCloudIfActive();
        } else {
          var b = r2.body || {};
          if (b.code === 'PUBLISH_IN_PROGRESS') { toast('已有发布任务进行中，请稍候', true); refreshVersions(); renderCloudIfActive(); return; }
          dialog('发布失败', '<div class="cloud-err">' + esc(b.error || b.code || ('HTTP ' + r2.status)) + '</div>' +
            (b.code ? '<div class="hint">错误码：' + esc(b.code) + '</div>' : ''),
            [{ label: '知道了', act: 'dlg-close', cls: 'btn--primary' }]);
          refreshVersions(); renderCloudIfActive();
        }
      }).catch(function (err) {
        dialog('发布失败', '<div class="cloud-err">' + esc(err.message || '网络错误') + '</div>', [{ label: '知道了', act: 'dlg-close', cls: 'btn--primary' }]);
      });
    });
  }

  /* ------------------------------------------------------------ 视图事件 */
  function onCloudClick(e) {
    var btn = e.target.closest('[data-cloudact]');
    if (!btn) return;
    var act = btn.dataset.cloudact;
    switch (act) {
      case 'login':
        state.offline = false;
        try { sessionStorage.removeItem(SS_MODE); } catch (err) {}
        showGate();
        break;
      case 'logout': logout(); break;
      case 'refresh':
        if (!session) { toast('未登录云端', true); return; }
        if (!isActive()) {
          /* 已登录但云端状态未知（此前读取失败）：重新验证并拉取 */
          toast('正在恢复云端状态…');
          enterCloud();
          return;
        }
        fetchConfigStatus(false).then(function (row) {
          if (!row) { toast('读取失败或已无权限', true); return; }
          cloud.revision = Number(row.revision) || cloud.revision;
          cloud.published_revision = row.published_revision;
          cloud.updated_at = row.updated_at;
          renderCloudIfActive(); renderChip();
          toast('云端状态已刷新（r' + cloud.revision + '）');
        }).catch(function (err) { toast('刷新失败：' + (err.message || '网络错误'), true); });
        break;
      case 'save-now': saveDraftToCloud('manual'); break;
      case 'load-cloud': loadCloudDraft(); break;
      case 'media-retry': syncMedia(); break;
      case 'publish': startPublish(); break;
      case 'refresh-versions': refreshVersions().then(function () { toast('版本历史已刷新'); }); break;
      case 'watch': {
        if (!btn.dataset.vid) break;
        var wv = state.versions.find(function (v) { return v.id === btn.dataset.vid; });
        state.publishing = {
          version_id: btn.dataset.vid,
          revision: wv ? wv.revision : '?',
          mode: 'test', startedAt: Date.now(), status: (wv && wv.status) || 'building'
        };
        watchVersion(btn.dataset.vid);
        renderCloudIfActive();
        break;
      }
    }
  }
  function onCloudChange(e) {
    if (e.target.id === 'publish-mode') {
      state.publishMode = e.target.value === 'production' ? 'production' : 'test';
    }
  }

  /* ------------------------------------------------------------ 导出 */
  window.CloudAdmin = {
    init: init,
    login: login,
    logout: logout,
    getSession: function () { return session ? clone(session) : null; },
    isActive: isActive,
    onDraftLoaded: onDraftLoaded,
    onLocalSave: onLocalSave,
    onMediaAdded: onMediaAdded,
    renderView: renderView,
    saveDraftToCloud: saveDraftToCloud,
    loadCloudDraft: loadCloudDraft,
    syncMedia: syncMedia,
    refreshVersions: refreshVersions,
    startPublish: startPublish,
    /* 诊断用（只读快照，不含令牌） */
    _debug: function () {
      return {
        active: isActive(),
        offline: state.offline,
        revision: cloud && cloud.revision,
        draftEmpty: !!(cloud && cloud.draft && !Array.isArray(cloud.draft.projects)),
        lastSync: state.lastSync ? clone(state.lastSync) : null,
        syncing: state.syncing,
        mediaQueue: Object.keys(state.mediaQueue),
        mediaErrors: state.mediaErrors,
        versions: state.versions.length
      };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
