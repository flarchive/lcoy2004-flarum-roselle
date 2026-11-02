/*
 * 用 Discourse 的用户菜单取代铃铛和会话菜单。
 *
 * - 头部去掉铃铛（NotificationsDropdown）、被举报帖子（FlagsDropdown，
 *   来自 flarum/flags）和信封图标（DialogsDropdown，来自 flarum/messages）：
 *   这些都变成菜单的标签页，与 Discourse 一致。会话菜单（SessionDropdown）
 *   变成打开菜单的头像——它的条目仍然保留，位于“个人资料”标签页。
 * - Esc 和点击外部会关闭；导航时也会关闭。
 * - /notifications 页面获得同样的列表，标签页横向排列。
 *
 * 可在管理后台关闭（`lcoy.user_menu`）：关闭后头部恢复为核心的样式。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import LinkButton from 'flarum/common/components/LinkButton';
import UserPage from 'flarum/forum/components/UserPage';
import PageStructure from 'flarum/forum/components/PageStructure';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import UserMenuButton from './UserMenuButton';
import { userMenu } from './state';
import { umText } from './text';
import { loadMenu } from './lazy';
import { beforeChunk } from '../utils/chunkGate';
import { forumBool } from '../utils/settings';

// 打开的菜单和各面板位于一个 chunk（lazy.ts）中；想扩展它们的人使用
// 模块名（`ext:lcoy/roselle/forum/usermenu/UserMenu`）。
export function userMenuEnabled(): boolean {
  return !!app.session.user && forumBool('lcoyUserMenu', true);
}

/** 菜单吸收的头部条目。 */
const ABSORBED_HEADER_ITEMS = ['notifications', 'flags', 'messages'];

let headerItemsExtended = false;

export default function installUserMenu(): void {
  // 在 `mount` 中注册，早于首次绘制：主题之后加载的扩展 initializer
  //（例如 flarum/messages）已经添加了它们的条目，
  // 移除必须最后运行。
  override(app as any, 'mount', function (this: any, original: (...args: any[]) => unknown, ...args: any[]) {
    if (headerItemsExtended) return original(...args);
    headerItemsExtended = true;

    extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
      if (!userMenuEnabled()) return;

      ABSORBED_HEADER_ITEMS.forEach((key) => items.has(key) && items.remove(key));

      // 使用与会话菜单相同的键（`session`）和优先级：头部图标的顺序
      //（手机上也是）已经把它算在内。
      if (items.has('session')) items.setContent('session', <UserMenuButton />);
    });

    return original(...args);
  });

  installGlobalListeners();
  installNotificationsPage();
  installProfileTab();
}

/**
 * 资料一级标签页中的“通知”，与 Discourse 一致（仅在自己的资料中）。
 * `notifications` 键已经在主题资料放到第一行的那些键之中。
 */
function installProfileTab(): void {
  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    const user = this.user;

    if (!user || app.session.user !== user || !app.routes['user.notifications']) return;

    items.add(
      'notifications',
      <LinkButton href={app.route('user.notifications', { username: user.slug() })} icon="far fa-bell">
        {umText('page.title')}
      </LinkButton>,
      95
    );
  });
}

function installGlobalListeners(): void {
  // 点击外部关闭。在捕获阶段，早于其他监听器停止事件；
  // 点击头像本身由按钮处理（它负责切换）。
  document.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      if (!userMenu.open) return;

      const target = e.target as HTMLElement | null;

      if (target?.closest?.('.LcoyUserMenuWrap')) return;

      userMenu.close();
      m.redraw();
    },
    true
  );

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!userMenu.open || e.key !== 'Escape') return;

    // 上层打开的弹窗（例如退出确认）保留 Esc。
    if (document.body.classList.contains('modal-open')) return;

    e.preventDefault();
    userMenu.close(true);
    m.redraw();
  });

  // 焦点通过 Tab 离开菜单时也会关闭，如同下拉菜单。
  document.addEventListener('focusin', (e: FocusEvent) => {
    if (!userMenu.open) return;

    const target = e.target as HTMLElement | null;

    if (target && target !== document.body && !target.closest('.LcoyUserMenuWrap') && !target.closest('.ModalManager')) {
      userMenu.close();
      m.redraw();
    }
  });
}

/**
 * /notifications 页面（按需加载：通过模块名）。核心的 `oninit`
 * 继续保留：它负责加载列表并设置标题。
 */
function installNotificationsPage(): void {
  // 菜单 chunk（含列表）随核心页面的 chunk 一起加载。
  let NotificationsPageView: (() => Mithril.Children) | null = null;

  beforeChunk(
    (namespace, url) => namespace === 'core' && /\/forum\/components\/NotificationsPage\.js/.test(url),
    () =>
      loadMenu().then((chunk) => {
        NotificationsPageView = chunk.NotificationsPageView;
      })
  );

  override('flarum/forum/components/NotificationsPage' as any, 'view', function (this: any, original: () => Mithril.Children) {
    if (!userMenuEnabled()) return original();

    return (
      <PageStructure className="NotificationsPage LcoyNotificationsPage">
        <div className="LcoyNotificationsPage-header">
          <h2 className="LcoyNotificationsPage-title">{umText('page.title')}</h2>
        </div>
        {NotificationsPageView ? NotificationsPageView() : null}
      </PageStructure>
    );
  });
}
