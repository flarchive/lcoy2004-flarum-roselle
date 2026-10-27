/*
 * 手机端的可视视口高度。iOS 和 Android 在键盘弹出、地址栏收放时
 * 对布局视口的处理并不一致：`100vh/100dvh` 不一定跟着键盘缩小。
 * `visualViewport.height` 是实际能看到的区域，写进变量后，
 * 全屏编辑器、搜索面板和长表单都按这个高度布局。
 *
 * 只钉住盒子还不够：文本域的高度由核心按像素写死，只在重绘或
 * 窗口尺寸变化时重算，而 iOS 键盘不改变窗口。视口高度变化后
 * 补一次重绘，核心才会按新的盒子重新量高度，工具栏和“回复”
 * 不会被键盘挡住。
 */

let frame = 0;
/** 上次写入的高度：只有新值才重绘，避免重绘与测量互相触发。 */
let applied = '';

function update(): void {
  frame = 0;

  const root = document.documentElement;
  const viewport = window.visualViewport;

  if (!viewport || window.innerWidth >= 768) {
    root.style.removeProperty('--lcoy-visual-height');
    applied = '';

    return;
  }

  const height = Math.round(viewport.height);

  root.style.setProperty('--lcoy-visual-height', `${height}px`);

  if (`${height}` !== applied) {
    applied = `${height}`;
    m.redraw();
  }
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(update);
}

export default function installMobileViewport(): void {
  const viewport = window.visualViewport;

  if (!viewport) return;

  viewport.addEventListener('resize', schedule, { passive: true });
  viewport.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });

  update();
}
