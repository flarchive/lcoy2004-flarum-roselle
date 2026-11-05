/*
 * 书签的论坛 extenders：store 中的模型、个人资料页标签的路由、
 * 提醒通知组件，以及 PHP 为帖子添加的属性。主入口文件会把
 * 该数组展开到论坛的 `extend` 中。
 */
import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

import Bookmark from './Bookmark';
// 按需加载的页面（独立 chunk）：不增加首次加载负担。
const BookmarksUserPage = () => import('./components/BookmarksUserPage');
import BookmarkReminderNotification from './components/BookmarkReminderNotification';

export default [
  new Extend.Store() //
    .add('bookmarks', Bookmark),

  // 服务端已用个人资料页响应 `/u/{username}[/{filter}]`：
  // 该 URL 可直接打开，无需在 PHP 中新增路由。
  // 类型断言：core 2.0.1 的类型定义不接受此处的 UserPageResolver，
  // 尽管 flarum/likes 本身也是这样使用的。
  new Extend.Routes() //
    .add('user.bookmarks', '/u/:username/bookmarks', BookmarksUserPage, UserPageResolver as any),

  new Extend.Notification() //
    .add('lcoyBookmarkReminder', BookmarkReminderNotification),

  new Extend.Model(Post) //
    .attribute<boolean>('bookmarked')
    .attribute<number | null>('bookmarkId')
    .attribute<string | null>('bookmarkName')
    .attribute<Date | null, string | null>('bookmarkReminderAt', (value) => (value ? new Date(value) : null)),
];
