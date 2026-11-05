/*
 * 资料“通知”标签页的路由。服务器已经用资料页面响应
 * `/u/{username}[/{filter}]`：该 URL 可直接打开，无需在 PHP 中新增路由
 *（与书签相同）。
 */
import Extend from 'flarum/common/extenders';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

// 按需加载的页面（独立 chunk）：不增加首次加载负担。
const NotificationsUserPage = () => import('./NotificationsUserPage');

export default [
  new Extend.Routes() //
    .add('user.notifications', '/u/:username/notifications', NotificationsUserPage, UserPageResolver as any),
];
