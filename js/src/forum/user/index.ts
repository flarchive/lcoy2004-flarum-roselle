/*
 * Discourse 风格的用户资料和会话菜单。
 *
 * - 资料卡片（UserCard `.UserHero`）获得封面、大头像、
 *   突出显示的名字、胶囊形式的分组、“发消息”按钮以及统计行。
 * - 资料导航变成卡片下方的横向标签页。
 * - 一个像 Discourse 那样的“摘要”页面（`user.summary`）。
 * - 会话菜单顶部显示用户身份。
 * - 补齐 Discourse 缺失的“活动”子标签页（已读、反应、
 *   投票、已解决），位于 activity/。
 *
 * 通用组件（按钮、弹窗、composer、搜索、设置）
 * 只用 LESS：核心的标记已经够用。
 */
import installProfile from './installProfile';
import installSummary from './installSummary';
import installSessionMenu from './installSessionMenu';
import installPreferences from './preferences/install';
import installActivity from './activity/install';

export default function installUser() {
  installProfile();
  installSummary();
  installSessionMenu();
  installPreferences();
  installActivity();
}
