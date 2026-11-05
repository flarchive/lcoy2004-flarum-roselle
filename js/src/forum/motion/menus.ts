/*
 * 菜单关闭（Discourse 的 `.fk-d-menu.-animated.-closing`）：
 * 菜单在 125ms 内上浮淡出（`dissolve-up`），向上打开时
 * 则向下（`dissolve-down`）。打开（`float-down`，250ms）只是 CSS。
 *
 * Bootstrap 的下拉菜单会一次性移除 `open` 类，因此无法
 * 给菜单本身加动画。在 `hide.bs.dropdown`（关闭之前触发）时，
 * 菜单会被复制到一个固定在同一位置的“幽灵”中，由它执行动画
 * 并自行销毁——不会触碰下拉菜单的状态。
 */
import { isPhone, prefersReducedMotion } from './motionUtils';

const GHOST_CLASS = 'LcoyMenuGhost';
const CLOSING_MS = 125;

function ghostMenu(dropdown: HTMLElement) {
  if (!dropdown.classList.contains('open')) return;

  // 页头面板（通知、用户、语言）是 Discourse 的
  // `.menu-panel`，它们会立即关闭。
  if (dropdown.closest('.App-header, .App-navigation, .LcoySidebar')) return;

  const menu = dropdown.querySelector<HTMLElement>(':scope > .Dropdown-menu');

  if (!menu || menu.classList.contains('Dropdown-menu--inline')) return;

  const rect = menu.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  const clone = menu.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  clone.style.cssText += `;position:absolute;top:0;left:0;right:auto;bottom:auto;margin:0;width:${rect.width}px;height:${rect.height}px;max-height:none;`;

  // 幽灵会带上拉菜单的类：诸如
  // `.Dropdown.open > .Dropdown-menu` 以及组件自身的规则都会在它上面生效。
  const ghost = document.createElement('div');
  ghost.className = `${dropdown.className} ${GHOST_CLASS}`;
  ghost.classList.add('open');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  ghost.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;margin:0;`;
  ghost.appendChild(clone);
  document.body.appendChild(ghost);

  const remove = () => ghost.remove();
  clone.addEventListener('animationend', remove, { once: true });
  // 如果动画没有运行（标签页在后台），也同样移除。
  window.setTimeout(remove, CLOSING_MS + 150);
}

export default function installMenus() {
  const $ = (window as any).$;

  if (!$) return;

  $(document).on('hide.bs.dropdown', (event: { target: EventTarget | null }) => {
    if (prefersReducedMotion() || isPhone()) return;

    const dropdown = event.target as HTMLElement | null;

    if (!dropdown || !(dropdown instanceof HTMLElement)) return;

    try {
      ghostMenu(dropdown);
    } catch {
      // 幽灵只是装饰：如果失败，菜单会像核心那样关闭。
    }
  });
}
