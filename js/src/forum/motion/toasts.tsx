/*
 * 出现后消失的提示（核心的 AlertManager）会变成 Discourse 的提示条
 * （`.fk-d-toast` + `DDefaultToast`）：左侧是主题图标
 * （对勾、三角形、感叹号、“i”），然后是文本和 ✕；3 秒后
 * 自动关闭（“short”）——或 5 秒（“long”）——并淡出，鼠标悬停时
 * 停止计时，在手机上向上滑动即可关闭。
 *
 * 页面内的提示（内容中的 `.Alert`）不变：只有
 * AlertManager 的提示会获得 `LcoyToast` 类。
 */
import { extend } from 'flarum/common/extend';
import Alert from 'flarum/common/components/Alert';
import AlertManager from 'flarum/common/components/AlertManager';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';
import { prefersReducedMotion } from './motionUtils';

// `DToast.duration` 以及 float-kit 的 `auto-close-toast`。
const SHORT_MS = 3000;
const LONG_MS = 5000;
const CSS_TRANSITION_DELAY_MS = 300;
const FADE_OUT_CLASS = 'LcoyToast--fadeOut';
// `DToast`：关闭时滑动速度（px/ms），以及关闭时的回退距离。
const VELOCITY_THRESHOLD = -1.2;
const SWIPE_DISTANCE = 50;
const MAX_ANIMATION_MS = 200;

const TOAST_CLASS = 'LcoyToast';

/** 每种主题的图标，如同 `toasts.success/error/warning/info`。 */
const THEME_ICONS: Record<string, string> = {
  success: 'fas fa-check',
  error: 'fas fa-exclamation-triangle',
  warning: 'fas fa-exclamation-circle',
  info: 'fas fa-info-circle',
};

interface ToastTimer {
  element: HTMLElement;
  duration: number;
  close: () => void;
  fadeTimer?: number;
  closeTimer?: number;
  stopped?: boolean;
}

const timers = new WeakMap<HTMLElement, ToastTimer>();

function startTimer(timer: ToastTimer) {
  if (timer.stopped) return;

  stopTimer(timer);
  timer.fadeTimer = window.setTimeout(() => {
    timer.element.classList.add(FADE_OUT_CLASS);
    timer.closeTimer = window.setTimeout(timer.close, CSS_TRANSITION_DELAY_MS);
  }, timer.duration);
}

function stopTimer(timer: ToastTimer) {
  window.clearTimeout(timer.fadeTimer);
  window.clearTimeout(timer.closeTimer);
  // 在提示条淡出时重新看向它的人会让它回来。
  timer.element.classList.remove(FADE_OUT_CLASS);
}

function flatten(children: unknown): Mithril.Vnode<any, any>[] {
  if (!Array.isArray(children)) return [];

  return children.flatMap((child: any) => (child && child.tag === '[' ? flatten(child.children) : child ? [child] : []));
}

/** 手机上向上滑动（提示条的 `dSwipe`）。 */
function bindSwipe(element: HTMLElement, close: () => void) {
  let startY = 0;
  let startT = 0;
  let deltaY = 0;
  let tracking = false;

  const animateTo = (y: number, done?: () => void) => {
    const animation = element.animate([{ transform: `translateY(${y}px)` }], {
      duration: prefersReducedMotion() ? 0 : MAX_ANIMATION_MS,
      fill: 'forwards',
    });

    animation.onfinish = () => done?.();
  };

  element.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      tracking = true;
      startY = event.touches[0].clientY;
      startT = performance.now();
      deltaY = 0;
    },
    { passive: true }
  );

  element.addEventListener(
    'touchmove',
    (event) => {
      if (!tracking) return;
      deltaY = event.touches[0].clientY - startY;
      // 只能向上：向下时提示条不会离开原位。
      element.style.transform = `translateY(${Math.min(0, deltaY)}px)`;
    },
    { passive: true }
  );

  element.addEventListener('touchend', () => {
    if (!tracking) return;
    tracking = false;

    const velocity = deltaY / Math.max(1, performance.now() - startT);
    element.style.transform = '';

    if (deltaY < 0 && (velocity < VELOCITY_THRESHOLD || deltaY < -SWIPE_DISTANCE)) {
      element.style.transform = `translateY(${deltaY}px)`;
      animateTo(-150, close);
    } else if (deltaY < 0) {
      element.style.transform = `translateY(${deltaY}px)`;
      animateTo(0, () => {
        element.style.transform = '';
        element.getAnimations().forEach((animation) => animation.cancel());
      });
    }
  });
}

/**
 * Discourse 的提示条是右上角的一列
 * （`.fk-d-toasts`）。这里有两条堆叠——核心的 AlertManager 和
 * flarum/realtime 的通知——所以第二条从第一条结束的位置开始：
 * 提示的高度会写入 `--lcoy-toasts-offset`。
 */
function watchAlertsHeight(): void {
  const update = (element: Element | null) => {
    const height = element ? Math.ceil(element.getBoundingClientRect().height) : 0;

    document.documentElement.style.setProperty('--lcoy-toasts-offset', height > 0 ? `${height + 5}px` : '0px');
  };

  const attach = () => {
    const manager = document.querySelector('.AlertManager');

    if (!manager || typeof ResizeObserver === 'undefined') return false;

    new ResizeObserver(() => update(manager)).observe(manager);
    update(manager);

    return true;
  };

  if (!attach()) window.setTimeout(attach, 1000);
}

export default function installToasts() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchAlertsHeight);
  else window.setTimeout(watchAlertsHeight, 0);

  // 标记 AlertManager 的提示，并给每个提示一个 key。没有 key 时，
  // 关闭第一个后 Mithril 会把它的组件复用于
  // 第二个——一个的计时器就会关闭另一个。
  extend(AlertManager.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    const ids = Object.keys(this.state.getActiveAlerts());
    const wrappers = flatten(vdom.children);

    if (wrappers.length !== ids.length) return;

    wrappers.forEach((wrapper, index) => {
      wrapper.key = ids[index];

      const alert = flatten(wrapper.children)[0];

      if (alert && alert.attrs) {
        alert.attrs.className = classList(alert.attrs.className, TOAST_CLASS);
      }
    });
  });

  // 文本前的主题图标，如同 `__icon-container`。
  extend(Alert.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    if (!vdom?.attrs || !String(vdom.attrs.className || '').includes(TOAST_CLASS)) return;

    const icon = this.attrs.icon && this.attrs.title ? null : THEME_ICONS[this.attrs.type as string];
    const containerVnode = flatten(vdom.children)[0];

    if (!icon || !containerVnode || !Array.isArray(containerVnode.children)) return;

    containerVnode.children.unshift(
      <div className="LcoyToast-icon" aria-hidden="true">
        <Icon name={icon} />
      </div>
    );
  });

  extend(Alert.prototype, 'oncreate', function (this: any) {
    const element = this.element as HTMLElement;

    if (!element?.classList.contains(TOAST_CLASS)) return;

    const close = () => (this.attrs.ondismiss as (() => void) | undefined)?.();

    bindSwipe(element, close);

    // 不会自行关闭的（仍在用它的“加载中”）会保留。
    // 在这里读取，而不是在 install 中：initializer 中 `app.forum` 还不存在。
    if (!forumBool('lcoyToastAutoClose', true) || this.attrs.dismissible === false) return;

    const hasControls = Array.isArray(this.attrs.controls) && this.attrs.controls.length > 0;
    const timer: ToastTimer = {
      element,
      // 带按钮的错误和警告停留更久（"long"）：有内容可读，也有内容可点。
      duration: this.attrs.type === 'error' || hasControls ? LONG_MS : SHORT_MS,
      close,
    };

    timers.set(element, timer);

    element.addEventListener('mouseenter', () => stopTimer(timer), { passive: true });
    element.addEventListener('mouseleave', () => startTimer(timer), { passive: true });
    // 触摸时没有“移出”：一旦触摸，提示条会保留到点 ✕。
    element.addEventListener(
      'touchstart',
      () => {
        stopTimer(timer);
        timer.stopped = true;
      },
      { passive: true, once: true }
    );
    // 使用键盘到达的人也能获得时间。
    element.addEventListener('focusin', () => stopTimer(timer));
    element.addEventListener('focusout', () => startTimer(timer));

    startTimer(timer);
  });

  extend(Alert.prototype, 'onremove', function (this: any) {
    const timer = this.element && timers.get(this.element);

    if (timer) {
      timer.stopped = true;
      window.clearTimeout(timer.fadeTimer);
      window.clearTimeout(timer.closeTimer);
      timers.delete(this.element);
    }
  });
}
