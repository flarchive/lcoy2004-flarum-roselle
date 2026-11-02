/*
 * 之前缺失的 Discourse 功能卡片（js/src/forum/gaps）：帖子
 * 内容（代码、标题、表格、剧透）、讨论内的阅读、
 * 可编辑标题、分享、本地日期、列表的
 * “上次访问”和“忽略”、侧栏的首页和额外链接，
 * 以及带后端的功能（给作者的提示、404）。提及中
 * 用户卡片选项位于用户卡片卡片（../cards/core），
 * 时间线的“返回”则位于时间线卡片。
 */
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminSelect from '../components/AdminSelect';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';
import AdminTextarea from './AdminTextarea';
import { getBool, getStr, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.gaps';

const toggle = (name: string, label: string, helpText: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`lcoy.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText)}
    dependsOn={dependsOn}
  />
);

const text = (name: string, label: string, helpText: string, placeholder = '', rows = 1) => (
  <AdminTextarea
    settingKey={`lcoy.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText)}
    placeholder={placeholder}
    rows={rows}
  />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

/** 带后端的功能（extend/gaps.php）只有在服务器加载它后才生效。 */
const backendOff = (): string | null =>
  getBool('lcoy.gaps_backend') ? null : trans(`${KEY}.backend_off`, '这些功能的后端（extend/gaps.php）还没有在服务器上加载。');

const cards: CardDef[] = [
  // ── 主题 ─────────────────────────────────────────────────────────────────
  {
    id: 'post-content',
    group: 'topic',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.cooked_title`, '帖子内容'),
    keywords: '图片 image 代码 code 复制 copy 全屏 fullscreen 锚点 anchor 标题 heading 表格 table 展开 spoiler 模糊 blur markdown',
    body: () => (
      <>
        {toggle('code_buttons', '代码块按钮', '鼠标悬停在代码块上时显示「复制」和「全屏」，与 Discourse 一致。')}
        {toggle('heading_anchors', '标题链接', '帖子内的标题在悬停时出现链接图标（#），可直接定位到该段落。')}
        {toggle('table_expand', '展开宽表格', '超出帖子宽度的表格会出现「展开表格」按钮，在独立大窗口中打开。')}
        {toggle('spoiler_blur', '模糊剧透', '剧透内容（||文本|| 和行首的 >!）在点击前保持模糊，与 Discourse 一致，而不是显示深色遮罩。')}
        {isExtensionEnabled('fof-formatting') && (
          <AdminNotice>
            {trans(`${KEY}.tables_notice`, 'Markdown 表格（| a | b |），同 Discourse：请在 FoF Formatting 里开启 PipeTables。')}
          </AdminNotice>
        )}
      </>
    ),
  },
  {
    id: 'reading',
    group: 'topic',
    icon: 'fas fa-book-open-reader',
    title: () => trans(`${KEY}.reading_title`, '讨论内的阅读与跳转'),
    keywords: '已读 read 未读 unread 圆点 dot 上次访问 last visit 快捷键 shortcuts 键盘 keyboard j k',
    body: () => (
      <>
        {toggle('post_read_state', '已读标记', '每条新帖子角落的「未读」圆点，读过后消失；上次阅读位置之后还会显示红色的「上次访问」分隔线。')}
        {/* 帖子的快捷键是键盘快捷键的一部分：没有它们，这些操作就会消失。 */}
        {toggle(
          'post_shortcuts',
          '帖子快捷键',
          'j/k 在帖子间移动，l、b、s、e、r、q、d、! 作用于当前选中的帖子；# 跳转到指定帖子；Home/End、shift+L、shift+R、shift+S、shift+P、f、m w/m r/m m 以及 g n、g u、g b、g m、g d、g j、g k 等组合键；按 ? 可查看完整列表。',
          'lcoy.keyboard_shortcuts'
        )}
      </>
    ),
  },
  {
    id: 'inline-title',
    group: 'topic',
    icon: 'fas fa-pencil',
    title: () => trans(`${KEY}.inline_title_editor_label`, '在页头直接改标题'),
    description: help('inline_title_editor', '有重命名权限的人会在讨论标题旁看到一个铅笔图标：标题变成输入框，并带有标签按钮和 ✓/✕ 用于保存或取消。'),
    keywords: '标题 title 编辑 edit 铅笔 pencil 重命名 rename 标签 tags 分类 category',
    master: 'lcoy.inline_title_editor',
  },
  {
    id: 'share',
    group: 'topic',
    icon: 'fas fa-share-nodes',
    title: () => trans(`${KEY}.share_modal_label`, '「分享讨论」弹窗'),
    description: help(
      'share_modal',
      '点击「分享」会打开 Discourse 风格的弹窗，包含链接、复制按钮和各平台按钮；关闭后仅复制链接。手机上使用系统分享面板。'
    ),
    keywords: '分享 share 社交网络 social networks x twitter facebook whatsapp telegram linkedin reddit email',
    master: 'lcoy.share_modal',
    body: () =>
      text(
        'share_networks',
        '分享平台',
        '用逗号分隔，按显示顺序排列：x、facebook、linkedin、whatsapp、telegram、reddit、email。',
        'x,facebook,whatsapp,email'
      ),
  },
  {
    id: 'local-dates',
    group: 'topic',
    icon: 'far fa-calendar',
    title: () => trans(`${KEY}.local_dates_label`, '本地时间'),
    description: help('local_dates', '[date=2026-10-20 time=14:00 timezone="America/Sao_Paulo"] 会按读者的时区显示日期和时间。清理缓存后生效。'),
    keywords: '日期 date 时区 timezone 时间 time 本地 local',
    master: 'lcoy.local_dates',
    lockedBy: backendOff,
  },

  // ── 审核 ──────────────────────────────────────────────────────────────
  {
    id: 'author-notifications',
    group: 'moderation',
    icon: 'fas fa-bell',
    title: () => trans(`${KEY}.notifications_title`, '给作者的提示'),
    keywords: '通知 notification 编辑 edited 链接 linked 作者 author 审核',
    lockedBy: backendOff,
    body: () => (
      <>
        {toggle('notify_post_edited', '帖子被编辑时通知', '当其他人（例如管理人员）修改正文时，向作者发送「某某编辑了你的帖子」。')}
        {toggle('notify_topic_linked', '讨论被链接时通知', '当某个帖子链接到你的讨论时，发送「某某链接了你的讨论」。')}
      </>
    ),
  },
  // ── 社区 ─────────────────────────────────────────────────────────────
  {
    id: 'not-found',
    group: 'community',
    icon: 'far fa-compass',
    title: () => trans(`${KEY}.not_found_page_label`, 'Discourse 风格的 404 页面'),
    description: help('not_found_page', '用「糟糕！该页面不存在或为私密页面。」，以及「返回首页」、搜索框和热门/最新讨论，替代简单的错误页面。'),
    keywords: '404 页面 未找到 not found 错误 error',
    master: 'lcoy.not_found_page',
    lockedBy: backendOff,
  },

  // ── 讨论列表 ───────────────────────────────────────────────────────
  {
    id: 'list-visit',
    group: 'list',
    icon: 'fas fa-clock-rotate-left',
    title: () => trans(`${KEY}.list_title`, '上次访问与忽略'),
    keywords: '上次访问 last visit 分隔线 separator 线 line 忽略 dismiss 新 new 未读 unread 标记已读',
    body: () => (
      <>
        {toggle(
          'list_last_visit',
          '「上次访问」分隔线',
          '在「最新」列表中，用一条红线把上次访问后发生变化的话题与之前已如此的区分开。上次访问时间保存在读者设备上。'
        )}
        {toggle('list_dismiss', '「忽略」按钮', '在「未读」和「新」列表中，Discourse 风格的按钮可将列表中的话题全部标记为已读（右上角及列表末尾）。')}
      </>
    ),
  },

  // ── 侧栏 ──────────────────────────────────────────────────────────
  {
    id: 'sidebar-home',
    group: 'navigation',
    icon: 'fas fa-house',
    title: () => trans(`${KEY}.sidebar_home_link_label`, '「首页」链接'),
    description: help(
      'sidebar_home_link',
      '侧栏的第一个链接，与 Discourse 一致。当它指向讨论列表时，「全部讨论」会改为打开「最新」列表，以免两者同时被标记。'
    ),
    keywords: '首页 home 主页 homepage 目标 侧栏 sidebar',
    master: 'lcoy.sidebar_home_link',
    dependsOn: 'lcoy.sidebar_enabled',
    body: () => (
      <>
        <AdminSelect
          settingKey="lcoy.sidebar_home"
          label={trans(`${KEY}.sidebar_home_label`, '目标页面')}
          options={{
            index: trans(`${KEY}.sidebar_home_index`, '讨论列表（首页）'),
            categories: trans(`${KEY}.sidebar_home_categories`, '标签'),
            url: trans(`${KEY}.sidebar_home_url_option`, '其它地址'),
          }}
          default="index"
        />
        {getStr('lcoy.sidebar_home') === 'url' && (
          <AdminSubGroup>{text('sidebar_home_url', '首页地址', '论坛内地址（如 /p/welcome）或其他网站的地址。', '/')}</AdminSubGroup>
        )}
      </>
    ),
  },
  {
    id: 'sidebar-links',
    group: 'navigation',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.sidebar_title`, '额外链接'),
    description: () =>
      trans(`${KEY}.sidebar_help`, '和 Discourse 一样，填了地址的 FAQ、服务条款和隐私链接会进入「更多」菜单。「审核」只对版主显示，带着举报队列。'),
    keywords: '链接 links faq 常见问题 社区守则 guidelines 条款 terms 隐私 privacy 分区 section 自定义 custom 更多 more 审核 review',
    dependsOn: 'lcoy.sidebar_enabled',
    body: () => (
      <>
        {text('sidebar_faq_url', 'FAQ / 社区准则', '常见问题或社区准则页面的地址。', 'https://')}
        {text('sidebar_tos_url', '服务条款', '服务条款的地址。', 'https://')}
        {text('sidebar_privacy_url', '隐私政策', '隐私政策的地址。', 'https://')}
        <SubDivider />
        {text('sidebar_custom_title', '自定义分区标题', '链接分区的名称（默认「链接」）。', '链接')}
        {text(
          'sidebar_custom_links',
          '自定义分区链接',
          '每行一个链接：名称 | 地址 | 图标（可选，Font Awesome 图标）。以 / 开头的地址指向本站。没有链接时该分区不显示。',
          '博客 | https://example.com/blog | fas fa-newspaper\n规则 | /p/rules',
          4
        )}
      </>
    ),
  },
];

export default cards;
