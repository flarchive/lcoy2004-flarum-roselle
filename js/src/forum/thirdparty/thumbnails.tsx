/*
 * fof/discussion-thumbnail 在主题列表中。
 *
 * 该扩展用缩略图替换作者头像，但主题的列表
 * 并不绘制该头像（Discourse 在独立的列中显示发帖人）。
 * 因此缩略图变成独立项，位于标题之前，与 Horizon 的
 * 缩略图组件相同；在移动端它占据 48px 头像的
 * 位置。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { thirdParty } from './settings';

export default function installThumbnails(): void {
  extend(DiscussionListItem.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.thumbnails()) return;

    // 搜索弹窗的结果（MinimalDiscussionListItem）仍保留头像。
    if (String(this.elementAttrs().className || '').includes('MinimalDiscussionListItem')) return;

    const discussion = this.attrs.discussion;
    const src = discussion.attribute('customThumbnail');

    if (!src) return;

    items.add(
      'lcoyThumbnail',
      <Link href={app.route.discussion(discussion)} className="LcoyTopicThumbnail" tabindex="-1" aria-hidden="true">
        <img src={src} alt="" loading="lazy" decoding="async" />
      </Link>,
      90
    );
  });
}
