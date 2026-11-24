/*
 * 资料“摘要”的路由和标签页（`/u/:username/summary`）。
 *
 * 路由直接放进 `app.routes`，与 Extend.Routes 的做法相同：initializer 在
 * `mount` 之前运行，而核心在 `mount` 时装配路由器。服务器已经用资料页面
 * 响应 `/u/{username}[/{filter}]`，因此 URL 可直接打开，无需在 PHP 中新增路由。
 *
 * 资料链接（`app.route.user`：头像、帖子中的名字、会话菜单）
 * 会在管理后台选定的标签页打开（`lcoy.user_default_tab`）：默认是“讨论”，
 * 进入个人主页即可看到对方发起的主题；也可以改为“摘要”。
 * 讨论与回复分成两个标签页，回复流只列回复（`lcoyReplies`）。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import PostsUserPage from 'flarum/forum/components/PostsUserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import UserSummaryPage from './UserSummaryPage';
import { forumBool, t } from '../utils/settings';

export default function installSummary() {
  app.routes['user.summary'] = {
    path: '/u/:username/summary',
    component: UserSummaryPage,
    resolverClass: UserPageResolver,
  } as any;

  // 配置在构建链接时读取：在 initializer 中 `app.forum` 还不存在。
  app.route.user = (user: User) =>
    app.forum && forumBool('lcoyUserSummary', true) && app.forum.attribute('lcoyUserDefaultTab') === 'summary'
      ? app.route('user.summary', { username: user.slug() })
      : app.route('user.discussions', { username: user.slug() });

  // 帖子（回复）获得 Discourse 专属地址（`/u/:username/activity`）：
  // 核心的 `/u/:username` 变成入口，打开默认标签页。
  app.routes['user.activity'] = {
    path: '/u/:username/activity',
    component: PostsUserPage,
    resolverClass: UserPageResolver,
  } as any;

  extend(UserPage.prototype, 'oninit', function () {
    const username = m.route.param('username');

    if (!username) return;

    // 只有不带标签页的地址：核心的 `user` 和 `user.posts` 路由共用
    // 同一路径，因此路由名不足以区分。
    if (m.route.get().split('?')[0] !== app.route('user', { username })) return;

    // 入口落在管理员选择的标签页。“讨论”是默认：点开个人主页
    // 就能看到对方发起的主题，而不是在回帖流里翻找。
    const summary = forumBool('lcoyUserSummary', true) && app.forum.attribute('lcoyUserDefaultTab') === 'summary';

    m.route.set(app.route(summary ? 'user.summary' : 'user.discussions', { username }), undefined, { replace: true });
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!this.user || !items.has('posts')) return;

    (items.get('posts') as any).attrs.href = app.route('user.activity', { username: this.user.slug() });
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    // 论坛属性在这里读取，而不是在 install 中：在 initializer 里
    // `app.forum` 还不存在。
    if (!this.user || !forumBool('lcoyUserSummary', true)) return;

    items.add(
      'summary',
      <LinkButton href={app.route('user.summary', { username: this.user.slug() })} icon="far fa-user">
        {t('user.summary.nav')}
      </LinkButton>,
      110
    );
  });
}
