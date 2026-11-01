/*
 * 用户菜单每个标签页的内容（Discourse 的 `.quick-access-panel`）：
 * 列表（`items-list`）、带“查看全部”（⌄）和“忽略”的底部，以及
 * 使用 Discourse 文案的空状态。
 *
 * 列表使用核心和扩展已经维护的状态（`app.notifications`、flarum/messages 的
 * `app.dialogs`、flarum/flags 的 `app.flags`）——菜单加载的内容也能供它们的
 * 页面使用。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import listItems from 'flarum/common/helpers/listItems';
import type ItemList from 'flarum/common/utils/ItemList';
import type Notification from 'flarum/common/models/Notification';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import {
  BOOKMARK_TYPES,
  IconAvatar,
  MenuItem,
  NotificationItem,
  dismissNotifications,
  filteredNotifications,
  type NotificationFilter,
} from './notifications';
import { menuIcon } from './icons';
import { userMenu } from './state';
import { isExtensionEnabled } from '../utils/settings';
import { umText } from './text';

/** 富文本翻译（含 `<a>`、`<b>` 和图标）：主题的 `t()` 只返回文本。 */
export function um(key: string, params: Record<string, unknown> = {}): Mithril.Children {
  return app.translator.trans(`lcoy-roselle.forum.usermenu.${key}`, params) as any;
}

/** 同上的文本形式（title、aria-label）；位于 text.ts，主包也会使用。 */
export { umText };

/**
 * 列表是否还从未收到任何响应（连空响应也没有）？PaginatedListState
 * 每次响应保存一页，即使没有条目：没有页时，“没有条目”
 * 还不能说明什么，空列表提示会在条目之前闪现。
 */
export function neverLoaded(state: any): boolean {
  return !!state && typeof state.getPages === 'function' && state.getPages().length === 0;
}

/** Flarum 的“通知设置”位于设置页。 */
export function preferencesLink(): Mithril.Vnode<any, any> {
  return <Link href={app.route('settings')} onclick={() => userMenu.close()} />;
}

// ---------------------------------------------------------------------
// 空状态（`DEmptyState`）：标题和一段文字，两句之间使用 Discourse 的
// `<br><br>`。
// ---------------------------------------------------------------------

export function EmptyState(title: Mithril.Children, body?: Mithril.Children[]): Mithril.Children {
  const parts = (body || []).filter((part) => part !== null && part !== undefined && part !== '');
  const paragraph: Mithril.Children[] = [];

  parts.forEach((part, index) => {
    if (index > 0) paragraph.push(<br />, <br />);
    paragraph.push(part);
  });

  return (
    <div>
      <div className="LcoyUserMenu-empty">
        <div className="LcoyUserMenu-emptyTitle">{title}</div>
        {paragraph.length ? (
          <div className="LcoyUserMenu-emptyBody">
            <p>{paragraph}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const bold = () => <b />;

export const emptyStates = {
  notifications: () =>
    EmptyState(um('empty.notifications_title'), [
      um('empty.notifications_body_1', { b: bold() }),
      um('empty.notifications_body_2', { icon: menuIcon('bell'), a: preferencesLink() }),
    ]),
  likes: () => EmptyState(um('empty.likes_title'), [um('empty.likes_body_1'), um('empty.likes_body_2', { a: preferencesLink() })]),
  messages: () => {
    const about = app.routes['lcoy.about'] ? app.route('lcoy.about') : app.route('index');

    return EmptyState(um('empty.messages_title'), [
      um('empty.messages_body_1', { icon: menuIcon('mail') }),
      um('empty.messages_body_2', {
        a: (
          <Link
            href={about}
            onclick={() => {
              userMenu.close();
            }}
          />
        ),
      }),
    ]);
  },
  bookmarks: () => EmptyState(um('empty.bookmarks_title'), [um('empty.bookmarks_body', { icon: menuIcon('bookmark') })]),
  other: () => EmptyState(um('empty.other_title'), [um('empty.other_body')]),
  generic: () => EmptyState(um('empty.generic')),
};

export function Spinner(): Mithril.Children {
  return (
    <div className="LcoyUserMenu-spinnerContainer">
      <div className="LcoyUserMenu-spinner" />
    </div>
  );
}

/**
 * 尚未收到响应的通知列表：按条目高度显示行（头像加两行文本，每条
 * 横条与真实文本的一行等高），而不是 spinner：面板打开时已是列表的
 * 尺寸，列表到达时不会跳动。
 */
export function NotificationSkeleton(rows = 8): Mithril.Children {
  return (
    <ul className="LcoyUserMenu-list LcoyUserMenu-list--loading" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <li className="LcoyUserMenu-item LcoyUserMenu-item--skeleton">
          <div className="LcoyUserMenu-skeletonRow">
            <span className="LcoySkeleton LcoyUserMenu-skeletonAvatar" />
            <span className="LcoyUserMenu-itemText">
              <span className="LcoySkeleton LcoySkeleton--line" style={{ width: `${45 + ((index * 17) % 30)}%` }} />
              <span className="LcoySkeleton LcoySkeleton--line" style={{ width: `${70 + ((index * 11) % 25)}%` }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * `.panel-body-bottom`：带小箭头的宽按钮进入该标签页的完整页面；
 * “忽略”把它们标为已读。
 */
export function PanelBottom(attrs: { showAllHref?: string | null; showAllTitle?: string; dismiss?: (() => unknown) | null; dismissTitle?: string }) {
  return (
    <div className="LcoyUserMenu-bottom">
      {attrs.showAllHref ? (
        <Link
          className="Button LcoyUserMenu-showAll"
          href={attrs.showAllHref}
          title={attrs.showAllTitle}
          aria-label={attrs.showAllTitle}
          onclick={() => userMenu.close()}
        >
          {/* 只有 chevron（Discourse 的 `show-all`）不能说明它的作用。 */}
          <span className="LcoyUserMenu-showAllLabel">{um('view_all')}</span>
        </Link>
      ) : null}
      {attrs.dismiss ? (
        <button type="button" className="Button LcoyUserMenu-dismiss" title={attrs.dismissTitle} onclick={() => attrs.dismiss!()}>
          {menuIcon('check')}
          <span className="LcoyUserMenu-dismissLabel">{um('dismiss')}</span>
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// 通知（全部、回复、点赞、聊天、其他）
// ---------------------------------------------------------------------

export interface NotificationsPanelAttrs extends ComponentAttrs {
  filter: NotificationFilter;
  empty: () => Mithril.Children;
  showAllHref?: string | null;
  showAllTitle?: string;
  dismissTitle?: string;
  /** 通知之前的额外条目（书签会用到）。 */
  extra?: () => Mithril.Children[];
}

/** 为填满一个过滤标签页还要额外请求多少页（API 不按类型过滤）。 */
const MAX_EXTRA_PAGES = 3;
const MIN_ITEMS = 10;

export class NotificationsPanel extends Component<NotificationsPanelAttrs> {
  extraPages = 0;

  view() {
    const state: any = app.notifications;
    const notifications = filteredNotifications(this.attrs.filter);
    const extra = this.attrs.extra ? this.attrs.extra() : [];
    const items = [...extra, ...notifications.map((notification: Notification) => NotificationItem(notification))].filter(Boolean);
    const loading = (state.isLoading() || neverLoaded(state)) && !items.length;

    if (loading) return NotificationSkeleton();

    if (!items.length) {
      // 后续页面中可能仍有该类型的条目。
      if (this.wantsMore()) return Spinner();

      return this.attrs.empty();
    }

    // “全部标为已读”：存在未读时显示——用户计数或列表中任一已加载
    // 条目（计数可能相对于标签页显示的内容有所延迟）。
    const anyUnread =
      (app.session.user?.unreadNotificationCount() ?? 0) > 0 || notifications.some((notification: Notification) => !notification.isRead());

    return [
      <ul className="LcoyUserMenu-list">{items}</ul>,
      PanelBottom({
        showAllHref: this.attrs.showAllHref,
        showAllTitle: this.attrs.showAllTitle,
        // 只要存在未读，Discourse 就在任何通知标签页显示“忽略”，
        // 且只忽略该标签页中的类型。
        dismiss: anyUnread ? () => dismissNotifications(this.attrs.filter) : null,
        dismissTitle: this.attrs.dismissTitle || umText('dismiss_notifications_tooltip'),
      }),
    ];
  }

  oncreate(vnode: Mithril.VnodeDOM<NotificationsPanelAttrs, this>) {
    super.oncreate(vnode);
    this.fill();
  }

  onupdate(vnode: Mithril.VnodeDOM<NotificationsPanelAttrs, this>) {
    super.onupdate(vnode);
    this.fill();
  }

  wantsMore(): boolean {
    const state: any = app.notifications;
    const filtered = !!(this.attrs.filter.types || this.attrs.filter.exclude);

    return filtered && state.hasNext() && this.extraPages < MAX_EXTRA_PAGES && filteredNotifications(this.attrs.filter).length < MIN_ITEMS;
  }

  /** 在条目很少的过滤标签页中，请求后续页面（最多 3 页）。 */
  fill(): void {
    const state: any = app.notifications;

    if (state.isLoading() || !state.hasItems() || !this.wantsMore()) return;

    this.extraPages++;
    Promise.resolve(state.loadNext()).catch(() => {});
  }
}

// ---------------------------------------------------------------------
// 消息（flarum/messages）：会话列表，未读项突出显示。
// ---------------------------------------------------------------------

export class MessagesPanel extends Component {
  /**
   * 列表是否已经有过一次响应？在此之前，“没有会话”还不能说明什么：
   * 第一次绘制发生在请求开始之前，“你没有消息”的提示会在条目之前闪现。
   */
  ready = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const state: any = (app as any).dialogs;

    this.ready = !!state && typeof state.getPages === 'function' && state.getPages().length > 0;

    if (state && typeof state.load === 'function') {
      Promise.resolve(state.load())
        .catch(() => {})
        .finally(() => {
          this.ready = true;
          m.redraw();
        });
    } else {
      this.ready = true;
    }
  }

  view() {
    const state: any = (app as any).dialogs;

    if (!state) return emptyStates.messages();

    const dialogs: any[] = typeof state.getAllItems === 'function' ? state.getAllItems() : [];

    if (!dialogs.length) return !this.ready || state.isLoading() || neverLoaded(state) ? Spinner() : emptyStates.messages();

    const unread = (app.session.user?.attribute<number>('unreadDialogCount') ?? 0) > 0;

    return [
      <ul className="LcoyUserMenu-list">
        {dialogs.map((dialog) => {
          const recipient: User | null = dialog.recipient?.() || null;
          const lastMessage: any = dialog.lastMessage?.();
          const preview = (lastMessage?.contentPlain?.() || '').slice(0, 80);
          const name = recipient ? recipient.displayName() : '';

          return MenuItem({
            className: 'LcoyUserMenu-item--message',
            unread: !!dialog.unreadCount?.(),
            href: (app.route as any).dialog ? (app.route as any).dialog(dialog) : app.route('messages'),
            title: name,
            avatar: IconAvatar(recipient, 'far fa-envelope'),
            label: name,
            description: preview,
          });
        })}
      </ul>,
      PanelBottom({
        showAllHref: app.route('messages'),
        showAllTitle: umText('view_all_messages'),
        dismiss: unread && typeof state.markAllAsRead === 'function' ? () => state.markAllAsRead() : null,
        dismissTitle: umText('dismiss_messages_tooltip'),
      }),
    ];
  }
}

// ---------------------------------------------------------------------
// 书签（主题的 `bookmarks` 功能）：未读提醒在前，
// 然后是较新的书签。
// ---------------------------------------------------------------------

export class BookmarksPanel extends Component {
  bookmarks: any[] = [];
  loading = true;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const include = ['post', 'post.discussion', 'post.user'];

    app.store
      .find<any[]>('bookmarks', { include: include.join(','), page: { limit: 20 } } as any)
      .then((results: any) => {
        this.bookmarks = Array.isArray(results) ? results.slice() : [];
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  view() {
    const reminders = filteredNotifications({ types: BOOKMARK_TYPES }).filter((notification) => !notification.isRead());

    const items = [
      ...reminders.map((notification) => NotificationItem(notification)),
      ...this.bookmarks.map((bookmark) => {
        const post: Post | null = bookmark.post?.() || null;

        if (!post) return null;

        const user = post.user() as User | false;
        const discussion: any = post.discussion();

        return MenuItem({
          className: 'LcoyUserMenu-item--bookmark bookmark',
          href: app.route.post(post),
          title: bookmark.name?.() || discussion?.title?.() || '',
          avatar: IconAvatar(user, bookmark.hasPendingReminder?.() ? 'fas fa-clock' : 'far fa-bookmark'),
          label: user ? user.displayName() : null,
          description: discussion?.title?.() || '',
        });
      }),
    ].filter(Boolean);

    if (!items.length) return this.loading ? Spinner() : emptyStates.bookmarks();

    const user = app.session.user!;

    return [
      <ul className="LcoyUserMenu-list">{items}</ul>,
      PanelBottom({
        showAllHref: app.routes['user.bookmarks'] ? app.route('user.bookmarks', { username: user.slug() }) : null,
        showAllTitle: umText('view_all_bookmarks'),
        dismiss: reminders.length ? () => dismissNotifications({ types: BOOKMARK_TYPES }) : null,
        dismissTitle: umText('dismiss_bookmarks_tooltip'),
      }),
    ];
  }
}

// ---------------------------------------------------------------------
// 审核（flarum/flags）：被举报的帖子，供管理使用。
// ---------------------------------------------------------------------

export class ReviewPanel extends Component {
  oncreate(vnode: Mithril.VnodeDOM<any, this>) {
    super.oncreate(vnode);

    const state: any = (app as any).flags;

    if (app.forum.attribute('canViewFlags') && state && typeof state.load === 'function') {
      Promise.resolve(state.load())
        // API 已把队列标记为已查看（`read_flags_at`）：头像上的旗帜消失。
        .then(() => app.session.user?.pushAttributes({ newFlagCount: 0 }))
        .catch(() => {});
    }
  }

  view() {
    const state: any = (app as any).flags;
    const flags: any[] = app.forum.attribute('canViewFlags') && state && typeof state.getAllItems === 'function' ? state.getAllItems() : [];
    const rows: { date: number; item: Mithril.Children }[] = [];

    flags.forEach((flag) => {
      const post: Post | null = flag.post?.() || null;

      if (!post) return;

      const user = post.user() as User | false;
      const discussion: any = post.discussion();

      rows.push({
        date: flag.createdAt?.()?.getTime?.() || 0,
        item: MenuItem({
          className: 'LcoyUserMenu-item--reviewable reviewable pending',
          unread: true,
          href: app.route.post(post),
          title: post.contentPlain?.() || '',
          avatar: IconAvatar(user, 'fas fa-flag'),
          label: user ? user.displayName() : null,
          description: discussion?.title?.() || '',
        }),
      });
    });

    if (!rows.length) {
      const loading = state?.isLoading?.() || (app.forum.attribute('canViewFlags') && neverLoaded(state));

      return loading ? Spinner() : emptyStates.generic();
    }

    return [
      <ul className="LcoyUserMenu-list">{rows.sort((a, b) => b.date - a.date).map((row) => row.item)}</ul>,
      PanelBottom({
        showAllHref: app.routes['flags'] ? app.route('flags') : null,
        showAllTitle: umText('view_all_reviewables'),
      }),
    ];
  }
}

// ---------------------------------------------------------------------
// 个人资料：会话菜单的条目（核心的、主题的以及任何扩展
// 扩展 `SessionDropdown.prototype.items` 添加的）。
// ---------------------------------------------------------------------

export function ProfilePanel(items: ItemList<Mithril.Children>): Mithril.Children {
  return (
    <ul
      className="LcoyUserMenu-profile"
      onclick={(e: MouseEvent) => {
        // 跟随条目（或退出、切换主题）会关闭菜单，与 Discourse 的
        // `closeUserMenu` 一致。
        if ((e.target as HTMLElement).closest('a, button')) userMenu.close();
      }}
    >
      {listItems(items.toArray())}
    </ul>
  );
}

export function isMessagesEnabled(): boolean {
  return isExtensionEnabled('flarum-messages') && !!(app as any).dialogs;
}
