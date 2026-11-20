/*
 * 阅读聚焦模式（桌面）：话题页向下滚动、标题离开视口后，
 * 时间线降低视觉权重并略向右让位；指针移回时间线/侧栏、
 * 或向上滚动时恢复。
 *
 * 不用 IntersectionObserver：判断只需标题盒子的位置，
 * 而滚动事件本来就要监听（rAF 合并，一帧最多测量一次），
 * 这样也避免依赖 DiscussionPage 的生命周期钩子。
 */
import { forumBool } from '../utils/settings';

const APP = () => document.getElementById('app');
const HERO = '.LcoyTopic .Page-hero--inline, .LcoyTopic .DiscussionHero';

/** 标题顶部进入页头下方这么多像素内仍算“可见”。 */
const KEEP_VISIBLE = 72;
/** 向上滚动超过这么多像素才视为“回看”，此时不进入聚焦。 */
const DIRECTION_DELTA = 48;

export default function installReadingFocus(): void {
  if (!forumBool('lcoyReadingFocus', true)) return;

  let hero: HTMLElement | null = null;
  let frame = 0;
  let heroVisible = true;
  /** 指针停在时间线/侧栏上：暂时恢复正常权重。 */
  let hovering = false;
  /** 用户正在向上滚动：不进入聚焦，直到再次向下滚。 */
  let scrollingUp = false;
  let lastY = window.scrollY;

  const apply = () => {
    APP()?.classList.toggle('Lcoy--readingFocus', !heroVisible && !hovering && !scrollingUp);
  };

  const measure = () => {
    frame = 0;

    if (!hero || !hero.isConnected) hero = document.querySelector<HTMLElement>(HERO);

    if (!hero) {
      if (!heroVisible) {
        heroVisible = true;
        apply();
      }

      return;
    }

    const visible = hero.getBoundingClientRect().bottom > KEEP_VISIBLE;

    if (visible === heroVisible) return;

    heroVisible = visible;
    apply();
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const delta = y - lastY;

      lastY = y;

      if (delta < -DIRECTION_DELTA && !scrollingUp) {
        scrollingUp = true;
        apply();
      } else if (delta > DIRECTION_DELTA && scrollingUp) {
        scrollingUp = false;
        apply();
      }

      schedule();
    },
    { passive: true }
  );

  // 指针移到时间线或侧栏上：恢复完整权重，方便直接操作。
  document.addEventListener(
    'pointermove',
    (event) => {
      const inside = !!(event.target as HTMLElement | null)?.closest('.Page-sidebar, .DiscussionPage-nav');

      if (inside === hovering) return;

      hovering = inside;
      apply();
    },
    { passive: true }
  );

  // 路由切换后标题是新的节点：`isConnected` 会在下一次测量时
  // 发现旧节点已移除，从而重新查询。

  schedule();
}
