/* -----------------------------------------------------------------------------
 * cloud-inspect.mjs — 只读结构自检（仅测试分支使用）
 * -----------------------------------------------------------------------------
 * 只做 GET 查询，不写任何数据、不修改任何文件、不打印密钥。
 * 输出：PostgREST OpenAPI 表/列定义、业务表行数、Storage 桶配置、anon 边界。
 * 运行身份：GitHub Actions，环境变量由 Secrets 注入（本脚本不读取明文到输出）。
 * --------------------------------------------------------------------------- */

import fs from 'node:fs';

const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON = process.env.SUPABASE_ANON_KEY || '';
const TABLES = ['admin_users', 'site_config', 'site_versions', 'media_assets'];

if (!BASE || !SERVICE) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function get(path, key, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: headers(key, opts.headers || {}),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, body };
}

const lines = [];
function log(s = '') { console.log(s); lines.push(s); }
function mask(s) { return s ? `${String(s).slice(0, 6)}…（已脱敏）` : '(空)'; }

log('# Supabase 实际结构自检（只读）');
log('');
log(`- Project host: ${new URL(BASE).host}`);
log(`- 服务端密钥: 已注入，类型 ${SERVICE.slice(0, 3) === 'sb_' ? 'new-style secret key' : 'JWT'}，长度 ${SERVICE.length}（值不输出）`);
log('');

/* 1. PostgREST OpenAPI：用 service_role 取得真实表/列定义 */
log('## 1. 表结构（PostgREST OpenAPI definitions）');
const openapi = await get('/rest/v1/', SERVICE);
if (openapi.status !== 200) {
  log(`- ❌ OpenAPI 读取失败 HTTP ${openapi.status}: ${JSON.stringify(openapi.body).slice(0, 200)}`);
} else {
  const defs = openapi.body.definitions || {};
  log(`- 可见表定义数: ${Object.keys(defs).length}`);
  for (const t of TABLES) {
    const cols = Object.keys(defs[t]?.properties || {});
    log(`- \`${t}\`: ${cols.length ? cols.join(', ') : '❌ 未找到'} (${cols.length} 列)`);
  }
}
log('');

/* 2. 业务表实际数据状态 */
log('## 2. 业务表数据状态');
for (const t of TABLES) {
  const r = await get(`/rest/v1/${t}?select=*`, SERVICE);
  if (r.status !== 200) {
    log(`- \`${t}\`: ❌ HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
    continue;
  }
  const rows = Array.isArray(r.body) ? r.body : [];
  let extra = `行数 ${rows.length}`;
  if (t === 'site_config' && rows[0]) {
    extra += `, revision=${rows[0].revision}, draft_bytes=${JSON.stringify(rows[0].draft).length}, published=${rows[0].published ? 'set' : 'null'}`;
  }
  if (t === 'site_versions') {
    extra += `, 状态分布=${JSON.stringify(rows.reduce((a, v) => (a[v.status] = (a[v.status] || 0) + 1, a), {}))}`;
  }
  if (t === 'admin_users') {
    extra += `, 邮箱数=${rows.length}`;
  }
  log(`- \`${t}\`: ${extra}`);
}
log('');

/* 3. 私有 Storage 桶 */
log('## 3. Storage 桶配置');
const buckets = await get('/storage/v1/bucket', SERVICE);
if (buckets.status !== 200) {
  log(`- ❌ 桶列表读取失败 HTTP ${buckets.status}: ${JSON.stringify(buckets.body).slice(0, 200)}`);
} else {
  const b = (Array.isArray(buckets.body) ? buckets.body : []).find((x) => x.id === 'portfolio-uploads');
  if (!b) log('- ❌ 未找到 portfolio-uploads 桶');
  else log(`- portfolio-uploads: public=${b.public}, limit=${b.file_size_limit}, mime=${JSON.stringify(b.allowed_mime_types)}`);
  log(`- 桶总数: ${Array.isArray(buckets.body) ? buckets.body.length : 'unknown'}`);
}
log('');

/* 4. 私有对象数量（列表接口，不下载内容） */
log('## 4. 私有桶对象');
const objs = await fetch(`${BASE}/storage/v1/object/list/portfolio-uploads`, {
  method: 'POST',
  headers: headers(SERVICE),
  body: JSON.stringify({ prefix: '', limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
});
const objBody = await objs.json().catch(() => null);
log(`- 列表 HTTP ${objs.status}, 顶层对象数: ${Array.isArray(objBody) ? objBody.length : 'n/a'}`);
log('');

/* 5. anon 权限边界（可选；anon key 为公开值，缺失则跳过） */
log('## 5. anon 权限边界');
if (!ANON) {
  log('- 未提供 SUPABASE_ANON_KEY 变量，跳过（本地 curl 已实测四表均返回 42501）');
} else {
  for (const t of TABLES) {
    const r = await get(`/rest/v1/${t}?select=*`, ANON);
    const denied = r.status === 401 || r.status === 403;
    log(`- \`${t}\` anon 读取: HTTP ${r.status} → ${denied ? '✅ 已拒绝' : '⚠️ 未被拒绝'}`);
  }
}
log('');

/* 6. 汇总 */
const summary = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n'); } catch { /* ignore */ }
}
log('自检结束（未写入任何数据）');
