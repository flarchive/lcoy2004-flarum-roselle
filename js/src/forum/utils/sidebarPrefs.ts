/*
 * 读者为侧栏选择的分类和标签——Discourse 的
 * “自定义区域”。按用户保存在 localStorage 中：该选择是
 * 阅读偏好，而不是需要发送到服务器的数据。
 * 没有选择（null）时，区域显示论坛默认值。
 */
import app from 'flarum/forum/app';

export type SidebarSectionName = 'categories' | 'tags';

function storageKey(section: SidebarSectionName): string {
  return `lcoy.sidebarPicks.${app.session.user?.id() ?? 'guest'}.${section}`;
}

export function getSidebarPicks(section: SidebarSectionName): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(section));
    const parsed = raw ? JSON.parse(raw) : null;

    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function setSidebarPicks(section: SidebarSectionName, ids: string[] | null): void {
  try {
    if (ids === null) localStorage.removeItem(storageKey(section));
    else localStorage.setItem(storageKey(section), JSON.stringify(ids));
  } catch {
    // 没有存储时，该选择仅在页面重新加载前有效。
  }
}

/*
 * 在主区域（首页、聊天、Wiki……）中，读者把哪些条目放进了
 * “更多”。同样的方案：按用户保存在 localStorage 中；null = 默认。
 */
function communityKey(): string {
  return `lcoy.sidebarCommunityMore.${app.session.user?.id() ?? 'guest'}`;
}

export function getCommunityMore(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(communityKey()) || '[]');

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function setCommunityMore(keys: string[]): void {
  try {
    if (keys.length) localStorage.setItem(communityKey(), JSON.stringify(keys));
    else localStorage.removeItem(communityKey());
  } catch {
    // 没有存储时，该选择仅在页面重新加载前有效。
  }
}
