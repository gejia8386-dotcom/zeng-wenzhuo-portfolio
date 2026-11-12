# 部署说明 · 从本地文件到永久公开链接

> 站点是**纯静态网站**：没有数据库、没有后端、没有构建步骤。
> 只要能把一个文件夹放到公网，它就能永久访问。

---

## 一、先确认：两种「打开」不是一回事

| 方式 | 地址长什么样 | 谁能看到 | 适合 |
|---|---|---|---|
| 本地打开 | `file:///Users/.../index.html` | 只有这台电脑 | 自己检查、给身边人看 |
| 静态托管 | `https://你的域名/` | 所有人，永久 | 投简历、发给面试官、放作品集链接 |

`file://` 不是「上线」，把文件发给别人也不等于发布。**永久公开链接必须由托管平台生成**——它是平台分配的一个网址，任何本地文件都无法凭空产生。

---

## 二、三条最省事的路径（都免费）

### 方案 A：Netlify Drop（最快，1 分钟，无需命令行）

1. 打开 <https://app.netlify.com/drop>。
2. 把**解压后的整个网站文件夹**直接拖进页面（不是 zip 也行，拖文件夹或 zip 都可以）。
3. 几秒后得到一个 `https://随机名.netlify.app` 的地址，**这就是永久公开链接**。
4. 想换一个好记的名字：Site settings → Change site name → 例如 `zengwenzhuo` → `https://zengwenzhuo.netlify.app`。
5. 以后更新：把新的发布包重新拖一次，或在 Deploys 页面拖入新版本。

### 方案 B：GitHub Pages（适合长期维护、有版本记录）

1. 注册 GitHub，新建仓库，例如 `portfolio`（Public）。
2. 把网站**文件夹里的内容**（`index.html` 所在层级）上传到仓库根目录。
   - 网页上传：Add file → Upload files，把整个文件夹拖进去。
   - 命令行：
     ```bash
     cd 解压后的网站目录
     git init
     git add .
     git commit -m "portfolio"
     git branch -M main
     git remote add origin https://github.com/<你的用户名>/portfolio.git
     git push -u origin main
     ```
3. 仓库 Settings → Pages → Source 选 `Deploy from a branch` → Branch 选 `main` + `/ (root)` → Save。
4. 1–2 分钟后访问 `https://<你的用户名>.github.io/portfolio/`，**这就是永久链接**。

> 注意：GitHub Pages 区分大小写，文件名要保持原样；本项目全部为小写英文文件名，不会有问题。

### 方案 C：Cloudflare Pages（国内访问通常更稳，带全球 CDN）

1. 打开 <https://dash.cloudflare.com/> → Workers & Pages → Create → Pages → Upload assets。
2. 项目名填 `portfolio`，把解压后的文件夹拖进去，Deploy。
3. 得到 `https://portfolio.pages.dev`；可在 Custom domains 绑定自己的域名。

> 三个平台都自带 HTTPS 与 CDN，21 MB 的图片资源会被缓存，第二次访问明显更快。

---

## 三、自定义域名（可选）

1. 买一个域名（阿里云 / 腾讯云 / Namecheap 均可）。
2. 在托管平台的 Domain / Custom domain 里添加域名，按提示到域名商处配置：
   - `CNAME` 记录：`www` → 平台给的地址；
   - 根域名：按平台提示用 `A` 记录或 `ALIAS/ANAME`。
3. 等待 DNS 生效（几分钟到几小时），平台会自动签发 HTTPS 证书。
4. 之后把简历、邮件签名里的链接统一换成新域名。

---

## 四、发布包里有什么

```
index.html            首页
works.html            作品总览
about.html            关于 / 来源说明
admin.html            可视化后台（可选保留）
projects/             9 个项目详情页 + 1 个通用详情页外壳
css/                  style.css / motion.css / admin.css
js/                   site.js / motion.js / admin.js / portfolio-store.js / zip-writer.js
data/                 works.js / i18n.js / published.js / 备份与清单
assets/               51 张作品图 + 39 张高清原页 + 8 个站点图形 + uploads/
ADMIN-GUIDE.md        后台使用说明（由「后台使用说明.md」改名，兼容各系统解压）
RELEASE-NOTES.txt     本次导出说明
```

- `data/published.js` 是**已发布内容 + 发布锁**：访客看到的就是导出那一刻的内容，不会读取任何人的浏览器草稿。
- 后台上传的图片会被写成 `assets/uploads/*.png|jpg` 独立文件，**不会覆盖 `assets/` 中的原始作品图**。
- `admin.html` 上线后任何人都能打开，但**只能修改他自己浏览器里的草稿**，改不到线上内容；线上内容只会随你下一次导出的发布包变化。如果不需要在线后台，可以不上传 `admin.html`、`css/admin.css`、`js/admin.js`、`js/zip-writer.js`，站点照常运行。

---

## 五、以后怎么更新内容

1. 本地起服务：`python3 -m http.server 8765`，打开 `http://127.0.0.1:8765/admin.html`。
2. 编辑 → 右上角「导出发布包 ZIP」。
3. 解压新发布包 → 在托管平台重新上传（Netlify 拖拽 / GitHub 提交 / Cloudflare 重新 Deploy）。
4. 刷新线上地址即可看到新内容。

> 后台的草稿只存在你自己的浏览器里。换电脑继续编辑：先用「导出完整配置 JSON」，在新电脑的后台「导入配置 JSON」。

---

## 六、上线后的检查清单

- [ ] 首页、作品总览、关于页、9 个项目详情页都能打开
- [ ] 右上角「中 / EN」可切换，刷新后保持
- [ ] 手机打开无横向滚动，导航可展开
- [ ] 点击作品图能打开高清原页灯箱，左右切换正常
- [ ] 控制台无红色报错（浏览器 F12 → Console）
- [ ] 分享链接到微信 / 社交平台时标题与描述正常

---

## 七、关于分享卡片图片（可选优化）

`index.html` 等页面已经写好 `og:title` / `og:description` / `og:locale`。
社交平台要显示缩略图还需要**绝对地址**的 `og:image`，它依赖你的最终域名，因此没有预置。上线后如需缩略图，在 `<head>` 里加一行（把域名换成你的）：

```html
<meta property="og:image" content="https://你的域名/assets/site/cover-title.png">
```

---

## 八、常见问题

**Q：为什么不能直接给我一个永久链接？**
A：永久链接是托管平台分配的资源，需要在平台上完成一次部署才会生成。上面的方案 A 只需拖一次文件夹，一分钟就能拿到。

**Q：国内访问 GitHub Pages 慢怎么办？**
A：用 Cloudflare Pages，或把站点放在国内对象存储（阿里云 OSS / 腾讯云 COS）并绑定已备案域名。

**Q：发布后修改不生效？**
A：确认上传的是**新导出的发布包**，并强制刷新（`⌘/Ctrl + Shift + R`）。旧文件残留时，先清空托管目录再上传。

**Q：图片太大？**
A：全部作品图都是 PDF 原始内嵌图，为保真未做有损压缩。托管平台会启用 gzip/br 与 CDN 缓存；高清原页只在点击放大时才加载。
