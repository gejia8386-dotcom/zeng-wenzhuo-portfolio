# 交付清单（最新）

> 更新时间：2026-11-12 · 站点总体积约 **22 MB**（其中 `assets/` 原始素材 21 MB）

## 一、可直接交付的文件

| 交付物 | 位置 | 说明 |
|---|---|---|
| **完整网站 ZIP** | `zeng-wenzhuo-portfolio-website.zip` | 19 MB · 130 个文件；解压即用，双击 `index.html` 可运行；含全部源码、素材、后台与文档（文档在 ZIP 内为 ASCII 文件名：ADMIN-GUIDE / DEPLOY / TEST-REPORT / DELIVERY） |
| 完整网站目录 | `zeng-wenzhuo-portfolio-website/` | 与 ZIP 内容一致，可直接整体拖入 Netlify Drop |
| 原始备份 ZIP | `portfolio-original-v1-backup.zip` | 第一版原始作品集网站（未加后台/动效/双语），用于兜底 |
| 原始数据快照 | `data/original-backup.json` | 9 个原始项目的完整 JSON，可在后台一键恢复 |
| 后台说明 | `后台使用说明.md`（发布包内为 `ADMIN-GUIDE.md`） | 三种状态、全部功能、发布流程、常见问题 |
| 部署说明 | `部署说明.md` | Netlify / GitHub Pages / Cloudflare Pages 步骤与永久链接说明 |
| 测试报告 | `测试报告.md` | 191 项验收结果、修复清单、性能数据、已知限制 |
| 文件清单 | `交付清单.md` + `data/file-manifest.json` | 人工清单 + 发布包打包清单 |

## 二、网站结构

```
index.html                 首页（动态开场 / 拼贴 / 精选 / 关于 / 联系）
works.html                 作品总览（分类筛选 + 作品目录）
about.html                 关于本站（来源、素材、设计语言）
admin.html                 可视化后台
projects/                  9 个原始项目详情页 + project.html 通用详情页外壳
css/style.css              全站视觉（暖白 / 深黑 / 中性灰 + 项目品牌色）
css/motion.css             沉浸式动效层（可整体关闭）
css/admin.css              后台样式
js/site.js                 前台渲染 + 中英切换
js/motion.js               动效逻辑（光标 / 倾斜 / 视差 / 叙事 / 转场 / 触控）
js/portfolio-store.js      配置层（默认数据 / 草稿 / 图片 / 导入导出）
js/admin.js                后台交互
js/zip-writer.js           纯原生 ZIP 打包
data/works.js              原始内容数据（后台不写入）
data/i18n.js               中英双语内置英文
data/published.js          已发布配置（本地为空，导出时写入并加锁）
data/original-backup.json  原始数据快照
data/source-map.json       PDF 39 页逐页归属与命名
data/file-manifest.json    发布包文件清单
assets/                    51 张作品图 + 39 张 200dpi 原页 + 8 个站点图形
assets/uploads/            后台上传图片（导出时生成，初始不存在）
```

## 三、内容与素材

- 9 个项目：海屿低空 VI、PETORA、诊伴、South Pearl、滨小讯、Logo 选辑、中玻建交 40 周年、原创字体 FUTURE CYBER、中文实验字体海报「大美汉字」
- 素材全部来自《曾文卓作品集2.pdf》，未裁切、未重绘、未 AI 生成
- PDF 第 15 页与第 9 页内容重复，已去重
- 全站 HTML 13 页（含通用详情页），前台资源 0 第三方依赖

## 四、验收状态

- 页面：13 个地址全部正常，0 破图，0 站点运行时异常
- 后台：52 项回归全通过
- 端到端：39 项真实操作全通过（上传、删除、改名、改色、新建、导出重开）
- 动效：32 项全通过（桌面 / 手机 / 减少动态 / 后台开关 / `file://`）
- 双语：29 项全通过
- 第三阶段综合：39 项全通过
- 合计 **191 / 191**

## 五、永久访问链接（已上线）

站点已部署到 GitHub Pages，**任何人（手机 / 电脑、任何网络）都能直接打开**：

> **https://gejia8386-dotcom.github.io/zeng-wenzhuo-portfolio/**

- 平台：GitHub Pages（从 `main` 分支根目录部署，HTTPS 已强制开启）
- 仓库：`https://github.com/gejia8386-dotcom/zeng-wenzhuo-portfolio`（Public，可随时删除或改内容）
- 改内容后：本地后台导出新发布包 → 解压 → 提交推送，Pages 会自动重新构建
- 想要更好记的地址：绑定自定义域名（见 `部署说明.md` 第三节），或改用 Netlify Drop 取 `*.netlify.app` 域名
- 已验证：首页 / 作品总览 / 关于 / 9 个项目详情 / 后台 / 双语 / 动效 在子路径部署下全部返回 200

## 六、本地预览（未上线，仅本机）

- 本机服务：`http://127.0.0.1:8765/`（已开启全网卡监听，同 WiFi 手机可访问 `http://192.168.13.188:8765`）
- 双击 `index.html`（或解压 ZIP 后双击）也能离线运行，但只在本机、且不是「上线」
