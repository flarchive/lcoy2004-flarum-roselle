/*
 * 已登录用户的“新帖 (N)”和“未读 (N)”计数。
 *
 * 这些计数随论坛文档下发（lcoyNewCount / lcoyUnreadCount），并在用户
 * 返回列表时通过 GET /api/lcoy-counts 更新——那时用户可能刚读完
 * 某些内容。
 *
 * 在某个标签页面上，标签显示该标签的数字（`?tag=slug`），与
 * Discourse 在分类中的做法一致：在空分类中显示全局的“(1)”会造成
 * 误解。
 */
import app from 'flarum/forum/app';

import { forumBool } from '../../utils/settings';
import { currentTag } from '../../utils/tags';
import { fetchTopicCounts } from './api';

/** 服务端到此停止计数；超过后标签显示“99+”。 */
export const COUNT_LIMIT = 100;

/** 连续多次返回列表无需重复计数。 */
const REFRESH_AFTER_MS = 15_000;

interface CountsState {
  newCount: number;
  unreadCount: number;
  /** 数字在服务端计算的时间（毫秒）。 */
  at: number;
}

let state: CountsState | null = null;
let refreshing: Promise<void> | null = null;

/** 按标签（slug）的计数，在打开各标签页面时获取。 */
const tagged: Record<string, CountsState> = {};
const taggedRefreshing: Record<string, Promise<void> | undefined> = {};

function currentTagSlug(): string | null {
  return currentTag()?.slug() || null;
}

function toCount(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function countsEnabled(): boolean {
  return !!app.session.user && forumBool('lcoyStatsCountsEnabled', true);
}

function current(): CountsState | null {
  if (!countsEnabled()) return null;

  if (!state) {
    const newCount = app.forum.attribute<unknown>('lcoyNewCount');
    const unreadCount = app.forum.attribute<unknown>('lcoyUnreadCount');

    // 缺少这些属性（服务端已关闭该功能）时，没有内容可显示。
    if (newCount === undefined && unreadCount === undefined) return null;

    state = { newCount: toCount(newCount), unreadCount: toCount(unreadCount), at: Date.now() };
  }

  return state;
}

/**
 * “全部标记为已读”会立即将两者清零，无需等待服务端：用户对象上的
 * 新时间表明，早于该时间的所有计数都已失效。
 */
function markedAllAfterCount(counts: CountsState): boolean {
  const markedAt = app.session.user?.markedAllAsReadAt();

  return !!markedAt && markedAt.getTime() > counts.at;
}

/**
 * 适用于 `scope` 的计数：`'global'`（侧边栏）或 `'page'`（标签页——
 * 当前页面为某标签时使用该标签）。
 */
function scoped(scope: 'global' | 'page'): CountsState | null {
  const base = current();

  if (!base || scope === 'global') return base;

  const slug = currentTagSlug();

  if (!slug) return base;

  // 尚无该标签的数字：发起获取，期间不显示任何内容。
  if (!tagged[slug]) {
    refreshTag(slug);
    return null;
  }

  return tagged[slug];
}

export function newCount(scope: 'global' | 'page' = 'global'): number {
  const counts = scoped(scope);

  return counts && !markedAllAfterCount(counts) ? counts.newCount : 0;
}

export function unreadCount(scope: 'global' | 'page' = 'global'): number {
  const counts = scoped(scope);

  return counts && !markedAllAfterCount(counts) ? counts.unreadCount : 0;
}

function refreshTag(slug: string, force = false): Promise<void> {
  const counts = tagged[slug];

  if (!force && counts && Date.now() - counts.at < REFRESH_AFTER_MS && !markedAllAfterCount(counts)) return Promise.resolve();
  if (taggedRefreshing[slug]) return taggedRefreshing[slug]!;

  taggedRefreshing[slug] = fetchTopicCounts(slug)
    .then((response) => {
      if (!response) return;

      tagged[slug] = { newCount: toCount(response.new), unreadCount: toCount(response.unread), at: Date.now() };
      m.redraw();
    })
    .finally(() => {
      taggedRefreshing[slug] = undefined;
    });

  return taggedRefreshing[slug]!;
}

/** “3”，或服务端停止计数时的“99+”。 */
export function formatCount(count: number): string {
  return count >= COUNT_LIMIT ? `${COUNT_LIMIT - 1}+` : String(count);
}

export function refreshCounts(force = false): Promise<void> {
  const counts = current();

  if (!counts) return Promise.resolve();

  const slug = currentTagSlug();
  const tagRefresh = slug ? refreshTag(slug, force) : Promise.resolve();

  return Promise.all([refreshGlobal(counts, force), tagRefresh]).then(() => {});
}

function refreshGlobal(counts: CountsState, force: boolean): Promise<void> {
  if (!force && Date.now() - counts.at < REFRESH_AFTER_MS && !markedAllAfterCount(counts)) return Promise.resolve();
  if (refreshing) return refreshing;

  refreshing = fetchTopicCounts()
    .then((response) => {
      if (!response) return;

      state = { newCount: toCount(response.new), unreadCount: toCount(response.unread), at: Date.now() };
      m.redraw();
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}
