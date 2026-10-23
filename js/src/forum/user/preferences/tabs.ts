/*
 * 设置标签页，与 Discourse 一致（账户、安全、资料、通知、跟踪、用户、
 * 界面、导航菜单、聊天）。每个标签页是一个独立地址，
 * `/u/:username/preferences/:tab`。
 *
 * 各区域仍来自 SettingsPage 的 `settingsItems`（核心和扩展）；
 * 这里只决定每个区域出现在哪个标签页。没有任何映射表认识的分区会进入
 * “其他”，以免消失。
 *
 * 有两个标签页属于其他组件：“安全”是核心的 UserSecurityPage，
 * “用户”是 fof/ignore-users 的忽略列表。
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import { isExtensionEnabled } from '../../utils/settings';
import { isTagsEnabled } from '../../utils/tags';
import { thirdParty } from '../../thirdparty/settings';

export type PrefTab = 'account' | 'security' | 'profile' | 'notifications' | 'tracking' | 'users' | 'interface' | 'navigation-menu' | 'other';

export const TAB_ROUTE = 'user.preferences.tab';
export const BASE_ROUTE = 'user.preferences';

/** 标签页图标，与 Discourse 的 `user-navigation-secondary` 相同。 */
export const TAB_ICONS: Record<PrefTab, string> = {
  account: 'fas fa-circle-user',
  security: 'fas fa-lock',
  profile: 'fas fa-address-card',
  notifications: 'fas fa-bell',
  tracking: 'fas fa-plus',
  users: 'fas fa-users',
  interface: 'fas fa-desktop',
  'navigation-menu': 'fas fa-bars',
  other: 'fas fa-puzzle-piece',
};

/** 已知分区（`settingsItems` 的键）及各自所属标签页。 */
const SECTION_TABS: Record<string, PrefTab> = {
  account: 'account',
  privacy: 'account',
  lcoyProfile: 'profile',
  notifications: 'notifications',
  lcoyAutoTrack: 'tracking',
  'fof-follow-tags': 'tracking',
  lcoyInterface: 'interface',
  wardrobeTheme: 'interface',
  colorScheme: 'interface',
  device: 'interface',
  realtimeItems: 'interface',
  drafts: 'interface',
  lcoyNavMenu: 'navigation-menu',
};

/** `notificationsItems` 中在 Discourse 属于“跟踪”的条目。 */
export const TRACKING_ITEMS = ['followAfterReply', 'followAfterCreate', 'notifyForAllPosts'];

export function sectionTab(key: string): PrefTab {
  return SECTION_TABS[key] || 'other';
}

/** 记住上次设置页是否有位于“其他”中的分区。 */
let hasOther = false;

export function rememberOther(value: boolean): void {
  hasOther = value;
}

/** 该用户拥有的标签页，按 Discourse 的顺序。 */
export function visibleTabs(user: User): PrefTab[] {
  const tabs: PrefTab[] = ['account', 'security'];

  if (thirdParty.profileCover()) tabs.push('profile');
  tabs.push('notifications');
  if (isExtensionEnabled('flarum-subscriptions') || isExtensionEnabled('fof-follow-tags')) tabs.push('tracking');
  if (app.routes['user.ignoredUsers']) tabs.push('users');
  tabs.push('interface');
  if (isTagsEnabled()) tabs.push('navigation-menu');
  if (hasOther) tabs.push('other');

  return tabs;
}

export function tabUrl(user: User, tab: PrefTab): string {
  if (tab === 'security') return app.route('user.security', { username: user.slug() });
  if (tab === 'users') return app.route('user.ignoredUsers');

  return app.route(TAB_ROUTE, { username: user.slug(), tab });
}

/** 当前打开的标签页；不在设置中时为 null。 */
export function currentTab(): PrefTab | null {
  const route = app.current.get('routeName');

  if (route === 'user.security') return 'security';
  if (route === 'user.ignoredUsers') return 'users';
  if (route === 'settings' || route === BASE_ROUTE) return 'account';
  if (route === TAB_ROUTE) return (m.route.param('tab') as PrefTab) || 'account';

  return null;
}
