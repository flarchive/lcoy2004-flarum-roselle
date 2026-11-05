/*
 * Discourse 的搜索页面（`/search?q=`）：标签（主题、帖子、标签与分类、
 * 用户）、带“搜索”的大输入框、“高级筛选”、“排序方式”、“X 的 N 个
 * 结果”，以及带标题、标签和高亮搜索词摘录的结果。
 *
 * 全部状态都保存在 URL 中（`q`、`type`、`sort`）：每次搜索都会导航到
 * 新 URL，核心的解析器重建页面，浏览器后退即可回到上一次搜索——
 * 与 Discourse 一致。只有筛选面板的展开状态保存在外部，避免每次
 * 搜索都关闭它。
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Model from 'flarum/common/Model';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { isTagsEnabled, type LcoyTag } from '../../../utils/tags';
import AdvancedFilters from './AdvancedFilters';
import { hasCriteria, highlightPattern, parseQuery, serializeQuery, type SearchQuery } from './query';
import { discussionResult, postResult, resultSkeleton, tagResult, userResult } from './results';
import { fetchPage, postFilters, sortOptions, type SearchTab } from './sources';

// 路由和 URL 位于 ./route，在本页面的 chunk 之外。
import { SEARCH_ROUTE, searchPageEnabled, searchUrl } from './route';

/** 展开的筛选面板在每次搜索导致页面重建后仍然保留。 */
let filtersExpanded = false;

export default class SearchPage extends Page<IPageAttrs> {
  tab: SearchTab = 'topics';
  sort = 'relevance';
  /** 输入框中的文本，含 gambits。 */
  raw = '';
  query!: SearchQuery;

  items: Model[] = [];
  total: number | null = null;
  hasMore = false;
  loading = false;
  searched = false;
  failed = false;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--lcoySearch';

    const type = String(m.route.param('type') || 'topics') as SearchTab;
    this.tab = this.tabs().some(([key]) => key === type) ? type : 'topics';

    this.raw = String(m.route.param('q') || '').trim();
    this.query = parseQuery(this.raw);

    const sorts = sortOptions(this.tab, t).map((option) => option.key);
    const sort = String(m.route.param('sort') || '');
    // 无文本时没有相关性可排序：默认变为“最新”。
    this.sort = sorts.includes(sort) ? sort : this.query.text ? 'relevance' : 'latest';

    app.history.push(SEARCH_ROUTE, t('extras.search.title'));

    if (searchPageEnabled() && this.canSearch()) this.load(0);
  }

  oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.oncreate(vnode);

    app.setTitle(this.raw ? t('extras.search.meta_title_query', { query: this.raw }) : t('extras.search.title'));
    app.setTitleCount(0);

    // 没有查询时，输入框是该页面唯一可操作的内容。
    if (!this.raw) this.$('.LcoySearch-input').trigger('focus');
  }

  view(): Mithril.Children {
    if (!searchPageEnabled()) {
      return (
        <PageStructure className="LcoySearchPage">
          <p className="LcoySearch-empty">{app.translator.trans('core.forum.error.not_found_text')}</p>
        </PageStructure>
      );
    }

    return (
      <PageStructure className="LcoySearchPage">
        <div className="LcoySearch">
          {this.tabsView()}
          {this.formView()}
          {this.controlsView()}
          {filtersExpanded && this.filtersAvailable() && (
            <AdvancedFilters query={this.query} postsOnly={this.tab === 'posts'} onchange={(query: SearchQuery) => this.updateQuery(query)} />
          )}
          {this.sortView()}
          {this.resultsView()}
        </div>
      </PageStructure>
    );
  }

  // ── 标签 ──────────────────────────────────────────────────────────────────

  tabs(): [SearchTab, string][] {
    const tabs: [SearchTab, string][] = [
      ['topics', t('extras.search.tab_topics')],
      ['posts', t('extras.search.tab_posts')],
    ];

    if (isTagsEnabled()) tabs.push(['categories', t('extras.search.tab_categories')]);
    if (app.forum.attribute('canSearchUsers')) tabs.push(['users', t('extras.search.tab_users')]);

    return tabs;
  }

  tabsView(): Mithril.Children {
    return (
      <nav className="LcoySearch-tabs" aria-label={t('extras.search.tabs_label')}>
        {this.tabs().map(([key, label]) => (
          <button
            type="button"
            className={classList('LcoySearch-tab', { active: this.tab === key })}
            aria-current={this.tab === key ? 'page' : undefined}
            onclick={() => this.go(this.raw, key, undefined)}
          >
            {label}
          </button>
        ))}
      </nav>
    );
  }

  // ── 输入框 ─────────────────────────────────────────────────────────────────

  formView(): Mithril.Children {
    return (
      <form
        className="LcoySearch-form"
        role="search"
        onsubmit={(event: SubmitEvent) => {
          event.preventDefault();
          // 只有用户明确选择的排序会随新搜索保留：默认排序随文本
          // 变化（有文本时按相关性，无文本时按最新）。
          this.go(this.raw, this.tab, m.route.param('sort'));
        }}
      >
        <div className="LcoySearch-field">
          <input
            className="FormControl LcoySearch-input"
            type="search"
            enterkeyhint="search"
            aria-label={t('extras.search.input_label')}
            placeholder={t('extras.search.input_placeholder')}
            value={this.raw}
            oninput={(event: InputEvent) => {
              this.raw = (event.target as HTMLInputElement).value;
              // 控件会跟随手动输入的 gambits。
              this.query = parseQuery(this.raw);
            }}
          />
          {this.raw && (
            <Button
              className="Button Button--icon Button--link LcoySearch-clear"
              icon="fas fa-times"
              aria-label={t('extras.search.clear')}
              onclick={() => {
                this.raw = '';
                this.query = parseQuery('');
                this.$('.LcoySearch-input').trigger('focus');
              }}
            />
          )}
        </div>
        <Button type="submit" className="Button Button--primary LcoySearch-submit" icon="fas fa-search">
          {t('extras.search.submit')}
        </Button>
      </form>
    );
  }

  filtersAvailable(): boolean {
    return this.tab === 'topics' || this.tab === 'posts';
  }

  controlsView(): Mithril.Children {
    if (!this.filtersAvailable()) return null;

    return (
      <div className="LcoySearch-controls">
        <Button
          className={classList('Button LcoySearch-advancedToggle', { active: filtersExpanded })}
          aria-expanded={filtersExpanded ? 'true' : 'false'}
          onclick={() => {
            filtersExpanded = !filtersExpanded;
          }}
        >
          {t('extras.search.advanced')}
          <Icon name={filtersExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="LcoySearch-advancedCaret" />
        </Button>
      </div>
    );
  }

  updateQuery(query: SearchQuery): void {
    this.query = query;
    this.raw = serializeQuery(query);
  }

  // ── 排序 ─────────────────────────────────────────────────────────────────

  sortView(): Mithril.Children {
    const options = sortOptions(this.tab, t);

    if (!options.length) return <hr className="LcoySearch-divider" />;

    return (
      <div className="LcoySearch-sortRow">
        <label className="LcoySearch-sort">
          <span className="LcoySearch-sortLabel">{t('extras.search.sort_by')}</span>
          <span className="LcoySearch-selectWrap">
            <select
              className="FormControl LcoySearch-select"
              value={this.sort}
              onchange={(event: Event) => this.go(this.raw, this.tab, (event.target as HTMLSelectElement).value)}
            >
              {options.map((option) => (
                <option value={option.key}>{option.label}</option>
              ))}
            </select>
            <Icon name="fas fa-chevron-down" className="LcoySearch-selectCaret" />
          </span>
        </label>
      </div>
    );
  }

  // ── 结果 ────────────────────────────────────────────────────────────

  /** 标签和用户只能按文本搜索；主题和帖子也可按筛选条件搜索。 */
  canSearch(): boolean {
    if (this.tab === 'categories' || this.tab === 'users') return !!this.query.text;

    return hasCriteria(this.query);
  }

  resultsView(): Mithril.Children {
    if (!this.searched && !this.loading) {
      return <p className="LcoySearch-empty">{this.raw ? t('extras.search.need_more') : t('extras.search.start')}</p>;
    }

    const pattern = highlightPattern(this.query.text);
    const count = this.total ?? this.items.length;
    const firstPage = this.loading && !this.items.length;
    const skeletonTab = this.tab === 'topics' || this.tab === 'posts';

    return (
      <div className="LcoySearch-results" aria-live="polite" aria-busy={this.loading ? 'true' : 'false'}>
        {this.searched && !this.failed && (
          <h2 className="LcoySearch-heading">
            {this.items.length === 0
              ? t('extras.search.no_results')
              : t('extras.search.result_count', { count, more: this.total === null && this.hasMore ? '+' : '' })}
            {this.items.length > 0 &&
              this.query.text && [' ', t('extras.search.result_for'), ' ', <mark className="LcoySearch-term">{this.query.text}</mark>]}
          </h2>
        )}

        {/* 首次搜索时标题（“X 的 N 个结果”）还不存在：
            为其预留位置，使列表在它出现时不会下移。 */}
        {!this.searched && firstPage && skeletonTab && (
          <h2 className="LcoySearch-heading">
            <span className="LcoySkeleton LcoySkeleton--line" style={{ width: '14em' }} />
          </h2>
        )}

        {this.failed && <p className="LcoySearch-empty">{t('extras.search.failed')}</p>}

        {this.tab === 'posts' && this.searched && postFilters(this.query).ignored && (
          <p className="LcoySearchFilters-note">
            <Icon name="fas fa-circle-info" />
            {t('extras.search.posts_filters_note')}
          </p>
        )}

        {/* 主题或帖子的第一页：用骨架行代替加载动画
            （“加载更多”仍使用加载动画）。 */}
        {firstPage && skeletonTab ? (
          <ul className="LcoySearch-list LcoySearch-list--loading" aria-busy="true">
            {resultSkeleton()}
          </ul>
        ) : (
          <ul className="LcoySearch-list">{this.items.map((item) => this.itemView(item, pattern))}</ul>
        )}

        {this.loading && !(firstPage && skeletonTab) && <LoadingIndicator display="block" />}

        {!this.loading && this.hasMore && (
          <div className="LcoySearch-more">
            <Button className="Button" onclick={() => this.load(this.items.length)}>
              {t('extras.search.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  itemView(item: Model, pattern: RegExp | undefined): Mithril.Children {
    switch (this.tab) {
      case 'topics':
        return discussionResult(item as Discussion, pattern);
      case 'posts':
        return postResult(item as Post, pattern);
      case 'categories':
        return tagResult(item as unknown as LcoyTag, pattern);
      default:
        return userResult(item as User, pattern);
    }
  }

  load(offset: number): void {
    const sort = sortOptions(this.tab, t).find((option) => option.key === this.sort)?.api || '';

    this.loading = true;
    this.failed = false;

    fetchPage(this.tab, this.query, sort, offset)
      .then((page) => {
        this.items = offset ? [...this.items, ...page.items] : page.items;
        this.total = page.total;
        this.hasMore = page.hasMore;
      })
      .catch(() => {
        // 核心的错误提示已经显示；此处只替换页面上的消息，
        // 避免出现误导性的“0 个结果”。
        this.failed = true;
      })
      .finally(() => {
        this.loading = false;
        this.searched = true;
        m.redraw();
      });
  }

  go(raw: string, tab: SearchTab, sort: string | undefined): void {
    const url = searchUrl(raw.trim(), tab, sort);

    // 相同的 URL 不会重建页面（路由键未变）：重新搜索同一内容
    // 只会重新加载结果。
    if (url === app.route(SEARCH_ROUTE, m.route.param())) {
      if (this.canSearch()) this.load(0);
      return;
    }

    m.route.set(url);
  }
}
