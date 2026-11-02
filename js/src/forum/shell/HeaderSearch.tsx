/*
 * Discourse 的页头搜索：搜索菜单（search/SearchMenu），
 * 页头字段本身就是搜索输入框，结果在紧贴其下方的
 * 面板中打开——取代核心中打开 SearchModal
 * 的按钮。
 */
import Component from 'flarum/common/Component';
import type Mithril from 'mithril';

import SearchMenu from '../search/SearchMenu';

export default class HeaderSearch extends Component {
  view(): Mithril.Children {
    return <SearchMenu location="header" />;
  }
}
