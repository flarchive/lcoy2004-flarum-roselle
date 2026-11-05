/*
 * 基础主题的卡片（extend.php 中 `$forumSettings` 表的键）。
 * 带后端的功能自带卡片（../features）。
 *
 * 模板：一个功能就是一张带 `master`（标题栏开关）的卡片，
 * 内容区只放开启后有效的内容。不属于某个功能的零散选项
 * 放在没有 `master` 的卡片中，每项各有自己的键。
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';

import { trans, getBool, when } from '../util';
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminSelect from '../components/AdminSelect';
import AdminNumber from '../components/AdminNumber';
import { PalettePreview } from '../components/PalettePreview';
import LoaderPicker from '../components/LoaderPicker';
import ContentWidthControl from '../components/ContentWidthControl';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings';

// 每个开关选项都遵循同一模板：键 `lcoy.<名称>`，标签在
// `<名称>_label`，帮助在 `<名称>_help`。
const toggle = (name: string, label: string, help: string, extra: Record<string, any> = {}) => (
  <AdminToggle settingKey={`lcoy.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} {...extra} />
);

/** 主开关的帮助会成为卡片描述。 */
const help = (name: string, text: string) => () => trans(`${KEY}.${name}_help`, text);

const number = (name: string, range: { min: number; max: number; fallback: number }, label: string, helpText: string) => (
  <AdminNumber
    settingKey={`lcoy.${name}`}
    min={range.min}
    max={range.max}
    fallback={range.fallback}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText, { min: range.min, max: range.max })}
  />
);

const TAGS = ['flarum-tags'];

const CORE_CARDS: CardDef[] = [
  // ── 外观 ──────────────────────────────────────────────────────────────
  {
    // 只读卡片：主题没有自己的颜色。没有它，在主题面板中搜索
    // “颜色”的人会一无所获，并以为无法设置。
    id: 'colors',
    group: 'appearance',
    icon: 'fas fa-swatchbook',
    title: () => trans(`${KEY}.section_colors`, '颜色'),
    description: () =>
      trans(
        `${KEY}.colors_help`,
        '本主题没有自己的配色：整套调色板都来自 Flarum 的主色，就像 Discourse 的 Horizon 主题使用其第三色一样。淡色背景、选中态、链接和聚焦环都由它派生，浅色和深色模式均如此。'
      ),
    keywords: '颜色 color colors 主色 primary 调色板 palette 外观 appearance 浅色 深色 light dark oklch',
    body: () => (
      <>
        <PalettePreview />
        <div className="LcoyAdmin-actions">
          <Link className="Button Button--primary" href={app.route('appearance')}>
            {trans(`${KEY}.colors_link`, '在「外观」中修改颜色')}
          </Link>
        </div>
      </>
    ),
  },
  {
    id: 'content-width',
    group: 'appearance',
    icon: 'fas fa-arrows-left-right',
    title: () => trans(`${KEY}.content_width_label`, '内容宽度'),
    keywords: '宽度 width 内容 content 卡片 card box 尺寸 size 宽 wide',
    body: () => <ContentWidthControl />,
  },
  {
    id: 'font',
    group: 'appearance',
    icon: 'fas fa-font',
    title: () => trans(`${KEY}.section_font`, '字体'),
    keywords: '字体 font 排版 typography 字型 family inter jakarta 系统 system',
    body: () => (
      <>
        {/* AdminSelect 在 `change` 时保存：每次保存这个键都会重新编译
            论坛 CSS（它是 LESS 变量），所以不要按按键保存。 */}
        <AdminSelect
          settingKey="lcoy.font"
          label={trans(`${KEY}.font_label`, '论坛字体')}
          help={trans(
            `${KEY}.font_help`,
            '整个论坛使用的字体。Inter 和 Plus Jakarta Sans 随主题提供，覆盖拉丁字母；系统字体不下载任何文件，覆盖所有文字。'
          )}
          options={{
            inter: trans(`${KEY}.font_inter`, 'Inter：主题默认'),
            jakarta: trans(`${KEY}.font_jakarta`, 'Plus Jakarta Sans'),
            system: trans(`${KEY}.font_system`, '系统字体'),
          }}
          default="inter"
        />
        <AdminNotice>{trans(`${KEY}.font_notice`, '更改字体会重新编译论坛 CSS，因此保存需要几秒钟。')}</AdminNotice>
      </>
    ),
  },
  {
    id: 'surfaces',
    group: 'appearance',
    icon: 'fas fa-layer-group',
    title: () => trans(`${KEY}.section_surfaces`, '背景与卡片'),
    keywords: '背景 background 淡色 tinted 卡片 card 边框 surface 白色',
    body: () => (
      <>
        {toggle('tinted_background', '背景使用主色淡化', '内容和侧栏后面的背景会带上一抹主色，如同 Horizon。关闭后，背景保持中性灰色。')}
        {toggle('content_card', '内容置于卡片内', '列表、讨论和个人主页置于背景之上的圆角卡片中。关闭后，内容会占满整个区域，没有边框。')}
      </>
    ),
  },
  {
    id: 'colored-accents',
    group: 'appearance',
    icon: 'fas fa-droplet',
    title: () => trans(`${KEY}.section_colored`, '彩色高亮'),
    description: help(
      'colored_accents',
      '在标签页或讨论中，主题的强调色（按钮、链接、当前标签、淡色背景）会变成该标签的颜色；其它页面恢复论坛的主色。'
    ),
    keywords: '颜色 color 标签 tag 分类 category 强调 accent 彩色 colored 主色 讨论',
    master: 'lcoy.colored_accents',
    extensions: TAGS,
  },
  {
    id: 'pill-buttons',
    group: 'appearance',
    icon: 'fas fa-capsules',
    title: () => trans(`${KEY}.pill_buttons_label`, '胶囊按钮'),
    description: help('pill_buttons', '两端完全圆润的按钮，如同 Horizon。关闭后，按钮使用略微圆角。'),
    keywords: '按钮 按钮组 buttons button 胶囊 pill 圆角 rounded 角 radius',
    master: 'lcoy.pill_buttons',
  },
  {
    id: 'lucide-icons',
    group: 'appearance',
    icon: 'fas fa-icons',
    title: () => trans(`${KEY}.lucide_icons_label`, 'Discourse 图标（Lucide）'),
    description: help(
      'lucide_icons',
      '用 Lucide 细线描边绘制的界面图标（搜索、铃铛、回复、赞、菜单等），与 meta.discourse.org 一致。关闭后，会恢复 Font Awesome 的实心图标。Meta 未替换的图标（品牌图标以及部分为标签和用户组选用的图标）仍保留在 Font Awesome 中。'
    ),
    keywords: '图标 图标 icons icon lucide font awesome 线条 stroke discourse meta',
    master: 'lcoy.lucide_icons',
  },
  {
    id: 'logo-title',
    group: 'appearance',
    icon: 'fas fa-image',
    title: () => trans(`${KEY}.show_title_with_logo_label`, '在徽标旁显示论坛标题'),
    description: help('show_title_with_logo', '在「外观」中上传徽标后，只有开启此项，标题才会显示在徽标旁。没有徽标时，标题始终显示。'),
    keywords: '徽标 logo 品牌 brand 标题 title 名称 页头 header',
    master: 'lcoy.show_title_with_logo',
  },
  {
    id: 'loading-slider',
    group: 'appearance',
    icon: 'fas fa-bars-progress',
    title: () => trans(`${KEY}.loading_slider_label`, '顶部的加载条'),
    description: help(
      'loading_slider',
      '切换页面时，屏幕顶部会有一条细进度条一直显示到页面加载完成，如同 Discourse，取代 Flarum 的「正在加载…」提示。'
    ),
    keywords: '加载 loading 进度条 bar progress 顶部 top 导航 过渡',
    master: 'lcoy.loading_slider',
  },
  {
    // lcoy.loader_* 这些键是 LESS 变量（extend.php）：所选的
    // 图案会进入论坛样式表，并替换所有 LoadingIndicator。
    id: 'loader',
    group: 'appearance',
    icon: 'fas fa-spinner',
    title: () => trans(`${KEY}.loader.title`, '加载动画'),
    description: () =>
      trans(
        `${KEY}.loader.help`,
        '内容加载时显示的动画：出现在列表、帖子、个人主页、弹窗、菜单、按钮、编辑器、扩展以及页面首次加载时。可以用动画 SVG 替换 Flarum 原来的灰色转圈图标。'
      ),
    keywords: '加载 loading spinner preloader 指示器 svg 动画 旋转 avocado',
    body: () => <LoaderPicker />,
  },
  {
    id: 'toast-auto-close',
    group: 'appearance',
    icon: 'far fa-bell',
    title: () => trans(`${KEY}.toast_auto_close_label`, '自动关闭的提示条'),
    description: help(
      'toast_auto_close',
      '角落提示（「已保存」「链接已复制」等）会在几秒后自动消失，并显示倒计时条，类似 Discourse 的提示条。关闭后，它们会一直保留直到被关闭。'
    ),
    keywords: '提示 警告 alerts toasts 通知 关闭 close 自动 auto 时间',
    master: 'lcoy.toast_auto_close',
  },

  // ── 页头与侧栏 ──────────────────────────────────────────────────────────
  {
    id: 'header-search',
    group: 'navigation',
    icon: 'fas fa-magnifying-glass',
    title: () => trans(`${KEY}.section_header_search`, '页头搜索'),
    description: help('header_search', '页头中间的胶囊形搜索框，如同 Discourse。关闭后，页头恢复 Flarum 的默认搜索。'),
    keywords: '搜索 search 页头 header 胶囊 pill',
    master: 'lcoy.header_search',
  },
  {
    id: 'user-menu',
    group: 'navigation',
    icon: 'far fa-circle-user',
    title: () => trans(`${KEY}.user_menu_label`, 'Discourse 用户菜单'),
    description: help(
      'user_menu',
      '页头头像会打开一个面板，其中包含通知、回复、赞、私信、收藏、审核和个人主页等标签页（取代 Flarum 的铃铛和会话菜单）。'
    ),
    keywords: '菜单 用户 user 头像 avatar 通知 notifications 铃铛 bell 面板 panel 页头 header',
    master: 'lcoy.user_menu',
  },
  {
    // 登录/注册功能的键（extend/auth.php）：页面只有在
    // 服务器加载其路由后才存在。
    id: 'auth-pages',
    group: 'navigation',
    icon: 'fas fa-right-to-bracket',
    title: () => trans(`${KEY}.auth.pages_label`, '整页登录和注册'),
    description: () =>
      trans(`${KEY}.auth.pages_help`, '页头的「登录」和「注册」按钮会像 Discourse 那样打开 /login 和 /signup 页面。关闭后，它们会打开弹窗。'),
    keywords: '登录 login 注册 注册 signup sign up 页面 page 弹窗 modal 账户 account',
    master: 'lcoy.auth_pages',
    lockedBy: () =>
      getBool('lcoy.auth_routes_backend')
        ? null
        : trans(`${KEY}.shell.auth_backend_off`, '服务器尚未加载 /login 和 /signup 页面（extend/auth.php），因此按钮仍会打开弹窗。'),
  },
  {
    id: 'shortcuts',
    group: 'navigation',
    icon: 'far fa-keyboard',
    title: () => trans(`${KEY}.section_shortcuts`, '键盘快捷键'),
    description: help(
      'keyboard_shortcuts',
      'Discourse 的快捷键：/ 搜索，c 新讨论，r 回复，j 和 k 在列表中移动，g h 返回首页，= 打开或关闭侧栏，? 显示完整列表。在输入框中输入时它们不会生效。'
    ),
    keywords: '快捷键 shortcuts 键盘 keyboard 按键 keys hotkeys',
    master: 'lcoy.keyboard_shortcuts',
  },
  {
    id: 'sidebar',
    group: 'navigation',
    icon: 'fas fa-table-columns',
    title: () => trans(`${KEY}.section_sidebar`, '侧栏'),
    description: help('sidebar_enabled', '包含导航和标签的左栏，如同 Discourse。关闭后，论坛会恢复 Flarum 的默认导航。'),
    keywords: '侧栏 sidebar 菜单 导航 navigation 展开 open 新主题 new topic 页脚 footer',
    master: 'lcoy.sidebar_enabled',
    body: () => (
      <>
        {toggle(
          'sidebar_open_default',
          '默认展开',
          '对于尚未用页头按钮打开或关闭过侧栏的人，侧栏的显示方式。之后各访客的选择优先，并保存在其浏览器中。'
        )}
        {toggle('sidebar_new_topic', '「发起讨论」按钮', '侧栏顶部的按钮，会打开编辑器以发起新讨论。')}
        {toggle('sidebar_footer', '侧栏页脚', '侧栏底部的按钮：浅色或深色主题、新讨论和键盘快捷键。')}
      </>
    ),
  },
  {
    id: 'sidebar-tags',
    group: 'navigation',
    icon: 'fas fa-tags',
    title: () => trans(`${KEY}.section_sidebar_tags`, '标签'),
    keywords: '分类 categories 标签 tags 侧栏 sidebar 限制 limit 数量 圆点 dot 新动态',
    dependsOn: 'lcoy.sidebar_enabled',
    extensions: TAGS,
    body: () => (
      <>
        {toggle('sidebar_categories', '标签区域', '主标签，每个带有自己的颜色或图标，以及指向全部标签的链接。')}
        {when(
          'lcoy.sidebar_categories',
          <AdminSubGroup>
            <AdminToggle
              settingKey="lcoy.sidebar_category_dots"
              label={trans('lcoy-roselle.admin.settings.gaps.sidebar_category_dots_label', '标签上的新动态圆点')}
              help={trans(
                'lcoy-roselle.admin.settings.gaps.sidebar_category_dots_help',
                '有新帖或未读讨论的标签旁会有一个圆点，和「全部讨论」上的一样。'
              )}
            />
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle('sidebar_tags', '二级标签区域', '二级标签，以及指向全部标签的链接。')}
        {when(
          'lcoy.sidebar_tags',
          <AdminSubGroup>
            {number(
              'sidebar_tags_limit',
              { min: 1, max: 50, fallback: 6 },
              '侧栏中的二级标签',
              '在「全部标签」链接之前列出多少个二级标签，从 {min} 到 {max}。'
            )}
          </AdminSubGroup>
        )}
      </>
    ),
  },

  // ── 讨论列表 ───────────────────────────────────────────────────────
  {
    id: 'welcome-banner',
    group: 'list',
    icon: 'fas fa-panorama',
    title: () => trans(`${KEY}.section_welcome_banner`, '欢迎横幅'),
    description: help('welcome_banner', '「外观」中设置的欢迎标题和消息会以横幅形式显示在淡色背景之上，如同 Horizon。关闭后，页面直接从列表开始。'),
    keywords: '横幅 banner 欢迎 welcome hero 访客 guests 搜索 search 首页 home',
    master: 'lcoy.welcome_banner',
    body: () => (
      <>
        {toggle('welcome_banner_guests_only', '仅访客', '已登录成员会直接进入列表；横幅面向首次访问的访客。')}
        {toggle('welcome_banner_search', '横幅中的搜索框', '横幅中间的大号搜索框，会打开论坛搜索。')}
      </>
    ),
  },
  {
    id: 'category-hero',
    group: 'list',
    icon: 'fas fa-folder-open',
    title: () => trans(`${KEY}.section_category_hero`, '标签页头'),
    description: help('category_hero', '在标签页面中，列表之前显示一个包含图标、颜色、名称和描述的页头。'),
    keywords: '分类 category hero 页头 header 子分类 subcategories 子标签 children 卡片 cards 标签',
    master: 'lcoy.category_hero',
    extensions: TAGS,
    body: () => toggle('category_hero_children', '子标签以卡片显示', '页头下方，子标签以可点击的卡片形式显示。'),
  },
  {
    id: 'list-tabs',
    group: 'list',
    icon: 'fas fa-bars-staggered',
    title: () => trans(`${KEY}.section_nav`, '列表标签页'),
    keywords: '标签页 tabs 导航 navigation 未读 unread 热门 hot 天数 days 最新 latest 吸顶 sticky 固定',
    body: () => (
      <>
        {toggle('nav_unread', '未读标签页', '包含某人尚未阅读的回复的讨论。仅对已登录成员显示。')}
        <SubDivider />
        {toggle('nav_hot', '热门标签页', '最近几天发起的讨论中回复最多的那些。')}
        {when(
          'lcoy.nav_hot',
          <AdminSubGroup>
            {number('hot_days', { min: 1, max: 365, fallback: 7 }, '热门的统计天数', '统计的时间范围，从 {min} 到 {max} 天。')}
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle('nav_sticky', '吸顶标签页', '滚动列表时，标签栏会吸在页头下方，如同 Horizon。meta.discourse.org 不吸顶。')}
      </>
    ),
  },
  {
    id: 'list-filters',
    group: 'list',
    icon: 'fas fa-filter',
    title: () => trans(`${KEY}.section_nav_categories`, '标签筛选'),
    keywords: '筛选 filters 菜单 dropdowns 分类 categories 标签 tags 标签页 tab 导航',
    extensions: TAGS,
    body: () => (
      <>
        {toggle('nav_dropdowns', '标签菜单', '标签页左侧的菜单，用于按主标签和二级标签筛选列表，如同 Discourse。')}
        {toggle('nav_categories_link', '「标签」标签页', '指向包含全部标签页面的标签页。')}
      </>
    ),
  },
  {
    id: 'list-columns',
    group: 'list',
    icon: 'fas fa-table-list',
    title: () => trans(`${KEY}.section_list_columns`, '列表列'),
    keywords: '列 columns 页头 header 参与者 posters 头像 avatars 浏览 views 热度 heat 计数 摘要 excerpt 置顶 pinned',
    body: () => (
      <>
        {toggle('list_header', '列标题', '列表上方包含「讨论」「回复」「浏览」和「活动」的那一行。')}
        {toggle('list_posters', '参与者的头像', '每条讨论旁显示作者和最后回复者的头像，类似 Discourse 的发帖人列。')}
        {toggle('list_views', '浏览列', '每条讨论被浏览的次数，由 fof/discussion-views 统计。未启用该扩展时不会显示这一列。')}
        {toggle('list_heat', '高数值高亮', '当数值远高于其它时，将其显示为橙色或红色，类似 Discourse 的热力图。')}
        {toggle('list_excerpts', '置顶讨论的摘要', '标题下方显示置顶讨论第一条帖子的开头。')}
      </>
    ),
  },
  {
    id: 'infinite-scroll',
    group: 'list',
    icon: 'fas fa-arrows-down-to-line',
    title: () => trans(`${KEY}.list_infinite_scroll_label`, '无限滚动'),
    description: help('list_infinite_scroll', '当列表末尾接近屏幕时，下一页会自动加载，如同 Discourse。关闭后，仍保留 Flarum 的「加载更多」按钮。'),
    keywords: '无限滚动 infinite scroll 加载更多 load more 分页 pagination',
    master: 'lcoy.list_infinite_scroll',
  },
  {
    id: 'categories-page',
    group: 'list',
    icon: 'fas fa-table-cells-large',
    title: () => trans(`${KEY}.section_categories_page`, '标签页面'),
    keywords: '分类 categories 页面 page 盒子 boxes 列表 list 布局 标签',
    extensions: TAGS,
    body: () => (
      <AdminSelect
        settingKey="lcoy.categories_layout"
        label={trans(`${KEY}.categories_layout_label`, '布局')}
        help={trans(`${KEY}.categories_layout_help`, '全部标签页面展示标签的方式。')}
        options={{
          boxes: trans(`${KEY}.categories_layout_boxes`, '盒子：带有颜色、描述和子标签的卡片'),
          list: trans(`${KEY}.categories_layout_list`, '列表：标签及其最新讨论的表格'),
        }}
        default="boxes"
      />
    ),
  },

  // ── 主题 ─────────────────────────────────────────────────────────────────
  {
    id: 'topic-map',
    group: 'topic',
    icon: 'fas fa-map',
    title: () => trans(`${KEY}.section_topic_map`, '讨论信息'),
    description: help('topic_map', '首帖下方显示包含创建日期、最后回复、回复数量和参与者的摘要。'),
    keywords: '信息 map 摘要 summary 参与者 回复 replies 主题 topic',
    master: 'lcoy.topic_map',
  },
  {
    id: 'topic-timeline',
    group: 'topic',
    icon: 'fas fa-timeline',
    title: () => trans(`${KEY}.section_topic_timeline`, '时间线'),
    description: help('topic_timeline', '右侧的进度条，显示你在讨论中的位置，并可跳转到任意帖子。'),
    keywords: '时间线 timeline 滚动 scrubber 导航 帖子 posts 主题 返回 back',
    master: 'lcoy.topic_timeline',
    body: () => (
      <AdminToggle
        settingKey="lcoy.timeline_back"
        label={trans('lcoy-roselle.admin.settings.gaps.timeline_back_label', '时间线上的「返回」按钮')}
        help={trans(
          'lcoy-roselle.admin.settings.gaps.timeline_back_help',
          '当读者滚到已读位置上方很远时，时间线轨道上会出现一个按钮，点它回到最后未读的帖子。'
        )}
      />
    ),
  },
  {
    // Discourse 风格的帖子，使用 avocado 时间线连接头像
    // （less/forum/PostDirect.less，通过 Lcoy--postDirect 类）。对所有人生效：
    // 该选择仅由管理员设置。
    id: 'post-style',
    group: 'topic',
    icon: 'fas fa-comments',
    title: () => trans(`${KEY}.post_style_label`, '帖子样式'),
    keywords: '样式 style 帖子 posts 讨论 discussion 直接 direct avocado discourse 时间线 timeline 头像 对话 conversation',
    body: () => (
      <AdminSelect
        settingKey="lcoy.post_style"
        label={trans(`${KEY}.post_style_label`, '帖子样式')}
        help={trans(
          `${KEY}.post_style_help`,
          '使用时间线时，帖子与 Discourse 保持一致，但会有一条类似 avocado 主题的竖线，把一条帖子的头像连接到下一条，穿过事件通知，并用圆圈标记时间间隔（「一个月后」）。平板宽度及以上生效；手机上帖子保持原样。'
        )}
        options={{
          discourse: trans(`${KEY}.post_style_discourse`, 'Discourse（默认）'),
          direct: trans(`${KEY}.post_style_direct`, '使用时间线（avocado 风格）'),
        }}
        default="discourse"
      />
    ),
  },
  {
    // avocado 的“回复”标识（用户名下方一行），与
    // 时间线和内嵌回复无关。
    id: 'reply-to-style',
    group: 'topic',
    icon: 'fas fa-reply',
    title: () => trans(`${KEY}.topic_reply_to_style_label`, '帖子上的「回复」标识'),
    keywords: '回复 回复他人 in reply to 响应 reply 提及 mention 页头 header avocado discourse 行 line',
    extensions: ['flarum-mentions'],
    body: () => (
      <AdminSelect
        settingKey="lcoy.topic_reply_to_style"
        label={trans(`${KEY}.topic_reply_to_style_label`, '帖子上的「回复」标识')}
        help={trans(
          `${KEY}.topic_reply_to_style_help`,
          '用于设置回复他人的帖子如何显示它回复的对象。在 Discourse 中，页头右侧显示「↩ 名称」（仅在所回复的帖子不是其上方那条时）。在 avocado 中，每条回复的用户名下方都有一行「↳ 回复 [头像] 名称」。点击可查看被回复的帖子。'
        )}
        options={{
          discourse: trans(`${KEY}.topic_reply_to_style_discourse`, 'Discourse（默认：页头右侧的 ↩ 名称）'),
          avocado: trans(`${KEY}.topic_reply_to_style_avocado`, '用户名下方的一行（avocado 风格）'),
        }}
        default="discourse"
      />
    ),
  },
  {
    id: 'post-actions',
    group: 'topic',
    icon: 'fas fa-ellipsis',
    title: () => trans(`${KEY}.post_actions_label`, 'Discourse 帖子操作'),
    description: help(
      'post_actions',
      '在每条帖子的操作栏中显示赞、复制链接、收藏、回复，以及展开其余操作的「…」，如同 Discourse。关闭后，会恢复 Flarum 的操作菜单。'
    ),
    keywords: '操作 actions 栏 bar 帖子 post 赞 like 回复 reply 菜单 控件 controls',
    master: 'lcoy.post_actions',
  },
  {
    id: 'embedded-replies',
    group: 'topic',
    icon: 'fas fa-reply-all',
    title: () => trans(`${KEY}.embedded_replies_label`, '内嵌回复'),
    description: help('embedded_replies', '每条帖子的「N 条回复」会在其下方打开回复，被引用的帖子会显示在上方，如同 Discourse。'),
    keywords: '回复 replies 内嵌 embedded 提及 mentions 引用 quote 下方 inline',
    master: 'lcoy.embedded_replies',
    extensions: ['flarum-mentions'],
  },
  {
    id: 'new-replies-bar',
    group: 'topic',
    icon: 'fas fa-arrow-down-short-wide',
    title: () => trans(`${KEY}.new_replies_bar_label`, '新回复提示'),
    description: help('new_replies_bar', '当实时回复到达时，正在浏览该讨论的人会看到「有 N 条新回复」提示条，点击即可前往，如同 Discourse。'),
    keywords: '新回复 new replies 实时 realtime 栏 bar 提示 websocket',
    master: 'lcoy.new_replies_bar',
    extensions: ['flarum-realtime'],
  },
  {
    id: 'event-posts',
    group: 'topic',
    icon: 'fas fa-thumbtack',
    title: () => trans(`${KEY}.topic_event_posts_label`, '事件帖'),
    description: help('topic_event_posts', '在讨论中显示 Flarum 的通知，例如「锁定了讨论」和「置顶了讨论」。Discourse 不会这样显示。'),
    keywords: '事件 event 帖子 posts 锁定 locked 置顶 pinned 重命名 renamed 提示',
    master: 'lcoy.topic_event_posts',
  },
  {
    id: 'sticky-avatar',
    group: 'topic',
    icon: 'fas fa-user-pen',
    title: () => trans(`${KEY}.topic_sticky_avatar_label`, '帖子中的吸顶头像'),
    description: help('topic_sticky_avatar', '在长帖子中，作者头像会跟随滚动并保持可见，直到帖子结束，类似 avocado 主题。仅桌面端。'),
    keywords: '头像 吸顶 sticky 跟随 滚动 scroll fixed avatar 长帖',
    master: 'lcoy.topic_sticky_avatar',
  },
  {
    id: 'topic-footer',
    group: 'topic',
    icon: 'fas fa-grip-lines',
    title: () => trans(`${KEY}.section_topic_footer`, '讨论页脚'),
    description: help('topic_footer', '最后一条帖子之后显示回复、分享和关注，如同 Discourse。关注需要 Subscriptions 扩展。'),
    keywords: '页脚 footer 按钮 buttons 回复 reply 分享 share 关注 follow subscriptions',
    master: 'lcoy.topic_footer',
  },
  {
    id: 'suggested',
    group: 'topic',
    icon: 'far fa-lightbulb',
    title: () => trans(`${KEY}.section_suggested`, '推荐讨论'),
    description: help('suggested_topics', '讨论末尾显示一个简短的其他讨论列表，方便继续阅读，优先来自同一标签。'),
    keywords: '推荐 suggested 相关 related 主题 topics 数量 count',
    master: 'lcoy.suggested_topics',
    body: () => number('suggested_count', { min: 1, max: 20, fallback: 5 }, '讨论数量', '推荐多少个讨论，从 {min} 到 {max}。'),
  },

  // ── 个人主页与用户 ──────────────────────────────────────────────────
  {
    id: 'user-page',
    group: 'people',
    icon: 'far fa-id-badge',
    title: () => trans(`${KEY}.section_user_page`, '个人主页'),
    keywords:
      '个人主页 profile 用户 user 封面 cover 统计 stats 摘要 summary 标签页 tab 活动 activity 已读 read 表情回应 reactions 投票 votes 已解决 solved',
    body: () => (
      <>
        {toggle('user_cover', '个人主页顶部的封面', '大头像和用户名后面的宽幅背景，如同 Discourse。')}
        {toggle('user_stats', '统计', '用户名下方显示加入日期、最后访问时间以及帖子和讨论数量。只有启用 Likes 扩展时才显示赞。')}
        {toggle('user_summary', '摘要标签页', '第一个标签页，显示该用户的各项数据及其主要讨论和回复。')}
        {/* 没有摘要标签页时，在该标签页打开个人主页就没有地方可去。 */}
        {getBool('lcoy.user_summary') && (
          <AdminSubGroup>
            <AdminSelect
              settingKey="lcoy.user_default_tab"
              label={trans(`${KEY}.user_default_tab_label`, '打开个人主页时')}
              help={trans(`${KEY}.user_default_tab_help`, '点击头像或昵称时，个人主页默认打开哪个标签页。')}
              options={{
                activity: trans(`${KEY}.user_default_tab_activity`, '活动（帖子），同 Flarum'),
                summary: trans(`${KEY}.user_default_tab_summary`, '概要，同 Discourse'),
              }}
              default="summary"
            />
          </AdminSubGroup>
        )}
        {/* Discourse“活动”中依赖扩展的子标签页（extend/activity.php）。 */}
        {toggle('user_activity_read', '已读标签页', '在「活动」下，显示某人已读的讨论，按时间从新到旧排列。仅本人和管理员可见。')}
        {toggle(
          'user_activity_reactions',
          '表情回应标签页',
          '在「活动」下，将该用户给出的赞和表情回应合并为一个列表（取代 Likes），并显示表情和帖子摘要。只有有权查看回应者身份的人才能看到这些表情回应。',
          { extension: 'fof-reactions' }
        )}
        {toggle('user_activity_votes', '投票标签页', '在「活动」下，显示某人参与投票的带投票帖。其他人只能看到公开投票者的投票。', {
          extension: 'fof-polls',
        })}
        {toggle('user_activity_solved', '已解决标签页', '在「活动」下，显示该用户被选为最佳答案的回复。', {
          extension: 'fof-best-answer',
        })}
      </>
    ),
  },
  {
    id: 'user-card',
    group: 'people',
    icon: 'far fa-address-card',
    title: () => trans(`${KEY}.section_user_card`, '用户卡片'),
    description: help('user_card', '一个简洁的卡片，包含头像、数据和主页链接，可由他人的头像或用户名打开，无需离开当前页面。'),
    keywords: '卡片 card 用户 user 个人主页 profile 头像 名称 popup 提及 mention',
    master: 'lcoy.user_card',
    body: () => (
      <AdminToggle
        settingKey="lcoy.mention_cards"
        label={trans('lcoy-roselle.admin.settings.gaps.mention_cards_label', '提及时的用户卡片')}
        help={trans('lcoy-roselle.admin.settings.gaps.mention_cards_help', '点击 @提及会打开用户卡片，而不是跳转到个人主页。')}
      />
    ),
  },
];

export default CORE_CARDS;
