/*
 * 与覆盖 Discourse 功能的第三方扩展（FriendsOfFlarum）的集成：
 * 每个扩展仅在启用时才被触及，且不直接导入它们的任何模块 ——
 * 通过 Flarum 注册表获取，并带保护。
 * 管理员开关（thirdparty/settings.ts）在绘制时读取：
 * 在 initializer 中论坛尚未加载配置。
 *
 * 其余部分（follow-tags、oauth、terms、formatting、split、merge、ignore）只是
 * 视觉呈现，位于 less/forum/thirdparty/。
 *
 * forumaker 的封面在 ./profileCover 中读取和定位，它在其开关启用时
 * 安装 UserCard 和设置页中的字段。
 */
import installBestAnswer from './bestAnswer';
import installReactions from './reactions';
import installPolls from './polls';
import installLinks from './links';
import installUpload from './upload';
import installThumbnails from './thumbnails';
import installRecommendations from './recommendations';
import installFofWidgets from './fofWidgets';
import installProfileCover from './profileCover';
import { isExtensionEnabled } from '../utils/settings';
// 副作用：在 tryhackx/flarum-thumb-sliders 的 initializer 之前
// 关闭它自己的网格（主题会在行内绘制滑块）。
import './thumbSlider';

export default function installThirdParty(): void {
  if (isExtensionEnabled('fof-best-answer')) installBestAnswer();
  if (isExtensionEnabled('fof-reactions')) installReactions();
  if (isExtensionEnabled('fof-polls')) installPolls();
  if (isExtensionEnabled('fof-links')) installLinks();
  if (isExtensionEnabled('fof-upload')) installUpload();
  if (isExtensionEnabled('fof-discussion-thumbnail')) installThumbnails();
  // lcoy/recommendations 的三个列表变成侧边栏的一个区块。
  if (isExtensionEnabled('lcoy-recommendations')) installRecommendations();
  // fof/forum-widgets-core 的小部件从右栏移出，变成
  // 侧边栏的区块（右栏会撑出窗口）。
  if (isExtensionEnabled('fof-forum-widgets-core')) installFofWidgets();
  if (isExtensionEnabled('forumaker-profile-cover')) installProfileCover();
}
