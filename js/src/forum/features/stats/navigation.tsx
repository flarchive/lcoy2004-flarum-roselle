/*
 * 统计在导航中的显示位置：“新帖”和“未读”标签中的“(N)”、
 * 侧边栏“主题”的小圆点，以及标签“更多”菜单中按浏览量排序。
 *
 * 全部通过列表和侧边栏组件上的 `extend` 实现——这些区域的代码文件
 * 并不知道统计功能的存在。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type { SortMap } from 'flarum/common/states/PaginatedListState';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ListNavigation from '../../list/ListNavigation';
import LcoySidebar from '../../components/LcoySidebar';
import { t } from '../../utils/settings';
import { pluginProvidesViews } from '../../list/metrics';
import { countsEnabled, formatCount, newCount, refreshCounts, unreadCount } from './counts';

export const VIEWS_SORT = 'views';

/** ListNavigation 标签的格式（其接口未导出）。 */
interface Tab {
  key: string;
  label: Mithril.Children;
  href: string;
  active: boolean;
}

/** 当前列表在指定排序下的 URL，与其他标签的构造方式一致。 */
function sortHref(sort: string): string {
  const onIndex = app.current.matches(IndexPage);
  const params: Record<string, any> = onIndex ? { ...app.search.state.params() } : {};
  const routeName = onIndex ? app.current.get('routeName') || 'index' : 'index';

  params.sort = sort;
  Object.keys(params).forEach((key) => {
    if (params[key] === undefined || params[key] === '') delete params[key];
  });

  return app.route(routeName, params);
}

function withCount(label: Mithril.Children, count: number, kind: string): Mithril.Children {
  if (count <= 0) return label;

  return [
    label,
    ' ',
    <span className={`LcoyStatsCount LcoyStatsCount--${kind}`} title={t(`stats.${kind}_count`, { count })}>
      ({formatCount(count)})
    </span>,
  ];
}

function installViewsSort(): void {
  // 真正的排序（`?sort=views`），以便 URL 和服务端预加载正常工作；
  // 它的标签不放在主行（那是 Discourse 的布局），而放在“更多”菜单
  // 中“最早”旁边。
  extend(DiscussionListState.prototype, 'sortMap', function (map: SortMap) {
    // 排序由 fof/discussion-views 提供：顺序来自 `view_count`（它的
    // 列）。`most_viewed`/`views` 等别名无法通过 API 校验，因此
    // 使用字段名。
    if (pluginProvidesViews()) map[VIEWS_SORT] = { sort: '-view_count', label: t('stats.views_sort') };
  });

  extend(ListNavigation.prototype, 'tabs', function (tabs: Tab[]) {
    const index = tabs.findIndex((tab) => tab.key === VIEWS_SORT);

    if (index !== -1) tabs.splice(index, 1);
  });

  extend(ListNavigation.prototype, 'overflowTabs', function (tabs: Tab[]) {
    if (!pluginProvidesViews() || !(VIEWS_SORT in app.discussions.sortMap())) return;

    const onIndex = app.current.matches(IndexPage);
    const sort = onIndex ? app.search.state.params().sort : undefined;

    tabs.push({ key: VIEWS_SORT, label: t('stats.views_sort'), href: sortHref(VIEWS_SORT), active: sort === VIEWS_SORT });
  });
}

function installTabCounts(): void {
  extend(ListNavigation.prototype, 'tabs', function (tabs: Tab[]) {
    if (!countsEnabled()) return;

    for (const tab of tabs) {
      if (tab.key === 'newest') tab.label = withCount(tab.label, newCount('page'), 'new');
      if (tab.key === 'unread') tab.label = withCount(tab.label, unreadCount('page'), 'unread');
    }
  });

  // 返回列表时计数可能已变化（用户刚读完一个主题）；
  // refreshCounts 自身会忽略过于频繁的返回。
  extend(IndexPage.prototype, 'oncreate', function () {
    refreshCounts();
  });
}

function installSidebarDot(): void {
  extend(LcoySidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (!countsEnabled() || !items.has('topics')) return;

    const fresh = newCount();
    const unread = unreadCount();

    if (fresh + unread <= 0) return;

    const vnode = items.get('topics') as Mithril.Vnode<any, any>;

    if (!vnode || typeof vnode !== 'object' || !vnode.tag) return;

    const children = Array.isArray(vnode.children) ? vnode.children : vnode.children == null ? [] : [vnode.children];
    const label = t('stats.sidebar_dot', { new: fresh, unread });

    // 默认情况下，Discourse 用一个圆点（而非数字）标记“主题”：
    // 提示有新内容，又不与侧边栏文字争夺注意力。
    items.setContent(
      'topics',
      m(vnode.tag as any, { ...vnode.attrs, title: label }, [
        ...children,
        <span className="LcoyStatsDot" aria-hidden="true" />,
        <span className="sr-only">{label}</span>,
      ])
    );
  });
}

export default function installNavigation(): void {
  installViewsSort();
  installTabCounts();
  installSidebarDot();
}
