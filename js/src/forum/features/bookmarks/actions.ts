/*
 * 书签操作集中于此，使帖子按钮、主题按钮、弹窗和个人资料页
 * 与 API、store 的交互保持一致。
 *
 * 帖子自带状态（`bookmarkId`、`bookmarkName`、`bookmarkReminderAt`，
 * 由 PHP 下发）：按钮读取的就是它。创建和编辑会返回包含该帖子的
 * 响应，store 会自动更新这些属性；删除不返回内容，因此在此处
 * 清空帖子的相关属性。
 */
import app from 'flarum/forum/app';
import type Post from 'flarum/common/models/Post';
import type Discussion from 'flarum/common/models/Discussion';

import type Bookmark from './Bookmark';
import { forumBool } from '../../utils/settings';

/**
 * 书签仅对已登录且功能已开启的用户可用。若缺少该属性
 * （功能的 PHP 未加载），则视为关闭：一个只会收到 API 404 的
 * 按钮，比没有按钮更糟。
 */
export function bookmarksEnabled(): boolean {
  return !!app.session.user && forumBool('lcoyBookmarksEnabled', false);
}

export interface PostBookmarkState {
  id: string;
  name: string | null;
  reminderAt: Date | null;
}

/** 当前用户在该帖子上的书签，按 PHP 的描述（或 `null`）。 */
export function postBookmark(post: Post): PostBookmarkState | null {
  const id = post.attribute<number | null | undefined>('bookmarkId');

  if (!id) return null;

  const reminder = post.attribute<string | null | undefined>('bookmarkReminderAt');

  return {
    id: String(id),
    name: post.attribute<string | null | undefined>('bookmarkName') ?? null,
    reminderAt: reminder ? new Date(reminder) : null,
  };
}

/**
 * 将帖子的书签作为 store 记录返回，用于保存或删除。当帖子来自
 * 较早加载的页面（store 中没有该书签）时，用帖子已有的信息
 * 构造记录——避免为此单独发起一次 GET。
 */
export function bookmarkRecord(post: Post): Bookmark | null {
  const state = postBookmark(post);

  if (!state) return null;

  const existing = app.store.getById<Bookmark>('bookmarks', state.id);

  if (existing) return existing;

  return app.store.pushObject<Bookmark>({
    type: 'bookmarks',
    id: state.id,
    attributes: {
      name: state.name,
      reminderAt: state.reminderAt ? state.reminderAt.toISOString() : null,
    },
    relationships: { post: { data: { type: 'posts', id: post.id()! } } },
  } as any);
}

/** 存在进行中请求的帖子：双击不会创建两个请求。 */
const pending = new Set<string>();

export function isBusy(post: Post): boolean {
  return pending.has(post.id()!);
}

async function withBusy<T>(post: Post, task: () => Promise<T>): Promise<T> {
  pending.add(post.id()!);
  m.redraw();

  try {
    return await task();
  } finally {
    pending.delete(post.id()!);
    m.redraw();
  }
}

export interface BookmarkChanges {
  name?: string | null;
  /** `undefined` 表示保持不变；`null` 表示移除提醒。 */
  reminderAt?: Date | null;
}

function attributesFor(changes: BookmarkChanges): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  if (changes.name !== undefined) attributes.name = changes.name?.trim() || null;
  if (changes.reminderAt !== undefined) attributes.reminderAt = changes.reminderAt ? changes.reminderAt.toISOString() : null;

  return attributes;
}

/** 收藏该帖子（若已有书签则更新）。 */
export function createBookmark(post: Post, changes: BookmarkChanges = {}): Promise<Bookmark> {
  return withBusy(post, () =>
    app.store.createRecord<Bookmark>('bookmarks').save({
      ...attributesFor(changes),
      relationships: { post },
    } as any)
  );
}

export function updateBookmark(post: Post, bookmark: Bookmark, changes: BookmarkChanges): Promise<Bookmark> {
  return withBusy(post, () => bookmark.save(attributesFor(changes) as any));
}

export function deleteBookmark(post: Post, bookmark: Bookmark | null = bookmarkRecord(post)): Promise<void> {
  return withBusy(post, async () => {
    if (bookmark) await bookmark.delete();

    clearPost(post);
  });
}

/** 取消收藏后清空帖子的相关属性。 */
export function clearPost(post: Post): void {
  post.pushAttributes({ bookmarked: false, bookmarkId: null, bookmarkName: null, bookmarkReminderAt: null });
}

/**
 * 主题的首帖，也就是“收藏主题”所收藏的对象（与 Discourse 一致）。
 * 先尝试 store，再请求 API：在主题页上它几乎总是已加载。
 */
export async function firstPostOf(discussion: Discussion): Promise<Post | null> {
  const linkedId = (discussion.data.relationships as any)?.firstPost?.data?.id;
  const linked = linkedId ? app.store.getById<Post>('posts', linkedId) : undefined;

  if (linked) return linked;

  const inStore = app.store.all<Post>('posts').find((post) => post.discussion() === discussion && post.number() === 1);

  if (inStore) return inStore;

  const found = await app.store.find<Post[]>('posts', {
    filter: { discussion: discussion.id() },
    sort: 'number',
    page: { limit: 1, total: 0 },
  } as any);

  return found[0] ?? null;
}
