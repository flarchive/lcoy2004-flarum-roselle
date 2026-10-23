/*
 * Discourse 资料的“摘要”标签页：一行数字（“访问 1.9k 天”），
 * 以及两栏中的最佳回复和最佳主题——每项上方是日期和点赞数，
 * 下方是标题。
 *
 * Flarum 不保存阅读时长和访问天数，因此数字只能用现有的数据：注册天数、
 * 给出的点赞（启用 flarum/likes 时；计数来自已点赞帖子搜索的
 * `meta.page.total`）、创建的主题和帖子。
 *
 * “最佳”遵循 Discourse——点赞最多者优先——但只在一个近期样本内
 *（最新帖子、回复最多的主题）：Flarum 的 API 不按点赞排序。
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import stringToColor from 'flarum/common/utils/stringToColor';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import type User from 'flarum/common/models/User';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { fullDate, shortDate } from '../utils/dates';
import { isExtensionEnabled, t } from '../utils/settings';
import { formatReadTime, userActivity } from '../features/stats/activity';

/** 每栏显示多少项，与 Discourse 一致。 */
const LIST_LIMIT = 6;
/** 生成“最佳”的样本。 */
const REPLY_SAMPLE = 50;
const TOPIC_SAMPLE = 20;

// 只取列表绘制所需的字段（JSON:API "sparse fieldsets"）：去掉每篇帖子的
// HTML 和文本后，样本（以及摘要的预加载——它在 src/Preload/PreloadContent.php
// 中镜像这些请求）降到约 1/4。store 中的部分模型没有影响：主题的流程会
// 重新加载帖子（不带 `canEdit`），其他页面则请求各自所需。
const TOPIC_FIELDS = { discussions: 'title,slug,commentCount,createdAt,firstPost', posts: 'likesCount' };
const REPLY_FIELDS = { posts: 'number,createdAt,likesCount,discussion', discussions: 'title,slug' };
const DAY = 24 * 60 * 60 * 1000;

function likesOf(post: Post | null | undefined | false): number | null {
  const value = post ? post.attribute<number | undefined>('likesCount') : undefined;

  return typeof value === 'number' ? value : null;
}

interface SummaryUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  color: string | null;
  count: number;
}

interface SummaryCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  topics: number;
  replies: number;
}

interface SummaryExtra {
  mostRepliedTo: SummaryUser[] | null;
  mostLikedBy: SummaryUser[] | null;
  mostLiked: SummaryUser[] | null;
  topCategories: SummaryCategory[] | null;
}

export default class UserSummaryPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  topics: Discussion[] | null = null;
  replies: Post[] | null = null;
  likesGiven: number | null = null;
  /** 摘要后端（资源 `usersummary`）的列表；没有它时为 null。 */
  extra: SummaryExtra | null = null;

  /** 数据已被请求过的用户：完整资料到达时 `show()` 会再次运行。 */
  private loadedFor: User | null = null;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);

    if (this.loadedFor === user) return;

    this.loadedFor = user;
    this.load(user);
  }

  likesEnabled(): boolean {
    return isExtensionEnabled('flarum-likes');
  }

  load(user: User): void {
    // 这里的错误不需要提示：该区域留空，资料页其余部分照常。
    const quiet = { errorHandler: () => {} };
    const byLikes = (a: Post | null, b: Post | null) => (likesOf(b) ?? 0) - (likesOf(a) ?? 0);

    app.store
      .find<Discussion[]>(
        'discussions',
        {
          filter: { author: user.slug() },
          sort: '-commentCount',
          include: 'firstPost',
          fields: TOPIC_FIELDS,
          page: { limit: TOPIC_SAMPLE, total: 0 },
        } as any,
        undefined,
        quiet
      )
      .then((topics) => {
        // API 的顺序（回复最多）用于打破平局；排序是稳定的。
        const list = topics.slice();
        if (this.likesEnabled()) list.sort((a, b) => byLikes(a.firstPost() || null, b.firstPost() || null));
        this.topics = list.slice(0, LIST_LIMIT);
      })
      .catch(() => (this.topics = []))
      .finally(() => m.redraw());

    app.store
      .find<Post[]>(
        'posts',
        {
          filter: { author: user.slug(), type: 'comment' },
          sort: '-createdAt',
          include: 'discussion',
          fields: REPLY_FIELDS,
          page: { limit: REPLY_SAMPLE, total: 0 },
        } as any,
        undefined,
        quiet
      )
      .then((posts) => {
        // 回复即不开启主题的帖子。
        const replies = posts.filter((post) => post.discussion() && (post.number() || 0) > 1);
        if (this.likesEnabled()) replies.sort(byLikes);
        this.replies = replies.slice(0, LIST_LIMIT);
      })
      .catch(() => (this.replies = []))
      .finally(() => m.redraw());

    // “回复最多”、“被谁点赞最多”、“点赞最多”、
    // “最佳标签”：服务器上没有该功能时路由不存在，
    // 这些区域就直接不出现。
    this.extra = null;
    app
      .request<SummaryExtra>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/lcoy-user-summary/${user.id()}`, ...quiet })
      .then((extra) => {
        if (this.loadedFor === user && extra && typeof extra === 'object') this.extra = extra;
      })
      .catch(() => {})
      .finally(() => m.redraw());

    if (this.likesEnabled()) {
      app.store
        .find<Post[]>('posts', { filter: { likedBy: user.username() }, page: { limit: 1 } } as any, undefined, quiet)
        .then((result: any) => {
          const total = result?.payload?.meta?.page?.total;
          this.likesGiven = typeof total === 'number' ? total : null;
        })
        .catch(() => (this.likesGiven = null))
        .finally(() => m.redraw());
    }
  }

  content(): Mithril.Children {
    return <div className="LcoyUserSummary">{this.sectionItems().toArray()}</div>;
  }

  sectionItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = this.user!;

    items.add(
      'stats',
      <section className="LcoyUserSummary-section LcoyUserSummary-stats">
        <h3 className="LcoyUserSummary-heading">{t('user.summary.stats_heading')}</h3>
        <ul className="LcoyUserSummary-statList">{this.statItems().toArray()}</ul>
      </section>,
      100
    );

    items.add(
      'columns',
      <div className="LcoyUserSummary-columns">
        <section className="LcoyUserSummary-section LcoyUserSummary-replies">
          <h3 className="LcoyUserSummary-heading">{t('user.summary.top_replies_heading')}</h3>
          {this.list(this.replies, (post) => this.replyItem(post), t('user.summary.no_replies'))}
          {!!this.replies?.length && (
            <Link className="LcoyUserSummary-more" href={app.route('user.posts', { username: user.slug() })}>
              {t('user.summary.more_replies')}
            </Link>
          )}
        </section>
        <section className="LcoyUserSummary-section LcoyUserSummary-topics">
          <h3 className="LcoyUserSummary-heading">{t('user.summary.top_topics_heading')}</h3>
          {this.list(this.topics, (discussion) => this.topicItem(discussion), t('user.summary.no_topics'))}
          {!!this.topics?.length && (
            <Link className="LcoyUserSummary-more" href={app.route('user.discussions', { username: user.slug() })}>
              {t('user.summary.more_topics')}
            </Link>
          )}
        </section>
      </div>,
      90
    );

    const extra = this.extra;

    if (extra) {
      // 各对区域始终并排，与 Discourse 一致：没有数据的区域显示标题和
      // “暂无内容”，而不是消失，让另一个单独占一行。
      items.add(
        'mostRepliedTo',
        <div className="LcoyUserSummary-columns">
          {this.userSection(
            'most-replied-to',
            t('user.summary.most_replied_to'),
            extra.mostRepliedTo || [],
            'fas fa-reply',
            t('user.summary.empty_replied')
          )}
        </div>,
        88
      );

      items.add(
        'likes',
        <div className="LcoyUserSummary-columns">
          {this.userSection('most-liked-by', t('user.summary.most_liked_by'), extra.mostLikedBy || [], 'fas fa-heart', t('user.summary.empty_likes'))}
          {this.userSection('most-liked', t('user.summary.most_liked'), extra.mostLiked || [], 'fas fa-heart', t('user.summary.empty_likes'))}
        </div>,
        87
      );

      if (extra.topCategories?.length) items.add('topCategories', this.categoriesSection(extra.topCategories), 86);
    }

    return items;
  }

  /** `.summary-user-list`：头像、用户名和姓名，以及下方的计数。 */
  userSection(name: string, heading: string, users: SummaryUser[], icon: string, emptyText = ''): Mithril.Children {
    if (!users.length) {
      return (
        <section className={`LcoyUserSummary-section LcoyUserSummary-${name}`}>
          <h3 className="LcoyUserSummary-heading">{heading}</h3>
          <p className="LcoyUserSummary-empty">{emptyText}</p>
        </section>
      );
    }

    return (
      <section className={`LcoyUserSummary-section LcoyUserSummary-${name}`}>
        <h3 className="LcoyUserSummary-heading">{heading}</h3>
        <ul className="LcoySummaryUsers">
          {users.map((user) => (
            <li className="LcoySummaryUsers-item" key={user.id}>
              <Link className="LcoySummaryUsers-avatar" href={app.route('user', { username: user.username })} tabindex="-1" aria-hidden="true">
                {user.avatarUrl ? (
                  <img className="Avatar" src={user.avatarUrl} alt="" loading="lazy" />
                ) : (
                  <span className="Avatar" style={{ '--avatar-bg': user.color || `#${stringToColor(user.displayName || user.username)}` }}>
                    {(user.displayName || user.username).charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
              <div className="LcoySummaryUsers-details">
                <div className="LcoySummaryUsers-names">
                  <Link className="LcoySummaryUsers-username" href={app.route('user', { username: user.username })}>
                    {user.username}
                  </Link>
                  {user.displayName && user.displayName !== user.username ? <span className="LcoySummaryUsers-name">{user.displayName}</span> : null}
                </div>
                <span className="LcoySummaryUsers-count" title={formatNumber(user.count)}>
                  <Icon name={icon} /> {abbreviateNumber(user.count)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /** `.top-categories-section`：分类、主题和回复。 */
  categoriesSection(categories: SummaryCategory[]): Mithril.Children {
    return (
      <section className="LcoyUserSummary-section LcoyUserSummary-topCategories">
        <h3 className="LcoyUserSummary-heading">{t('user.summary.top_categories')}</h3>
        <table className="LcoySummaryCategories">
          <thead>
            <tr>
              <th />
              <th className="LcoySummaryCategories-count">{t('user.summary.topics')}</th>
              <th className="LcoySummaryCategories-count">{t('user.summary.replies_column')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <Link className="LcoySummaryCategories-badge" href={app.route('tag', { tags: category.slug })}>
                    <span className="LcoySummaryCategories-swatch" style={{ background: category.color || 'var(--lcoy-primary-medium)' }} />
                    <span>{category.name}</span>
                  </Link>
                </td>
                <td className="LcoySummaryCategories-count">{formatNumber(category.topics)}</td>
                <td className="LcoySummaryCategories-count">{formatNumber(category.replies)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  statItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = this.user!;

    // 有统计功能时，按 Discourse 的同一顺序显示数字：
    // 访问天数、阅读时长、已读帖子、
    // 给出和收到的点赞、创建的主题和帖子、解决方案。
    const activity = userActivity(user);

    if (activity && activity.daysVisited !== null) {
      items.add('daysVisited', this.stat(activity.daysVisited, t('user.summary.days_visited', { count: activity.daysVisited })), 100);
    } else {
      const joinTime = user.joinTime();
      if (joinTime) {
        const days = Math.max(1, Math.floor((Date.now() - joinTime.getTime()) / DAY));
        items.add('days', this.stat(days, t('user.summary.days_member', { count: days }), fullDate(joinTime)), 100);
      }
    }

    if (activity && activity.timeRead !== null) {
      items.add('timeRead', this.statText(formatReadTime(activity.timeRead), t('user.summary.time_read')), 98);
    }

    // “近期阅读时长”（60 天），仅在存在时显示，与 Discourse 一致。
    if (activity && activity.recentTimeRead) {
      items.add('recentTimeRead', this.statText(formatReadTime(activity.recentTimeRead), t('user.summary.recent_time_read')), 97);
    }

    if (activity && activity.postsRead !== null) {
      items.add('postsRead', this.stat(activity.postsRead, t('user.summary.posts_read')), 94);
    }

    const likesGiven = activity && activity.likesGiven !== null ? activity.likesGiven : this.likesGiven;

    if (likesGiven !== null) {
      items.add('likesGiven', this.stat(likesGiven, t('user.summary.likes_given_short'), undefined, 'far fa-heart'), 90);
    }

    if (activity && activity.likesReceived !== null) {
      items.add('likesReceived', this.stat(activity.likesReceived, t('user.summary.likes_received_short'), undefined, 'far fa-heart'), 85);
    }

    items.add('topics', this.stat(user.discussionCount() || 0, t('user.summary.topics_created')), 80);
    items.add('posts', this.stat(user.commentCount() || 0, t('user.summary.posts_created')), 70);

    const solutions = user.attribute<number | null | undefined>('bestAnswerCount');

    if (typeof solutions === 'number') {
      items.add('solutions', this.stat(solutions, t('user.summary.solutions'), undefined, 'far fa-square-check'), 60);
    }

    return items;
  }

  /** “阅读 7 个月”：已格式化的值。 */
  statText(value: string, label: string): Mithril.Children {
    return (
      <li className="LcoyUserSummary-stat">
        <span className="LcoyUserSummary-stat-value">{value}</span> <span className="LcoyUserSummary-stat-label">{label}</span>
      </li>
    );
  }

  /** “访问 1.9k 天”：缩写数字，完整值放在 title 中。 */
  stat(value: number, label: string, title?: string, icon?: string): Mithril.Children {
    return (
      <li className="LcoyUserSummary-stat" title={title || formatNumber(value)}>
        <span className="LcoyUserSummary-stat-value">{abbreviateNumber(value)}</span>{' '}
        <span className="LcoyUserSummary-stat-label">
          {icon && [<Icon name={icon} className="LcoyUserSummary-stat-icon" />, ' ']}
          {label}
        </span>
      </li>
    );
  }

  list<T>(models: T[] | null, render: (model: T) => Mithril.Children, emptyText: string): Mithril.Children {
    // 加载中：按条目格式（上方日期、下方标题）显示行，避免列在数据到达时跳动。
    if (models === null) {
      return (
        <ul className="LcoySummaryList LcoySummaryList--loading" aria-busy="true">
          {['62%', '78%', '54%'].map((width) => (
            <li className="LcoySummaryList-item">
              <span className="LcoySkeleton LcoySummaryList-fake" style={{ width: '6em' }} />
              <br />
              <span className="LcoySkeleton LcoySummaryList-fake" style={{ width }} />
            </li>
          ))}
        </ul>
      );
    }

    if (!models.length) return <p className="LcoyUserSummary-empty">{emptyText}</p>;

    return <ul className="LcoySummaryList">{models.map((model) => render(model))}</ul>;
  }

  /** 上方“2022年4月 · ♡ 15”，下方主题标题。 */
  meta(date: Date | undefined | null, likes: number | null, replies?: number): Mithril.Children {
    const parts: Mithril.Children[] = [];

    if (date) {
      parts.push(
        <time datetime={date.toISOString()} title={fullDate(date)}>
          {shortDate(date)}
        </time>
      );
    }

    if (likes !== null) {
      parts.push(
        <span className="LcoySummaryList-likes">
          <Icon name="far fa-heart" /> {formatNumber(likes)}
        </span>
      );
    } else if (replies !== undefined) {
      parts.push(
        <span className="LcoySummaryList-replies" title={t('user.summary.replies', { count: replies })}>
          <Icon name="fas fa-reply" /> {formatNumber(replies)}
        </span>
      );
    }

    return <span className="LcoySummaryList-meta">{parts.map((part, index) => [index > 0 ? ' · ' : null, part])}</span>;
  }

  topicItem(discussion: Discussion): Mithril.Children {
    const replies = Math.max(0, (discussion.commentCount() || 1) - 1);
    const likes = this.likesEnabled() ? likesOf(discussion.firstPost() || null) : null;

    return (
      <li className="LcoySummaryList-item" key={discussion.id()}>
        {this.meta(discussion.createdAt(), likes, replies)}
        <br />
        <Link className="LcoySummaryList-title" href={app.route.discussion(discussion)}>
          {discussion.title()}
        </Link>
      </li>
    );
  }

  replyItem(post: Post): Mithril.Children {
    const discussion = post.discussion() as Discussion;

    return (
      <li className="LcoySummaryList-item" key={post.id()}>
        {this.meta(post.createdAt(), this.likesEnabled() ? likesOf(post) : null)}
        <br />
        <Link className="LcoySummaryList-title" href={app.route.post(post)}>
          {discussion.title()}
        </Link>
      </li>
    );
  }
}
