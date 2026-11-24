/*
 * 用 Discourse 的导航栏替换核心的工具栏（排序下拉菜单 + 按钮）。
 * 只改变 `toolbar` 项：realtime 的新内容提示以及扩展放入
 * contentItems 的其他内容保持原位。
 */
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ListNavigation from './ListNavigation';

export default function installNavigation(): void {
  extend(IndexPage.prototype, 'contentItems', function (this: IndexPage, items: ItemList<Mithril.Children>) {
    if (!items.has('toolbar')) return;

    items.setContent('toolbar', <ListNavigation page={this} />);
  });
}
