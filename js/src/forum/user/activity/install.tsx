/*
 * 资料中原本缺失、用于对齐 Discourse 的“活动”子标签页：
 * 已读、反应、投票和已解决。每个仅在对应扩展启用且管理后台勾选
 *（“个人资料页面”卡片）时出现：
 *
 * - 已读（`user.read`）：此人读过的主题，从最新到最旧。
 *   个人性质：仅本人和管理员可见。
 * - 反应（`user.reactions`，fof/reactions）：此人给出的点赞和反应，
 *   合并为一个列表（在 Lcoy 中点赞就是“爱心”反应）。它取代“点赞”；
 *   没有 fof 时保留核心的“点赞”。反应仅对有 fof 的查看反应者权限的人
 *   可见；点赞对所有人可见。
 * - 投票（`user.votes`，fof/polls）：此人投票过的带投票帖子，
 *   且该投票会显示投票者（对本人则全部显示）。
 * - 已解决（`user.solved`，fof/best-answer）：此人被选为最佳答案的回复。
 *
 * 路由直接放进 `app.routes`（initializer 在 `mount` 之前运行）；
 * 服务器已经用资料页面响应 `/u/{username}[/{filter}]`。页面在各自的
 * chunk 中按需加载。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled, t } from '../../utils/settings';

/**
 * 子标签页的顺序，与 Discourse 一致：全部、主题、已读、草稿、
 * 点赞、收藏、反应、投票、已解决。提及和媒体（Discourse 这一行没有）
 * 排在其后；其他扩展的放在最后。
 */
export const ACTIVITY_ORDER = [
  'posts',
  'discussions',
  'lcoyRead',
  'lcoyDrafts',
  'likes',
  // 点赞 + 反应：取代“点赞”。
  'lcoyReactions',
  'lcoyBookmarks',
  'lcoyVotes',
  'lcoySolved',
  'mentions',
  'uploads',
];

type Tab = 'read' | 'reactions' | 'votes' | 'solved';

const TABS: Record<Tab, { key: string; icon: string; load: () => Promise<any> }> = {
  read: { key: 'lcoyRead', icon: 'fas fa-clock-rotate-left', load: () => import('./ReadUserPage') },
  reactions: { key: 'lcoyReactions', icon: 'far fa-face-smile', load: () => import('./ReactionsUserPage') },
  votes: { key: 'lcoyVotes', icon: 'fas fa-check-to-slot', load: () => import('./VotesUserPage') },
  solved: { key: 'lcoySolved', icon: 'far fa-square-check', load: () => import('./SolvedUserPage') },
};

/** 已读（以及其他个人性质的内容）：本人或管理员。 */
export function canSeePrivate(user: User): boolean {
  const actor = app.session.user;

  return !!actor && (actor === user || !!actor.isAdmin());
}

/**
 * 该标签页对此资料是否存在。在绘制时读取：在 initializer 中
 * `app.forum` 还不存在。已读和投票依赖服务器 `activity` 功能的过滤器
 *（`lcoyActivityFilters`）。
 */
export function activityTabOn(tab: Tab, user: User): boolean {
  const filters = !!app.forum.attribute('lcoyActivityFilters');

  switch (tab) {
    case 'read':
      return filters && forumBool('lcoyUserActivityRead', true) && canSeePrivate(user);
    case 'reactions':
      return (
        filters &&
        isExtensionEnabled('fof-reactions') &&
        forumBool('lcoyUserActivityReactions', true) &&
        (isExtensionEnabled('flarum-likes') || !!app.forum.attribute('lcoyCanSeeReactions'))
      );
    case 'votes':
      return filters && isExtensionEnabled('fof-polls') && forumBool('lcoyUserActivityVotes', true);
    case 'solved':
      return isExtensionEnabled('fof-best-answer') && forumBool('lcoyUserActivitySolved', true);
  }
}

/** 手动输入但无权查看的标签页会退回帖子页。 */
export function leaveIfHidden(tab: Tab, user: User): boolean {
  if (activityTabOn(tab, user)) return false;

  m.route.set(app.route('user.posts', { username: user.slug() }), undefined, { replace: true });

  return true;
}

export default function installActivity() {
  (Object.keys(TABS) as Tab[]).forEach((tab) => {
    app.routes[`user.${tab}`] = {
      path: `/u/:username/${tab}`,
      component: TABS[tab].load,
      resolverClass: UserPageResolver,
    } as any;
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    const user = this.user;

    if (!user) return;

    // 点赞和反应合并为一个标签页（“反应”）。
    if (activityTabOn('reactions', user) && items.has('likes')) items.remove('likes');

    (Object.keys(TABS) as Tab[]).forEach((tab) => {
      if (!activityTabOn(tab, user)) return;

      items.add(
        TABS[tab].key,
        <LinkButton href={app.route(`user.${tab}`, { username: user.slug() })} icon={TABS[tab].icon}>
          {t(`user.nav.${tab}`)}
        </LinkButton>,
        // 最终位置由 ACTIVITY_ORDER 在资料导航中决定。
        60
      );
    });
  });
}
