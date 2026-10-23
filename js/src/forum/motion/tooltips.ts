/*
 * 仅图标按钮的提示。在 Discourse 中，每个图标按钮都有
 * `title`（帖子操作、页头图标、弹窗的 ✕），浏览器会在
 * 鼠标停下时显示提示。在 Flarum 中这些按钮只有
 * `aria-label`；当它们不在核心的 `<Tooltip>` 内时，标签
 * 也会成为 `title`。
 */
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';

const pending = new Set<HTMLElement>();
let scheduled = false;

function sync(element: HTMLElement) {
  if (!element.isConnected) return;

  // 核心的 <Tooltip> 已经显示提示（并把文本存在 jQuery 中）。
  const $ = (window as any).$;
  if ($ && $(element).data('bs.tooltip')) return;

  const own = element.dataset.lcoyTitle;
  const current = element.getAttribute('title');

  // 组件自带的标题优先。
  if (current && current !== own) return;

  const label = element.getAttribute('aria-label')?.trim();
  const iconOnly = !element.textContent?.trim();

  if (label && iconOnly) {
    if (current !== label) element.setAttribute('title', label);
    element.dataset.lcoyTitle = label;
  } else if (own) {
    element.removeAttribute('title');
    delete element.dataset.lcoyTitle;
  }
}

function flush() {
  scheduled = false;
  pending.forEach(sync);
  pending.clear();
}

export default function installTooltips() {
  // 等待一帧：按钮外层的 <Tooltip> 会在它之后挂载。
  extend(Button.prototype, ['oncreate', 'onupdate'] as any, function (this: any) {
    const element = this.element as HTMLElement | undefined;

    if (!element) return;

    pending.add(element);

    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  });
}
