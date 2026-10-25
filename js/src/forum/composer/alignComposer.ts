/*
 * 编辑器（不含预览）与内容卡片对齐。CSS 以前用
 * --lcoy-main-max 计算，这只在 px 下有效：当内容宽度为
 * 百分比（90%、全宽）时计算会出错，编辑器会跑到
 * 侧边栏上方。这里把卡片的实际位置转成 CSS 变量。
 */
import app from 'flarum/forum/app';

let frame = 0;

function measure(): void {
  frame = 0;

  const card = document.querySelector<HTMLElement>('#content .Page-container.container, #content .container');
  const root = document.documentElement;

  if (!card || window.innerWidth < 768) {
    root.style.removeProperty('--lcoy-composer-card-left');
    root.style.removeProperty('--lcoy-composer-card-room');
    return;
  }

  const rect = card.getBoundingClientRect();

  root.style.setProperty('--lcoy-composer-card-left', `${Math.round(rect.left)}px`);
  root.style.setProperty('--lcoy-composer-card-room', `${Math.round(rect.width)}px`);
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(measure);
}

let observersReady = false;

export default function installAlignComposer(): void {
  window.addEventListener('resize', schedule, { passive: true });

  // 侧边栏开合时卡片会移动（内容区域宽度改变）。观察器只挂一次：
  // beforeMount 在首次挂载前运行；保留幂等守卫，安装器被重复调用时
  // 也不会累积 ResizeObserver/MutationObserver。
  app.beforeMount(() => {
    requestAnimationFrame(() => {
      if (!observersReady) {
        const content = document.getElementById('content');
        const area = document.querySelector('.App-content');

        if (content && area) {
          if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(area);
          new MutationObserver(schedule).observe(content, { childList: true });
          observersReady = true;
        }
      }

      schedule();
    });
  });
}
