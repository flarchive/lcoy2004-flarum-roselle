/*
 * “主题”分组中的收藏卡片：标题栏的功能开关，以及开启后
 * 快捷入口出现的位置。帖子上的按钮没有单独选项——
 * 它是功能的核心，关闭整个功能就会将其移除。
 */
import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.bookmarks';

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`lcoy.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const cards: CardDef[] = [
  {
    id: 'bookmarks',
    group: 'topic',
    icon: 'far fa-bookmark',
    title: () => trans(`${KEY}.title`, '收藏'),
    description: () =>
      trans(
        `${KEY}.bookmarks_enabled_help`,
        '成员可以收藏帖子，以便之后回看，并可添加可选的名称和提醒，在个人主页的「收藏」标签页中可以找到全部收藏。关闭后，相关按钮会消失，接口的行为就像该功能不存在一样，已有收藏会保留。'
      ),
    keywords: '收藏 书签 标记 提醒 bookmarks bookmark favorites reminder',
    master: 'lcoy.bookmarks_enabled',
    body: () => (
      <>
        {toggle('bookmarks_topic_button', '收藏讨论', '在讨论操作菜单（页脚的「…」菜单）中添加「收藏讨论」。它会像 Discourse 那样收藏第一条帖子。')}
        {toggle('bookmarks_user_menu', '用户菜单项', '在头像菜单中，「个人主页」的下方新增一个「收藏」快捷入口。')}
        <AdminNotice icon="far fa-clock">
          {trans(
            `${KEY}.reminders_notice`,
            '提醒由 Flarum 的计划任务每五分钟发送一次，服务器必须通过 cron 每分钟执行 php flarum schedule:run。没有 cron 时，收藏仍可正常使用，但不会发送提醒。'
          )}
        </AdminNotice>
      </>
    ),
  },
];

export default cards;
