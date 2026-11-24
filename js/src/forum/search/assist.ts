/*
 * 只有打开的搜索菜单面板才会使用（SearchPanel 的 chunk）：
 * 最近的搜索、随机提示和助手快捷方式。
 */
import app from 'flarum/forum/app';
import { GambitType } from 'flarum/common/query/IGambit';
import type IGambit from 'flarum/common/query/IGambit';

import { t } from '../utils/settings';
import { isTagsEnabled } from '../utils/tags';
import { gambitKey } from './query';

const MAX_RECENT_SEARCHES = 5;

// ---------------------------------------------------------------------------
// 最近的搜索
// ---------------------------------------------------------------------------
// Discourse 把最近的搜索保存在服务器上（`log_search_queries`）；
// 这里按用户保存在浏览器中：这是搜索者的便利，
// 而不是论坛数据。

function recentKey(): string | null {
  const user = app.session.user;

  return user ? `lcoy.recentSearches.${user.id()}` : null;
}

export function recentSearches(): string[] {
  const key = recentKey();

  if (!key) return [];

  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');

    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  const key = recentKey();
  const clean = term.trim();

  if (!key || !clean) return;

  const list = [clean, ...recentSearches().filter((item) => item !== clean)].slice(0, MAX_RECENT_SEARCHES);

  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 没有存储（无痕窗口、配额）：搜索仍可继续，只是没有历史记录。
  }
}

export function clearRecentSearches(): void {
  const key = recentKey();

  if (!key) return;

  try {
    localStorage.removeItem(key);
  } catch {
    // 同上。
  }
}

// ---------------------------------------------------------------------------
// 作为助手快捷方式的 Gambits（"in:title"、"status:open"……）
// ---------------------------------------------------------------------------

function enabledGambits(): IGambit[] {
  return app.search.gambits.for('discussions').filter((gambit) => gambit.enabled());
}

function firstKey(key: string | string[]): string {
  return Array.isArray(key) ? key[0] : key;
}

/** 布尔分组（"is:"、"in:"）及其各自的键。 */
function groupedKeys(): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  enabledGambits()
    .filter((gambit) => gambit.type === GambitType.Grouped)
    .forEach((gambit) => {
      const { group, key } = gambit.suggestion() as { group: string; key: string | string[] };
      const list = groups.get(group) || [];

      list.push(firstKey(key));
      groups.set(group, list);
    });

  return groups;
}

/**
 * 所有快捷方式，按 Discourse 列出的顺序：先是已完整的
 * 布尔项（"is:pinned"），然后是请求值的键
 * （"created:"）——但作者和标签除外，它们已经有 `@` 和 `#`。
 */
export function suggestionShortcuts(): string[] {
  const shortcuts: string[] = [];

  groupedKeys().forEach((keys, group) => keys.forEach((key) => shortcuts.push(`${group}:${key}`)));

  enabledGambits()
    .filter((gambit) => gambit.type === GambitType.KeyValue && !['author', 'tag'].includes(gambit.filterKey()))
    .forEach((gambit) => shortcuts.push(`${firstKey((gambit as any).key())}:`));

  return shortcuts;
}

// ---------------------------------------------------------------------------
// 随机提示（`.search-random-quick-tip`）
// ---------------------------------------------------------------------------

export interface QuickTip {
  label?: string;
  shortcut?: boolean;
  description: string;
  clickable?: boolean;
}

/** 对没有键盘的人，键盘快捷键提示没有帮助。 */
function hasKeyboard(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function quickTips(): QuickTip[] {
  const tips: QuickTip[] = [];

  if (isTagsEnabled() && gambitKey('tag')) tips.push({ label: '#', description: t('search_menu.tips.category_tag'), clickable: true });
  if (gambitKey('author')) tips.push({ label: '@', description: t('search_menu.tips.author'), clickable: true });

  groupedKeys().forEach((keys, group) => {
    const examples = keys
      .slice(0, 3)
      .map((key) => `${group}:${key}`)
      .join(', ');

    tips.push({ label: `${group}:`, description: t('search_menu.tips.in', { examples }), clickable: true });
  });

  if (hasKeyboard()) tips.push({ shortcut: true, description: t('search_menu.tips.full_search') });

  return tips;
}

export function randomTip(): QuickTip | null {
  const tips = quickTips();

  return tips.length ? tips[Math.floor(Math.random() * tips.length)] : null;
}
