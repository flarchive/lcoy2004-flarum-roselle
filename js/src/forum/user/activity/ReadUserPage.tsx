/*
 * 资料的“已读”标签页：此人读过的主题，从最新到最旧
 *（`filter[lcoyReadBy]`，来自 extend/activity.php），使用常规的主题列表。
 * 仅本人和管理员可见；服务器会再次校验。
 */
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { leaveIfHidden } from './install';

export default class ReadUserPage extends UserPage<IUserPageAttrs, DiscussionListState> {
  oninit(vnode: Mithril.Vnode<IUserPageAttrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    if (leaveIfHidden('read', user)) return;

    super.show(user);

    this.state = new DiscussionListState({ filter: { lcoyReadBy: user.slug() } } as any);
    this.state.refresh();
  }

  content() {
    return <div className="DiscussionsUserPage LcoyReadUserPage">{this.state && <DiscussionList state={this.state} />}</div>;
  }
}
