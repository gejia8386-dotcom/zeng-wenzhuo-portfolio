/* =============================================================================
 * Edge Function: publish
 * -----------------------------------------------------------------------------
 * 作品集「保存并发布」的唯一服务端入口。前端永远拿不到本函数持有的任何密钥。
 *
 * 链路：
 *   admin.html(用户 JWT) → 本函数 → site_versions 快照 → GitHub dispatch
 *   → GitHub Actions(publish.yml) → 生成静态文件 → 回写 success / failed
 *
 * 安全设计：
 *   1. 身份：从 Authorization 提取用户 JWT，交 GoTrue /auth/v1/user 验签；
 *      绝不信任请求体里自报的 uid / email。
 *   2. 授权：用 service_role 查 admin_users 白名单，非白名单直接 403。
 *   3. 越权：anon 无表权限；本函数自己二次校验，不依赖 RLS 单点。
 *   4. 防重复：15 分钟内已有 pending/building 版本则 409；超时才允许重试。
 *   5. 防误发：默认 mode=test（只触发 cloud-test 分支的测试作业）；
 *      只有显式 mode=production 才会发 repository_dispatch 给 main。
 *   6. 防空白发布：production 模式拒绝 projects 为空的 draft。
 *   7. 状态：创建版本 → 触发 → 回写 building；任一失败回写 failed + 错误。
 *
 * 环境变量（全部由平台注入，前端不可见）：
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY,
 *   SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY,
 *   GITHUB_DISPATCH_TOKEN, GITHUB_OWNER, GITHUB_REPO
 *
 * 部署建议：关闭网关层 "Verify JWT"，由本函数内部完成校验（兼容新旧密钥体系）。
 * ========================================================================== */

const readEnv = (name: string): string => Deno.env.get(name) || '';

const SUPABASE_URL = readEnv('SUPABASE_URL').replace(/\/$/, '');
const SERVICE_KEY =
  readEnv('SUPABASE_SECRET_KEY') || readEnv('SUPABASE_SERVICE_ROLE_KEY');
const PUBLIC_KEY =
  readEnv('SUPABASE_PUBLISHABLE_KEY') ||
  readEnv('SUPABASE_ANON_KEY') ||
  SERVICE_KEY;
const GH_TOKEN = readEnv('GITHUB_DISPATCH_TOKEN');
const GH_OWNER = readEnv('GITHUB_OWNER');
const GH_REPO = readEnv('GITHUB_REPO');

const GH_API = 'https://api.github.com';
const TEST_BRANCH = 'cloud-test';
const REPEAT_WINDOW_MS = 15 * 60 * 1000;

const ALLOWED_ORIGINS = [
  'https://gejia8386-dotcom.github.io',
  'http://localhost',
  'http://127.0.0.1',
  'https://ypvpaqkjnxgcnnupfrmy.supabase.co',
];

function corsHeaders(origin: string | null): Record<string, string> {
  const ok =
    !origin ||
    ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ':'));
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : 'null',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

class PublishError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/* ---- PostgREST：apikey 标识项目，Authorization 决定数据库角色 ---- */
async function db<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      /* 新旧密钥体系混用会让 PostgREST 报 PGRST301（实测），
       * apikey 必须与 Authorization 同体系：统一用 service_role 新密钥 */
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    /* 只回状态码与 PostgREST 错误码，不回显任何密钥或请求头 */
    const detail =
      body && typeof body === 'object' && 'code' in body
        ? String((body as { code: unknown }).code)
        : String(res.status);
    throw new PublishError(`数据库请求失败 (${detail})`, 502, 'DB_ERROR');
  }
  return body as T;
}

async function requireAdmin(userJwt: string): Promise<{ id: string; email: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: PUBLIC_KEY,
      Authorization: `Bearer ${userJwt}`,
    },
  });
  if (!res.ok) {
    throw new PublishError('登录状态无效或已过期，请重新登录', 401, 'INVALID_TOKEN');
  }
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id) {
    throw new PublishError('无法解析登录身份', 401, 'INVALID_TOKEN');
  }

  const rows = await db<Array<{ user_id: string }>>(
    `admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`,
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new PublishError('该账号不在管理员白名单内', 403, 'NOT_ADMIN');
  }
  return { id: user.id, email: user.email || '' };
}

async function triggerGithub(
  mode: 'test' | 'production',
  versionId: string,
  revision: number,
): Promise<{ status: number; ok: boolean; kind: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'zwz-portfolio-publish',
  };

  const isTest = mode === 'test';
  const url = isTest
    ? `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/publish.yml/dispatches`
    : `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/dispatches`;
  const payload = isTest
    ? {
        ref: TEST_BRANCH,
        inputs: {
          version_id: versionId,
          target_branch: TEST_BRANCH,
          mode: 'test',
        },
      }
    : {
        event_type: 'portfolio-publish',
        client_payload: {
          version_id: versionId,
          revision,
          test_mode: false,
        },
      };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  /* 不回显 GitHub 响应体，避免任何敏感信息进入客户端或日志 */
  await res.arrayBuffer().catch(() => null);
  return {
    status: res.status,
    ok: res.status === 204 || res.status === 200 || res.status === 201,
    kind: isTest ? 'workflow_dispatch(cloud-test)' : 'repository_dispatch(main)',
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (origin && !ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ':'))) {
    return json({ ok: false, code: 'ORIGIN_DENIED', error: '来源不被允许' }, 403, origin);
  }
  if (req.method !== 'POST') {
    return json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: '仅支持 POST' }, 405, origin);
  }
  if (!SUPABASE_URL || !SERVICE_KEY || !GH_TOKEN || !GH_OWNER || !GH_REPO) {
    return json(
      { ok: false, code: 'SERVER_MISCONFIGURED', error: '服务端环境变量未完整配置' },
      503,
      origin,
    );
  }

  let versionId = '';
  try {
    /* 1. 请求体（只允许 mode 字段，其它字段一律忽略） */
    let mode: 'test' | 'production' = 'test';
    try {
      const body = (await req.json()) as { mode?: unknown } | null;
      if (body?.mode === 'production') mode = 'production';
    } catch { /* 空体 = 默认 test 模式 */ }

    /* 2. 提取用户 JWT */
    const auth = req.headers.get('Authorization') || '';
    const userJwt = auth.replace(/^Bearer\s+/i, '').trim();
    if (!userJwt || userJwt === PUBLIC_KEY || userJwt === SERVICE_KEY) {
      throw new PublishError('缺少用户登录凭证', 401, 'MISSING_TOKEN');
    }

    /* 3. 验身份 + 白名单 */
    const admin = await requireAdmin(userJwt);

    /* 4. 防重复发布 */
    const busy = await db<Array<{ id: string; created_at: string }>>(
      'site_versions?select=id,created_at&status=in.(pending,building)&order=created_at.desc&limit=1',
    );
    if (Array.isArray(busy) && busy.length > 0) {
      const age = Date.now() - Date.parse(busy[0].created_at);
      if (Number.isFinite(age) && age < REPEAT_WINDOW_MS) {
        throw new PublishError(
          '已有发布任务进行中，请等待完成或 15 分钟后重试',
          409,
          'PUBLISH_IN_PROGRESS',
        );
      }
    }

    /* 5. 读取云端草稿 */
    const cfgRows = await db<Array<{
      draft: Record<string, unknown> | null;
      revision: number;
      published_revision: number | null;
    }>>('site_config?select=draft,revision,published_revision&id=eq.main');
    const row = cfgRows?.[0];
    if (!row) throw new PublishError('站点配置不存在', 500, 'NO_CONFIG');
    const draft = row.draft || {};
    if (
      mode === 'production' &&
      (!Array.isArray(draft.projects) || draft.projects.length === 0)
    ) {
      throw new PublishError(
        '云端草稿为空，拒绝发布（请先在管理后台保存内容）',
        422,
        'EMPTY_DRAFT',
      );
    }

    /* 6. 图片清单（仅登记，不下载；下载由 Actions 完成） */
    const media = await db<Array<{ storage_path: string }>>(
      'media_assets?select=storage_path&order=created_at.asc',
    );
    const assets = (Array.isArray(media) ? media : []).map((m) => m.storage_path);

    /* 7. 冻结版本快照 */
    const created = await db<Array<{ id: string }>>('site_versions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        revision: row.revision,
        config: draft,
        assets,
        status: 'pending',
        triggered_by: admin.id,
      }),
    });
    versionId = created?.[0]?.id || '';
    if (!versionId) throw new PublishError('版本快照创建失败', 502, 'VERSION_CREATE_FAILED');

    /* 8. 触发 GitHub */
    const gh = await triggerGithub(mode, versionId, row.revision);

    /* 9. 回写状态 */
    await db(`site_versions?id=eq.${encodeURIComponent(versionId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(
        gh.ok
          ? { status: 'building' }
          : {
              status: 'failed',
              error: `GitHub 触发失败 HTTP ${gh.status}`,
              finished_at: new Date().toISOString(),
            },
      ),
    }).catch(() => null);

    if (!gh.ok) {
      throw new PublishError(`GitHub 触发失败 (HTTP ${gh.status})`, 502, 'DISPATCH_FAILED');
    }

    return json(
      {
        ok: true,
        version_id: versionId,
        revision: row.revision,
        mode,
        trigger: gh.kind,
        assets: assets.length,
        status: 'building',
      },
      200,
      origin,
    );
  } catch (err) {
    const e =
      err instanceof PublishError
        ? err
        : new PublishError(
            err instanceof Error ? err.message : '未知错误',
            500,
            'INTERNAL_ERROR',
          );

    /* 已建版本则标记失败，避免留下永远 pending 的僵尸记录 */
    if (versionId && e.code !== 'PUBLISH_IN_PROGRESS') {
      await db(`site_versions?id=eq.${encodeURIComponent(versionId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          error: `${e.code}: ${e.message}`.slice(0, 900),
          finished_at: new Date().toISOString(),
        }),
      }).catch(() => null);
    }

    return json(
      { ok: false, code: e.code, error: e.message, version_id: versionId || null },
      e.status,
      origin,
    );
  }
});
