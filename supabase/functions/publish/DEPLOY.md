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
