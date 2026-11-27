/*
 * 手机端讨论卡片的滑动手势。
 *
 * 与核心的 Slidable（jQuery + 反色滑块）不同：这里只改
 * `.DiscussionListItem-content` 的 transform，操作层由
 * `viewItems` 绘制的 `.LcoySwipeLayer` 承担，因此视觉由主题
 * 控制，语义也换成「左滑关注 / 右滑标记已读」。
 *
 * 方向判断优先于位移：只有横向位移明显大于纵向时才锁定手势，
 * 锁定前不阻止默认滚动，纵向浏览完全交给浏览器。
 */

const THRESHOLD = 72;
const MAX = 104;
const PHONE_QUERY = '(max-width: 767.98px)';

export interface SwipeAction {
  label: string;
  run: () => void;
}

export interface SwipeActions {
  /** 向左滑（手指左移）：显示右侧操作层。 */
  left?: SwipeAction;
  /** 向右滑（手指右移）：显示左侧操作层。 */
  right?: SwipeAction;
}

/** 返回清理函数；非手机或不支持触摸时返回空函数。 */
export function attachSwipe(row: HTMLElement, actions: SwipeActions): () => void {
  if (!window.matchMedia(PHONE_QUERY).matches) return () => {};
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return () => {};

  const content = row.querySelector<HTMLElement>('.DiscussionListItem-content');

  if (!content) return () => {};

  let startX = 0;
  let startY = 0;
  let dx = 0;
  let active = false;
  let axis: 'h' | 'v' | null = null;
  let blockUntil = 0;

  const reset = () => {
    content.style.transition = 'transform 180ms cubic-bezier(0.2, 0.7, 0.3, 1)';
    content.style.transform = '';
    row.classList.remove('is-swiping');
    row.removeAttribute('data-swipe');
    window.setTimeout(() => (content.style.transition = ''), 200);
    dx = 0;
    axis = null;
  };

  // 滑动过后紧跟的 click 不应打开话题。
  const blockClick = (event: Event) => {
    if (Date.now() > blockUntil) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;

    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    active = true;
    axis = null;
    dx = 0;
  };

  const onMove = (event: TouchEvent) => {
    if (!active) return;

    const x = event.touches[0].clientX - startX;
    const y = event.touches[0].clientY - startY;

    if (!axis) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;

      axis = Math.abs(x) > Math.abs(y) * 1.2 ? 'h' : 'v';

      if (axis === 'h') {
        content.style.transition = 'none';
        row.classList.add('is-swiping');
      }
    }

    if (axis !== 'h') return;

    const action = x < 0 ? actions.left : actions.right;

    // 该方向没有可用操作：保持原位，让浏览器恢复自己的滚动。
    if (!action) {
      dx = 0;
      content.style.transform = '';
      row.removeAttribute('data-swipe');

      return;
    }

    // 只在横向锁定后处理位移。监听保持 passive：横向手势由
    // `touch-action: pan-y` 在 CSS 层挡住，纵向滚动与缩放始终由
    // 浏览器负责，滚动不会被这个监听阻塞（手机上这是主要的卡顿来源）。
    dx = Math.max(-MAX, Math.min(MAX, x));
    content.style.transform = `translate3d(${dx}px, 0, 0)`;
    row.dataset.swipe = Math.abs(dx) >= THRESHOLD ? (dx < 0 ? 'left' : 'right') : 'idle';
  };

  const onEnd = () => {
    if (!active) return;

    active = false;

    const action = dx < 0 ? actions.left : actions.right;

    if (axis === 'h' && action && Math.abs(dx) >= THRESHOLD) {
      blockUntil = Date.now() + 350;
      content.style.transition = 'transform 160ms ease-out';
      content.style.transform = `translate3d(${(dx < 0 ? -1 : 1) * MAX}px, 0, 0)`;

      // 先让卡片滑出，再复位并执行操作：有明确的完成感。
      window.setTimeout(() => {
        reset();
        action.run();
      }, 140);

      return;
    }

    if (axis === 'h') blockUntil = Date.now() + 250;
    reset();
  };

  const onCancel = () => {
    active = false;
    reset();
  };

  row.addEventListener('click', blockClick, true);
  row.addEventListener('touchstart', onStart, { passive: true });
  row.addEventListener('touchmove', onMove, { passive: true });
  row.addEventListener('touchend', onEnd);
  row.addEventListener('touchcancel', onCancel);

  return () => {
    row.removeEventListener('click', blockClick, true);
    row.removeEventListener('touchstart', onStart);
    row.removeEventListener('touchmove', onMove);
    row.removeEventListener('touchend', onEnd);
    row.removeEventListener('touchcancel', onCancel);
    content.style.transition = '';
    content.style.transform = '';
    row.classList.remove('is-swiping');
    row.removeAttribute('data-swipe');
  };
}
