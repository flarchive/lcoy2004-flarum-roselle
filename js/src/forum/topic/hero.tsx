/*
 * 主题头部：大标题，下面是分类和标签，与 Discourse 一致——去掉 flarum/tags
 * 用第一个标签颜色绘制的那条彩色带。核心的状态图标（置顶、锁定…）
 * 仍在标题之前。
 */
import { extend } from 'flarum/common/extend';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { discussionBadges } from '../utils/tags';

/** flarum/tags 加在 hero 上、用于以标签颜色为其着色的类。 */
const COLORED_CLASS = /^(DiscussionHero--colored|text-contrast--\w+)$/;

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

    // 标题位于白色卡片中：用标签颜色作背景不协调，而且 tags 计算出的
    // 对比度会让文字变成白底白字。
    delete vnode.attrs.style;

    vnode.attrs.className = String(vnode.attrs.className || '')
      .split(' ')
      .filter((name: string) => name && !COLORED_CLASS.test(name))
      .concat('LcoyTopicHero')
      .join(' ');
  });
}
