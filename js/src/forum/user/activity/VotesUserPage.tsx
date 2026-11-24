/*
 * 资料的“投票”标签页：此人投票过的 fof/polls 带投票帖子
 *（`filter[lcoyVoter]`，来自 extend/activity.php）。服务器只返回
 * 显示投票者的投票，对本人则返回全部。
 */
import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import type User from 'flarum/common/models/User';

import { leaveIfHidden } from './install';

export default class VotesUserPage extends PostsUserPage {
  show(user: User): void {
    if (leaveIfHidden('votes', user)) return;

    super.show(user);
  }

  params(user: User) {
    return { filter: { lcoyVoter: user.slug() } } as any;
  }
}
