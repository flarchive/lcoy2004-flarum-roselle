/*
 * Discourse 用户卡片上的“该主题中有 N 篇帖子”：主题只显示此人的帖子，
 * 顶部带一条“显示 @某某 的 N 篇帖子 · 查看全部”。
 *
 * 核心的 PostStream 不会过滤；主题会把该主题的所有帖子一次性加载
 * （stream 保持整个窗口），再用 CSS 隐藏其他人的。点击“查看全部”只是取消
 * 过滤：帖子本来就已经在那里了。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';

import { t } from '../utils/settings';

/** 超过此数量一次性全部加载负担过重：不显示该过滤入口。 */
export const AUTHOR_FILTER_MAX_POSTS = 500;

export const authorFilter: { discussionId: string | null; user: User | null; count: number; loading: boolean } = {
  discussionId: null,
  user: null,
  count: 0,
  loading: false,
};

/** 此人在主题中已加载的帖子（可见评论）数量。 */
export function authorPostCount(discussion: Discussion, user: User): number {
  return discussion
    .postIds()
    .map((id) => app.store.getById<Post>('posts', id))
    .filter((post) => post && post.contentType() === 'comment' && !post.isHidden() && post.user() === user).length;
}

export function filterByAuthor(stream: any, discussion: Discussion, user: User): void {
  if (!stream || discussion.postIds().length > AUTHOR_FILTER_MAX_POSTS) return;

  authorFilter.loading = true;
  m.redraw();

  stream
    .loadRange(0, discussion.postIds().length)
    .then((posts: Post[]) => {
      stream.show(posts);
      authorFilter.discussionId = discussion.id()!;
      authorFilter.user = user;
      authorFilter.count = posts.filter((post) => post.contentType() === 'comment' && !post.isHidden() && post.user() === user).length;
      window.scrollTo({ top: 0 });
    })
    .catch(() => {})
    .finally(() => {
      authorFilter.loading = false;
      m.redraw();
    });
}

/**
 * 关闭过滤。它会把整个主题载入 stream（`show` 所有帖子）；关掉后窗口恢复
 * 正常——否则数百篇帖子会继续挂载，滚动一直很卡，直到刷新页面。
 */
export function clearAuthorFilter(stream?: any): void {
  const wasActive = !!authorFilter.discussionId;

  authorFilter.discussionId = null;
  authorFilter.user = null;
  authorFilter.count = 0;
  m.redraw();

  if (!wasActive || !stream) return;

  const count = stream.count?.() || 0;
  const index = Math.max(0, Math.min(count - 1, Math.floor(stream.index || 1) - 1));
  const near = stream.posts?.()[index]?.number?.() || index + 1;
  const start = Math.max(0, index - 10);
  const end = Math.min(count, start + 20);

  // 帖子已经在 store 里：loadRange 不会发起任何请求。
  stream.reset?.(start, end);

  Promise.resolve(stream.loadRange?.(start, end))
    .then((posts: Post[]) => {
      if (Array.isArray(posts) && posts.length) stream.show?.(posts);

      return stream.goToNumber?.(near);
    })
    .catch(() => {});
}

function activeFor(discussion: Discussion | null | undefined): boolean {
  return !!discussion && !!authorFilter.user && authorFilter.discussionId === discussion.id();
}

export default function installAuthorFilter(): void {
  // 每篇帖子自己判断是否被排除；过滤器变化时 retainer 需要重绘。
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    this.subtree.check(() => (activeFor(this.attrs.post.discussion()) ? authorFilter.user!.id() : ''));
  });

  extend(CommentPost.prototype, 'elementAttrs', function (this: any, attrs: Record<string, unknown>) {
    const post: Post = this.attrs.post;

    if (activeFor(post.discussion()) && post.user() !== authorFilter.user) {
      attrs.className = classList(attrs.className as string, 'LcoyPost--filteredOut');
    }
  });

  extend(DiscussionPage.prototype, 'view', function (this: any, vnode: any) {
    if (!vnode || !vnode.attrs) return;

    const active = activeFor(this.discussion);

    vnode.attrs.className = classList(vnode.attrs.className, { 'LcoyTopic--authorFilter': active });

    if (!active) return;

    const children: any[] = Array.isArray(vnode.children) ? vnode.children : [];
    const streamWrapper = children.find((child) => child && child.attrs && child.attrs.className === 'DiscussionPage-stream');

    if (!streamWrapper || !Array.isArray(streamWrapper.children)) return;

    streamWrapper.children.unshift(
      <div className="LcoyAuthorFilter" role="status">
        <span className="LcoyAuthorFilter-text">
          {t('topic.author_filter.showing', { count: authorFilter.count, username: authorFilter.user!.username() })}
        </span>
        <Button className="Button Button--link LcoyAuthorFilter-clear" onclick={() => clearAuthorFilter(this.stream)}>
          {t('topic.author_filter.show_all')}
        </Button>
      </div>
    );
  });

  // 切换到其他主题（或离开页面）时关闭过滤。
  extend(DiscussionPage.prototype, 'onremove', () => clearAuthorFilter());
}
