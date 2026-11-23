/*
 * Discourse 风格的书签。
 *
 * - 每个帖子操作栏中的书签按钮：直接收藏；已收藏的帖子则打开
 *   “编辑书签”（名称、提醒、删除）。
 * - 主题控制中的“收藏主题”（页脚的“…”和页面菜单），会收藏
 *   首帖，与 Discourse 相同。
 * - 个人资料页中的“书签”标签（仅本人可见）以及用户菜单中的入口。
 * - 通知偏好设置中的提醒通知类型。
 *
 * 路由、模型和通知组件位于 ./extend（主入口会把该数组展开到
 * 论坛的 `extend` 中）。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LinkButton from 'flarum/common/components/LinkButton';
import CommentPost from 'flarum/forum/components/CommentPost';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import UserPage from 'flarum/forum/components/UserPage';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { bookmarksEnabled, createBookmark, firstPostOf, isBusy, postBookmark } from './actions';
import { reminderLabel } from './reminders';
import { forumBool, t } from '../../utils/settings';

/** 位于主题的“复制链接”（-10）与“…”（-50）之间，与 Discourse 一致。 */
const POST_ACTION_PRIORITY = -20;

export default function installBookmarks() {
  addPostButton();
  addTopicControl();
  addProfileTab();
  addSessionItem();
  addNotificationType();
}

/**
 * 未收藏的帖子：收藏并提示——提示本身带有“设置提醒”快捷操作，
 * 因为 Discourse 在收藏后会立即打开提醒菜单。已收藏的帖子则
 * 打开弹窗。
 */
export function togglePostBookmark(post: Post): void {
  if (isBusy(post)) return;

  if (postBookmark(post)) {
    app.modal.show(() => import('./components/BookmarkModal'), { post });
    return;
  }

  createBookmark(post)
    .then(() => {
      const alertId = app.alerts.show(
        {
          type: 'success',
          controls: [
            <Button
              className="Button Button--link"
              onclick={() => {
                app.alerts.dismiss(alertId);
                app.modal.show(() => import('./components/BookmarkModal'), { post });
              }}
            >
              {t('bookmarks.alerts.set_reminder')}
            </Button>,
          ],
        },
        t('bookmarks.alerts.added')
      );
    })
    .catch(() => {});
}

function buttonTitle(post: Post): string {
  const state = postBookmark(post);

  if (!state) return t('bookmarks.post.add');

  const parts = [state.name || t('bookmarks.post.edit')];

  if (state.reminderAt && state.reminderAt.getTime() > Date.now()) {
    parts.push(t('bookmarks.post.reminder', { date: reminderLabel(state.reminderAt) }));
  }

  return parts.join(' · ');
}

function addPostButton() {
  extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    const post: Post = this.attrs.post;

    if (!bookmarksEnabled() || post.isHidden()) return;

    const state = postBookmark(post);
    const hasReminder = !!state?.reminderAt && state.reminderAt.getTime() > Date.now();
    const label = buttonTitle(post);

    items.add(
      'lcoyBookmark',
      <Button
        className={classList('Button Button--icon Button--flat LcoyPostAction LcoyBookmarkButton', {
          'LcoyBookmarkButton--active': !!state,
        })}
        icon={state ? 'fas fa-bookmark' : 'far fa-bookmark'}
        aria-label={label}
        aria-pressed={state ? 'true' : 'false'}
        title={label}
        disabled={isBusy(post)}
        onclick={() => togglePostBookmark(post)}
      >
        {hasReminder && <Icon name="fas fa-clock" className="LcoyBookmarkButton-clock" />}
      </Button>,
      POST_ACTION_PRIORITY
    );
  });
}

/** 收藏（或编辑）主题的首帖。 */
export async function toggleTopicBookmark(discussion: Discussion): Promise<void> {
  const post = await firstPostOf(discussion);

  if (!post) return;

  togglePostBookmark(post);
  m.redraw();
}

export function topicIsBookmarked(discussion: Discussion): boolean {
  const linkedId = (discussion.data.relationships as any)?.firstPost?.data?.id;
  const firstPost =
    (linkedId && app.store.getById<Post>('posts', linkedId)) ||
    app.store.all<Post>('posts').find((post) => post.discussion() === discussion && post.number() === 1);

  return !!firstPost && !!postBookmark(firstPost);
}

function addTopicControl() {
  extend(DiscussionControls, 'userControls', function (items: ItemList<Mithril.Children>, discussion: Discussion) {
    if (!bookmarksEnabled() || !forumBool('lcoyBookmarksTopicButton', true)) return;

    const bookmarked = topicIsBookmarked(discussion);

    items.add(
      'lcoyBookmark',
      <Button icon={bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark'} onclick={() => toggleTopicBookmark(discussion).catch(() => {})}>
        {t(bookmarked ? 'bookmarks.topic.edit' : 'bookmarks.topic.add')}
      </Button>,
      // 紧接在“回复”下方（无优先级，位于列表顶部）。
      -10
    );
  });
}

function addProfileTab() {
  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    // 书签属于个人内容：该标签仅在本人资料页显示。
    if (!this.user || !bookmarksEnabled() || app.session.user !== this.user) return;

    items.add(
      'lcoyBookmarks',
      <LinkButton href={app.route('user.bookmarks', { username: this.user.slug() })} icon="far fa-bookmark">
        {t('bookmarks.page.nav')}
      </LinkButton>,
      75
    );
  });
}

function addSessionItem() {
  extend(SessionDropdown.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    if (!user || !bookmarksEnabled() || !forumBool('lcoyBookmarksUserMenu', true)) return;

    items.add(
      'lcoyBookmarks',
      <LinkButton icon="far fa-bookmark" href={app.route('user.bookmarks', { username: user.slug() })}>
        {t('bookmarks.page.nav')}
      </LinkButton>,
      // 紧接在“个人资料”（100）下方、“设置”（50）上方。
      90
    );
  });
}

function addNotificationType() {
  // 按模块名扩展：NotificationGrid 位于设置页面的 chunk 中，
  // 按需加载——启动时该类尚不存在。
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!forumBool('lcoyBookmarksEnabled', false)) return;

    items.add('lcoyBookmarkReminder', {
      name: 'lcoyBookmarkReminder',
      icon: 'fas fa-bookmark',
      label: t('bookmarks.settings.notify_reminder_label'),
    });
  });
}
