/*
 * Flarum 原本没有的 Discourse 通知，由功能后端生成
 * （extend/gaps.php）：
 *
 * - “某某编辑了你的帖子”（edited）；
 * - “某某关联了你的主题”（linked）；
 *
 * 以及它们在 设置 → 通知 中的条目，仅在后端已加载时显示
 *（否则服务器上不存在该类型）。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Notification from 'flarum/forum/components/Notification';
import { truncate } from 'flarum/common/utils/string';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';

import { gapsBackend } from '../settings';
import { forumBool, t } from '../../utils/settings';

function postSubject(notification: any): Post | null {
  const subject = notification.subject();

  return subject && typeof subject.discussion === 'function' ? (subject as Post) : null;
}

export class PostEditedNotification extends Notification {
  icon() {
    return 'fas fa-pencil';
  }

  href() {
    const post = postSubject(this.attrs.notification);

    return post ? app.route.post(post) : app.route('index');
  }

  content() {
    const user = this.attrs.notification.fromUser();

    return t('gaps.notifications.post_edited', { username: user ? user.displayName() : '' });
  }

  excerpt() {
    const post = postSubject(this.attrs.notification);
    const discussion = post?.discussion();

    return discussion ? discussion.title() : null;
  }
}

export class TopicLinkedNotification extends Notification {
  icon() {
    return 'fas fa-link';
  }

  href() {
    const post = postSubject(this.attrs.notification);

    return post ? app.route.post(post) : app.route('index');
  }

  content() {
    const user = this.attrs.notification.fromUser();

    return t('gaps.notifications.topic_linked', { username: user ? user.displayName() : '' });
  }

  excerpt() {
    const post = postSubject(this.attrs.notification);
    const discussion = post?.discussion();

    return discussion ? truncate(discussion.title(), 120) : null;
  }
}

export default function installGapNotifications(): void {
  // 按模块名：NotificationGrid 位于设置页面的 chunk 中，按需加载。
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!gapsBackend()) return;

    if (forumBool('lcoyNotifyPostEdited', true)) {
      items.add('lcoyPostEdited', { name: 'lcoyPostEdited', icon: 'fas fa-pencil', label: t('gaps.notifications.post_edited_setting') });
    }

    if (forumBool('lcoyNotifyTopicLinked', true)) {
      items.add('lcoyTopicLinked', { name: 'lcoyTopicLinked', icon: 'fas fa-link', label: t('gaps.notifications.topic_linked_setting') });
    }
  });
}
