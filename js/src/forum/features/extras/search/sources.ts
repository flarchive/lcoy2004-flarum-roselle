/*
 * 搜索页面每个标签对应一个结果来源。每个来源都能根据查询和所选
 * 排序构造 API 请求。
 */
import app from 'flarum/forum/app';
import type Model from 'flarum/common/Model';

import { isExtensionEnabled } from '../../../utils/settings';
import { pluginProvidesViews } from '../../../list/metrics';
import { allTags, isTagsEnabled } from '../../../utils/tags';
import { queryFilters, type SearchQuery } from './query';

export type SearchTab = 'topics' | 'posts' | 'categories' | 'users';

export const PAGE_SIZE = 20;

export interface SortOption {
  key: string;
  /** API `sort` 的值；空表示相关性（文本顺序）。 */
  api: string;
  label: string;
}

export interface SearchPage {
  items: Model[];
  total: number | null;
  hasMore: boolean;
}

export function sortOptions(tab: SearchTab, t: (key: string) => string): SortOption[] {
  const likes = isExtensionEnabled('flarum-likes');

  if (tab === 'topics') {
    return [
      { key: 'relevance', api: '', label: t('extras.search.sort_relevance') },
      { key: 'latest', api: '-lastPostedAt', label: t('extras.search.sort_latest_post') },
      { key: 'newest', api: '-createdAt', label: t('extras.search.sort_latest_topic') },
      ...(likes ? [{ key: 'likes', api: '-lcoyLikes', label: t('extras.search.sort_likes') }] : []),
      ...(pluginProvidesViews() ? [{ key: 'views', api: '-view_count', label: t('extras.search.sort_views') }] : []),
    ];
  }

  if (tab === 'posts') {
    return [
      { key: 'relevance', api: '', label: t('extras.search.sort_relevance') },
      { key: 'latest', api: '-createdAt', label: t('extras.search.sort_latest_post') },
      ...(likes ? [{ key: 'likes', api: '-lcoyLikes', label: t('extras.search.sort_likes') }] : []),
    ];
  }

  return [];
}

/** 帖子搜索支持的筛选条件：作者、标签、点赞和书签。 */
export function postFilters(query: SearchQuery): { filter: Record<string, any>; ignored: boolean } {
  const all = queryFilters(query);
  const filter: Record<string, any> = { type: 'comment' };

  if (all.author) filter.author = all.author;
  // 帖子标签筛选（flarum/tags）接收 id 而非 slug，并会连接标签表：
  // 只支持一个标签，否则同一帖子会重复出现。
  // 分类或唯一标签有效；更多则被忽略。
  const slugs = [query.category, ...query.tags].filter(Boolean);
  const tag = isTagsEnabled() && slugs.length ? allTags().find((item) => item.slug() === slugs[0]) : undefined;
  if (tag) filter.tag = tag.id();
  const tagsIgnored = slugs.length > 1 || (slugs.length === 1 && !tag) || 'tag' in query.extra;

  // flarum/likes 按点赞者（用户名）筛选帖子。
  if (query.liked && app.session.user) filter.likedBy = app.session.user.username();
  if (query.bookmarked) filter.lcoyBookmarked = true;

  const handled = ['author', 'tag', 'lcoyLiked', 'lcoyBookmarked'];
  const ignored = tagsIgnored || Object.keys(all).some((key) => !handled.includes(key));

  return { filter, ignored };
}

function pageOf(response: any, items: Model[]): SearchPage {
  const total = response?.payload?.meta?.page?.total;

  return {
    items,
    total: typeof total === 'number' ? total : null,
    hasMore: !!response?.payload?.links?.next,
  };
}

export async function fetchPage(tab: SearchTab, query: SearchQuery, sort: string, offset: number): Promise<SearchPage> {
  const page = { offset, limit: PAGE_SIZE };

  if (tab === 'topics') {
    const include = ['user', 'lastPostedUser', 'firstPost', 'mostRelevantPost', 'mostRelevantPost.user'];
    if (isTagsEnabled()) include.push('tags');

    const filter: Record<string, any> = queryFilters(query);
    if (query.text) filter.q = query.text;

    const response: any = await app.store.find('discussions', { filter, sort: sort || undefined, include: include.join(','), page });

    return pageOf(response, response);
  }

  if (tab === 'posts') {
    const { filter } = postFilters(query);
    if (query.text) filter.q = query.text;

    const include = ['user', 'discussion'];
    if (isTagsEnabled()) include.push('discussion.tags');

    const response: any = await app.store.find('posts', { filter, sort: sort || undefined, include: include.join(','), page });

    return pageOf(response, response);
  }

  if (tab === 'categories') {
    const response: any = await app.store.find('tags', { filter: { q: query.text }, include: 'parent', page });

    return pageOf(response, response);
  }

  const response: any = await app.store.find('users', { filter: { q: query.text }, page });

  return pageOf(response, response);
}
