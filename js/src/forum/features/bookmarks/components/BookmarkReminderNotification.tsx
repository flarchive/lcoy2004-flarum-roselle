/*
 * “书签提醒”通知（类型 `lcoyBookmarkReminder`），由计划任务
 * 在到达所选时间时发送。点击进入被收藏的帖子；摘录为书签名称，
 * 若无名称则为帖子的开头部分。
 */
import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import { truncate } from 'flarum/common/utils/string';
import type Post from 'flarum/common/models/Post';

import { t } from '../../../utils/settings';

interface ReminderContent {
  bookmarkId?: number;
  name?: string | null;
  reminderAt?: string | null;
}

export default class BookmarkReminderNotification extends Notification {
  icon() {
    return 'fas fa-bookmark';
  }

  post(): Post | null {
    return (this.attrs.notification.subject() as Post | null | false) || null;
  }

  href() {
    const post = this.post();

    return post ? app.route.post(post) : '';
  }

  content() {
    const discussion = this.post()?.discussion();

    return t('bookmarks.notification.text', { title: discussion ? discussion.title() : '' });
  }

  excerpt() {
    const data = (this.attrs.notification.content<ReminderContent | null>() || {}) as ReminderContent;

    if (data.name) return data.name;

    const plain = this.post()?.contentPlain();

    return plain ? truncate(plain, 200) : null;
  }
}
