/*
 * 输入目标：字段、下拉框和可编辑区域。主题和 Discourse 的键盘
 * 快捷键会检查它，以免抢走正在输入的人的按键。
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable]');
}
