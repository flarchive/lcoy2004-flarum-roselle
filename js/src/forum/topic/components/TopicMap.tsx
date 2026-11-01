/*
 * 当前 Discourse 的主题地图（topic-map.--op），位于第一楼正下方：
 * 夹在两条线之间的横条，醒目展示各项数字（浏览量、点赞、用户），旁边是
 * 参与最多的用户头像。点赞和用户会打开菜单（“最受欢迎的回复”、
 * “常驻作者”），与那边一致。在长主题中，它会在末尾重复出现
 * （topic-map.--bottom）。
 *
 * 只有链接菜单和点赞菜单读取已加载的数据；浏览量仅在某个扩展已经下发该
 * 属性时出现；用户和点赞由帖子统计得出，但仅当所有帖子都已在内存中——
 * 部分求和会得到一个看似正确实则错误的数字。没有它们时，改用回复数，
 * Flarum 总是有这个数。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import username from 'flarum/common/helpers/username';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { isExtensionEnabled, t } from '../../utils/settings';
import { formatViews, viewsLabel } from '../../utils/views';

export interface TopicMapAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** 'op' 在第一楼下方；'bottom' 在主题末尾。 */
  position?: 'op' | 'bottom';
}

/** 横条中能放下几个头像，以及点赞菜单中显示几篇帖子。 */
const POSTERS_LIMIT = 5;
const LIKED_LIMIT = 3;
/** 回复数达到多少时地图在末尾重复出现（Meta 在 11 时重复）。 */
const BOTTOM_MIN_REPLIES = 10;

type MenuKey = 'likes' | 'users';

function numericAttribute(discussion: Discussion, names: string[]): number | null {
  for (const name of names) {
    const value = discussion.attribute<unknown>(name);

    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return null;
}

/** 主题的所有帖子，如果都已加载；否则为 null。 */
function allPosts(discussion: Discussion): Post[] | null {
  const posts: Post[] = [];

  for (const id of discussion.postIds()) {
    const post = app.store.getById<Post>('posts', id);

    if (!post) return null;

    posts.push(post);
  }

  return posts;
}

/** 已加载的帖子（用于头像，可以是部分）。 */
function loadedPosts(discussion: Discussion): Post[] {
  return discussion
    .postIds()
    .map((id) => app.store.getById<Post>('posts', id))
    .filter((post): post is Post => !!post);
}

const VIEW_ATTRIBUTES = ['views', 'view_count'];

/** 没有回复也没有浏览量时，地图只会重复帖子的头部。 */
export function hasTopicMap(discussion: Discussion): boolean {
  return discussion.replyCount() > 0 || numericAttribute(discussion, VIEW_ATTRIBUTES) !== null;
}

export function hasBottomTopicMap(discussion: Discussion): boolean {
  return discussion.replyCount() >= BOTTOM_MIN_REPLIES;
}

function likesOf(post: Post): number {
  return Number(post.attribute('likesCount')) || 0;
}

/** 发帖最多的人在前；并列时先发帖的人在前。 */
function posters(posts: Post[]): { user: User; count: number }[] {
  const counts = new Map<User, number>();

  posts.forEach((post) => {
    const user = post.user();
    if (user) counts.set(user, (counts.get(user) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count);
}

export default class TopicMap extends Component<TopicMapAttrs> {
  open: MenuKey | null = null;
  closer?: (event: Event) => void;

  onremove(vnode: Mithril.VnodeDOM<TopicMapAttrs, this>) {
    super.onremove(vnode);
    this.unlisten();
  }

  view() {
    const discussion = this.attrs.discussion;
    const position = this.attrs.position || 'op';
    const views = numericAttribute(discussion, VIEW_ATTRIBUTES);

    const posts = allPosts(discussion);
    const comments = posts ? posts.filter((post) => post.contentType() === 'comment' && !post.isHidden()) : null;
    const users = numericAttribute(discussion, ['participantCount', 'participantsCount']) ?? (comments ? posters(comments).length : null);
    const likes =
      numericAttribute(discussion, ['lcoyLikeCount']) ??
      (comments && isExtensionEnabled('flarum-likes') ? comments.reduce((sum, post) => sum + likesOf(post), 0) : null);

    const visible = loadedPosts(discussion).filter((post) => post.contentType() === 'comment' && !post.isHidden());
    const top = posters(visible);

    const stats: Mithril.Children[] = [];

    // Discourse 的 `minViewsCount`：当前打开的主题浏览量不会为零。
    const shownViews = views === null ? null : Math.max(views, 1);

    if (shownViews !== null) stats.push(this.stat('views', shownViews, viewsLabel(shownViews)));
    if (likes) stats.push(this.stat('likes', likes, t('topic.map.likes', { count: likes }), 'likes'));
    if (users !== null && users > 0) stats.push(this.stat('users', users, t('topic.map.users', { count: users }), 'users'));
    if (users === null) {
      const replies = discussion.replyCount();
      stats.push(this.stat('replies', replies, t('topic.map.replies', { count: replies })));
    }

    return (
      <section className={classList('LcoyTopicMap', `LcoyTopicMap--${position}`)} aria-label={t('topic.map.aria_label')}>
        <div className={classList('LcoyTopicMap-stats', { 'LcoyTopicMap-stats--single': stats.length === 1 })}>
          {stats}

          {top.length > 1 && (
            <div className="LcoyTopicMap-users">
              {top.slice(0, POSTERS_LIMIT).map(({ user, count }) => (
                <Link
                  className={user.isOnline() ? 'LcoyTopicMap-poster LcoyTopicMap-poster--online' : 'LcoyTopicMap-poster'}
                  href={app.route.user(user)}
                  title={`${user.displayName()}: ${t('topic.map.posts', { count })}`}
                >
                  <Avatar user={user} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {this.open === 'likes' && this.likesMenu(visible)}
        {this.open === 'users' && this.usersMenu(top)}
      </section>
    );
  }

  stat(key: string, value: number, label: string, menu?: MenuKey): Mithril.Children {
    const content = [
      // Discourse 的 `dNumber … noTitle`：1.2k、120k、1.0M。
      <span className="LcoyTopicMap-number number">{formatViews(value)}</span>,
      <span className="LcoyTopicMap-label">{label}</span>,
    ];

    if (!menu) return <div className={`LcoyTopicMap-stat LcoyTopicMap-stat--${key}`}>{content}</div>;

    return (
      <button
        type="button"
        className={classList('LcoyTopicMap-stat', `LcoyTopicMap-stat--${key}`, { active: this.open === menu })}
        aria-expanded={this.open === menu ? 'true' : 'false'}
        onclick={(event: MouseEvent) => this.toggle(menu, event.currentTarget as HTMLElement)}
      >
        {content}
      </button>
    );
  }

  toggle(menu: MenuKey, trigger: HTMLElement) {
    if (this.open === menu) {
      this.close();
      return;
    }

    this.unlisten();
    this.open = menu;
    this.anchorLeft = trigger.offsetLeft;

    // 点击外部或按 Esc 时关闭，与 Discourse 的菜单一致。
    this.closer = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.type === 'mousedown' && (event.target as HTMLElement).closest?.('.LcoyTopicMap-menu, .LcoyTopicMap-stat')) return;

      this.close();
      m.redraw();
    };

    document.addEventListener('mousedown', this.closer, true);
    document.addEventListener('keydown', this.closer, true);
  }

  anchorLeft = 0;

  close() {
    this.open = null;
    this.unlisten();
  }

  unlisten() {
    if (!this.closer) return;

    document.removeEventListener('mousedown', this.closer, true);
    document.removeEventListener('keydown', this.closer, true);
    this.closer = undefined;
  }

  menu(className: string, title: string, body: Mithril.Children): Mithril.Children {
    return (
      <div className={classList('LcoyTopicMap-menu', className)} role="dialog" aria-label={title} style={{ left: `${this.anchorLeft}px` }}>
        <h3 className="LcoyTopicMap-menuTitle">{title}</h3>
        {body}
      </div>
    );
  }

  /** 点赞最多的回复（第一楼不计入，与 Discourse 一致）。 */
  likesMenu(posts: Post[]): Mithril.Children {
    const liked = posts
      .filter((post) => post.number() > 1 && likesOf(post) > 0)
      .sort((a, b) => likesOf(b) - likesOf(a) || a.number() - b.number())
      .slice(0, LIKED_LIMIT);

    return this.menu(
      'LcoyTopicMap-menu--likes',
      t('topic.map.most_liked'),
      <ul className="LcoyTopicMap-liked">
        {liked.map((post) => (
          <li>
            <Link href={app.route.post(post)} onclick={() => this.close()}>
              <span className="LcoyTopicMap-likedUser">
                <Avatar user={post.user() || null} />
                {username(post.user() || null)}
              </span>
              <span className="LcoyTopicMap-likedCount">
                {abbreviateNumber(likesOf(post))}
                <Icon name="fas fa-heart" />
              </span>
              <p className="LcoyTopicMap-likedExcerpt">{post.contentPlain()?.slice(0, 200)}</p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  usersMenu(top: { user: User; count: number }[]): Mithril.Children {
    return this.menu(
      'LcoyTopicMap-menu--users',
      t('topic.map.frequent_posters'),
      <div className="LcoyTopicMap-usersList">
        {top.slice(0, 24).map(({ user, count }) => (
          <Link className="LcoyTopicMap-poster" href={app.route.user(user)} title={user.displayName()} onclick={() => this.close()}>
            <Avatar user={user} />
            {count > 1 && <span className="LcoyTopicMap-postCount">{count}</span>}
          </Link>
        ))}
      </div>
    );
  }
}
