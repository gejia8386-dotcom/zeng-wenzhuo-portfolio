/* =============================================================================
 * publish-status.mjs — 发布状态回写（GitHub Actions 内运行）
 * -----------------------------------------------------------------------------
 * 用法: node scripts/publish-status.mjs success|failed "可选错误摘要"
 *
 * 仅 service_role 可写 site_versions.status 与 site_config.published*，
 * 密钥由 Actions Secrets 注入，脚本不打印任何密钥。
 *
 * production + success 时额外把 site_config.published 同步为本次发布的配置；
 * test 模式不触碰 published 字段（正式站点状态不受测试影响）。
 * ========================================================================== */

const URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VERSION_ID = (process.env.VERSION_ID || '').trim();
const MODE = process.env.MODE === 'production' ? 'production' : 'test';
const RUN_ID = Number(process.env.GITHUB_RUN_ID || 0) || null;
const RESULT = (process.argv[2] || '').toLowerCase();
const ERROR_TEXT = (process.argv[3] || '').slice(0, 800);

if (!URL || !SERVICE) {
  console.error('FATAL: 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (RESULT !== 'success' && RESULT !== 'failed') {
  console.error('FATAL: 参数必须是 success 或 failed');
  process.exit(1);
}

function headers(extra = {}) {
  return {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function req(rel, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${rel}`, {
    ...init,
    headers: headers(init.headers || {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${rel}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  /* 定位版本：优先指定 id，否则取最新一条 pending/building */
  let version = null;
  if (VERSION_ID) {
    const rows = await req(
      `site_versions?select=id,revision,config,status&id=eq.${encodeURIComponent(VERSION_ID)}`,
    );
    version = rows?.[0] || null;
  } else {
    const rows = await req(
      'site_versions?select=id,revision,config,status&order=created_at.desc&limit=1',
    );
    version = rows?.[0] || null;
  }
  if (!version) {
    console.error('WARN: 未找到发布版本记录，跳过状态回写');
    return;
  }

  const patch = {
    status: RESULT === 'success' ? 'success' : 'failed',
    finished_at: new Date().toISOString(),
    github_run_id: RUN_ID,
    error: RESULT === 'success' ? null : (ERROR_TEXT || 'GitHub Actions 构建失败'),
  };
  await req(`site_versions?id=eq.${encodeURIComponent(version.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  console.log(`[status] site_versions ${version.id} → ${patch.status} (run ${RUN_ID || 'n/a'})`);

  /* 仅正式发布成功才同步 published 配置，测试分支绝不改动 */
  if (RESULT === 'success' && MODE === 'production' && version.config) {
    await req('site_config?id=eq.main', {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        published: version.config,
        published_revision: version.revision,
        published_at: new Date().toISOString(),
      }),
    });
    console.log(`[status] site_config.published → r${version.revision}`);
  } else {
    console.log(`[status] mode=${MODE} → 不修改 site_config.published`);
  }
}

main().catch((e) => {
  console.error('[status] FATAL:', e.message);
  process.exit(1);
});
