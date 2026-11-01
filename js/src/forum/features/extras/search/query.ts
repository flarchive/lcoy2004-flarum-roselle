/*
 * 搜索页面的查询，双向转换：
 *
 *   "horizon autor:ana tag:suporte é:trancada"  <->  { text, author, category, … }
 *   （示例中的关键词随论坛语言变化）
 *
 * 与 Discourse 一致，高级筛选并不保存在独立状态中：它们会把
 * gambits 写入查询本身，而查询会进入 URL。这样搜索链接可以分享，
 * 输入框准确显示正在搜索的内容，手动输入 gambits 的用户也能看到
 * 控件随之调整。
 *
 * 解析使用核心的 GambitManager（关键词会被翻译，其他扩展的 gambits
 * 也能被识别）。页面不认识的筛选条件会留在 `extra` 中，并原样
 * 写回查询。
 */
import app from 'flarum/forum/app';
import type IGambit from 'flarum/common/query/IGambit';

import { allTags, type LcoyTag } from '../../../utils/tags';

export type SearchStatus = '' | 'open' | 'closed' | 'sticky';

export interface SearchQuery {
  /** 自由文本，不含 gambits。 */
  text: string;
  author: string;
  category: string;
  tags: string[];
  inTitle: boolean;
  liked: boolean;
  bookmarked: boolean;
  unread: boolean;
  status: SearchStatus;
  /** YYYY-MM-DD */
  after: string;
  before: string;
  minPosts: string;
  /** 其他扩展的筛选条件（或手动输入的），页面不编辑它们。 */
  extra: Record<string, unknown>;
}

/** 只选择了一端时 `created:` 的边界。 */
const OPEN_START = '1970-01-01';
const OPEN_END = '2999-12-31';

const KNOWN_KEYS = [
  'q',
  'author',
  'tag',
  'lcoyInTitle',
  'lcoyLiked',
  'lcoyBookmarked',
  'unread',
  'locked',
  '-locked',
  'sticky',
  'created',
  'lcoyMinPosts',
];

export function emptyQuery(): SearchQuery {
  return {
    text: '',
    author: '',
    category: '',
    tags: [],
    inTitle: false,
    liked: false,
    bookmarked: false,
    unread: false,
    status: '',
    after: '',
    before: '',
    minPosts: '',
    extra: {},
  };
}

function findTag(slug: string): LcoyTag | undefined {
  const wanted = slug.toLowerCase();

  return allTags().find((tag) => tag.slug().toLowerCase() === wanted);
}

/** 分类 = 主标签（带位置）或某个主标签的子标签。 */
export function isCategory(tag: LcoyTag): boolean {
  return tag.position() !== null || tag.isChild();
}

export function parseQuery(raw: string): SearchQuery {
  const query = emptyQuery();
  const filter = app.search.gambits.apply('discussions', { q: raw || '' }) as Record<string, any>;

  query.text = String(filter.q || '').trim();
  query.author = typeof filter.author === 'string' ? filter.author : '';
  query.inTitle = !!filter.lcoyInTitle;
  query.liked = !!filter.lcoyLiked;
  query.bookmarked = !!filter.lcoyBookmarked;
  query.unread = !!filter.unread;
  query.minPosts = filter.lcoyMinPosts ? String(filter.lcoyMinPosts) : '';

  if (filter['-locked']) query.status = 'open';
  else if (filter.locked) query.status = 'closed';
  else if (filter.sticky) query.status = 'sticky';

  // `tag:a tag:b` 会得到 ['a', 'b']（与）；`tag:a,b` 得到 ['a,b']（或）。
  // 只有简单值会变成分类/标签；或组保持输入时的原样。
  const tagValues: string[] = Array.isArray(filter.tag) ? filter.tag : filter.tag ? [String(filter.tag)] : [];
  const orGroups: string[] = [];

  for (const value of tagValues) {
    if (value.includes(',')) {
      orGroups.push(value);
      continue;
    }

    const tag = findTag(value);

    if (tag && isCategory(tag) && !query.category) query.category = tag.slug();
    else query.tags.push(tag ? tag.slug() : value);
  }

  if (typeof filter.created === 'string') {
    const [start, end] = filter.created.split('..');

    if (end === undefined) {
      query.after = start;
      query.before = start;
    } else {
      query.after = start === OPEN_START ? '' : start;
      query.before = end === OPEN_END ? '' : end;
    }
  }

  for (const key of Object.keys(filter)) {
    if (!KNOWN_KEYS.includes(key)) query.extra[key] = filter[key];
  }

  if (orGroups.length) query.extra.tag = orGroups;

  return query;
}

/** 与查询等价的 API 筛选条件（不含自由文本）。 */
export function queryFilters(query: SearchQuery): Record<string, any> {
  const filter: Record<string, any> = { ...query.extra };
  const tags = [query.category, ...query.tags].filter(Boolean);
  const extraTags = Array.isArray(filter.tag) ? filter.tag : [];

  if (tags.length || extraTags.length) filter.tag = [...tags, ...extraTags];
  if (query.author.trim()) filter.author = query.author.trim();
  if (query.inTitle) filter.lcoyInTitle = true;
  if (query.liked) filter.lcoyLiked = true;
  if (query.bookmarked) filter.lcoyBookmarked = true;
  if (query.unread) filter.unread = true;
  if (query.status === 'open') filter['-locked'] = true;
  if (query.status === 'closed') filter.locked = true;
  if (query.status === 'sticky') filter.sticky = true;

  const minPosts = parseInt(query.minPosts, 10);
  if (Number.isFinite(minPosts) && minPosts > 0) filter.lcoyMinPosts = String(minPosts);

  if (query.after || query.before) {
    filter.created = query.after && query.after === query.before ? query.after : `${query.after || OPEN_START}..${query.before || OPEN_END}`;
  }

  return filter;
}

/**
 * 将查询序列化为文本，并翻译其中的 gambits。
 *
 * 不使用 `GambitManager.from`：当注册了多个 gambit 时，它会丢失
 * 否定筛选的“-”（例如“未锁定”主题所用的否定关键词）。
 */
export function serializeQuery(query: SearchQuery): string {
  const gambits = app.search.gambits.for('discussions');
  const filter = queryFilters(query);
  const parts: string[] = query.text ? [query.text] : [];

  for (const [rawKey, value] of Object.entries(filter)) {
    const negate = rawKey.startsWith('-');
    const key = negate ? rawKey.slice(1) : rawKey;
    const gambit = gambits.find((candidate: IGambit) => candidate.filterKey() === key);

    if (!gambit) continue;

    // “与”关系的标签会为每个值生成一个 `tag:`；TagGambit 对数组
    // 已做此处理。
    parts.push(gambit.fromFilter(value, negate));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** 是否有可搜索的内容？仅有筛选条件也算，与 Discourse 一致。 */
export function hasCriteria(query: SearchQuery): boolean {
  return !!query.text || Object.keys(queryFilters(query)).length > 0;
}

/** 自由文本中的各个词，用于在结果中高亮。 */
export function highlightPattern(text: string): RegExp | undefined {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return words.length ? new RegExp(words.join('|'), 'gi') : undefined;
}
