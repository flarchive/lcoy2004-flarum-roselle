/*
 * 主题面板（选项卡、卡片、搜索）：按需加载的 chunk，只在
 * 扩展页面打开时下载。面板的搜索会查找这里的卡片，
 * 因此保持不变。
 */
import { createPanel } from './components/SettingsPanel';
import type { CardDef } from './types';
import CORE_CARDS from './cards/core';
import FEATURE_CARDS from './features';

const ORDER: string[] = [
  // 外观
  'colors',
  'font',
  'surfaces',
  'content-width',
  'colored-accents',
  'pill-buttons',
  'lucide-icons',
  'logo-title',
  'text-size',
  'loading-slider',
  'loader',
  'toast-auto-close',
  // 页头与侧边栏
  'header-search',
  'user-menu',
  'auth-pages',
  'shortcuts',
  'sidebar',
  'sidebar-home',
  'sidebar-tags',
  'sidebar-links',
  // 列表
  'welcome-banner',
  'category-hero',
  'list-tabs',
  'list-filters',
  'list-columns',
  'views',
  'counts',
  'list-visit',
  'top-periods',
  'infinite-scroll',
  'categories-page',
  // 主题
  'post-style',
  'sticky-avatar',
  'reply-to-style',
  'post-actions',
  'embedded-replies',
  'post-content',
  'reading',
  'topic-timeline',
  'topic-map',
  'topic-footer',
  'suggested',
  'new-replies-bar',
  'inline-title',
  'share',
  'bookmarks',
  'local-dates',
  'print',
  'event-posts',
  // 编辑器与搜索
  'composer',
  'drafts',
  'hashtags',
  'search-page',
  // 个人资料与用户
  'user-page',
  'user-card',
  'activity',
  // 社区
  'about',
  'guidelines',
  'about_pages',
  'legal',
  'groups',
  'not-found',
  // 审核
  'bulk-select',
  'author-notifications',
];

const rank = (card: CardDef) => {
  const index = ORDER.indexOf(card.id);

  return index === -1 ? ORDER.length : index;
};

const CARDS: CardDef[] = [...CORE_CARDS, ...FEATURE_CARDS].sort((a, b) => rank(a) - rank(b));

export default createPanel(CARDS);
