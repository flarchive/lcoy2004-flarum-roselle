/*
 * 与第三方扩展集成的管理员开关。在服务端给出相反设置之前，
 * 它们都视为 `true`，因此即使扩展的配置尚未存在于 extend.php 中，
 * 集成也能工作。
 */
import app from 'flarum/forum/app';

import { forumBool, isExtensionEnabled } from '../utils/settings';

/**
 * 手机页头没有位置放导航项：有侧边栏时，链接即便开关关闭
 * 也进入汉堡面板。侧边栏被关闭时没有面板可放，链接留在页头。
 */
function linksNeedSidebar(): boolean {
  return app.screen() === 'phone' && forumBool('lcoySidebarEnabled', true);
}

export const thirdParty = {
  /** fof/best-answer：帖子栏中的 "✓ 已解决" 以及首帖下方被采纳的答案。 */
  solved: () => isExtensionEnabled('fof-best-answer') && forumBool('lcoyThirdPartySolved', true),
  /** fof/reactions：帖子栏中的 emoji 摘要，与 discourse-reactions 相同。 */
  reactions: () => isExtensionEnabled('fof-reactions') && forumBool('lcoyThirdPartyReactions', true),
  /** fof/polls：Discourse 投票的网格，旁边显示较大的计数。 */
  polls: () => isExtensionEnabled('fof-polls') && forumBool('lcoyThirdPartyPolls', true),
  /**
   * fof/links：默认留在页眉（Flarum 的默认位置），开启后移入侧边栏。
   * 手机页头放不下导航项，因此有侧边栏时即便开关关闭也移入侧边栏，
   * 否则链接会被隐藏、无从进入。
   */
  linksSidebar: () => isExtensionEnabled('fof-links') && (forumBool('lcoyThirdPartyLinksSidebar', false) || linksNeedSidebar()),
  /** fof/upload：编辑器中的 "上传中…" 栏。 */
  uploadProgress: () => isExtensionEnabled('fof-upload') && forumBool('lcoyThirdPartyUploadProgress', true),
  /** fof/discussion-thumbnail：主题列表中的缩略图。 */
  thumbnails: () => isExtensionEnabled('fof-discussion-thumbnail') && forumBool('lcoyThirdPartyThumbnails', true),
  /**
   * forumaker/profile-cover：用该扩展的封面取代主题内置封面
   * （个人资料、名片以及设置页中的编辑器）。内置封面仍保留在数据库中。
   */
  profileCover: () => isExtensionEnabled('forumaker-profile-cover') && forumBool('lcoyThirdPartyProfileCover', true),
  /**
   * lcoy/recommendations：三个列表（推荐 / 最新 / 最多浏览）位于侧边栏的
   * "推荐" 部分，取代 fof/forum-widgets-core 的小部件。
   * 没有侧边栏就没有位置放置该区块，小部件仍由该扩展提供。
   */
  recommendationsSidebar: () => isExtensionEnabled('lcoy-recommendations') && forumBool('lcoySidebarEnabled', true),
};

/**
 * 可能被关闭的扩展的模块：绝不直接 `import`，
 * 否则没有它就会让整个主题崩溃。
 */
export function extModule<T = any>(namespace: string, id: string): T | null {
  if (!isExtensionEnabled(namespace)) return null;

  return ((flarum as any).reg.checkModule(namespace, id) as T) || null;
}
