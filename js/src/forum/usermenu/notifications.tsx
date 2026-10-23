/*
 * 采用 Discourse 用户菜单格式的通知。
 *
 * Flarum 不在服务端按类型分组通知（API 中没有 `type` 过滤），因此各标签页
 * 在客户端按 `contentType()` 过滤 `app.notifications` 已加载的内容。文本来自
 * 各扩展注册的组件（`app.notificationComponents`）：主题只改变形式——
 * 产生者头像带类型图标的小徽章、加粗的名字以及主题标题，类似 Discourse 的
 * `.user-menu.show-avatars`。
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import type Notification from 'flarum/common/models/Notification';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { userMenu } from './state';

/** 过滤通知的标签页：“回复”对应 Discourse 的 `replies`（被提及、被引用、被回复、新帖）。 */
export const REPLY_TYPES = ['newPost', 'postMentioned', 'userMentioned', 'groupMentioned'];
/** `postReacted` 是反应类型（fof/reactions），Discourse 也把它放在点赞中。 */
export const LIKE_TYPES = ['postLiked', 'postReacted'];
export const MESSAGE_TYPES = ['messageReceived'];
export const BOOKMARK_TYPES = ['lcoyBookmarkReminder'];

export interface NotificationFilter {
  /** 仅这些类型；没有列表时为全部。 */
  types?: string[] | null;
  /** 除这些之外的全部（“其他通知”标签页）。 */
  exclude?: string[] | null;
}

/** `app.notifications` 已加载的全部内容，按 API 顺序（最新在前）。 */
export function loadedNotifications(): Notification[] {
  const state: any = app.notifications;

  if (!state || typeof state.getPages !== 'function') return [];

  const list: Notification[] = [];

  state.getPages().forEach((page: any) => {
    (page.items || []).forEach((notification: Notification) => list.push(notification));
  });

  return list;
}

export function matches(notification: Notification, filter: NotificationFilter): boolean {
  const type = notification.contentType() || '';

  if (filter.types && !filter.types.includes(type)) return false;
  if (filter.exclude && filter.exclude.includes(type)) return false;

  // 没有注册组件（扩展已关闭）就无法绘制。
  return !!(app as any).notificationComponents?.[type];
}

export function filteredNotifications(filter: NotificationFilter): Notification[] {
  return loadedNotifications().filter((notification) => matches(notification, filter));
}

/** 标签页气泡上的数字：已加载项中该组的未读数。 */
export function unreadCount(filter: NotificationFilter): number {
  return filteredNotifications(filter).filter((notification) => !notification.isRead()).length;
}

/** 与核心的 `Notification.markAsRead()` 一致，用于不是它组件的条目。 */
export function markNotificationRead(notification: Notification): Promise<unknown> {
  if (notification.isRead()) return Promise.resolve();

  const user = app.session.user;

  user?.pushAttributes({ unreadNotificationCount: Math.max(0, (user.unreadNotificationCount() ?? 0) - 1) });

  return notification.save({ isRead: true }).catch(() => {});
}

/**
 * “忽略”：无过滤时使用核心的 POST /notifications/read（全部）。有过滤时
 * 只逐个处理该组的未读通知——Flarum 没有 Discourse 的
 * `dismiss_types`。
 */
export function dismissNotifications(filter: NotificationFilter | null): Promise<unknown> {
  if (!filter || (!filter.types && !filter.exclude)) {
    return Promise.resolve(app.notifications.markAllAsRead()).then(() => m.redraw());
  }

  const unread = filteredNotifications(filter).filter((notification) => !notification.isRead());

  return Promise.all(unread.map((notification) => markNotificationRead(notification))).then(() => m.redraw());
}

function relatedDiscussion(notification: Notification): any {
  const subject: any = notification.subject();

  if (!subject) return null;
  if (subject.data?.type === 'discussions') return subject;
  if (typeof subject.discussion === 'function') return subject.discussion() || null;

  return null;
}

export interface NotificationView {
  icon: string;
  href: string;
  label: Mithril.Children;
  description: Mithril.Children;
  title: string;
}

/**
 * Discourse 在通知中显示的内容：产生者（`item-label`，加粗）和主题标题
 *（`item-description`），类型只通过图标表示。没有主题或没有其他人时
 *（获得徽章、被暂停），组件自身的文本成为描述，不带标签——类似 Meta 的
 * “获得‘首次点赞’”。整句话放在 `title` 中。
 */
export function describeNotification(notification: Notification): NotificationView | null {
  const Component = (app as any).notificationComponents?.[notification.contentType() || ''];

  if (!Component) return null;

  // 组件的方法只读 `this.attrs.notification`：可以在不挂载组件的情况下
  // 使用它们（也不用它的 HeaderListItem）。
  const instance: any = new Component();
  instance.attrs = { notification };

  const call = <T,>(method: string, fallback: T): T => {
    try {
      const value = instance[method]?.();
      return value === undefined || value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  };

  const content = call<Mithril.Children>('content', '');
  const title = extractText(content as any);
  const fromUser = notification.fromUser() as User | false | undefined;
  const discussion = relatedDiscussion(notification);
  const other = fromUser && fromUser !== app.session.user;

  return {
    icon: call('icon', 'fas fa-bell'),
    href: call('href', ''),
    label: other && discussion ? fromUser.displayName() : null,
    description: other && discussion ? discussion.title() : content,
    title,
  };
}

/** 没有人员（Discourse 的 “system”）：用论坛图标代替头像。 */
function systemAvatar(): Mithril.Children {
  const src = app.forum.attribute<string | null>('faviconUrl') || app.forum.attribute<string | null>('logoUrl');

  return src ? <img className="Avatar LcoyUserMenu-systemAvatar" src={src} alt="" loading="lazy" /> : <Avatar user={null} />;
}

/** Discourse 的 `.icon-avatar`：2em 头像，角落的圆形徽章中带类型图标。 */
export function IconAvatar(user: User | null | false | undefined, icon: string, system = false): Mithril.Children {
  return (
    <span className={classList('LcoyUserMenu-iconAvatar', system || !user ? 'system-avatar' : 'user-avatar')}>
      {user ? <Avatar user={user} /> : systemAvatar()}
      <span className="LcoyUserMenu-iconWrapper">
        <Icon name={icon} />
      </span>
    </span>
  );
}

export interface MenuItemAttrs {
  className?: string;
  unread?: boolean;
  href: string;
  title?: string;
  avatar: Mithril.Children;
  label?: Mithril.Children;
  description?: Mithril.Children;
  onclick?: (e: MouseEvent) => void;
}

/** Discourse `menu-item` 的 `<li>`。跟随链接时关闭菜单。 */
export function MenuItem(attrs: MenuItemAttrs): Mithril.Children {
  const external = attrs.href.includes('://');

  const content = [
    attrs.avatar,
    <div className="LcoyUserMenu-itemText">
      {attrs.label ? <span className="LcoyUserMenu-label">{attrs.label}</span> : null}
      {attrs.description ? <span className="LcoyUserMenu-description">{attrs.description}</span> : null}
    </div>,
  ];

  const onclick = (e: MouseEvent) => {
    attrs.onclick?.(e);

    // 在新标签页打开不会关闭任何东西。
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;

    userMenu.close();
  };

  return (
    <li className={classList('LcoyUserMenu-item', attrs.className, attrs.unread ? 'unread' : 'read')}>
      {attrs.href ? (
        <Link href={attrs.href} external={external} title={attrs.title} onclick={onclick}>
          {content}
        </Link>
      ) : (
        <button type="button" className="Button--ua-reset" title={attrs.title} onclick={onclick}>
          {content}
        </button>
      )}
    </li>
  );
}

export function NotificationItem(notification: Notification): Mithril.Children {
  const view = describeNotification(notification);

  if (!view) return null;

  return MenuItem({
    className: `LcoyUserMenu-item--notification Notification--${notification.contentType()}`,
    unread: !notification.isRead(),
    href: view.href,
    title: view.title,
    avatar: IconAvatar(notification.fromUser() as User | false, view.icon),
    label: view.label,
    description: view.description,
    onclick: () => markNotificationRead(notification),
  });
}
