/*
 * 编辑器各功能共用的部分：管理员的开关，以及在其它扩展之后
 * 扩展编辑器工具栏的方式。
 */
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import type ComposerState from 'flarum/forum/states/ComposerState';
import type EditorDriverInterface from 'flarum/common/utils/EditorDriverInterface';

import { forumBool } from '../../utils/settings';

export type ComposerFeature = 'Similar' | 'Hashtags' | 'Drafts' | 'LinkedTopic' | 'Preview';

/**
 * 编辑器功能当前是否启用。每次使用时读取，而非在 install 时读取：
 * initializer 阶段 `app.forum` 尚不存在，且管理员可能更改该选项。
 */
export function composerOn(feature: ComposerFeature): boolean {
  return forumBool('lcoyComposerEnabled', true) && forumBool(`lcoyComposer${feature}`, true);
}

type ToolbarHook = (this: TextEditor, items: any) => void;

const lateToolbarHooks: ToolbarHook[] = [];
let lateHooksInstalled = false;

/**
 * 在所有扩展之后扩展 `TextEditor#toolbarItems`。
 *
 * 扩展 initializer 的执行顺序并无保证，因此该钩子只在编辑器的
 * 首次 `oninit` 时挂载：此时所有 initializer 均已运行，我们的
 * 钩子排在最后。
 */
export function extendToolbarLate(hook: ToolbarHook): void {
  lateToolbarHooks.push(hook);

  if (lateHooksInstalled) return;
  lateHooksInstalled = true;

  let applied = false;

  extend(TextEditor.prototype, 'oninit', function () {
    if (applied) return;
    applied = true;

    extend(TextEditor.prototype, 'toolbarItems', function (this: TextEditor, items) {
      lateToolbarHooks.forEach((fn) => fn.call(this, items));
    });
  });
}

/**
 * 某个 TextEditor 的 ComposerState。核心的 TextEditor 是 JS 编写，
 * 其 attrs 以无类型方式到达 TypeScript；类型断言只写在此处。
 */
export function editorComposer(editor: TextEditor): ComposerState | null {
  return ((editor.attrs as any)?.composer as ComposerState | undefined) ?? null;
}

/** 编辑器驱动（textarea，或其他扩展的富文本编辑器）。 */
export function editorDriver(editor: TextEditor): EditorDriverInterface | null {
  return editorComposer(editor)?.editor ?? null;
}
