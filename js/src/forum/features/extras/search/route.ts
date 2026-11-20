/*
 * 搜索页面的路由及其地址。放在 SearchPage 之外，使页面可位于独立
 * chunk 中：弹窗中的链接只需要 URL。
 */
import app from 'flarum/forum/app';

import { forumBool } from '../../../utils/settings';
import type { SearchTab } from './sources';

export const SEARCH_ROUTE = 'lcoy.search';

export function searchPageEnabled(): boolean {
  return forumBool('lcoySearchPageEnabled', true);
}

/** 搜索页面的 URL——供弹窗中的链接及其他调用方使用。 */
export function searchUrl(q: string, type?: SearchTab, sort?: string): string {
  const params: Record<string, string> = {};

  if (q) params.q = q;
  if (type && type !== 'topics') params.type = type;
  if (sort && sort !== 'relevance') params.sort = sort;

  return app.route(SEARCH_ROUTE, params);
}
