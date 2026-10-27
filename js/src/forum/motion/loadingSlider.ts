/*
 * 顶部加载条（Discourse 的 `.loading-indicator-container`）：
 * 切换页面时，它会在最近五次导航的平均时间内增长到 80%，
 * 在页面到达前缓慢前进到 90%，到达后完成
 * 并消失。
 *
 * Flarum 没有带等待的“路由过渡”：新页面会立即挂载，
 * 并在 `oninit` 中获取数据。因此导航从每个 Page 的 `oninit`
 * 开始，在那一刻触发的请求返回时结束。
 * 它也覆盖按需加载的模块，核心曾用
 * “正在加载…”提示来通知这些模块——Discourse 没有这种提示。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';

import { forumBool } from '../utils/settings';

// Discourse `loading-slider` 服务的数值。
const STORE_LOADING_TIMES = 5;
const DEFAULT_LOADING_TIME = 0.3;
const MIN_LOADING_TIME = 0.2;

type SliderState = 'ready' | 'loading' | 'still-loading' | 'done';

const durations: number[] = [];
let average = DEFAULT_LOADING_TIME;

let container: HTMLElement | null = null;
let bar: HTMLElement | null = null;
let state: SliderState = 'ready';
let deferred: number | null = null;

// 进行中的导航：何时开始，以及它还剩多少个请求。
let loading = false;
let startedAt = 0;
let pending = 0;
// 进行中的按需模块（AlertManagerState 的“pool”）。
let chunkPool = 0;
// 首页随 HTML 数据一起诞生：不算导航。
let armed = false;

function record(seconds: number) {
  durations.push(seconds);
  if (durations.length > STORE_LOADING_TIMES) durations.shift();
  average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function setState(next: SliderState) {
  state = next;

  if (!container) return;

  container.className = `LcoyLoadingSlider ${next}`;
  container.style.setProperty('--loading-duration', `${average.toFixed(2)}s`);
}

function mount() {
  if (container) return;

  container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  bar = document.createElement('div');
  bar.className = 'LcoyLoadingSlider-bar';
  container.appendChild(bar);
  document.body.appendChild(container);
  setState('ready');

  // 已完成消失：无动画地回到零（`.ready` 在进度条上
  // 没有过渡）。
  container.addEventListener('transitionend', (event) => {
    if (event.target === container && event.propertyName === 'opacity' && state === 'done') {
      setState('ready');
    }
  });

  // 到达 80% 且页面仍未到来：缓慢前进到 90%。
  bar.addEventListener('transitionend', (event) => {
    if (event.target === bar && event.propertyName === 'transform' && state === 'loading') {
      setState('still-loading');
    }
  });
}

/** 开始一次导航（如果已有导航进行中则忽略）。 */
export function startLoading() {
  if (loading || !enabled()) return;

  mount();
  loading = true;
  startedAt = performance.now();
  pending = 0;

  // 如同 Discourse 的 `stateChanged`：先归零，在下一帧再增长。
  if (deferred !== null) cancelAnimationFrame(deferred);
  setState('ready');
  deferred = requestAnimationFrame(() => {
    deferred = null;
    if (loading) setState('loading');
  });
}

/** 结束导航：进度条完成并消失。 */
export function endLoading() {
  if (!loading) return;

  loading = false;
  record(Math.max((performance.now() - startedAt) / 1000, MIN_LOADING_TIME));

  if (deferred !== null) {
    cancelAnimationFrame(deferred);
    deferred = null;
  }

  // 如果它甚至没有出现（页面瞬间加载），`.done` 会保持不可见。
  setState('done');
}

/** 实时读取：安装时 `app.forum` 还不存在。 */
function enabled(): boolean {
  return !!app.forum && forumBool('lcoyLoadingSlider', true);
}

function settle() {
  pending = Math.max(0, pending - 1);
  if (pending === 0 && chunkPool === 0) endLoading();
}

export default function installLoadingSlider() {
  extend(app as any, 'mount', () => {
    // 在首次绘制后启用：初始页面不是导航。
    requestAnimationFrame(() => window.setTimeout(() => (armed = true), 300));
  });

  // 每个新页面都是一次导航。Page 的 `oninit` 在子类的
  // `oninit` 之前运行，而子类才是发起请求的地方——因此检查会等到
  // 绘制之后：如果到那时还没有请求，页面就已经准备好了。
  extend(Page.prototype, 'oninit', () => {
    if (!armed) return;

    startLoading();
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        if (pending === 0 && chunkPool === 0) endLoading();
      }, 0)
    );
  });

  // 统计导航期间产生的请求。override 绝不能失败：
  // 如果失败，app 的 `request` 会返回 undefined。
  override(app as any, 'request', function (this: unknown, original: (...args: unknown[]) => Promise<unknown>, ...args: unknown[]) {
    const promise = original(...args);

    try {
      if (loading && promise && typeof (promise as Promise<unknown>).then === 'function') {
        pending++;
        (promise as Promise<unknown>).then(settle, settle);
      }
    } catch {
      // 计数只是装饰性的；请求无论如何都会继续。
    }

    return promise;
  });

  // 按需模块：用进度条取代“正在加载…”提示。
  const alerts = app.alerts as any;

  // 关闭进度条后，核心的提示会恢复。
  let coreLoads = 0;

  override(alerts, 'showLoading', (original: () => void) => {
    if (!enabled()) {
      coreLoads++;
      return original();
    }

    chunkPool++;
    if (armed) startLoading();
  });

  override(alerts, 'clearLoading', (original: () => void) => {
    if (coreLoads > 0) {
      coreLoads--;
      return original();
    }

    if (chunkPool === 0) return;
    chunkPool--;
    if (chunkPool === 0 && pending === 0) endLoading();
  });
}
