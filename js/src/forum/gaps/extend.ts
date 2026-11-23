/*
 * 功能后端的通知类型（extend/gaps.php）。extender 在论坛获知配置之前
 * 运行，因此始终注册；没有后端时，服务器只是不会发送这些类型的通知。
 */
import Extend from 'flarum/common/extenders';

import { PostEditedNotification, TopicLinkedNotification } from './backend/notifications';

export default [
  new Extend.Notification() //
    .add('lcoyPostEdited', PostEditedNotification)
    .add('lcoyTopicLinked', TopicLinkedNotification),
];
