/*
 * 侧栏打开或关闭，如同 Discourse 的汉堡按钮。
 *
 * 平板及以上（≥ 768px，与 Discourse 相同）它会停靠在内容旁，读者的
 * 选择会写入 localStorage；在读者选择之前，使用管理员的
 * 默认值。在手机上它变成汉堡面板，覆盖在内容之上，
 * 每个页面开始时都是关闭的。
 */
import { forumBool } from './settings';

const STORAGE_KEY = 'lcoy.sidebarOpen';
const DOCKED_QUERY = '(min-width: 768px)';

export const SHELL_CLASS = 'Lcoy';
export const OPEN_CLASS = 'Lcoy--sidebarOpen';
export const OVERLAY_CLASS = 'Lcoy--sidebarOverlay';

let dockedChoice: boolean | null = null;
let overlayOpen = false;

function readStoredChoice(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return stored === null ? null : stored === '1';
  } catch {
    return null;
  }
}

export function isDocked(): boolean {
  return window.matchMedia(DOCKED_QUERY).matches;
}

export function isSidebarOpen(): boolean {
  if (!isDocked()) return overlayOpen;

  if (dockedChoice === null) {
    dockedChoice = readStoredChoice() ?? forumBool('lcoySidebarOpenDefault', true);
  }

  return dockedChoice;
}

export function applySidebarState(): void {
  const app = document.getElementById('app');

  if (!app) return;

  app.classList.toggle(OPEN_CLASS, isSidebarOpen());
  app.classList.toggle(OVERLAY_CLASS, !isDocked() && overlayOpen);
}

export function toggleSidebar(): void {
  if (isDocked()) {
    dockedChoice = !isSidebarOpen();

    try {
      localStorage.setItem(STORAGE_KEY, dockedChoice ? '1' : '0');
    } catch {
      // 没有存储时，该选择仅在页面重新加载前有效。
    }
  } else {
    overlayOpen = !overlayOpen;
  }

  applySidebarState();
}

/** 关闭覆盖面板——在导航时或点击其外部时。 */
export function closeOverlaySidebar(): void {
  if (!overlayOpen) return;

  overlayOpen = false;
  applySidebarState();
}

export function watchViewport(): void {
  window.matchMedia(DOCKED_QUERY).addEventListener('change', () => {
    overlayOpen = false;
    applySidebarState();
  });
}
