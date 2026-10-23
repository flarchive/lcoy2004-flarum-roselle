/*
 * 事件帖子（锁定、置顶、重命名、邀请…）采用 Discourse 的 “small action” 样式：
 * 单行显示，小图标在圆圈里，接下来是操作者头像，灰色文字中名字加粗。
 * 管理后台的 `topic_event_posts` 开关可以隐藏它们。
 */
import { extend } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import EventPost from 'flarum/forum/components/EventPost';
import type Mithril from 'mithril';

export default function installEventPosts(): void {
  extend(EventPost.prototype, 'content', function (this: EventPost, content: Mithril.Children[]) {
    const user = this.attrs.post.user();

    if (!user || !Array.isArray(content)) return;

    // 放在图标之后、文字之前。
    const index = content.findIndex((child: any) => child?.attrs?.className === 'EventPost-info');

    content.splice(index === -1 ? content.length : index, 0, <Avatar user={user} className="EventPost-avatar" />);
  });
}
