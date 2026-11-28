/*
 * 阅读聚焦模式（桌面）：话题页向下滚动、标题离开视口后，
 * 时间线降低视觉权重并略向右让位；向上滚动时恢复。
 *
 * 指针移回时间线时由 CSS 的 `:hover` 单独恢复完整权重，
 * 不参与类的切换——否则指针落在时间线边缘时，「移入恢复 →
 * 位移让指针离开 → 再次降权」会形成反复闪烁的反馈环。
 *
 * 只用不改变布局的属性（opacity / transform）：聚焦态若同时
 * 改列宽或间距，滚动中会不断触发重排，也与滚动事件互相激发。
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

  // 手机上时间线是底部的浮标，阅读聚焦在 CSS 层不生效；
  // 这里也直接跳过，省掉每次滚动后的标题测量（手机滚动卡顿
  // 的一处来源）。
  if (window.matchMedia('(max-width: 767.98px)').matches) return;

  let hero: HTMLElement | null = null;
  let frame = 0;
  let heroVisible = true;
  /** 用户正在向上滚动：不进入聚焦，直到再次向下滚。 */
  let scrollingUp = false;
  let lastY = window.scrollY;

  const apply = () => {
    APP()?.classList.toggle('Lcoy--readingFocus', !heroVisible && !scrollingUp);
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

  // 指针移回时间线时的恢复完全交给 CSS 的 `:hover`，
  // 不在 JS 里切换类，避免“移入 → 位移 → 移出”的反复触发。

  schedule();
}
