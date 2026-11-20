/*
 * Discourse 的搜索菜单（`.search-menu`）：页头字段本身
 * 就是搜索输入框，面板（`.search-menu-panel`）紧贴其下方
 * 打开，没有弹窗，也不会让页面变暗。
 *
 * - 空：一条随机提示（"#"、"@"、"is:"、Ctrl+Enter）和最近的
 *   搜索；在分类页面中，显示“in ▪ 分类”。
 * - 输入中：“在所有主题和帖子中搜索该词，或按 Enter”，
 *   后面是与搜索词匹配的分类、标签和用户。
 * - 搜索词末尾的 "#"、"@" 或 "key:"：带建议的助手。
 * - Enter：主题，带状态图标、标题、分类，以及
 *   搜索词加粗的摘要；再次按 Enter（或 Ctrl+Enter）打开
 *   整页搜索。
 *
 * 在手机上，页头只显示放大镜；点击后字段覆盖页头，
 * 面板占据其下方的屏幕。
 *
 * 结构和类名遵循 Discourse 的 `search-menu/*` 组件；
 * CSS（less/forum/Search.less）只在
 * `.LcoySearchMenu` 内生效，以免与通用类名冲突。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { searchIcon, slidersIcon } from '../utils/shellIcons';
import state from './state';
import { advancedSearchAvailable, fullSearchUrl } from './query';
import { preloadSearchPanel, SearchPanelSlot } from './panelLazy';

export interface SearchMenuAttrs extends ComponentAttrs {
  /** `header`（页头字段）或 `welcome`（欢迎横幅）。 */
  location: 'header' | 'welcome';
}

/** 15 秒内按两次 Enter 会打开整页搜索（`SECOND_ENTER_MAX_DELAY`）。 */
const SECOND_ENTER_MAX_DELAY = 15000;

let instances = 0;

export default class SearchMenu extends Component<SearchMenuAttrs> {
  protected open = false;
  protected lastEnter = 0;
  protected inputId = '';

  protected onDocumentPress = (event: Event) => {
    if (!this.open) return;

    const target = event.target as HTMLElement | null;

    if (target && this.element?.contains(target)) return;

    this.close(false);
  };

  oninit(vnode: Mithril.Vnode<SearchMenuAttrs, this>) {
    super.oninit(vnode);

    // 第一个菜单使用 Discourse 的 id（`search-term`）；横幅中的使用另一个。
    this.inputId = instances++ === 0 ? 'search-term' : `search-term-${instances}`;

    // 在列表搜索（`/?q=`）之后，字段继续显示搜索词。
    const active = app.search.state.getValue?.();

    if (active && !state.term) state.term = active;
  }

  oncreate(vnode: Mithril.VnodeDOM<SearchMenuAttrs, this>) {
    super.oncreate(vnode);

    // 面板（结果、提示、助手）是一个 chunk：在首次聚焦之前
    // 下载——在字段悬停/触摸时，或没有这些操作时在启动空闲时。
    this.element.addEventListener('mouseenter', preloadSearchPanel, { once: true });
    this.element.addEventListener('touchstart', preloadSearchPanel, { once: true, passive: true });
    this.element.addEventListener('focusin', preloadSearchPanel, { once: true });
    preloadSearchPanel({ idle: true });

    document.addEventListener('mousedown', this.onDocumentPress);
    document.addEventListener('touchend', this.onDocumentPress);
  }

  onremove(vnode: Mithril.VnodeDOM<SearchMenuAttrs, this>) {
    super.onremove(vnode);

    document.removeEventListener('mousedown', this.onDocumentPress);
    document.removeEventListener('touchend', this.onDocumentPress);
  }

  view(): Mithril.Children {
    const location = this.attrs.location;

    return (
      <div
        className={classList('search-menu glimmer-search-menu LcoySearchMenu', `LcoySearchMenu--${location}`, {
          'LcoySearchMenu--open': this.open,
        })}
        role="search"
        onkeydown={(event: KeyboardEvent) => this.onKeydown(event)}
      >
        {location === 'header' && (
          <button
            type="button"
            className="LcoySearchMenu-toggle LcoyHeaderSearch Button Button--icon Button--flat"
            aria-label={t('search_menu.title')}
            title={t('search_menu.title')}
            onclick={() => (this.open ? this.close() : this.openAndFocus())}
          >
            {searchIcon()}
          </button>
        )}
        <div className={classList('search-menu-container menu-panel-results', { loading: state.loading })}>
          {this.inputView()}
          {this.open && <SearchPanelSlot menu={this} />}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // 字段
  // ---------------------------------------------------------------------

  placeholder(): string {
    return t('search_menu.title');
  }

  inputView(): Mithril.Children {
    const placeholder = this.placeholder();

    return (
      <div className="search-input-wrapper">
        <div
          className={classList('search-input', `search-input--${this.attrs.location}`, 'LcoyHeaderSearch')}
          onclick={(event: MouseEvent) => {
            // 快捷键 “/” 以及点击文本外（放大镜上）的人都会落到字段中。
            if (!(event.target as HTMLElement).closest('a, button, input')) this.input()?.focus();
          }}
        >
          <span className="search-icon" aria-hidden="true">
            {searchIcon()}
          </span>
          <input
            id={this.inputId}
            className="search-term__input"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            aria-label={placeholder}
            placeholder={placeholder}
            value={state.term}
            oninput={(event: InputEvent) => state.setTerm((event.target as HTMLInputElement).value)}
            onkeydown={(event: KeyboardEvent) => this.onInputKeydown(event)}
            onfocus={() => this.openMenu()}
          />
          <div className="searching">
            {state.loading ? (
              <div className="spinner small" />
            ) : (
              [
                state.term ? (
                  <a
                    href="#"
                    className="clear-search"
                    aria-label={t('search_menu.clear_search')}
                    title={t('search_menu.clear_search')}
                    onclick={(event: MouseEvent) => {
                      event.preventDefault();
                      event.stopPropagation();
                      state.clear();
                      this.input()?.focus();
                    }}
                  >
                    <Icon name="fas fa-times" />
                  </a>
                ) : null,
                advancedSearchAvailable() ? (
                  <button
                    type="button"
                    className="show-advanced-search btn-transparent"
                    title={t('search_menu.open_advanced')}
                    aria-label={t('search_menu.open_advanced')}
                    onclick={() => this.go(fullSearchUrl(state.term))}
                  >
                    {slidersIcon()}
                  </button>
                ) : null,
              ]
            )}
          </div>
          {/* 在手机上，字段会覆盖页头：这个 X 用于关闭它。 */}
          <button type="button" className="LcoySearchMenu-cancel" aria-label={t('search_menu.close')} onclick={() => this.close()}>
            <Icon name="fas fa-times" />
          </button>
        </div>
      </div>
    );
  }

  input(): HTMLInputElement | null {
    return (this.element?.querySelector('input.search-term__input') as HTMLInputElement | null) || null;
  }

  openMenu(): void {
    if (this.open) return;

    this.open = true;
    m.redraw();
  }

  /** 在手机上点击放大镜：字段必须在聚焦前已存在于屏幕中（键盘只会在手势内打开）。 */
  openAndFocus(): void {
    this.open = true;
    m.redraw.sync();
    this.input()?.focus();
  }

  close(blur = true): void {
    this.open = false;

    // 如同 Discourse：失焦后再次聚焦会重新打开面板。
    if (blur) this.input()?.blur();

    m.redraw();
  }

  go(url: string): void {
    this.close();
    m.route.set(url);
  }

  fullSearch(): void {
    this.go(fullSearchUrl(state.term));
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) return;

    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      this.fullSearch();
      return;
    }

    this.openMenu();

    const recentEnter = this.lastEnter && Date.now() - this.lastEnter < SECOND_ENTER_MAX_DELAY;

    if (state.searchTopics && recentEnter) {
      this.fullSearch();
    } else if (state.term.trim()) {
      state.searchTopicsNow();
    }

    this.lastEnter = Date.now();
  }

  /** Esc 关闭；方向键在面板的链接间移动，并回到字段。 */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (!this.open || !this.element) return;

    const input = this.input();
    const links = Array.from(
      this.element.querySelectorAll<HTMLElement>('.search-menu-panel .search-link, .search-menu-panel .clear-recent-searches')
    );
    const items: HTMLElement[] = input ? [input, ...links] : links;

    if (items.length < 2) return;

    event.preventDefault();

    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);

    items[next].focus();
  }
}
