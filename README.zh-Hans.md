![Roselle](icon.png)

# Roselle

![Flarum](https://img.shields.io/badge/flarum-2.x-e7672e?style=flat-square) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[English](README.md) · [简体中文](README.zh-Hans.md)

Roselle 是一个 Flarum 2 主题，灵感来自 Discourse 的 Horizon 主题，布局参考 meta.discourse.org。

Roselle 保留了 Discourse 的结构——带分区的侧栏、分栏的讨论列表、主题信息与时间线、带封面的个人主页——并加入本论坛自己的定制。所有功能都可以在后台开关，整套配色在明暗模式下都由 Flarum 主色派生。

## 环境要求

- Flarum 2.x
- PHP 8.2+

可选扩展会在运行时检测；未安装时相关卡片会被锁定，不会报错。已安装扩展已经实现的功能，主题直接委托给它，只做展示适配——见[集成](#集成)。

## 安装

```sh
composer require lcoy/roselle
php flarum migrate
php flarum assets:publish
```

然后在扩展页启用 **Roselle**。设置位于主题自己的后台面板，分组为外观、页头与侧栏、讨论列表、主题页、编辑器与搜索、个人主页与用户、社区、审核、集成。

如果使用收藏提醒，请保持 cron 中运行 `php flarum schedule:run`。

## 升级

从任意旧版 Roselle 或仍使用 canela 前缀的版本升级：

1. **先备份数据库**——清理迁移会删除废弃表/列，且不可回滚。
2. `composer update lcoy/roselle`
3. `php flarum migrate`——重命名在用表、把 `canela.*` 设置迁到 `lcoy.*`、更新通知类型；随后删除已移除功能的表，并清理所有剩余的 Canela 表、列、设置、权限、通知类型与用户偏好。
4. `php flarum assets:publish`
5. 刷新论坛，并清理 CDN/反代缓存。

每个迁移都会先判断旧名称是否存在，再执行重命名或删除，因此升级中断后可以安全重跑。清理是无条件的：如果站点仍装着 Canela 配套扩展（聊天、AI、徽章、草稿、会话），它们的表和数据也会被删除，扩展将失效；需要保留就先备份。

### 改名带来的破坏性变更

- 设置键 `canela.*` → `lcoy.*`（自动迁移）。
- API/论坛属性与路由 `canela*` / `/canela-*` → `lcoy*` / `/lcoy-*`。
- CSS 类 `.Canela*` → `.Lcoy*`、变量 `--cn-*` → `--lcoy-*`；自定义 CSS 片段需要同步修改。
- 编辑历史、外链点击统计、邀请链接已移除，相关表与数据已删除。
- 旧的 `localStorage` / `sessionStorage` 键会被忽略，可手动清理。

## 功能

**结构**

- 可折叠分区的侧栏、带未读圆点的标签、自定义链接和页脚
- 页头搜索胶囊、带通知面板的用户菜单、登录与注册页面
- 分栏讨论列表（参与者、回复、浏览、活动）、新帖 / 未读 / 热门标签页、标签筛选、无限滚动
- 主题页：讨论信息、时间线、推荐讨论、分享弹窗、标题就地编辑

**阅读与写作**

- Discourse 风格编辑器：工具栏布局、并排预览、相似讨论、关联主题、草稿（fof/drafts）、话题标签和 Flamoji 表情选择器
- 图片放大（fof/photoswipe）、代码块按钮、标题锚点、表格展开、模糊剧透、本地日期
- 收藏提醒、提及卡片、打印视图、复制链接反馈和键盘快捷键

**个人主页与社区**

- 个人主页：简介来自 fof/user-bio，社交链接来自 fof/socialprofile，封面来自 forumaker/profile-cover
- 摘要与活动标签页（阅读、反应、投票、已解决）、用户目录（fof/user-directory）、用户组页面、带额外标签页的关于页、社区守则与法律条款跳转
- 用户卡片浮层

## 集成

主题不会重复实现已安装扩展已有的功能：只对扩展的输出做样式，或读取其数据。适配代码位于 `js/src/forum/thirdparty/` 和各功能模块；「委托」表示扩展负责该功能，主题只负责呈现。

### 已适配扩展

| 扩展 | 主题做了什么 |
|---|---|
| `flarum/tags` | 标签与分类页面、侧栏标签树、`#tag` 编辑器、标签筛选和彩色高亮 |
| `flarum/mentions` | 引用头、话题标签胶囊、内嵌回复和回复对象行 |
| `flarum/likes` | 帖子栏的赞按钮与汇总；主题级「我赞过的」筛选和按赞排序 |
| `flarum/subscriptions` | 主题页脚的 Discourse 风格通知下拉 |
| `flarum/messages` | 个人卡片上的私信按钮和消息面板 |
| `flarum/flags` | 主题页脚举报按钮和举报审核队列 |
| `flarum/approval` | 审核队列和「待审核」筛选 |
| `flarum/lock`、`flarum/sticky` | 搜索筛选，以及在显式排序下仍置顶 |
| `flarum/nicknames` | 帖子、卡片和个人主页在用户名上方显示昵称 |
| `flarum/markdown`、`flarum/bbcode` | 编辑器的格式选择器和工具栏 |
| `flarum/emoji` | 帖子与编辑器预览中的 emoji 渲染 |
| `flarum/pusher` | 浏览主题时的「有 N 条新回复」提示条 |
| `flarum/deck` | `/deck` 看板页适配主题外壳：不再保留页脚空间，全屏时隐藏全局侧栏，并补齐简体中文文案 |
| `fof/discussion-views` | 委托：统计并暴露浏览量。主题保留浏览列和「浏览最多」排序，读取 `views` / `view_count` |
| `pianotell/flarum-ext-flamoji` | 委托：负责编辑器表情选择器；主题围绕它排布工具栏 |
| `fof/photoswipe` | 委托：帖子图片放大 |
| `fof/user-directory` | 委托：`/users` 用户目录页 |
| `fof/user-bio` | 委托：个人简介；主题把它放进主页信息带，并在用户卡片浮层读取 `bioHtml` |
| `fof/socialprofile` | 委托：主页的网站与社交链接 |
| `forumaker/profile-cover` | 委托：封面与卡片背景，包括其编辑器 |
| `fof/best-answer` | 解决方案栏和已采纳答案折叠区 |
| `fof/reactions` | 合并的赞 / 反应按钮和反应汇总 |
| `fof/polls` | Discourse 风格投票网格和票数 |
| `fof/upload` | 编辑器中的上传进度 |
| `fof/drafts` | Discourse 风格草稿：自动保存、恢复、关闭提示和草稿列表 |
| `fof/links` | 链接移入侧栏 |
| `fof/follow-tags` | 分类头部的标签通知铃铛；移除扩展重复的关注按钮 |
| `fof/forum-widgets-core` | 新闻、统计、在线用户小部件作为侧栏分区（不再显示本月发帖之星） |
| `fof/pages` | 关于区域的额外标签页 |
| `fof/terms` | 条款与隐私标签页、`/tos` 和 `/privacy` 跳转 |
| `fof/formatting` | 编辑器格式按钮与 Markdown 表格 |
| `fof/synopsis` | 列表摘要，移入主题行内 |
| `fof/badges` | 徽章项排布在主页信息胶囊和帖子作者旁 |
| `tryhackx/flarum-thumb-sliders` | 禁用其自带行布局；滑块放在主题行内 |
| `lcoy/recommendations` | 推荐标签作为侧栏分区 |
| `huseyinfiliz/stickiest` | 置顶排序；主题的置顶 mutator 覆盖显式排序场景 |

### 可选集成

为当前论坛未运行的扩展预留；安装对应扩展后会自动生效。

| 扩展 | 主题做了什么 |
|---|---|
| `fof/discussion-thumbnail` | 讨论列表标题旁的缩略图 |
| `flarum/realtime` | 「用户正在输入」指示器的样式（Flarum 2 论坛使用 Pusher 替代） |

## 开发

```sh
cd js
npm ci
npm run build          # webpack -> js/dist/forum.js 和 js/dist/admin.js
```

修改 PHP、LESS 或语言文件后，重建 Flarum 的缓存：

```sh
php flarum assets:publish    # 发布 js/dist 和扩展资源
php flarum cache:clear       # 必须以 Web 用户（www）运行，不要用其他用户
```

保存会影响 LESS 的设置（字体、加载动画）时，样式表会在下一次请求时自动重建。如果 `public/assets` 下的编译文件属于其他用户，重建将无法写入——请让 `public/assets` 和 `storage` 归 Web 用户所有。

静态检查：

```sh
composer analyse     # PHPStan
composer test        # PHPUnit
```

发布基于标签。推送 `vX.Y.Z` 标签会运行 `.github/workflows/release.yml`，用 `git archive` 打包已编译的主题（开发文件由 `.gitattributes` 排除），附加 `roselle-X.Y.Z.zip`，并自动生成 release notes 创建 GitHub Release。带后缀的标签（如 `v1.0.0-rc.1`）会成为预发布版本。

## 项目结构

```
extend.php            基础设置、前端资源、服务提供者
extend/               每个功能一个文件；只有 extend/.enabled 中列出的才会加载
  .enabled            功能白名单（每行一个名称）
src/                  PHP：API 资源、格式化器、控制器、策略
js/src/forum/         论坛应用（初始化器、功能、第三方适配层）
js/src/admin/         后台面板（卡片、控件、面板 chunk）
less/                 LESS 源码，由 Flarum 编译
locale/               en.yml、zh-Hans.yml（键必须一致）
migrations/           仅当前启用功能所需的表
views/                错误页覆盖
assets/               字体和语言旗帜
```

某个功能文件加载失败时会被跳过并记录日志，论坛其余部分继续运行。调试单个功能时，可在请求头中发送 `X-Lcoy-Probe: <feature>`，无需改动白名单。

## 语言

主题自带英文和简体中文。核心与扩展的文案来自 Flarum 语言包。

## 致谢

Roselle 由 Lcoy 维护，是非官方项目，与 Discourse 无隶属关系，也未获其背书。原始的 MIT 版权声明保留在 LICENSE 文件中。

## 许可证

[MIT](LICENSE)。
