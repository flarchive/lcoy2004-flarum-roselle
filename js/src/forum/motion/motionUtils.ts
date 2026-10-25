/*
 * `motion/` 各模块共享的动效工具。
 */

/** 要求减少动画的人会立即看到一切（Discourse 会将时长归零）。 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** 手机（< 768px）：那里的菜单是底部面板，触摸也没有悬停。 */
export function isPhone(): boolean {
  return window.matchMedia?.('(max-width: 767.98px)').matches ?? false;
}
