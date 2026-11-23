/*
 * 主题中缺失的 Discourse 功能（gaps）的开关。
 *
 * 在使用时读取，而不是在 initializer 中：那时论坛还没加载配置。
 * 带后端的功能（extend/gaps.php）仅在服务器表示后端已加载
 * （`lcoyGapsBackend`）时出现：否则界面会调用不存在的路由。
 */
import app from 'flarum/forum/app';

import { forumBool } from '../utils/settings';

export const gaps = {
  postShortcuts: () => forumBool('lcoyPostShortcuts', true) && forumBool('lcoyKeyboardShortcuts', true),
  codeButtons: () => forumBool('lcoyCodeButtons', true),
  headingAnchors: () => forumBool('lcoyHeadingAnchors', true),
  spoilerBlur: () => forumBool('lcoySpoilerBlur', true),
  mentionCards: () => forumBool('lcoyMentionCards', true) && forumBool('lcoyUserCard', true),
  readState: () => forumBool('lcoyPostReadState', true),
  timelineBack: () => forumBool('lcoyTimelineBack', true) && forumBool('lcoyTopicTimeline', true),
  titleEditor: () => forumBool('lcoyInlineTitleEditor', true),
  shareModal: () => forumBool('lcoyShareModal', true),
  lastVisit: () => forumBool('lcoyListLastVisit', true),
  dismiss: () => forumBool('lcoyListDismiss', true),
  tableExpand: () => forumBool('lcoyTableExpand', true),
};

/** 带后端的功能：仅在 extend/gaps.php 已加载时可用。 */
export function gapsBackend(): boolean {
  return forumBool('lcoyGapsBackend', false);
}

/** 自由文本配置的文本，已去掉两端空白。 */
export function forumString(attribute: string): string {
  const value = app.forum.attribute<unknown>(attribute);

  return typeof value === 'string' ? value.trim() : '';
}
