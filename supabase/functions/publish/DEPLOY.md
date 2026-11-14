# publish Edge Function 部署说明

> 源码：`supabase/functions/publish/index.ts`（Deno / Supabase Edge Runtime）
> 项目：`ypvpaqkjnxgcnnupfrmy`
> 函数地址（部署后）：`https://ypvpaqkjnxgcnnupfrmy.supabase.co/functions/v1/publish`

## 方式 A：Supabase Dashboard 在线编辑器（推荐，无需任何额外密钥）

1. 打开 `https://supabase.com/dashboard/project/ypvpaqkjnxgcnnupfrmy/functions`
2. **Create a new function** → 名称填 `publish`
3. 选择 **Via Editor / Deploy a new function**，把 `index.ts` 全文粘贴进编辑器
4. 关闭 **Verify JWT**（网关层校验），因为函数内部已用 GoTrue 完成验签与白名单校验；
   开启网关校验会与新式密钥体系冲突，导致合法请求被网关提前拦截
5. 点 **Deploy**，等待状态变为 `ACTIVE`

平台会自动注入以下环境变量，无需手工配置：
`SUPABASE_URL`、`SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY`、
`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`。

本项目已在 **Edge Functions → Secrets** 配置：
`GITHUB_DISPATCH_TOKEN`、`GITHUB_OWNER`、`GITHUB_REPO`。

## 方式 B：Supabase CLI（需 Personal Access Token，不由聊天传递）

```bash
# 仅供有 CLI 与访问令牌的环境使用，令牌只放环境变量，不写入任何文件
export SUPABASE_ACCESS_TOKEN=...   # 在 Supabase Account → Access Tokens 生成
npx supabase functions deploy publish \
  --project-ref ypvpaqkjnxgcnnupfrmy \
  --no-verify-jwt
```

## 部署后只读验证（不触发正式发布）

```bash
# 1) 未登录调用必须被拒（期望 401 MISSING_TOKEN）
curl -s -X POST "https://ypvpaqkjnxgcnnupfrmy.supabase.co/functions/v1/publish" \
  -H "Content-Type: application/json" -d '{"mode":"test"}'

# 2) 带无效 JWT 调用必须被拒（期望 401 INVALID_TOKEN）
curl -s -X POST "https://ypvpaqkjnxgcnnupfrmy.supabase.co/functions/v1/publish" \
  -H "Content-Type: application/json" -H "Authorization: Bearer invalid.jwt.value" \
  -d '{"mode":"test"}'
```

管理员真实调用需要先登录取得 access_token，且只允许 `mode=test`
（只触发 `cloud-test` 分支的测试作业）。`mode=production` 会发
`repository_dispatch` 给 `main`，**本轮禁止使用**。

## 关键安全约定

- 函数内没有任何硬编码密钥，全部来自平台注入的环境变量。
- 身份只从 `Authorization` 的 JWT 解析，绝不信任请求体自报的 uid/email。
- 白名单 `admin_users` 用 service_role 二次校验，不依赖 RLS 单点。
- 默认 `mode=test`；`production` 需显式指定，且拒绝空草稿。
- 15 分钟内存在 `pending/building` 版本时拒绝重复发布（409）。
- 任何失败都会把 `site_versions` 标记为 `failed` 并记录错误。

## 实际部署记录（2026-11-14）

部署方式：Dashboard 在线编辑器（方式 A）。与本文档前文的两处偏差及原因：

1. **Verify JWT 保持开启**（未关闭）。理由：开启后网关对无凭证/无效 JWT
   请求直接返回 401（`UNAUTHORIZED_NO_AUTH_HEADER` /
   `UNAUTHORIZED_INVALID_JWT_FORMAT`），安全等价；携带合法用户 JWT 的请求
   会正常进入函数，函数内部的 GoTrue 验签 + 白名单校验不受影响。
   Edge 自动翻译会让 Dashboard 崩溃（insertBefore 错误），避免不必要的
   控制台配置操作。

2. **db() 的 apikey 头改用 service_role 新密钥**（commit 45fbf9a）。
   实测：Edge Runtime 注入的 `SUPABASE_ANON_KEY` 是旧式 JWT，而
   `SUPABASE_SECRET_KEY` 是新式 `sb_secret_`，两套体系混用会被 PostgREST
   以 `PGRST301`（Expected 3 parts in JWT; got 1）拒绝。apikey 与
   Authorization 必须同体系，统一用 `sb_secret_`。

### 端到端验证结果（全部通过）

- 无凭证 POST → 401（网关）
- 无效 JWT POST → 401（网关）
- OPTIONS 预检 → 204，CORS 头与函数内 corsHeaders 逐字一致
- 测试管理员（临时创建、验证后删除）JWT 调用 mode=test → 200，
  返回 version_id / revision / trigger=workflow_dispatch(cloud-test)
- GitHub Actions run 43560301673 → success
- site_versions 状态回写 success（finished_at 正确）
- cloud-test 分支产物提交 d12d3bf `publish: rlatest test (8fbd9f38…)`
