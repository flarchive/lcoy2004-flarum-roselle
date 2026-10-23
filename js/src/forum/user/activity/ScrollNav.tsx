/*
 * Discourse 的 `horizontal-overflow-nav`：一行可横向滚动的标签页，
 * 放不下时在仍有隐藏标签页的一侧出现 ‹ › 箭头（以及渐隐的边框）。
 *
 * `--left`/`--right` 类在滚动和 resize 时直接改 DOM：为每个滚动像素
 * 重绘 Mithril 是浪费。
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

export interface ScrollNavAttrs extends ComponentAttrs {
  className?: string;
}

/** 容差（px），用于滚动取整（缩放、高密度屏幕）。 */
const EDGE = 2;

export default class ScrollNav extends Component<ScrollNavAttrs> {
  private list: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private readonly sync = () => this.updateArrows();

  view(vnode: Mithril.Vnode<ScrollNavAttrs, this>) {
    return (
      <div className="LcoyScrollNav">
        <button
          type="button"
          className="LcoyScrollNav-arrow LcoyScrollNav-arrow--left"
          tabindex="-1"
          aria-label={t('user.nav.scroll_left')}
          onclick={() => this.scrollBy(-1)}
        >
          <Icon name="fas fa-chevron-left" />
        </button>
        <ul className={classList('LcoyScrollNav-list', this.attrs.className)}>{vnode.children}</ul>
        <button
          type="button"
          className="LcoyScrollNav-arrow LcoyScrollNav-arrow--right"
          tabindex="-1"
          aria-label={t('user.nav.scroll_right')}
          onclick={() => this.scrollBy(1)}
        >
          <Icon name="fas fa-chevron-right" />
        </button>
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>) {
    super.oncreate(vnode);

    this.list = this.element.querySelector('.LcoyScrollNav-list');
    this.list?.addEventListener('scroll', this.sync, { passive: true });

    if (typeof ResizeObserver !== 'undefined' && this.list) {
      this.observer = new ResizeObserver(this.sync);
      this.observer.observe(this.list);
    } else {
      window.addEventListener('resize', this.sync);
    }

    // 激活的标签页可见，与 Discourse 打开行末标签页时一致。
    const active = this.list?.querySelector<HTMLElement>('[active="true"], .active');

    if (this.list && active) {
      const left = active.offsetLeft - this.list.offsetLeft;
      const right = left + active.offsetWidth;

      if (right > this.list.scrollLeft + this.list.clientWidth || left < this.list.scrollLeft) {
        this.list.scrollLeft = Math.max(0, left - this.list.clientWidth / 3);
      }
    }

    this.updateArrows();
  }

  onupdate(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>) {
    super.onupdate(vnode);

    this.updateArrows();
  }

  onremove(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>) {
    super.onremove(vnode);

    this.list?.removeEventListener('scroll', this.sync);
    this.observer?.disconnect();
    window.removeEventListener('resize', this.sync);
  }

  private updateArrows(): void {
    const list = this.list;

    if (!list || !this.element) return;

    const max = list.scrollWidth - list.clientWidth;
    // 在从右到左的页面中 `scrollLeft` 为负数。
    const position = Math.abs(list.scrollLeft);

    this.element.classList.toggle('LcoyScrollNav--left', max > EDGE && position > EDGE);
    this.element.classList.toggle('LcoyScrollNav--right', max > EDGE && position < max - EDGE);
  }

  private scrollBy(direction: -1 | 1): void {
    const list = this.list;

    if (!list) return;

    const rtl = getComputedStyle(list).direction === 'rtl' ? -1 : 1;

    list.scrollBy({ left: direction * rtl * Math.max(120, list.clientWidth * 0.6), behavior: 'smooth' });
  }
}
