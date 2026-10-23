/*
 * Discourse 的列表导航栏（Horizon 中的 `.list-controls`）：
 * 分类/标签下拉菜单、排序标签（最新、热门、
 * 新帖、未读、最佳……）、分类链接、操作按钮以及
 * "发起讨论"。滚动时固定在卡片顶部。
 *
 * 只替换 IndexPage 的 `toolbar` 项：扩展放入
 * viewItems/actionItems/toolbarItems 的内容仍在这里面。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import SelectDropdown from 'flarum/common/components/SelectDropdown';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import IndexPage from 'flarum/forum/components/IndexPage';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import {
  categoriesRouteName,
  categoriesUrl,
  categorySymbol,
  currentTag,
  isTagsEnabled,
  primaryTags,
  secondaryTags,
  sortTags,
  tagSymbol,
  type LcoyTag,
} from '../utils/tags';
import { CORE_SORTS, activeSort, sortLabel } from './sorts';
import SelectKit from '../composer/SelectKit';
import { currentSortRoute, routeForSort } from './routes';

export interface ListNavigationAttrs extends ComponentAttrs {
  /** 提供 viewItems/actionItems 的页面 —— 分类页中没有。 */
  page?: IndexPage;
}

/** Discourse 没有作为标签的核心排序：放在 "更多" 菜单中。 */
const OVERFLOW_SORTS = ['oldest', 'az', 'za'];

interface NavTab {
  key: string;
  label: Mithril.Children;
  href: string;
  active: boolean;
}

function onIndex(): boolean {
  return app.current.matches(IndexPage);
}

/** 按指定排序方式的列表 URL，保留当前页面的标签/过滤器。 */
function sortHref(sort: string): string {
  const index = onIndex();
  const params: Record<string, any> = index ? { ...app.search.state.params() } : {};
  let routeName = index ? app.current.get('routeName') || 'index' : 'index';

  // 在总列表中，标签指向 Discourse 的地址（/latest、/hot、
  // /top……），排序方式包含在路由本身中。
  const sortRoute = forumBool('lcoyListRoutes', false) ? routeForSort(sort) : null;

  if (sortRoute && (routeName === 'index' || currentSortRoute())) {
    delete params.sort;
    routeName = sortRoute;
  } else if (currentSortRoute()) {
    routeName = 'index';
    params.sort = sort;
  } else if (sort === app.search.state.defaultSort()) {
    delete params.sort;
  } else {
    params.sort = sort;
  }

  // 空参数只会弄脏 URL（"?q=&filter="）。
  Object.keys(params).forEach((key) => {
    const value = params[key];

    if (value === undefined || value === '' || (typeof value === 'object' && value && !Object.keys(value).length)) delete params[key];
  });

  return app.route(routeName, params);
}

/** 工具栏下拉菜单的一行：一个标签或一个特殊选项。 */
interface DropRow {
  key: string;
  href: string;
  tag?: LcoyTag;
  parent?: LcoyTag;
  label?: string;
  special?: boolean;
  selected?: boolean;
}

/** Discourse 的 `max_tags_in_filter_list`：其余的会在过滤时出现。 */
const MAX_TAGS_IN_LIST = 30;

/** 超过此数量时，"无二级标签" 会变成子查询过多的查询。 */
const MAX_NEGATED_TAGS = 50;

/**
 * 标签的 URL，保留所选排序，与 Discourse 的下拉菜单
 * 相同。`filter` 进入查询（`filter[-tag][]=…`）：IndexPage 会把它
 * 传给 API，服务端也会在初始加载时使用它。
 */
function tagHref(tag: LcoyTag | null, filter?: Record<string, string[]>): string {
  const sort = onIndex() ? app.search.state.params().sort : undefined;
  const params: Record<string, any> = sort ? { sort } : {};

  if (filter) params.filter = filter;

  return tag ? app.route('tag', { tags: tag.slug(), ...params }) : app.route('index', params);
}

/** 当前 URL 中被排除的标签（`filter[-tag]`），用于标记 "无……"/"不含……"。 */
function negatedSlugs(): string[] {
  if (!onIndex()) return [];

  const value = (app.search.state.params().filter || ({} as any))['-tag'];
  const list: unknown[] = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : value ? [value] : [];

  return list.flatMap((item) => String(item).split(','));
}

/** 带所选分类的页眉：显示它的徽章，"父 ▪ 子" 不显示 —— 只有它本身。 */
function categoryHeader(tag: LcoyTag, parent: LcoyTag | null = null): Mithril.Children {
  return (
    <span className="LcoyNav-dropBadge">
      {parent && !tag.icon() ? splitSymbol(tag, parent) : categorySymbol(tag)}
      <span className="LcoyNav-dropName">{tag.name()}</span>
    </span>
  );
}

/** 没有图标的子分类所用的双色小方块。 */
function splitSymbol(tag: LcoyTag, parent: LcoyTag): Mithril.Children {
  const symbol: any = categorySymbol(tag);

  if (symbol?.attrs) {
    symbol.attrs.className = classList(symbol.attrs.className, 'LcoyCategorySymbol--split');
    symbol.attrs.style = { ...(symbol.attrs.style || {}), '--category-parent-color': parent.color() || 'var(--lcoy-primary-medium)' };
  }

  return symbol;
}

/** "图标 名称 × N"（访客还会看到描述），与 `category-row` 相同。 */
function dropRowContent(row: DropRow, symbols: boolean, showDescription: boolean): Mithril.Children {
  const tag = row.tag!;
  const count = tag.discussionCount();
  const description = symbols && showDescription ? tag.description() : null;

  return (
    <span className="LcoyNav-dropRow">
      <span className="LcoyNav-dropStatus">
        {symbols ? (row.parent && !tag.icon() ? splitSymbol(tag, row.parent) : categorySymbol(tag)) : tagSymbol(tag, 'LcoyNav-dropTagIcon')}
        <span className="LcoyNav-dropName">{tag.name()}</span>
        {symbols && count > 0 && <span className="LcoyNav-dropCount">× {count}</span>}
      </span>
      {description && <span className="LcoyNav-dropDesc">{description}</span>}
    </span>
  );
}

export default class ListNavigation extends Component<ListNavigationAttrs> {
  view(): Mithril.Children {
    return (
      // 固定在顶部是可选项：Horizon 会固定，meta.discourse.org 不会。
      <nav className={classList('LcoyNav', { 'LcoyNav--sticky': forumBool('lcoyNavSticky', false) })} aria-label={t('nav.label')}>
        <div className="LcoyNav-start">{this.startItems().toArray()}</div>
        <div className="LcoyNav-end">{this.endItems().toArray()}</div>
      </nav>
    );
  }

  startItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const page = this.attrs.page;

    if (isTagsEnabled() && forumBool('lcoyNavDropdowns', true)) {
      items.add('dropdowns', <div className="LcoyNav-dropdowns">{this.dropdownItems().toArray()}</div>, 100);
    }

    const tabs = this.tabs();
    const overflow = this.overflowTabs();

    items.add(
      'tabs',
      <ul className="LcoyNav-tabs">
        {tabs.map((tab) => (
          <li className={classList('LcoyNav-tab', `LcoyNav-tab--${tab.key}`, { active: tab.active })}>
            <Link href={tab.href} force={true} aria-current={tab.active ? 'page' : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
        {overflow.length > 0 && <li className="LcoyNav-tab LcoyNav-tab--more">{this.overflowDropdown(overflow)}</li>}
      </ul>,
      90
    );

    // 在移动端，标签页变成一个选择器（"最新 ⇅"）。
    items.add('select', <div className="LcoyNav-select">{this.compactSelect([...tabs, ...overflow])}</div>, 80);

    if (page) {
      // 扩展放在排序旁边的项（例如过滤器）。
      const view = page.viewItems();
      view.remove('sort');

      if (!view.isEmpty()) items.add('view', <ul className="LcoyNav-view">{listItems(view.toArray())}</ul>, 70);

      const toolbar = page.toolbarItems();
      toolbar.remove('view');
      toolbar.remove('action');

      if (!toolbar.isEmpty()) items.add('toolbar', <div className="LcoyNav-extra">{toolbar.toArray()}</div>, 60);
    }

    return items;
  }

  endItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const page = this.attrs.page;

    if (page) {
      const actions = page.actionItems();

      // 核心在移动端放在这里的放大镜会与页眉的重复。
      actions.remove('search');

      if (!actions.isEmpty()) items.add('actions', <ul className="LcoyNav-actions">{listItems(actions.toArray())}</ul>, 100);
    }

    // Discourse 只向已登录用户显示 "发起讨论"。
    if (app.session.user) items.add('newTopic', this.newTopicButton(), 50);

    return items;
  }

  /** 按 Discourse 顺序排列的标签页；扩展的排序方式排在 "最佳" 之后。 */
  tabs(): NavTab[] {
    const sortMap = app.discussions.sortMap();
    const index = onIndex();
    const current = index ? activeSort() : null;
    const keys = Object.keys(sortMap);

    const ordered = ['relevance', 'latest', 'hot', 'newest', 'unread', 'top'].filter(
      (key) => keys.includes(key) && !this.overflowKeys().includes(key)
    );
    const fromExtensions = keys.filter((key) => !CORE_SORTS.includes(key) && !ordered.includes(key) && !this.overflowKeys().includes(key));

    const tabs: NavTab[] = [...ordered, ...fromExtensions].map((key) => ({
      key,
      label: sortLabel(key),
      href: sortHref(key),
      active: current === key,
    }));

    // 在分类内部，Discourse 不显示 "分类" 标签。
    if (isTagsEnabled() && forumBool('lcoyNavCategoriesLink', true) && !currentTag()) {
      tabs.push({
        key: 'categories',
        label: t('nav.categories_link'),
        href: categoriesUrl(),
        active: app.current.get('routeName') === categoriesRouteName(),
      });
    }

    return tabs;
  }

  /**
   * 放入 "更多" 菜单的排序方式。Discourse 的 "新帖" 是未查看主题
   * 的列表，只对已登录用户存在；对访客来说，
   * Flarum 的 "最新" 留在菜单中，标签页则是 Meta
   * 未登录状态下的那些（最新、热门、最佳、分类）。
   */
  overflowKeys(): string[] {
    return app.session.user ? OVERFLOW_SORTS : ['newest', ...OVERFLOW_SORTS];
  }

  overflowTabs(): NavTab[] {
    const sortMap = app.discussions.sortMap();
    const current = onIndex() ? activeSort() : null;

    return this.overflowKeys()
      .filter((key) => key in sortMap)
      .map((key) => ({
        key,
        label: sortLabel(key),
        href: sortHref(key),
        active: current === key,
      }));
  }

  overflowDropdown(tabs: NavTab[]): Mithril.Children {
    const active = tabs.find((tab) => tab.active);

    return (
      <Dropdown
        className={classList('LcoyNav-more', { active: !!active })}
        buttonClassName="Button Button--text LcoyNav-moreButton"
        menuClassName="Dropdown-menu--right"
        label={active ? active.label : <Icon name="fas fa-ellipsis-h" />}
        caretIcon={active ? 'fas fa-caret-down' : ''}
        accessibleToggleLabel={t('nav.more')}
      >
        {tabs.map((tab) => (
          <LinkButton href={tab.href} active={tab.active} icon={tab.active ? 'fas fa-check' : true}>
            {tab.label}
          </LinkButton>
        ))}
      </Dropdown>
    );
  }

  compactSelect(tabs: NavTab[]): Mithril.Children {
    return (
      <SelectDropdown
        buttonClassName="Button Button--text LcoyNav-selectButton"
        caretIcon="fas fa-discourse-chevron-expand"
        defaultLabel={t('nav.latest')}
        accessibleToggleLabel={t('nav.sort_label')}
      >
        {tabs.map((tab) => (
          <LinkButton href={tab.href} active={tab.active} icon={tab.active ? 'fas fa-check' : true}>
            {tab.label}
          </LinkButton>
        ))}
      </SelectDropdown>
    );
  }

  dropdownItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const tag = currentTag();

    // 在子分类页面上，第一个下拉菜单显示父分类，第二个
    // 显示子分类 —— 与 Discourse 中的 "支持 › 安装" 相同。
    const isCategory = !!tag && (tag.position() !== null || tag.isChild());
    const parent = tag && tag.isChild() ? (tag.parent() as LcoyTag | null) || null : null;
    const category = isCategory ? parent || tag : null;
    const subcategory = isCategory && parent ? tag : null;
    const label = tag && !isCategory ? tag : null;
    const negated = negatedSlugs();

    const categories = primaryTags();

    if (categories.length) {
      const rows: DropRow[] = [];

      if (category) rows.push({ key: 'all', special: true, label: t('nav.remove_filter'), href: tagHref(null) });

      categories.forEach((item) => rows.push({ key: item.slug(), tag: item, href: tagHref(item), selected: item === category }));

      items.add(
        'categories',
        this.drop({
          className: 'LcoyNav-drop--categories',
          selected: !!category,
          header: category ? categoryHeader(category) : t('nav.categories'),
          label: t('nav.categories'),
          rows,
          symbols: true,
        }),
        100
      );
    }

    const children = category ? sortTags(((category.children() || []) as LcoyTag[]).filter(Boolean)) : [];

    if (category && children.length) {
      // "不含子标签"：父分类且不含任何子标签，使用 flarum/tags 的
      // 排除过滤器（`filter[-tag][]=子标签`，每个子标签一组，
      // 以便表示 "都不含" 而不是 "不全部含"）。
      const childSlugs = children.map((child) => child.slug());
      const noSub = !subcategory && childSlugs.length > 0 && childSlugs.every((slug) => negated.includes(slug));
      const rows: DropRow[] = [];

      if (subcategory || noSub) rows.push({ key: 'all', special: true, label: t('nav.remove_filter'), href: tagHref(category) });
      if (!noSub) rows.push({ key: 'none', special: true, label: t('nav.no_subcategory'), href: tagHref(category, { '-tag': childSlugs }) });

      children.forEach((child) =>
        rows.push({ key: child.slug(), tag: child, href: tagHref(child), selected: child === subcategory, parent: category })
      );

      items.add(
        'subcategories',
        this.drop({
          className: 'LcoyNav-drop--subcategories',
          selected: !!subcategory || noSub,
          header: subcategory ? categoryHeader(subcategory, category) : noSub ? t('nav.no_subcategory') : t('nav.subcategories'),
          label: t('nav.subcategories'),
          rows,
          symbols: true,
        }),
        90
      );
    }

    const labels = secondaryTags();

    if (labels.length) {
      // "不含二级标签"：不包含任何标签（分类除外，
      // 与 Discourse 相同）。标签过多时，查询会变得很重。
      const labelSlugs = labels.map((item) => item.slug());
      const noTagsSupported = labelSlugs.length <= MAX_NEGATED_TAGS;
      const noTags = noTagsSupported && labelSlugs.every((slug) => negated.includes(slug));
      const rows: DropRow[] = [];
      const base = category ? subcategory || category : null;

      if (label || noTags) rows.push({ key: 'all', special: true, label: t('nav.remove_filter'), href: tagHref(base) });
      if (noTagsSupported && !noTags) rows.push({ key: 'none', special: true, label: t('nav.no_tags'), href: tagHref(base, { '-tag': labelSlugs }) });

      labels.forEach((item) => rows.push({ key: item.slug(), tag: item, href: tagHref(item), selected: item === label }));

      items.add(
        'tags',
        this.drop({
          className: 'LcoyNav-drop--tags',
          selected: !!label || noTags,
          header: label ? (
            <span className="LcoyNav-dropBadge">
              {tagSymbol(label, 'LcoyNav-dropTagIcon')}
              <span className="LcoyNav-dropName">{label.name()}</span>
            </span>
          ) : noTags ? (
            t('nav.no_tags')
          ) : (
            t('nav.tags')
          ),
          label: t('nav.tags'),
          rows,
          symbols: false,
          limit: MAX_TAGS_IN_LIST,
        }),
        80
      );
    }

    return items;
  }

  /**
   * Discourse 的 `category-drop`/`tag-drop`：带 "›" 的页眉打开后
   * 变成 "⌄"，主体中有 "搜索…" 和放大镜，特殊选项以
   * 强调色加粗显示，分类为 "图标 名称 × N"。
   */
  drop(options: {
    className: string;
    selected: boolean;
    header: Mithril.Children;
    label: string;
    rows: DropRow[];
    symbols: boolean;
    limit?: number;
  }): Mithril.Children {
    const { rows, limit } = options;
    // 分类描述仅对访客显示（Discourse 会向已有
    // 信任等级的账号隐藏它）。
    const showDescription = !app.session.user;

    const filtered = (filter: string): DropRow[] => {
      const needle = filter.trim().toLowerCase();
      const special = needle ? [] : rows.filter((row) => row.special);
      let normal = rows.filter((row) => !row.special && (!needle || (row.tag?.name() || '').toLowerCase().includes(needle)));

      if (limit && !needle) normal = normal.slice(0, limit);

      return [...special, ...normal];
    };

    return (
      <SelectKit
        className={classList('LcoyNav-drop', options.className, { 'has-selection': options.selected })}
        header={options.header}
        caret="fas fa-angle-right"
        caretOpen="fas fa-angle-down"
        label={options.label}
        filterIcon={true}
        highlightSelected={true}
        placeholder={t('nav.search_placeholder')}
        emptyText={t('nav.no_results')}
        rows={(filter: string) =>
          filtered(filter).map((row) => ({
            key: row.key,
            selected: row.selected,
            title: row.tag?.name() || row.label,
            content: row.special ? <span className="LcoyNav-dropSpecial">{row.label}</span> : dropRowContent(row, options.symbols, showDescription),
          }))
        }
        after={(filter: string) =>
          limit && !filter.trim() && rows.filter((row) => !row.special).length > limit ? (
            <div className="LcoyNav-dropMore">{t('nav.filter_for_more')}</div>
          ) : null
        }
        onselect={(key: string) => {
          const row = rows.find((item) => item.key === key);

          if (row) m.route.set(row.href);
        }}
      />
    );
  }

  newTopicButton(): Mithril.Children {
    const tag = currentTag() as (LcoyTag & { canStartDiscussion?: () => boolean }) | null;
    const canStart = !app.session.user || (tag?.canStartDiscussion ? tag.canStartDiscussion() : !!app.forum.attribute('canStartDiscussion'));
    const label = canStart ? t('nav.new_topic') : (app.translator.trans('core.forum.index.cannot_start_discussion_button', {}, true) as string);

    return (
      <Button
        icon="fas fa-edit"
        className="Button Button--primary LcoyNav-newTopic"
        aria-label={label}
        title={label}
        disabled={!canStart}
        onclick={() =>
          // 复用核心的操作：打开编辑器（或登录），并让
          // flarum/tags 填入当前标签，它挂在该方法上。
          IndexSidebar.prototype.newDiscussionAction.call(IndexSidebar.prototype).catch(() => {})
        }
      >
        {label}
      </Button>
    );
  }
}
