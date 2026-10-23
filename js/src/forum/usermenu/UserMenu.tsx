/*
 * Discourse 的用户菜单（`.user-menu.revamped.menu-panel`）：左侧是当前标签页的列表
 *（`.quick-access-panel`，320px），右侧是一列图标标签页
 *（`.menu-tabs-container`），上方标签页（按类型的通知）与下方标签页
 *（个人资料）之间用一条线分隔。
 *
 * 扩展点：`UserMenu.prototype.tabItems()`（上方标签页）和
 * `bottomTabItems()`（下方标签页）是 `UserMenuTab` 的 ItemList。
 * 其他扩展用 `extend` 添加自己的标签页：
 *
 *   extend(UserMenu.prototype, 'tabItems', function (items) {
 *     items.add('minhaAba', { id: 'minha-aba', icon: menuIcon('flag'), … }, 50);
 *   });
 *
 * 某个标签页在 `types` 中声明的通知类型会从“其他通知”标签页中移出，
 * 与 Discourse 一致。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import ThemeSwitcher from 'flarum/forum/components/ThemeSwitcher';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { menuIcon } from './icons';
import { DEFAULT_TAB, userMenu } from './state';
import { LIKE_TYPES, MESSAGE_TYPES, BOOKMARK_TYPES, REPLY_TYPES, unreadCount, type NotificationFilter } from './notifications';
import { BookmarksPanel, MessagesPanel, NotificationsPanel, ProfilePanel, ReviewPanel, emptyStates, isMessagesEnabled, um, umText } from './panels';
import { forumBool } from '../utils/settings';

export interface UserMenuTab {
  /** 在标签页之间唯一；生成 `#quick-access-{id}` 和 `#user-menu-button-{id}`。 */
  id: string;
  /** 标签页图标（一个 `menuIcon(...)` 或任意 vnode）。 */
  icon: Mithril.Children;
  /** 用于 `title`/`aria-label` 的标签（不含数字）。 */
  title: string;
  /** 有未读时带数字的标签。 */
  titleWithUnread?: (count: number) => string;
  /** 标签页气泡上的数字；为零时隐藏。 */
  count?: () => number;
  /** 点击已激活的标签页会进入此页面（`linkWhenActive`）。 */
  href?: () => string | null;
  /** 该标签页的通知类型（从“其他通知”中移出）。 */
  types?: string[];
  /** 过滤通知的标签页：也会成为 /notifications 页面的标签页。 */
  filter?: NotificationFilter;
  /** 在 /notifications 页面中标签页的短名称。 */
  pageLabel?: string;
  /** 标签页的内容。 */
  panel: () => Mithril.Children;
}

export interface UserMenuAttrs extends ComponentAttrs {}

function notificationsHref(filter?: string): string {
  return app.route('notifications', filter ? { filter } : {});
}

export default class UserMenu extends Component<UserMenuAttrs> {
  view() {
    const top = this.resolvedTopTabs();
    const bottom = this.bottomTabItems().toArray();
    const all = [...top, ...bottom];
    const current = all.find((tab) => tab.id === userMenu.tab) || all[0];

    if (current && current.id !== userMenu.tab) userMenu.tab = current.id;

    return (
      <div
        className={classList('LcoyUserMenu', 'user-menu', 'show-avatars')}
        id="lcoy-user-menu"
        data-tab-id={current?.id}
        onkeydown={this.onkeydown.bind(this)}
      >
        <div className="LcoyUserMenu-bodyContents">
          <div className="LcoyUserMenu-tabs" role="tablist" aria-orientation="vertical" aria-label={umText('sr_menu_tabs')}>
            <div className="LcoyUserMenu-tabList LcoyUserMenu-tabList--top">{top.map((tab, index) => this.tabButton(tab, index))}</div>
            <div className="LcoyUserMenu-tabList LcoyUserMenu-tabList--bottom">
              {bottom.map((tab, index) => this.tabButton(tab, top.length + index))}
            </div>
          </div>
          <div className="LcoyUserMenu-panel" id={`quick-access-${current?.id}`} role="tabpanel" aria-labelledby={`user-menu-button-${current?.id}`}>
            {/* key 会在切换标签页时重建内容（每个标签页加载自己的内容）。 */}
            {current
              ? [
                  <div key={current.id} className="LcoyUserMenu-panelInner">
                    {current.panel()}
                  </div>,
                ]
              : null}
          </div>
        </div>
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<UserMenuAttrs, this>) {
    super.oncreate(vnode);

    // 与 Discourse 的 `focusFirstTab` 一致：焦点移到激活的标签页。
    (this.element.querySelector('.LcoyUserMenu-tab.active') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  /**
   * 上方标签页，按 Discourse 的顺序：全部、回复、点赞、
   * 消息、书签、（扩展标签页）、审核和“其他”。
   */
  tabItems(): ItemList<UserMenuTab> {
    const items = new ItemList<UserMenuTab>();
    const user = app.session.user;

    items.add(
      'all-notifications',
      {
        id: DEFAULT_TAB,
        icon: menuIcon('bell'),
        title: umText('tabs.all_notifications'),
        href: () => notificationsHref(),
        filter: {},
        pageLabel: umText('page.all'),
        panel: () => (
          <NotificationsPanel
            filter={{}}
            empty={emptyStates.notifications}
            showAllHref={notificationsHref()}
            showAllTitle={umText('view_all_notifications')}
          />
        ),
      },
      100
    );

    items.add(
      'replies',
      {
        id: 'replies',
        icon: menuIcon('reply'),
        title: umText('tabs.replies'),
        titleWithUnread: (count) => umText('tabs.replies_with_unread', { count }),
        count: () => unreadCount({ types: REPLY_TYPES }),
        href: () => notificationsHref('replies'),
        types: REPLY_TYPES,
        filter: { types: REPLY_TYPES },
        pageLabel: umText('page.replies'),
        panel: () => (
          <NotificationsPanel
            filter={{ types: REPLY_TYPES }}
            empty={emptyStates.notifications}
            showAllHref={notificationsHref('replies')}
            showAllTitle={umText('view_all_notifications')}
          />
        ),
      },
      90
    );

    if ('flarum-likes' in flarum.extensions) {
      items.add(
        'likes',
        {
          id: 'likes',
          icon: menuIcon('heart'),
          title: umText('tabs.likes'),
          titleWithUnread: (count) => umText('tabs.likes_with_unread', { count }),
          count: () => unreadCount({ types: LIKE_TYPES }),
          href: () => notificationsHref('likes'),
          types: LIKE_TYPES,
          filter: { types: LIKE_TYPES },
          pageLabel: umText('page.likes'),
          panel: () => (
            <NotificationsPanel
              filter={{ types: LIKE_TYPES }}
              empty={emptyStates.likes}
              showAllHref={notificationsHref('likes')}
              showAllTitle={umText('view_all_notifications')}
            />
          ),
        },
        80
      );
    }

    if (isMessagesEnabled()) {
      items.add(
        'messages',
        {
          id: 'messages',
          icon: menuIcon('mail'),
          title: umText('tabs.messages'),
          titleWithUnread: (count) => umText('tabs.messages_with_unread', { count }),
          count: () => user?.attribute<number>('unreadDialogCount') || 0,
          href: () => app.route('messages'),
          types: MESSAGE_TYPES,
          panel: () => <MessagesPanel />,
        },
        70
      );
    }

    if (user && forumBool('lcoyBookmarksEnabled', false) && app.routes['user.bookmarks']) {
      items.add(
        'bookmarks',
        {
          id: 'bookmarks',
          icon: menuIcon('bookmark'),
          title: umText('tabs.bookmarks'),
          titleWithUnread: (count) => umText('tabs.bookmarks_with_unread', { count }),
          count: () => unreadCount({ types: BOOKMARK_TYPES }),
          href: () => app.route('user.bookmarks', { username: user.slug() }),
          types: BOOKMARK_TYPES,
          panel: () => <BookmarksPanel />,
        },
        60
      );
    }

    // 审核队列：被举报的帖子（flarum/flags），对能看到的人显示。
    if (app.forum.attribute('canViewFlags') && (app as any).flags) {
      items.add(
        'review-queue',
        {
          id: 'review-queue',
          icon: menuIcon('flag'),
          title: umText('tabs.review_queue'),
          titleWithUnread: (count) => umText('tabs.review_queue_with_unread', { count }),
          count: () => Number(app.forum.attribute<number>('flagCount')) || 0,
          href: () => (app.routes['flags'] ? app.route('flags') : null),
          panel: () => <ReviewPanel />,
        },
        20
      );
    }

    return items;
  }

  /** 上方标签页再加上“其他通知”，包含剩余的类型。 */
  resolvedTopTabs(): UserMenuTab[] {
    const items = this.tabItems();

    if (!items.has('other-notifications')) {
      const used = items
        .toArray()
        .flatMap((tab) => tab.types || tab.filter?.types || [])
        .filter(Boolean);

      items.add('other-notifications', this.otherTab(used), 10);
    }

    return items.toArray();
  }

  otherTab(used: string[]): UserMenuTab {
    const filter: NotificationFilter = { exclude: used };

    return {
      id: 'other-notifications',
      icon: menuIcon('other'),
      title: umText('tabs.other_notifications'),
      titleWithUnread: (count) => umText('tabs.other_notifications_with_unread', { count }),
      count: () => unreadCount(filter),
      href: () => notificationsHref('other'),
      filter,
      pageLabel: umText('page.other'),
      panel: () => (
        <NotificationsPanel
          filter={filter}
          empty={emptyStates.other}
          showAllHref={notificationsHref('other')}
          showAllTitle={umText('view_all_notifications')}
        />
      ),
    };
  }

  bottomTabItems(): ItemList<UserMenuTab> {
    const items = new ItemList<UserMenuTab>();
    const user = app.session.user;

    if (!user) return items;

    items.add(
      'profile',
      {
        id: 'profile',
        icon: menuIcon('user'),
        title: umText('tabs.profile'),
        href: () => app.route.user(user),
        panel: () => ProfilePanel(this.profileItems()),
      },
      100
    );

    return items;
  }

  /**
   * “个人资料”标签页的条目：会话菜单提供的一切（核心、主题
   * 和扩展），再加上 Discourse 有而 Flarum 没有的：摘要、
   * 活动、消息以及浅色/深色模式。
   */
  profileItems(): ItemList<Mithril.Children> {
    const user = app.session.user!;
    const session: any = Object.create(SessionDropdown.prototype);
    session.attrs = {};

    const items: ItemList<Mithril.Children> = SessionDropdown.prototype.items.call(session);

    // 会话菜单的身份（头像和名字）不在 Discourse 的
    // 标签页中：头像已经在头部。
    ['lcoyIdentity', 'lcoyIdentitySeparator'].forEach((key) => items.has(key) && items.remove(key));

    // 不要“摘要”：“个人资料”已经打开摘要（资料的默认标签页）。

    if (!items.has('lcoyActivity')) {
      const route = app.routes['user.activity'] ? 'user.activity' : 'user.posts';

      items.add(
        'lcoyActivity',
        <LinkButton icon="fas fa-bars-staggered" href={app.route(route, { username: user.slug() })}>
          {um('profile.activity')}
        </LinkButton>,
        94
      );
    }

    if (isMessagesEnabled() && !items.has('messages')) {
      items.add(
        'messages',
        <LinkButton icon="far fa-envelope" href={app.route('messages')}>
          {um('profile.messages')}
        </LinkButton>,
        80
      );
    }

    if (app.allowUserColorScheme) {
      const switcher: any = Object.create(ThemeSwitcher.prototype);
      switcher.attrs = {};

      const active: string = ThemeSwitcher.prototype.active.call(switcher);
      const resolved = String(active === 'auto' ? app.getSystemColorSchemePreference() : active);
      const dark = resolved.startsWith('dark');

      items.add(
        'lcoyColorScheme',
        <Button icon={dark ? 'far fa-sun' : 'far fa-moon'} onclick={() => ThemeSwitcher.prototype.select.call(switcher, dark ? 'light' : 'dark')}>
          {um(dark ? 'profile.light_mode' : 'profile.dark_mode')}
        </Button>,
        -80
      );
    }

    return items;
  }

  tabButton(tab: UserMenuTab, position: number): Mithril.Children {
    const active = tab.id === userMenu.tab;
    const count = tab.count ? tab.count() : 0;
    const title = count && tab.titleWithUnread ? tab.titleWithUnread(count) : tab.title;
    const href = tab.href ? tab.href() : null;

    return (
      <a
        className={classList('LcoyUserMenu-tab', `LcoyUserMenu-tab--${tab.id}`, { active })}
        id={`user-menu-button-${tab.id}`}
        role="tab"
        href={href || undefined}
        aria-controls={`quick-access-${tab.id}`}
        aria-selected={active ? 'true' : 'false'}
        aria-label={title}
        title={title}
        tabindex={active ? 0 : -1}
        data-tab-number={position}
        onclick={(e: MouseEvent) => this.selectTab(tab, e)}
      >
        <span className="LcoyUserMenu-tabIcon">{tab.icon}</span>
        {count ? (
          <span className="LcoyUserMenu-badge" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </a>
    );
  }

  /**
   * 与 Discourse 的 `handleTabClick` 一致：在已激活的标签页（或在新标签页
   * 打开）上，链接进入完整页面；其他情况只切换内容。
   */
  selectTab(tab: UserMenuTab, e: MouseEvent | KeyboardEvent): void {
    const newWindow = e instanceof MouseEvent && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1);
    const href = tab.href ? tab.href() : null;

    if (newWindow) return;

    e.preventDefault();

    if (userMenu.tab === tab.id) {
      if (href) {
        userMenu.close();
        m.route.set(href);
      }

      return;
    }

    userMenu.tab = tab.id;
  }

  /** 上下方向键在标签页间移动（纵向 `role="tablist"`）。 */
  onkeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;

    if (!target.classList?.contains('LcoyUserMenu-tab')) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      target.click();
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;

    const tabs = Array.from(this.element.querySelectorAll<HTMLElement>('.LcoyUserMenu-tab'));
    const index = tabs.indexOf(target);
    let next = index;

    if (e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;

    e.preventDefault();
    tabs[next]?.focus();
  }
}
