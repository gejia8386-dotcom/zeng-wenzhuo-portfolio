# 作品集云端发布系统 · 第三步检查报告与开发说明

> 本文件只提交到 `cloud-test` 分支；`main` 上的正式网站内容未做任何改动。
> 生成时间：2026-11-14

---

## 一、任务一：现有项目检查

### 1. GitHub 仓库 / 分支

| 项 | 实测值 |
|---|---|
| 仓库 | `gejia8386-dotcom/zeng-wenzhuo-portfolio`（PUBLIC） |
| 默认分支 | `main` |
| 基线 HEAD | `d62453af`（docs: 记录 GitHub Pages 永久链接与上线状态） |
| 上一提交 | `cad8a75e`（Deploy 曾文卓视觉传达设计作品集 v1.0） |
| Pages | source = `main` / `/`，status = `built` |
| 永久链接 | https://gejia8386-dotcom.github.io/zeng-wenzhuo-portfolio/ |
| 原有 workflows | **无**（`.github` 目录 404） |
| 仓库文件数 | 132 |

回滚点：`tag backup/pre-cloud-20261114` → `d62453af`。
测试分支：`cloud-test`（从同一 HEAD 建立）。

### 2. 关键文件检查

| 文件 | 行数 | 结论 |
|---|---|---|
| `admin.html` | 145 | 6 个视图（作品管理/文字编辑/视觉设置/实时预览/数据安全/使用说明）；按钮 `btn-save`、`btn-release`；脚本顺序 `i18n.js → works.js → published.js → portfolio-store.js → zip-writer.js → admin.js` |
| `js/admin.js` | 1172 | `buildRelease()` 读 `data/file-manifest.json` 打 ZIP；物化 `media:` → `assets/uploads/`；生成 `data/published.js` 与 `projects/<id>.html`；**本轮一行不改** |
| `js/portfolio-store.js` | 408 | `resolve()` 优先级：草稿 > `PORTFOLIO_PUBLISHED` > `works.js`；`PORTFOLIO_PUBLISHED_LOCK` 阻止访客读草稿；`materialize()` 只认 `data:image/` data URL |
| `js/site.js` | 654 | `boot()` → `Store.resolve()` → 渲染；`AS()` 给相对路径补 `BASE`；`portfolio:rendered` / `portfolio:langchange` 供动效层挂接。**前台无任何外部服务依赖** |
| `data/works.js` | 458 | `window.PORTFOLIO`：9 个项目、6 个分类、dividers、cover、closing；详情为 `blocks[]`；图片全部 `assets/...` 相对路径 |

**发布产物格式（必须与后台导出完全一致，否则会破坏前台）**：
```js
window.PORTFOLIO_PUBLISHED = {...cfg};   // media: 已物化为 assets/uploads/...
window.PORTFOLIO_PUBLISHED_LOCK = true;
```
`cfg.staticPages` = 可见项目 id 列表；`cfg.media` = `{}`。

仓库 `projects/` 下已有 9 个详情页 + `project.html`，均含完整 OG 元信息。
`data/original-backup.json` 是含 9 个真实项目的完整配置快照（不是假数据），可作为测试基线。

### 3. Supabase 数据库实际结构

- 已执行 `supabase/schema.sql` v3：4 张表 `admin_users` / `site_config` / `site_versions` / `media_assets` + `is_portfolio_admin()` + 全套 RLS + 私有桶 `portfolio-uploads`。
- 上一轮四身份实测：anon 读四表均 `42501`；管理员可写 `draft/revision/updated_by/updated_at`，写 `published*` 被 42501 拒绝；`service_role` 可完成发布链路；测试数据全部回滚，`revision=1`。
- 本轮补充只读探测：`auth/v1/health` = 200；anon 读四表全部 HTTP 401 / `code 42501`；私有桶匿名公共读 = 400 `NoSuchBucket`（私有生效）；PostgREST OpenAPI 对 anon 返回 0 个表定义（证明 anon 零权限）。
- 列级精确结构由 `.github/workflows/cloud-test-inspect.yml` 用 service_role 在 Actions 内复核，日志只输出结构、不输出密钥。

> 说明：本会话中 Edge 浏览器扩展通道断开，SQL Editor 不可用，因此改用「只读 PostgREST 元数据 + 已实测权限行为 + Actions 内联自检」三重核对，未读取任何 Secret 明文。

### 4. 密钥变量名与类型（仅列名称，不读取/不展示明文）

| 位置 | 变量名 | 类型 |
|---|---|---|
| GitHub Actions Secrets | `SUPABASE_URL` | 字符串（公开项目 URL） |
| GitHub Actions Secrets | `SUPABASE_SERVICE_ROLE_KEY` | 字符串（new-style `sb_secret_…`） |
| Supabase Function Secrets | `GITHUB_DISPATCH_TOKEN` | 字符串（GitHub OAuth token） |
| Supabase Function Secrets | `GITHUB_OWNER` | 字符串（公开值） |
| Supabase Function Secrets | `GITHUB_REPO` | 字符串（公开值） |
| Supabase 平台自动注入 | `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` / `SUPABASE_DB_URL` | 服务端环境变量 |
| Actions 内置 | `GITHUB_TOKEN` | `permissions: contents: write` |
| 仓库 Variables | 空 | — |

**前端只有一个公开值**：anon / publishable key，且本轮尚未写入任何前端文件。

### 5. 备份

- 远端 tag `backup/pre-cloud-20261114`（指向 `d62453af`）。
- 本地完整克隆：`cloud-workspace/repo`（132 文件 / 37 MB）。
- 全部新增文件只提交到 `cloud-test` 分支，每一步都有 Git 提交记录，可整体回滚。

### 6. 线上正式站可访问性（未受影响）

首页 / `admin.html` / `js/site.js` / `js/admin.js` / `data/works.js` / `data/published.js` / `.nojekyll` 全部 HTTP 200。

---

## 二、任务二：`publish` Edge Function

源码：`supabase/functions/publish/index.ts`

| 要求 | 实现 |
|---|---|
| 验证登录身份 | 从 `Authorization` 取用户 JWT → `GET /auth/v1/user` 验签；不信任请求体自报身份 |
| 验证管理员白名单 | service_role 查 `admin_users.user_id = uid`；不在名单 → 403 |
| 读取 draft | `site_config?select=draft,revision,published_revision&id=eq.main` |
| 创建发布记录 | `INSERT site_versions { revision, config: draft, assets, status:'pending', triggered_by }` |
| 触发 GitHub | test → `workflow_dispatch` (ref `cloud-test`)；production → `repository_dispatch` |
| 记录状态 | 成功回写 `building`；失败回写 `failed + error + finished_at`（含 run id 由 Actions 补写） |
| 防重复发布 | 15 分钟内已有 `pending/building` 版本 → 409；超时才允许重试 |
| 防未授权 | JWT 验签 + 白名单 + Origin 白名单 + 仅 POST；默认 `mode=test`，production 需显式指定且拒绝空 draft |

密钥全部来自平台注入的环境变量，函数内无硬编码，响应体不回显任何密钥。

---

## 三、任务三：`.github/workflows/publish.yml`

| 要求 | 实现 |
|---|---|
| 接收 repository_dispatch | `on: repository_dispatch: types: [portfolio-publish]` |
| 获取快照 | `scripts/publish-build.mjs` 按 `version_id` 读 `site_versions` |
| 下载私有图片 | Storage 直连 `GET /storage/v1/object/...`（service_role），失败回退签名 URL |
| 同步到 assets/uploads | 按 `media_key` + mime 写 `assets/uploads/<key>.<ext>` |
| 兼容静态结构 | 生成与后台导出同格式的 `data/published.js`；只补建缺失详情页，**已存在的一律跳过**（保留原有 OG 与布局） |
| 提交文件 | 仅 `git add` 明确路径；`git push` 到目标分支 |
| 更新状态 | `scripts/publish-status.mjs success\|failed`，production 成功才同步 `site_config.published` |
| 构建失败 | `if: failure()` 回写 `failed` + 错误；构建脚本产物校验不通过即 `exit 1`，不提交半成品 |

额外护栏：`production` 只允许由 `repository_dispatch` 触发；`test` 禁止写 `main`、产物全部落在 `.cloud-test-output/`；`concurrency` 防并发覆盖。

---

## 四、任务四：测试策略（不碰 main 正式内容）

1. `.github/workflows/cloud-test-inspect.yml` — 只读核对数据库结构、行数、私有桶配置、anon 边界。
2. `publish.yml` 以 `mode=test` + `target_branch=cloud-test` 触发：读快照 → 下载私有图片 → 私有桶上传/下载/删除探针 → 生成静态文件到 `.cloud-test-output/` → 产物校验 → 提交到 `cloud-test` → 回写状态。
3. Edge Function 以 `mode=test` 调用：只触发 `cloud-test` 分支的测试作业，不触发正式发布。
4. `main` 分支上只包含工具文件（workflow / scripts / Edge Function 源码），**不写入 `data/published.js`、不改任何 html/css/js/图片**，Pages 视觉 100% 不变。

---

## 五、文件清单

**新增**
```
.github/workflows/publish.yml
.github/workflows/cloud-test-inspect.yml
scripts/cloud-inspect.mjs
scripts/publish-build.mjs
scripts/publish-status.mjs
supabase/functions/publish/index.ts
CLOUD-CHECK-REPORT.md
```

**修改**：无（`admin.html` / `admin.js` / `portfolio-store.js` / `site.js` / `works.js` / 图片 / 详情页全部未改动）。
