/*
 * 资料的“通知”标签页（`/u/:username/notifications`），与 Discourse 一致：
 * 与 /notifications 页面相同的列表和标签页（全部、回复、点赞、聊天、
 * 其他），位于资料内。仅在自己的资料中：API 只返回请求者自己的通知。
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import NotificationsPageView from './NotificationsPageView';
import { umText } from './text';

export default class NotificationsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--notifications';
    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);

    if (this.isOwnProfile()) Promise.resolve(app.notifications.load()).catch(() => {});
  }

  isOwnProfile(): boolean {
    return !!this.user && app.session.user === this.user;
  }

  content(): Mithril.Children {
    if (!this.isOwnProfile()) return <p className="LcoyNotificationsPage-private">{umText('page.private')}</p>;

    const slug = this.user!.slug();

    return (
      <div className="NotificationsPage LcoyNotificationsPage LcoyNotificationsPage--profile">
        {NotificationsPageView((filter) => app.route('user.notifications', filter ? { username: slug, filter } : { username: slug }))}
      </div>
    );
  }
}
