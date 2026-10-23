/*
 * 列表的无限滚动，与 Discourse 相同：当列表底部接近屏幕时，
 * 下一页会自动加载。核心的 "加载更多" 按钮仍然保留 —— 它是
 * 没有 IntersectionObserver 时显示的内容，也是键盘可以触达的内容。
 */
import { extend } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';

import { forumBool } from '../utils/settings';

interface Watched {
  lcoyObserver?: IntersectionObserver;
  lcoyTarget?: Element | null;
}

function stateOf(list: DiscussionList): DiscussionListState | undefined {
  return (list as any).attrs?.state;
}

/**
 * 仅读者正在查看的列表：讨论页侧栏中的副本
 * （`.DiscussionPage-list`）或隐藏的列表不会自行加载
 * 页面。
 */
function visible(list: DiscussionList): boolean {
  const element = list.element as HTMLElement | undefined;

  if (!element || element.closest('.DiscussionPage-list')) return false;

  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0 && element.offsetParent !== null;
}

function maybeLoad(list: DiscussionList): void {
  const state = stateOf(list);

  if (!visible(list)) return;

  if (!state || !state.hasNext() || state.isInitialLoading() || state.isLoadingNext()) return;

  state.loadNext();
}

/**
 * 观察当前的 `.DiscussionList-loadMore`。当列表变空又恢复时
 * （核心会用 Placeholder 替换整棵树），元素会变化，因此每次
 * 重绘时都检查是否仍是同一个。
 */
function watch(list: DiscussionList & Watched): void {
  if (typeof IntersectionObserver === 'undefined' || !forumBool('lcoyListInfiniteScroll', true)) return;

  const target = list.element?.querySelector('.DiscussionList-loadMore') ?? null;

  if (target === list.lcoyTarget) return;

  list.lcoyObserver?.disconnect();
  list.lcoyTarget = target;

  if (!target) return;

  // 600px 余量：下一行在读者看到末尾之前就已到达。
  list.lcoyObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) maybeLoad(list);
    },
    { rootMargin: '0px 0px 600px 0px' }
  );

  list.lcoyObserver.observe(target);
}

export default function installInfiniteScroll(): void {
  extend(DiscussionList.prototype, 'oncreate', function (this: DiscussionList & Watched) {
    watch(this);
  });

  extend(DiscussionList.prototype, 'onupdate', function (this: DiscussionList & Watched) {
    watch(this);

    // 较短的页面可能在末尾仍可见时就加载完毕：没有交叉变化时
    // 观察器不会再次触发，所以这里主动检查。
    const target = this.lcoyTarget;

    if (target && forumBool('lcoyListInfiniteScroll', true)) {
      const rect = target.getBoundingClientRect();

      if (rect.top < window.innerHeight + 600) maybeLoad(this);
    }
  });

  extend(DiscussionList.prototype, 'onremove', function (this: DiscussionList & Watched) {
    this.lcoyObserver?.disconnect();
    this.lcoyObserver = undefined;
    this.lcoyTarget = null;
  });
}
