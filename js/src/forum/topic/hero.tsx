/*
 * 主题头部：大标题，下面是分类和标签，与 Discourse 一致——去掉 flarum/tags
 * 用第一个标签颜色绘制的那条彩色带。核心的状态图标（置顶、锁定…）
 * 仍在标题之前。
 *
 * 标签扩展会给 hero 加 `DiscussionHero--colored` / `text-contrast--*`
 * 并用首个标签色作背景；颜色一律由 CSS 覆盖
 * （less/forum/Topic.less 的 `.DiscussionHero.LcoyTopicHero`），这里只负责
 * 标记主题自己的头部。
 */
import { extend } from 'flarum/common/extend';
import classList from 'flarum/common/utils/classList';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { discussionBadges } from '../utils/tags';

export default function installHero(): void {
  extend(DiscussionHero.prototype, 'items', function (this: DiscussionHero, items: ItemList<Mithril.Children>) {
    // flarum/tags 的标签行变成 Discourse 的徽章行，
    // 放在标题之后而不是之前。
    if (items.has('tags')) items.remove('tags');

    const badges = discussionBadges(this.attrs.discussion);

    if (badges) {
      items.add('lcoyBadges', <div className="LcoyTopicHero-badges">{badges}</div>, -10);
    }
  });

  extend(DiscussionHero.prototype, 'view', function (this: DiscussionHero, vnode: any) {
    if (!vnode || !vnode.attrs) return;

    vnode.attrs.className = classList(vnode.attrs.className, 'LcoyTopicHero');
  });
}
