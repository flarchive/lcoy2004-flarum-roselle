/*
 * 搜索状态，在各菜单（页头的和欢迎横幅的）之间共享，
 * 如同 Discourse 的 `search` 服务：搜索词、搜索是否
 * 已包含主题（按回车后）以及结果。
 *
 * 与 Discourse 一样，输入只触发“快速”搜索（`exclude_topics`）：
 * 分类、标签和用户，等待 400ms。用户按回车或选择
 * 建议后才会加入主题。
 *
 * 这里只放字段绘制所需的内容；搜索本身（engine.ts）随面板
 * （SearchPanel）一起下载，在字段聚焦/悬停或启动空闲时请求。
 */
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';

import type { LcoyTag } from '../utils/tags';
import { withSearchPanel } from './panelLazy';

export interface SearchResults {
  /** 不含 gambit 的自由文本，用于在标题和摘要中高亮。 */
  text: string;
  topics: Discussion[];
  moreTopics: boolean;
  categories: LcoyTag[];
  tags: LcoyTag[];
  users: User[];
}

export class SearchMenuState {
  term = '';
  /** Discourse 的 `typeFilter !== exclude_topics`：搜索已经包含主题。 */
  searchTopics = false;
  loading = false;
  invalidTerm = false;
  noResults = false;
  results: SearchResults | null = null;
  /** "#"、"@" 或输入的快捷方式（"is:"）：助手会显示在结果的位置。 */
  suggestionKeyword: string | false = false;
  suggestionResults: Array<LcoyTag | User> = [];

  /** Discourse 的 `searchTermChanged`。 */
  setTerm(term: string, opts: { searchTopics?: boolean } = {}): void {
    this.term = term.replace(/[​-‍﻿]/g, '');
    this.searchTopics = !!opts.searchTopics;
    this.trigger();
  }

  /** Enter：同一查询，现在包含主题。 */
  searchTopicsNow(): void {
    this.searchTopics = true;
    this.trigger();
  }

  clear(): void {
    this.setTerm('');
  }

  trigger(): void {
    this.noResults = false;
    // Enter 的加载状态会立即显示；其余来自引擎（chunk 已到达时同步）。
    this.loading = this.searchTopics;
    withSearchPanel((panel) => panel.trigger(this));
  }
}

const state = new SearchMenuState();

export default state;
