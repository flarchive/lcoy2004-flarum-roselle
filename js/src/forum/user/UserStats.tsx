/*
 * Discourse 的资料统计行：“加入于 2021年2月23日”、“最后发帖 9月17日”、
 * “最后活跃 14 小时前”…——灰色标签、深色值，之间有细边框。
 *
 * 用户模型不带最后发帖日期，因此它来自一次只取一篇帖子的查询，按用户缓存，
 * 避免每次重绘或每个资料标签页都重复请求。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import classList from 'flarum/common/utils/classList';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { fullDate, shortAge, shortDate } from '../utils/dates';
import { forumBool, t } from '../utils/settings';
import { groupsEnabled, groupUrl } from '../features/community/groups';

export interface UserStatsAttrs extends ComponentAttrs {
  user: User;
}

/** 用户 id → 最后发帖日期（null = 没有；Promise = 加载中）。 */
const lastPostCache = new Map<string, Date | null | Promise<void>>();

function loadLastPost(user: User): void {
  const id = user.id();

  if (!id || lastPostCache.has(id) || !user.commentCount()) return;

  const request = app.store
    .find<Post[]>('posts', {
      filter: { author: user.slug(), type: 'comment' },
      sort: '-createdAt',
      // 只取日期（摘要的预加载会把这篇排除在回复样本之外）。
      fields: { posts: 'number,createdAt,likesCount,discussion' },
      page: { limit: 1, total: 0 },
    } as any)
    .then((posts) => {
      lastPostCache.set(id, posts[0]?.createdAt() ?? null);
    })
    .catch(() => {
      // 无权限或网络错误：该统计直接不显示。
      lastPostCache.set(id, null);
    })
    .finally(() => m.redraw());

  lastPostCache.set(id, request);
}

function cachedLastPost(user: User): Date | null {
  const value = lastPostCache.get(user.id() || '');

  return value instanceof Date ? value : null;
}

export default class UserStats<Attrs extends UserStatsAttrs = UserStatsAttrs> extends Component<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    loadLastPost(this.attrs.user);
  }

  view(): Mithril.Children {
    const items = this.items();

    if (items.isEmpty()) return null;

    return <dl className="LcoyUserStats">{items.toArray()}</dl>;
  }

  /** 每项统计是一个条目，便于其他扩展追加自己的。 */
  items(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = this.attrs.user;

    const joinTime = user.joinTime();
    if (joinTime) {
      items.add('joined', this.stat(t('user.stats.joined'), shortDate(joinTime), fullDate(joinTime)), 100);
    }

    const lastPost = cachedLastPost(user);
    if (lastPost) {
      items.add('lastPost', this.stat(t('user.stats.last_post'), shortAge(lastPost), fullDate(lastPost)), 90);
    }

    const lastSeenAt = user.lastSeenAt();
    if (lastSeenAt) {
      const online = user.isOnline();

      items.add(
        'lastSeen',
        this.stat(
          t('user.stats.seen'),
          online ? <span className="LcoyUserStats-online">{t('user.stats.online')}</span> : shortAge(lastSeenAt),
          fullDate(lastSeenAt)
        ),
        80
      );
    }

    const posts = user.commentCount();
    if (typeof posts === 'number') {
      items.add('posts', this.stat(t('user.stats.posts'), formatNumber(posts)), 70);
    }

    const discussions = user.discussionCount();
    if (typeof discussions === 'number') {
      items.add('discussions', this.stat(t('user.stats.topics'), formatNumber(discussions)), 60);
    }

    // “分组 team, plugin_authors…”：名字用逗号分隔，分组页面存在时
    // 作为指向该页面的链接。
    const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);
    if (groups.length) {
      const linked = groupsEnabled() && forumBool('lcoyGroupsProfileLinks', true);

      items.add(
        'groups',
        this.stat(
          t('user.stats.groups'),
          groups.map((group) =>
            linked ? (
              <Link className="LcoyUserStats-group" href={groupUrl(group)}>
                {group.nameSingular()}
              </Link>
            ) : (
              <span className="LcoyUserStats-group">{group.nameSingular()}</span>
            )
          ),
          undefined,
          'LcoyUserStats-item--groups'
        ),
        40
      );
    }

    return items;
  }

  stat(label: string, value: Mithril.Children, title?: string, className?: string): Mithril.Children {
    return (
      <div className={classList('LcoyUserStats-item', className)} title={title || undefined}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    );
  }
}
