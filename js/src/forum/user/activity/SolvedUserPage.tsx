/*
 * 资料的“已解决”标签页（类似 discourse-solved）：此人被选为最佳答案的
 * 回复，使用 fof/best-answer 自身的 `solution` 过滤器。条目是其他标签页
 * 所用的 `user-stream-item`。
 */
import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import type User from 'flarum/common/models/User';

import { leaveIfHidden } from './install';

export default class SolvedUserPage extends PostsUserPage {
  show(user: User): void {
    if (leaveIfHidden('solved', user)) return;

    super.show(user);
  }

  params(user: User) {
    return { filter: { author: user.slug(), solution: '1' } } as any;
  }
}
