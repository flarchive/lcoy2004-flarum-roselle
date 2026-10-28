/*
 * Discourse 搜索：用搜索菜单（SearchMenu）取代打开核心
 * SearchModal 的按钮。页头的那个由 HeaderSearch
 * （shell/）绘制；这里加入欢迎横幅中的那个，在 Discourse 中
 * 它也是同一个 `search-menu`。
 */
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import WelcomeBanner from '../list/WelcomeBanner';
import SearchMenu from './SearchMenu';

export default function installSearchMenu(): void {
  extend(WelcomeBanner.prototype, 'bodyItems', function (items: ItemList<Mithril.Children>) {
    if (!items.has('search')) return;

    items.setContent(
      'search',
      <div className="LcoyWelcome-search">
        <SearchMenu location="welcome" />
      </div>
    );
  });
}
