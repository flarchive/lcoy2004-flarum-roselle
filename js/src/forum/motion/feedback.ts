/*
 * 帖子操作的反馈（Discourse 的 `lib/post-action-feedback`）：
 * 复制链接后，按钮角落会画出一个绿色“对勾”
 * （`draw`，1s），并在其上方显示“链接已复制！”；两者淡出
 * （0.25s），并在 2.5s 后消失。
 *
 * 主题的链接按钮通过类
 * `LcoyPostAction--copied` 表示已复制；点击只是开始等待它。
 */
import { t } from '../utils/settings';

const TIMEOUT = 2500;
const TRANSITION_BUFFER = 250;
const WAIT_MS = 1500;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** 在按钮上显示反馈。导出给其他负责复制的按钮使用。 */
export function postActionFeedback(button: HTMLElement, message: string) {
  // 已经在显示（双击）：不叠加。
  if (button.querySelector('.LcoyFeedback-check')) return;

  const alert = document.createElement('div');
  alert.className = 'LcoyFeedback-alert';
  alert.setAttribute('role', 'status');
  alert.textContent = message;

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'LcoyFeedback-check');
  svg.setAttribute('viewBox', '0 0 52 52');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('d', 'M13 26 l10 10 20 -20');
  svg.appendChild(path);

  button.classList.add('LcoyFeedback');
  button.append(alert, svg);

  // 在下一帧，以便透明度过渡发生。
  requestAnimationFrame(() => button.classList.add('LcoyFeedback--activated', 'LcoyFeedback--transition'));

  window.setTimeout(() => button.classList.remove('LcoyFeedback--activated'), TIMEOUT - TRANSITION_BUFFER);
  window.setTimeout(() => {
    alert.remove();
    svg.remove();
    button.classList.remove('LcoyFeedback--transition');
  }, TIMEOUT);
}

function waitForCopied(button: HTMLElement) {
  const started = performance.now();

  const check = () => {
    if (!button.isConnected) return;

    if (button.classList.contains('LcoyPostAction--copied')) {
      postActionFeedback(button, t('motion.link_copied'));
    } else if (performance.now() - started < WAIT_MS) {
      requestAnimationFrame(check);
    }
  };

  requestAnimationFrame(check);
}

export default function installFeedback() {
  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest?.('.LcoyPostAction--share');

    if (button instanceof HTMLElement) waitForCopied(button);
  });
}
