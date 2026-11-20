/*
 * Discourse 的 "热门" 和 "未读" 标签页变成 DiscussionListState 的
 * 排序方式。这样它们会出现在 URL 中（`?sort=hot`），经过与其他排序相同的
 * `changeSort`，并能在任何过滤列表的页面上工作
 * （标签、关注……），无需额外代码。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type { SortMap } from 'flarum/common/states/PaginatedListState';

import { forumBool, forumInt, t } from '../utils/settings';
import { lastDaysRange } from '../utils/dates';

export const HOT_SORT = 'hot';
export const UNREAD_SORT = 'unread';

/** 核心的排序方式 —— sortMap 中其余的都来自扩展。 */
export const CORE_SORTS = ['relevance', 'latest', 'top', 'newest', 'oldest', 'az', 'za'];

function extraSorts(): SortMap {
  const extra: SortMap = {};

  if (forumBool('lcoyNavHot', true)) {
    // "热门" 是最近几天创建的主题中评论最多的；日期
    // 过滤在 requestParams 中加入。
    extra[HOT_SORT] = { sort: '-commentCount', label: t('nav.hot') };
  }

  if (app.session.user && forumBool('lcoyNavUnread', true)) {
    // 核心已经有 `unread` 过滤器；排序与 "最新" 相同。
    extra[UNREAD_SORT] = { sort: '-lastPostedAt', label: t('nav.unread') };
  }

  return extra;
}

export default function installSorts(): void {
  extend(DiscussionListState.prototype, 'sortMap', function (map: SortMap) {
    const extra = extraSorts();

    if (!Object.keys(extra).length) return;

    // 重建对象，把新排序紧接在 "最新" 之后插入：
    // 第一个键是页面的默认排序（defaultSort），
    // 键的顺序就是标签的顺序。
    const entries = Object.entries(map);

    Object.keys(map).forEach((key) => delete map[key]);

    for (const [key, value] of entries) {
      map[key] = value;

      if (key === 'latest') Object.assign(map, extra);
    }

    // 没有 "latest"（某个扩展可能已将它移除）时，它们放到末尾。
    for (const [key, value] of Object.entries(extra)) {
      if (!(key in map)) map[key] = value;
    }
  });

  extend(DiscussionListState.prototype, 'requestParams', function (this: DiscussionListState, params) {
    const sort = this.getParams().sort;

    if (sort === HOT_SORT && sort in this.sortMap()) {
      params.filter = { ...params.filter, created: lastDaysRange(forumInt('lcoyHotDays', 7)) };
    }

    // 有了服务端计数（stats 功能），"新帖" 和 "未读" 标签页
    // 按与 "(N)" 相同的规则列出：从未打开 / 有新的回复，
    // 与 Discourse 相同。没有它们时，使用核心的 `unread` 过滤器。
    const personal = !!app.session.user && forumBool('lcoyStatsCountsEnabled', false) && app.forum.attribute('lcoyUnreadCount') !== undefined;

    if (sort === UNREAD_SORT && sort in this.sortMap()) {
      params.filter = { ...params.filter, ...(personal ? { lcoyUnread: '1' } : { unread: '1' }) };
    }

    if (sort === 'newest' && personal) {
      params.filter = { ...params.filter, lcoyNew: '1' };
    }
  });
}

/** 某个排序方式的标签，与核心在其下拉菜单中组装的方式相同。 */
export function sortLabel(key: string): string {
  const sort = app.discussions.sortMap()[key];

  if (sort && typeof sort !== 'string') return sort.label as string;

  switch (key) {
    case 'latest':
      return t('nav.default');
    case 'newest':
      return t('nav.newest');
    case 'top':
      return t('nav.top');
    default:
      return app.translator.trans(`core.forum.index_sort.${key}_button`, {}, true) as string;
  }
}

export function activeSort(): string {
  return app.search.state.params().sort || app.search.state.defaultSort();
}
