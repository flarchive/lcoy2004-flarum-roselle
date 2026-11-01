/*
 * 主题地图在第一楼之后插入，通过 PostStream 的 afterFirstPostItems
 * （按需加载的 chunk，因此按模块名 extend）。
 */
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import TopicMap, { hasTopicMap } from './components/TopicMap';
import { topicSettings } from './ui';

export default function installTopicMap(): void {
  extend('flarum/forum/components/PostStream', 'afterFirstPostItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!topicSettings.map() || !this.discussion || !hasTopicMap(this.discussion)) return;

    items.add('lcoyTopicMap', <TopicMap discussion={this.discussion} />, 100);
  });
}
