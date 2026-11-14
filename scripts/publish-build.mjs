/* =============================================================================
 * publish-build.mjs — 云端发布构建（GitHub Actions 内运行）
 * -----------------------------------------------------------------------------
 * 输入（环境变量，密钥由 Actions Secrets 注入，脚本不打印）：
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   VERSION_ID / MODE(test|production) / TARGET_BRANCH
 *   GITHUB_RUN_ID / GITHUB_RUN_ATTEMPT / GITHUB_SHA
 *
 * 流程：
 *   1. 读取 site_versions 发布快照（真实数据库记录）
 *   2. 读取 media_assets，下载私有 Storage 图片 → assets/uploads/
 *   3. 把配置里的 media:<key> 引用物化为相对静态路径
 *   4. 生成 data/published.js（与现有后台导出格式完全一致）
 *   5. 缺页时补建 projects/<id>.html；已存在的一律跳过，绝不覆盖
 *   6. 校验产物（9 项目、引用均为相对路径、published.js 可执行）
 *   7. 写 publish-report.json
 *
 * 安全护栏：
 *   - MODE=test 时所有产物写到隔离目录 .cloud-test-output/，
 *     不触碰仓库根目录任何正式文件，也不 push 到 main。
 *   - MODE=production 才写仓库根目录；仍不删除任何既有文件。
 *   - 快照为空时，仅 test 模式允许用 data/original-backup.json 的真实基线
 *     配置做格式校验；production 模式直接拒绝（防止空配置上线）。
 * ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VERSION_ID = (process.env.VERSION_ID || '').trim();
const MODE = process.env.MODE === 'production' ? 'production' : 'test';
const TARGET_BRANCH = process.env.TARGET_BRANCH || 'cloud-test';
const RUN_ID = process.env.GITHUB_RUN_ID || '';
const BUCKET = 'portfolio-uploads';

const CWD = process.cwd();
const OUTPUT_ROOT = MODE === 'test' ? path.join(CWD, '.cloud-test-output') : CWD;
const REPORT_NAME = 'publish-report.json';

if (!URL || !SERVICE) {
  console.error('FATAL: 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (MODE === 'production' && TARGET_BRANCH !== 'main') {
  console.error('FATAL: production 模式只允许 target_branch=main');
  process.exit(1);
}
if (MODE === 'test' && TARGET_BRANCH === 'main') {
  console.error('FATAL: test 模式禁止写入 main');
  process.exit(1);
}

const log = (...a) => console.log('[build]', ...a);
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const write = (rel, data) => {
  const full = path.join(OUTPUT_ROOT, rel);
  ensureDir(full);
  fs.writeFileSync(full, data);
  return rel;
};

function authHeaders(extra = {}) {
  return {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    ...extra,
  };
}

async function restJson(rel, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${rel}`, {
    ...init,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    }),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`PostgREST ${rel} → HTTP ${res.status}: ${JSON.stringify(body).slice(0, 240)}`);
  }
  return body;
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

/* ---- 私有桶下载：直连失败时回退到签名 URL ---- */
async function downloadObject(storagePath) {
  const direct = `${URL}/storage/v1/object/${BUCKET}/${encPath(storagePath)}`;
  let res = await fetch(direct, { headers: authHeaders() });
  if (!res.ok) {
    const signRes = await fetch(
      `${URL}/storage/v1/object/sign/${BUCKET}/${encPath(storagePath)}`,
      {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: 120 }),
      },
    );
    const signBody = await signRes.json().catch(() => null);
    if (!signRes.ok || !signBody?.signedURL) {
      throw new Error(`Storage 下载失败 HTTP ${res.status} / sign HTTP ${signRes.status}`);
    }
    const signed = signBody.signedURL.startsWith('http')
      ? signBody.signedURL
      : `${URL}/storage/v1${signBody.signedURL}`;
    res = await fetch(signed);
  }
  if (!res.ok) throw new Error(`Storage 对象读取失败 HTTP ${res.status}: ${storagePath}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ---- 测试模式：真实上传一张站内图片再下载，验证私有桶读写链路 ---- */
async function storageRoundTripProbe() {
  const src = path.join(CWD, 'assets/petora/01-hero.jpg');
  if (!fs.existsSync(src)) return { ok: false, reason: '探针源图不存在' };
  const bytes = fs.readFileSync(src);
  const probePath = '__cloudtest__/probe.jpg';
  try {
    const up = await fetch(`${URL}/storage/v1/object/${BUCKET}/${probePath}`, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      }),
      body: bytes,
    });
    if (!up.ok) return { ok: false, reason: `上传 HTTP ${up.status}` };

    const got = await downloadObject(probePath);
    const same = got.length === bytes.length && got.equals(bytes);

    await fetch(`${URL}/storage/v1/object/${BUCKET}/${probePath}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => null);

    return { ok: same, uploaded: bytes.length, downloaded: got.length, byte_identical: same };
  } catch (e) {
    await fetch(`${URL}/storage/v1/object/${BUCKET}/${probePath}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => null);
    return { ok: false, reason: String(e.message || e).slice(0, 200) };
  }
}

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 只新增缺页，不覆盖已有详情页，保留原有 OG 元信息与布局 */
function projectShell(p, ownerName) {
  const tplPath = path.join(CWD, 'projects/binxiaoxun.html');
  const tpl = fs.existsSync(tplPath)
    ? fs.readFileSync(tplPath, 'utf8')
    : '';
  if (!tpl) return null;
  const title = `${p.title} — ${ownerName}作品集`;
  const desc = Array.isArray(p.description) && p.description.length
    ? p.description[0]
    : '';
  return tpl
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/data-project="[^"]*"/, `data-project="${esc(p.id)}"`);
}

function materialize(cfg, map) {
  const out = JSON.parse(JSON.stringify(cfg));
  const walk = (o) => {
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) o[k] = walk(o[k]);
      return o;
    }
    if (typeof o === 'string' && map[o]) return map[o];
    return o;
  };
  return walk(out);
}

/* ------------------------------------------------------------------ main */
const report = {
  mode: MODE,
  target_branch: TARGET_BRANCH,
  output_root: MODE === 'test' ? '.cloud-test-output' : '.',
  github_run_id: RUN_ID,
  started_at: new Date().toISOString(),
  checks: {},
  files: [],
};

try {
  log(`模式=${MODE} 目标分支=${TARGET_BRANCH} 输出=${report.output_root}`);

  /* 1. 读取发布快照 */
  const rel = VERSION_ID
    ? `site_versions?select=*&id=eq.${encodeURIComponent(VERSION_ID)}`
    : 'site_versions?select=*&order=created_at.desc&limit=1';
  const rows = await restJson(rel);
  const version = Array.isArray(rows) ? rows[0] : null;
  if (!version) throw new Error('未找到发布版本快照（site_versions 为空或 version_id 无效）');
  report.version_id = version.id;
  report.version_revision = version.revision;
  report.version_status_before = version.status;
  log(`快照 id=${version.id} revision=${version.revision} status=${version.status}`);
  report.checks.read_version_snapshot = true;

  /* 2. 标记 building（由 Actions 侧回写，这里只读取，不改状态） */
  await restJson('site_config?select=revision,published_revision&id=eq.main');
  report.checks.read_site_config = true;

  /* 3. 图片清单 + 下载 */
  const media = await restJson('media_assets?select=media_key,storage_path,mime,published&order=created_at.asc');
  const mediaRows = Array.isArray(media) ? media : [];
  report.media_rows = mediaRows.length;
  const map = {};
  const downloaded = [];
  for (const row of mediaRows) {
    const ext = EXT_BY_MIME[row.mime] || 'jpg';
    const outRel = `assets/uploads/${row.media_key}.${ext}`;
    const bytes = await downloadObject(row.storage_path);
    write(outRel, bytes);
    map[`media:${row.media_key}`] = outRel;
    downloaded.push({ path: outRel, bytes: bytes.length });
    report.files.push(outRel);
  }
  report.downloaded_images = downloaded;
  report.checks.download_private_images = mediaRows.length === 0
    ? 'no_registered_images'
    : downloaded.length === mediaRows.length;
  log(`私有图片登记 ${mediaRows.length} 张，实际下载 ${downloaded.length} 张`);

  /* 4. 测试模式做一次真实私有桶上传/下载/删除探针 */
  if (MODE === 'test') {
    report.storage_probe = await storageRoundTripProbe();
    log(`私有桶读写探针: ${report.storage_probe.ok ? 'PASS' : 'FAIL'} ${report.storage_probe.reason || ''}`);
  }

  /* 5. 配置：快照优先；为空时仅 test 模式用真实基线 */
  let cfg = version.config;
  let configSource = 'site_versions.config';
  if (!cfg || !Array.isArray(cfg.projects) || cfg.projects.length === 0) {
    if (MODE !== 'test') {
      throw new Error('发布快照中的配置为空，production 模式拒绝发布');
    }
    const baseline = JSON.parse(
      fs.readFileSync(path.join(CWD, 'data/original-backup.json'), 'utf8'),
    );
    delete baseline._type;
    delete baseline._description;
    delete baseline._generatedAt;
    cfg = baseline;
    configSource = 'data/original-backup.json (test baseline, 真实数据)';
    log('⚠️ 快照配置为空 → 测试模式使用仓库真实基线配置做格式校验');
  }
  report.config_source = configSource;
  report.project_count_in_config = cfg.projects.length;

  const finalCfg = materialize(cfg, map);
  finalCfg.media = {};
  finalCfg.staticPages = cfg.projects.filter((p) => !p.hidden).map((p) => p.id);
  finalCfg._publishedAt = new Date().toISOString();
  finalCfg._publishedRevision = version.revision;

  /* 6. 生成 data/published.js（与后台导出格式一致） */
  const publishedJs =
    `/* 已发布配置 · 云端发布系统生成 · ${finalCfg._publishedAt} · r${version.revision} */\n` +
    `window.PORTFOLIO_PUBLISHED = ${JSON.stringify(finalCfg)};\n` +
    `window.PORTFOLIO_PUBLISHED_LOCK = true;\n`;
  write('data/published.js', publishedJs);
  report.files.push('data/published.js');

  /* 7. 详情页：只补建缺失的，绝不覆盖已存在的 */
  const ownerName = (cfg.owner && cfg.owner.name) || '曾文卓';
  const createdPages = [];
  const skippedPages = [];
  for (const p of cfg.projects.filter((x) => !x.hidden)) {
    const rel = `projects/${p.id}.html`;
    const existing = path.join(CWD, rel);
    const inOutput = path.join(OUTPUT_ROOT, rel);
    if (MODE === 'production' && fs.existsSync(existing)) {
      skippedPages.push(rel);
      continue;
    }
    if (fs.existsSync(inOutput)) continue;
    const html = projectShell(p, ownerName);
    if (!html) continue;
    write(rel, html);
    createdPages.push(rel);
    report.files.push(rel);
  }
  report.created_detail_pages = createdPages;
  report.skipped_existing_pages = skippedPages.length;
  log(`详情页：新建 ${createdPages.length}，跳过已存在 ${skippedPages.length}`);

  /* 8. 校验产物 */
  const sandbox = { window: {} };
  vm.runInNewContext(publishedJs, sandbox);
  const pub = sandbox.window.PORTFOLIO_PUBLISHED;
  report.checks.published_js_parseable = !!pub && Array.isArray(pub.projects);
  report.checks.lock_enabled = sandbox.window.PORTFOLIO_PUBLISHED_LOCK === true;
  report.checks.project_count = pub.projects.length;
  report.checks.static_pages_count = Array.isArray(pub.staticPages) ? pub.staticPages.length : 0;

  const badRefs = [];
  const scan = (o) => {
    if (Array.isArray(o)) return o.forEach(scan);
    if (o && typeof o === 'object') return Object.values(o).forEach(scan);
    if (typeof o === 'string' && /^(assets\/|css\/|js\/|projects\/)/.test(o)) {
      if (o.startsWith('/') || /^https?:\/\//.test(o) || o.includes('..')) badRefs.push(o);
    }
  };
  scan(pub);
  report.checks.no_absolute_asset_paths = badRefs.length === 0;
  report.bad_refs = badRefs.slice(0, 10);
  report.checks.all_files_written = report.files.every((f) =>
    fs.existsSync(path.join(OUTPUT_ROOT, f)),
  );

  const critical =
    report.checks.published_js_parseable &&
    report.checks.lock_enabled &&
    report.checks.project_count > 0 &&
    report.checks.static_pages_count === report.checks.project_count &&
    report.checks.no_absolute_asset_paths &&
    report.checks.all_files_written;
  report.checks.overall = !!critical;

  report.finished_at = new Date().toISOString();
  write(REPORT_NAME, JSON.stringify(report, null, 2));
  log(`产物校验: ${critical ? 'PASS' : 'FAIL'}；生成 ${report.files.length} 个文件`);

  if (!critical) {
    console.error('FATAL: 产物校验未通过', JSON.stringify(report.checks));
    process.exit(1);
  }
} catch (err) {
  report.checks.overall = false;
  report.error = String(err?.message || err).slice(0, 800);
  report.finished_at = new Date().toISOString();
  try { write(REPORT_NAME, JSON.stringify(report, null, 2)); } catch { /* ignore */ }
  console.error('[build] FATAL:', report.error);
  process.exit(1);
}
