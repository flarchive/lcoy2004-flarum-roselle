/*
 * 头部的头像，用于打开用户菜单（Discourse 的 `.header-dropdown-toggle
 * .current-user`）。它继承核心会话菜单按钮的内容
 *（`SessionDropdown.getButtonContent`），因此其他区域放在那里的内容——
 * 资料状态 emoji——仍然会显示；只有名字被移除，与 Discourse 一致。
 *
 * 气泡按 Discourse 的 `user-dropdown/notifications` 顺序：未读消息用
 * 绿色信封（`.new-pms`）；尚未查看的审核项用红旗（`.new-reviewables`）；
 * 否则显示菜单中等待处理的全部数量——未读通知（任意标签页，不只是
 * “新”通知）加上审核队列中的待处理项。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { userMenu } from './state';
import { umText } from './text';
import { loadMenu } from './lazy';
import { lazyComponent } from '../utils/lazy';

// 打开的菜单在 chunk 中；指针或焦点落在头像上时就会请求。
const UserMenu = lazyComponent(() => loadMenu().then((chunk) => chunk.UserMenu));
const preload = () => void loadMenu().catch(() => {});

export default class UserMenuButton extends Component {
  view() {
    // 导航时菜单关闭（Discourse 的 `routeDidChange`）。头部
    // 每次路由切换都会重绘，因此在这里检查即可。
    if (userMenu.open && userMenu.route !== m.route.get()) userMenu.close();

    const user = app.session.user!;
    const unreadDialogs = user.attribute<number>('unreadDialogCount') || 0;
    const canReview = !!app.forum.attribute('canViewFlags') && !!(app as any).flags;
    const newReviewables = canReview ? Number(user.attribute<number>('newFlagCount') || 0) : 0;
    const pendingReviewables = canReview ? Number(app.forum.attribute<number>('flagCount') || 0) : 0;
    const total = (user.unreadNotificationCount() || 0) + pendingReviewables;
    const label = umText('toggle');

    return (
      <div className={classList('LcoyUserMenuWrap', { 'LcoyUserMenuWrap--open': userMenu.open })}>
        <button
          type="button"
          className={classList('Button Button--flat LcoyUserMenuButton', { active: userMenu.open })}
          aria-haspopup="true"
          aria-expanded={userMenu.open ? 'true' : 'false'}
          aria-controls="lcoy-user-menu"
          aria-label={label}
          title={label}
          onmouseenter={preload}
          onfocus={preload}
          ontouchstart={preload}
          onclick={(e: MouseEvent) => {
            e.preventDefault();
            userMenu.toggle();
          }}
        >
          {this.avatarContent()}
          {unreadDialogs > 0 ? (
            <span className="LcoyUserMenuButton-badge LcoyUserMenuButton-badge--pms" title={umText('badge.new_messages', { count: unreadDialogs })}>
              <Icon name="fas fa-envelope" />
            </span>
          ) : newReviewables > 0 ? (
            <span
              className="LcoyUserMenuButton-badge LcoyUserMenuButton-badge--reviewables"
              title={umText('badge.new_reviewables', { count: newReviewables })}
            >
              <Icon name="fas fa-flag" />
            </span>
          ) : total > 0 ? (
            <span className="LcoyUserMenuButton-badge LcoyUserMenuButton-badge--unread" title={umText('badge.unread', { count: total })}>
              {total}
            </span>
          ) : null}
        </button>
        {userMenu.open ? <UserMenu /> : null}
      </div>
    );
  }

  /** 头像（以及附加到它的内容），不含用户名。 */
  avatarContent(): Mithril.Children {
    const session: any = Object.create(SessionDropdown.prototype);
    session.attrs = {};

    const children = SessionDropdown.prototype.getButtonContent.call(session) as Mithril.Children[];

    return (Array.isArray(children) ? children : [children]).filter((child: any) => {
      if (typeof child === 'string') return false;
      if (child && child.attrs && typeof child.attrs.className === 'string' && child.attrs.className.includes('Button-label')) return false;

      return !!child;
    });
  }

  onupdate(vnode: Mithril.VnodeDOM<any, this>) {
    super.onupdate(vnode);

    // 通过 Esc 关闭：焦点回到头像。
    if (!userMenu.open && userMenu.restoreFocus) {
      userMenu.restoreFocus = false;
      (this.element.querySelector('.LcoyUserMenuButton') as HTMLElement | null)?.focus();
    }
  }
}
