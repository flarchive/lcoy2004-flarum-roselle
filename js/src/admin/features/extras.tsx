/*
 * “附加”功能卡片：搜索页（编辑器与搜索）、“最佳”按时段
 * （列表）、文字大小（外观）、打印（主题）、
 * 批量选择（审核）。
 */
import { AdminNotice } from '../components/AdminCard';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.extras';

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const cards: CardDef[] = [
  // ── 编辑器与搜索 ─────────────────────────────────────────────────────────
  {
    id: 'search-page',
    group: 'composer',
    icon: 'fas fa-magnifying-glass-plus',
    title: () => trans(`${KEY}.search_title`, '搜索页'),
    description: help(
      'search_page_enabled',
      'Discourse 的 /search 页面：讨论、帖子、标签和用户等标签页，高级筛选（作者、主标签、标签、仅标题、已赞、状态、日期、最少帖子数）以及排序。搜索弹窗中会多出一个「高级搜索」链接。'
    ),
    keywords: '搜索 查找 search 页面 page 高级 advanced 筛选 filters gambits 排序 sort 结果 results',
    master: 'lcoy.search_page_enabled',
    body: () => (
      <AdminNotice>
        {trans(
          `${KEY}.search_notice`,
          '这些筛选项也会成为可在搜索框中直接输入的快捷方式：in:title、in:likes、in:bookmarks 和 min-posts:5，与 Flarum 自带的（author:、tag:、is:locked…）并列。'
        )}
      </AdminNotice>
    ),
  },

  // ── 审核 ──────────────────────────────────────────────────────────────
  {
    id: 'bulk-select',
    group: 'moderation',
    icon: 'fas fa-list-check',
    title: () => trans(`${KEY}.bulk_title`, '批量选择'),
    description: help(
      'bulk_select_enabled',
      '列表工具栏中的一个按钮会打开每个讨论上的复选框和一个操作栏：标记为已读、置顶、关闭、更改标签、隐藏和删除。该按钮只会对能管理列表中某些讨论的人显示，且每个操作只在其拥有权限的范围内生效。'
    ),
    keywords: '选择 批量 selection bulk 多选 select 审核 moderation 置顶 关闭 标签 删除 隐藏 批处理',
    master: 'lcoy.bulk_select_enabled',
  },

  // ── 讨论列表 ───────────────────────────────────────────────────────
  {
    id: 'top-periods',
    group: 'list',
    icon: 'fas fa-trophy',
    title: () => trans(`${KEY}.top_periods_title`, '按时段排行'),
    description: help('top_periods_enabled', '「最佳」标签页显示「全部时间 / 年 / 季度 / 月 / 周 / 今天」，把列表限制在该时段内创建的讨论。'),
    keywords: '最佳 排行 top 时段 period 年 月 周 日 季度 排名',
    master: 'lcoy.top_periods_enabled',
  },

  // ── 外观 ──────────────────────────────────────────────────────────────
  {
    id: 'text-size',
    group: 'appearance',
    icon: 'fas fa-text-height',
    title: () => trans(`${KEY}.text_size_title`, '文字大小'),
    description: help(
      'text_size_enabled',
      '在「设置」中，每个人可以选择较小、正常、较大或最大。与 Discourse 一样，该选择只对当前设备生效（保存在浏览器中）。'
    ),
    keywords: '大小 文字 字体 字号 text size font 无障碍 accessibility 缩放 较大 较小',
    master: 'lcoy.text_size_enabled',
  },

  // ── 主题 ─────────────────────────────────────────────────────────────────
  {
    id: 'print',
    group: 'topic',
    icon: 'fas fa-print',
    title: () => trans(`${KEY}.print_title`, '打印讨论'),
    description: help(
      'print_topic_enabled',
      '将全部帖子加载到一个简洁的视图中（不含侧栏、页头和时间线），并打开浏览器的打印对话框，也可用于另存为 PDF。'
    ),
    keywords: '打印 print 印刷 pdf 纸张 主题',
    master: 'lcoy.print_topic_enabled',
  },
];

export default cards;
