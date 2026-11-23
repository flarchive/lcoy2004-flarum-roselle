/*
 * 每篇帖子的界面状态（谁点赞了面板展开、额外按钮显示、
 * 内嵌回复…）以及主题页面的配置。
 *
 * CommentPost 只有在 SubtreeRetainer 发现某些变化（帖子、作者、编辑）时才会
 * 重绘。仅仅打开面板的点击不会改变这些，所以这里的每次状态变更都会递增
 * `version`，主题再把该版本登记到帖子的 retainer 中。
 */
import app from 'flarum/forum/app';
import { forumBool, isExtensionEnabled } from '../utils/settings';

export interface PostUi {
  likers: boolean;
  more: boolean;
  share: boolean;
  replies: boolean;
  parent: boolean;
  version: number;
  /** 链接按钮的“已复制”会在片刻后自动消失。 */
  copiedTimer?: number;
  /** 读者点赞的时刻：爱心只在点击后短暂跳动。 */
  likeBump?: number;
}

export function postUi(component: any): PostUi {
  if (!component.lcoyUi) {
    component.lcoyUi = { likers: false, more: false, share: false, replies: false, parent: false, version: 0 };
  }

  return component.lcoyUi;
}

/** 切换帖子的某个面板并通知 retainer。 */
export function togglePostUi(ui: PostUi, key: 'likers' | 'more' | 'share' | 'replies' | 'parent', value?: boolean): void {
  ui[key] = value ?? !ui[key];
  ui.version++;
}

export const topicSettings = {
  timeline: () => forumBool('lcoyTopicTimeline', true),
  footer: () => forumBool('lcoyTopicFooter', true),
  map: () => forumBool('lcoyTopicMap', true),
  suggested: () => forumBool('lcoySuggestedTopics', true),
  userCard: () => forumBool('lcoyUserCard', true),
  postActions: () => forumBool('lcoyPostActions', true),
  embeddedReplies: () => forumBool('lcoyEmbeddedReplies', true) && isExtensionEnabled('flarum-mentions'),
  /** “回复给”显示在名字下方一行，与 avocado 一致（lcoy.topic_reply_to_style）。 */
  replyToLine: () => app.forum?.attribute('lcoyTopicReplyToStyle') === 'avocado' && isExtensionEnabled('flarum-mentions'),
  // flarum-pusher（2.x）和 flarum-realtime（1.x）会实时更新主题；
  // 只有启用其中之一时，这条横条才有意义。
  newRepliesBar: () => forumBool('lcoyNewRepliesBar', true) && (isExtensionEnabled('flarum-pusher') || isExtensionEnabled('flarum-realtime')),
};

/** 主题通知控件仅在启用 flarum/subscriptions 且有人登录时存在。 */
export function canSubscribe(): boolean {
  return isExtensionEnabled('flarum-subscriptions') && !!app.session.user;
}

/** 绝对链接，用于复制和分享。 */
export function absoluteUrl(path: string): string {
  return (app.forum.attribute<string>('baseOrigin') || window.location.origin) + path;
}
