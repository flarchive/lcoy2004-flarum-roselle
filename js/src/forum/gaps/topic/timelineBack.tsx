/*
 * Discourse 时间线的“返回”（.timeline-last-read）：当读者上滚到远离已读
 * 位置的地方——跳到开头、点开旧帖链接——时，轨道上该位置的高度会出现一个
 * 按钮，把他带回最后未读的那篇帖子。
 *
 * 按钮在 scrubber 的 view 中创建，并在 updateScrubberValues 中显示或隐藏，
 * 后者每次滚动都会运行：scrubber 的 view 在滚动时不会重绘
 *（核心直接改 DOM 样式）。
 */
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

/** 在 view 树中查找带指定类名的 vnode。 */
function findByClass(vnode: any, className: string): any {
  if (!vnode || typeof vnode !== 'object') return null;

  if (vnode.attrs && typeof vnode.attrs.className === 'string' && vnode.attrs.className.split(' ').includes(className)) return vnode;

  const children = Array.isArray(vnode.children) ? vnode.children : [];

  for (const child of children) {
    const found = findByClass(child, className);

    if (found) return found;
  }

  return null;
}

/** 读者读到哪里的 scrubber 刻度（在 stream 中的位置，从 1 到 N）。 */
function lastReadIndex(stream: any): number {
  const discussion = stream?.discussion;
  const number = discussion?.lastReadPostNumber?.() || 0;

  if (!number) return 0;

  // 只有当中间有已删除帖子时，帖子编号与 stream 中的位置才会不同；
  // 帖子已加载时，用精确位置。
  const ids: string[] = discussion.postIds?.() || [];
  const posts: any[] = stream.posts?.() || [];
  const loaded = posts.find((post) => post && post.number() === number);

  if (loaded) {
    const index = ids.indexOf(String(loaded.id()));

    if (index !== -1) return index + 1;
  }

  return Math.min(number, stream.count());
}

/** 轨道上的按钮：scrubber 的 view 会重建它，因此它存在时复用同一节点。 */
function backElement(component: any): HTMLElement | null {
  const current = component.lcoyBackElement as HTMLElement | undefined;

  if (current && current.isConnected) return current;

  const element = (component.element?.querySelector?.('.LcoyTimelineBack') || null) as HTMLElement | null;

  component.lcoyBackElement = element;

  return element;
}

/**
 * 最后已读帖子的索引：每帧滚动都遍历主题的 id 是 O(n)，因此结果会缓存，
 * 直到已读编号变化（或 stream 加载更多帖子，这会改变所查找帖子的位置）。
 */
function cachedLastRead(component: any, stream: any): number {
  const discussion = stream?.discussion;
  const key = `${discussion?.id?.()}:${discussion?.lastReadPostNumber?.() || 0}:${stream?.count?.() || 0}`;

  if (component.lcoyLastReadKey !== key) {
    component.lcoyLastReadKey = key;
    component.lcoyLastReadIndex = lastReadIndex(stream);
  }

  return component.lcoyLastReadIndex || 0;
}

export default function installTimelineBack(): void {
  extend('flarum/forum/components/PostStreamScrubber', 'view', function (this: any, vnode: any) {
    if (!gaps.timelineBack()) return;

    const scrollbar = findByClass(vnode, 'Scrubber-scrollbar');

    if (!scrollbar || !Array.isArray(scrollbar.children)) return;

    scrollbar.children.push(
      <div className="LcoyTimelineBack" aria-hidden="true">
        <Button
          className="Button Button--primary LcoyTimelineBack-button"
          title={t('gaps.timeline.back_description')}
          onclick={(event: MouseEvent) => {
            // 点击轨道也会移动滑块：只让按钮生效。
            event.stopPropagation();

            const number = this.stream?.discussion?.lastReadPostNumber?.() || 0;

            if (number) this.stream.goToNumber(number);
          }}
        >
          {t('gaps.timeline.back')}
        </Button>
      </div>
    );
  });

  extend('flarum/forum/components/PostStreamScrubber', 'updateScrubberValues', function (this: any) {
    const element = backElement(this);

    if (!element) return;

    const stream = this.stream;
    const total = stream?.count?.() || 0;
    const current = stream?.index || 0;
    const lastRead = cachedLastRead(this, stream);

    // 与 Discourse 相同的条件：距离足够远（超过 3 篇帖子）、位于已读点
    // 上方，且该点不是主题末尾。
    const show =
      gaps.timelineBack() &&
      total > 0 &&
      lastRead > 3 &&
      lastRead > current &&
      Math.abs(lastRead - current) > 3 &&
      Math.abs(lastRead - total) > 1 &&
      lastRead !== total;

    const percent = Math.min(100, Math.max(0, ((lastRead - 1) / total) * 100));
    let visible = show;

    // 与 Discourse 的 showButton 一致：仅在滑块不在已读点上方时
    //（否则按钮会盖住它旁边的“11/27”）。
    if (visible) {
      const scrollbar = element.parentElement as HTMLElement | null;
      const handle = scrollbar?.querySelector<HTMLElement>('.Scrubber-handle');

      if (scrollbar && handle) {
        const top = (percent / 100) * scrollbar.clientHeight;
        const handleTop = handle.offsetTop;
        const handleBottom = handleTop + handle.offsetHeight;

        visible = handleBottom + 40 < top || handleTop > top + 40;
      }
    }

    // 每帧都写相同的类/属性会无谓地使样式失效：按钮只在出现、
    // 消失或高度变化时更新。
    if (this.lcoyBackVisible !== visible) {
      this.lcoyBackVisible = visible;
      element.classList.toggle('LcoyTimelineBack--visible', visible);
      element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    if (visible && this.lcoyBackTop !== percent) {
      this.lcoyBackTop = percent;
      element.style.top = `${percent}%`;
    }
  });
}
