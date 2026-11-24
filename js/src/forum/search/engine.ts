/*
 * 搜索菜单的引擎（SearchPanel 的 chunk）：按键之间的等待、
 * “#”、“@” 和 “key:” 的建议，以及 API 请求。状态（搜索词和
 * 结果）位于主包的 state.ts 中，因为页头字段从
 * 首次绘制起就会绘制它。
 */
import app from 'flarum/forum/app';
import SearchManager from 'flarum/common/SearchManager';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';

import { allTags, isTagsEnabled, type LcoyTag } from '../utils/tags';
import { CATEGORY_SLUG_REGEXP, discussionFilter, SUGGESTIONS_REGEXP, USERNAME_REGEXP } from './query';
import { addRecentSearch } from './assist';
import type { SearchMenuState, SearchResults } from './state';

/** Discourse 在菜单中每种类型显示多少项（`Search.per_facet`）。 */
export const PER_FACET = 5;
const DEBOUNCE_MS = 400;

type SuggestionMatch = { type: 'category'; text: string } | { type: 'user'; text: string } | { type: 'shortcut'; keyword: string };

/** 转小写并去除变音符号："Notícias" 可以匹配 "noticias"。 */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** 分类 = 主标签或某个主标签的子标签（如同主题的搜索页）。 */
export function isCategory(tag: LcoyTag): boolean {
  return tag.position() !== null || tag.isChild();
}

function matchingTags(text: string, limit: number): { categories: LcoyTag[]; tags: LcoyTag[] } {
  if (!isTagsEnabled()) return { categories: [], tags: [] };

  const wanted = normalize(text.trim());
  const found = allTags().filter((tag) => !wanted || normalize(tag.name()).includes(wanted) || normalize(tag.slug()).includes(wanted));
  // 以文本开头的排在仅包含它的前面。
  const starts = (tag: LcoyTag) => (normalize(tag.name()).startsWith(wanted) || normalize(tag.slug()).startsWith(wanted) ? 0 : 1);
  const sorted = found.sort((a, b) => starts(a) - starts(b) || b.discussionCount() - a.discussionCount());

  return {
    categories: sorted.filter(isCategory).slice(0, limit),
    tags: sorted.filter((tag) => !isCategory(tag)).slice(0, limit),
  };
}

function canSearchUsers(): boolean {
  return !!app.forum.attribute('canSearchUsers');
}

/** 过短的搜索词不会搜索，除非带有筛选器（如同 Discourse）。 */
function isValidTerm(term: string): boolean {
  const trimmed = term.trim();

  if (!trimmed) return false;
  if (/[#@:]/.test(trimmed)) return true;

  return trimmed.length >= SearchManager.minSearchLength();
}

/** `SearchMenuState.trigger()` 的工作，使用同一状态（只有一个，由各菜单共享）。 */
class Engine {
  private timer?: number;
  private request = 0;

  constructor(private readonly state: SearchMenuState) {}

  trigger(): void {
    const state = this.state;

    window.clearTimeout(this.timer);

    if (state.searchTopics) {
      state.loading = true;
      this.perform();
      addRecentSearch(state.term);
    } else {
      state.loading = false;
      this.timer = window.setTimeout(() => this.perform(), DEBOUNCE_MS);
    }
  }

  matchSuggestions(): SuggestionMatch | null {
    if (this.state.searchTopics) return null;

    const term = this.state.term.trim();
    const category = isTagsEnabled() ? term.match(CATEGORY_SLUG_REGEXP) : null;

    if (category) return { type: 'category', text: category[0].slice(1).split(':').pop() || '' };

    const user = term.match(USERNAME_REGEXP);

    if (user) return { type: 'user', text: user[0].slice(1) };

    const shortcut = term.match(SUGGESTIONS_REGEXP);

    if (shortcut) return { type: 'shortcut', keyword: shortcut[0] };

    return null;
  }

  async perform(): Promise<void> {
    const id = ++this.request;
    const current = () => id === this.request;
    const suggestion = this.matchSuggestions();

    if (suggestion) {
      this.state.noResults = true;
      this.state.results = null;
      this.state.loading = false;
      this.state.suggestionResults = [];

      if (suggestion.type === 'category') {
        const { categories, tags } = matchingTags(suggestion.text, 8);

        this.state.suggestionResults = [...categories, ...tags].slice(0, 8);
        this.state.suggestionKeyword = '#';
      } else if (suggestion.type === 'user') {
        this.state.suggestionKeyword = false;

        const users = await this.findUsers(suggestion.text, 6);

        if (!current()) return;

        if (users.length) {
          this.state.suggestionResults = users;
          this.state.suggestionKeyword = '@';
        }
      } else {
        this.state.suggestionKeyword = suggestion.keyword;
      }

      m.redraw();
      return;
    }

    this.state.suggestionKeyword = false;

    if (!this.state.term.trim()) {
      this.state.noResults = false;
      this.state.results = null;
      this.state.loading = false;
      this.state.invalidTerm = false;
      m.redraw();
      return;
    }

    if (!isValidTerm(this.state.term)) {
      this.state.noResults = true;
      this.state.results = null;
      this.state.loading = false;
      this.state.invalidTerm = true;
      m.redraw();
      return;
    }

    this.state.loading = true;
    this.state.invalidTerm = false;
    m.redraw();

    try {
      const results = this.state.searchTopics ? await this.findTopics(this.state.term) : await this.findQuick(this.state.term);

      if (!current()) return;

      this.state.results = results;
      this.state.noResults = !results.topics.length && !results.categories.length && !results.tags.length && !results.users.length;
    } catch {
      if (!current()) return;

      this.state.results = null;
      this.state.noResults = true;
    } finally {
      if (current()) {
        this.state.loading = false;
        m.redraw();
      }
    }
  }

  async findUsers(text: string, limit: number): Promise<User[]> {
    if (!canSearchUsers()) return [];

    try {
      // 没有文本（只有 "@"）时，Discourse 会建议最近活跃过的人。
      const params = text ? { filter: { q: text }, page: { limit } } : { sort: '-lastSeenAt', page: { limit } };

      return await app.store.find<User[]>('users', params as any);
    } catch {
      return [];
    }
  }

  async findQuick(term: string): Promise<SearchResults> {
    const { text } = discussionFilter(term);
    const { categories, tags } = text ? matchingTags(text, PER_FACET) : { categories: [], tags: [] };
    const users = text ? await this.findUsers(text, PER_FACET) : [];

    return { text, topics: [], moreTopics: false, categories, tags, users };
  }

  async findTopics(term: string): Promise<SearchResults> {
    const { filter, text } = discussionFilter(term);
    const include = ['mostRelevantPost', 'user', ...(isTagsEnabled() ? ['tags'] : [])].join(',');
    const topics = await app.store.find<Discussion[]>('discussions', { filter, page: { limit: PER_FACET }, include } as any);
    const moreTopics = !!(topics as any).payload?.links?.next;

    return { text, topics, moreTopics, categories: [], tags: [], users: [] };
  }
}

const engines = new WeakMap<SearchMenuState, Engine>();

export function trigger(state: SearchMenuState): void {
  let engine = engines.get(state);

  if (!engine) engines.set(state, (engine = new Engine(state)));

  engine.trigger();
}
