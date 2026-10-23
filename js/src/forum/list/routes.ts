/*
 * Discourse 的地址：/latest、/hot、/top、/new、/unread（按对应
 * 排序方式显示的列表）以及 /categories（分类页面）。
 * 服务端会响应相同的路由（extend/listroutes.php）；/c/<slug> 在那里
 * 重定向到 /t/<slug>。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import setRouteWithForcedRefresh from 'flarum/common/utils/setRouteWithForcedRefresh';

import { isTagsEnabled } from '../utils/tags';
import { HOT_SORT, UNREAD_SORT } from './sorts';

/** 路由 → 排序方式。Discourse 的 "新帖" 在这里是最新列表。 */
export const SORT_ROUTES: Record<string, string> = {
  'lcoy.latest': 'latest',
  'lcoy.hot': HOT_SORT,
  'lcoy.top': 'top',
  'lcoy.new': 'newest',
  'lcoy.unread': UNREAD_SORT,
};

const PATHS: Record<string, `/${string}`> = {
  'lcoy.latest': '/latest',
  'lcoy.hot': '/hot',
  'lcoy.top': '/top',
  'lcoy.new': '/new',
  'lcoy.unread': '/unread',
};

/** 某个排序方式对应的 Discourse 路由（如果存在）。 */
export function routeForSort(sort: string): string | null {
  return Object.keys(SORT_ROUTES).find((name) => SORT_ROUTES[name] === sort) || null;
}

export function currentSortRoute(): string | null {
  const name = app.current.get('routeName');

  return name && name in SORT_ROUTES ? name : null;
}

export default function installRoutes(): void {
  Object.keys(PATHS).forEach((name) => {
    app.routes[name] = { path: PATHS[name], component: IndexPage };
  });

  // 没有 flarum/tags 就没有分类页：/categories 显示列表。
  const TagsPage = isTagsEnabled() ? flarum.reg.checkModule('flarum-tags', 'forum/components/TagsPage') : null;

  app.routes['lcoy.categories'] = { path: '/categories', component: TagsPage || IndexPage };

  // 在 /top（以及其他路由）上，URL 未带 `sort` 时排序来自路由。
  extend(GlobalSearchState.prototype, 'stickyParams', function (params: any) {
    const route = currentSortRoute();

    if (route && !params.sort) params.sort = SORT_ROUTES[route];
  });

  // 在这些路由上切换排序会跳到新排序的路由（或带
  // `?sort=` 的列表），而不是同一路由加另一个参数。
  override(GlobalSearchState.prototype, 'changeSort', function (this: GlobalSearchState, original: (sort: string) => void, sort: string) {
    if (!currentSortRoute()) return original(sort);

    const { sort: _old, ...params } = this.params() as Record<string, any>;
    const target = routeForSort(sort);

    setRouteWithForcedRefresh(target ? app.route(target, params) : app.route('index', { ...params, sort }));
  });

  // 服务端把这些路由预加载为默认列表（最新）：在最新之外，
  // 预加载的文档不再适用，列表会请求 API。
  // loadPage 在类型中是受保护的；扩展方式与其他方法相同。
  override(
    DiscussionListState.prototype as any,
    'loadPage' as any,
    function (this: DiscussionListState, original: (page?: number) => any, ...args: unknown[]): any {
      const page = args[0] as number | undefined;
      const sort = this.getParams().sort;

      if (sort && sort !== 'latest' && (currentSortRoute() || sort === HOT_SORT || sort === UNREAD_SORT)) {
        (app as any).data.apiDocument = null;
      }

      return original(page);
    }
  );
}
