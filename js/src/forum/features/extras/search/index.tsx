/*
 * 高级搜索页面：自带 gambits，以及核心搜索弹窗中的“高级搜索 →”
 * 链接。路由本身在 ../extend.ts 中注册。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import installGambits from '../gambits';
import { searchPageEnabled, searchUrl } from './route';

export default function installSearchPage(): void {
  installGambits();

  // SearchModal 按需加载（chunk）；按路径扩展只在该模块到达时生效。
  extend('flarum/common/components/SearchModal', 'activeTabItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!searchPageEnabled()) return;

    // 该弹窗也用于管理后台；该页面只存在于论坛中。
    if (!app.route || !('lcoy.search' in app.routes)) return;

    const source = this.activeSource?.();
    const query = String(this.query?.() || '');
    const type = source?.resource === 'posts' ? 'posts' : source?.resource === 'users' ? 'users' : undefined;

    items.add(
      'lcoyAdvancedSearch',
      <div className="SearchModal-section LcoySearchModal-advanced">
        <hr className="Modal-divider" />
        <ul className="Dropdown-menu SearchModal-fullPage">
          <li>
            <LinkButton icon="fas fa-sliders" href={searchUrl(query.trim(), type)}>
              {t('extras.search.modal_link')}
            </LinkButton>
          </li>
        </ul>
      </div>,
      // 紧接在核心的“搜索所有主题”（80）下方。
      75
    );
  });
}
