/*
 * 主题的“分享”。放在 ShareModal 之外，让窗口进入独立的 chunk：
 * 在手机上（系统分享面板）以及关闭窗口时（只复制链接），
 * 弹窗甚至不会被下载。
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

import { gaps } from '../settings';
import { t } from '../../utils/settings';
import { copyText } from '../../utils/clipboard';

/** 分享主题（或其某篇帖子）：电脑上打开窗口，手机上用系统分享面板。 */
export function openShare(discussion: Discussion, post: Post | null = null): void {
  const path = post ? app.route.post(post) : app.route.discussion(discussion);
  const link = (app.forum.attribute<string>('baseOrigin') || window.location.origin) + path;

  if (app.screen() === 'phone' && typeof navigator.share === 'function') {
    navigator.share({ url: link, title: discussion.title() }).catch(() => {});
    return;
  }

  if (!gaps.shareModal()) {
    copyText(link).then((ok) => ok && app.alerts.show({ type: 'success' }, t('gaps.share.copied')));
    return;
  }

  app.modal.show(() => import('./ShareModal'), { discussion, post });
}
