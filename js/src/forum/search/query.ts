/*
 * 搜索菜单在绘制之外需要知道的内容：输入的搜索词
 * （以 Discourse 格式，带 `#分类` 和 `@用户`）如何变成 Flarum
 * 查询，以及整页搜索指向哪里。最近的搜索、
 * 提示和助手快捷方式位于 assist.ts（面板的 chunk）。
 */
import app from 'flarum/forum/app';
import { GambitType } from 'flarum/common/query/IGambit';

import { forumBool } from '../utils/settings';

/** 搜索词末尾的 `#slug`：助手会列出分类和标签。 */
export const CATEGORY_SLUG_REGEXP = /(#[\p{L}\p{N}\-_:]*)$/u;
/** 搜索词末尾的 `@名称`：助手会列出用户。 */
export const USERNAME_REGEXP = /(@[\p{L}\p{N}\-_.]*)$/u;
/** 搜索词末尾的 `某内容:`：助手会列出筛选器（gambits）。 */
export const SUGGESTIONS_REGEXP = /(\S*:)([\p{L}\p{N}\-]*)$/u;
/** 搜索词已有修饰符：第一行不再重复“在所有主题中”。 */
export const MODIFIER_REGEXP = /[#@:]/;

const SEARCH_ROUTE = 'lcoy.search';

/** 核心或扩展的 gambit 的翻译键，依据它生成的筛选器。 */
export function gambitKey(filterKey: string): string | null {
  const gambit = app.search.gambits.for('discussions').find((g) => g.filterKey() === filterKey && g.enabled());

  if (!gambit || gambit.type !== GambitType.KeyValue) return null;

  const key = (gambit as any).key();

  return Array.isArray(key) ? key[0] : key;
}

/**
 * "horizon #support @ana" -> "horizon tag:support author:ana"：Flarum 不
 * 认识 Discourse 的快捷方式，但认识 gambits（键使用论坛的
 * 语言），核心搜索和搜索页已经能理解它们。
 */
export function toGambitQuery(term: string): string {
  const tagKey = gambitKey('tag');
  const authorKey = gambitKey('author');

  return term
    .split(/\s+/)
    .filter(Boolean)
    .map((bit) => {
      if (tagKey && /^#[^\s#]+$/.test(bit)) return `${tagKey}:${bit.slice(1).split(':').pop()}`;
      if (authorKey && /^@[^\s@]+$/.test(bit)) return `${authorKey}:${bit.slice(1)}`;

      return bit;
    })
    .join(' ');
}

/** 该搜索词的 API 筛选器，以及剩余的自由文本（在结果中高亮的内容）。 */
export function discussionFilter(term: string): { filter: Record<string, any>; text: string } {
  const filter = app.search.gambits.apply('discussions', { q: toGambitQuery(term) }) as Record<string, any>;
  const text = String(filter.q || '').trim();

  if (!text) delete filter.q;

  return { filter, text };
}

function searchPageAvailable(): boolean {
  return forumBool('lcoySearchPageEnabled', true) && SEARCH_ROUTE in (app.routes as Record<string, unknown>);
}

/** 整页搜索：主题的搜索页，或没有它时核心的列表并带 `?q=`。 */
export function fullSearchUrl(term: string): string {
  const q = toGambitQuery(term.trim());

  if (searchPageAvailable()) return app.route(SEARCH_ROUTE, q ? { q } : {});

  const filter = app.search.gambits.apply('discussions', { q }) as Record<string, any>;
  const text = filter.q || null;

  delete filter.q;

  return app.route('index', { q: text, filter });
}

/** 滑块按钮只在启用高级搜索页时存在。 */
export function advancedSearchAvailable(): boolean {
  return searchPageAvailable();
}
