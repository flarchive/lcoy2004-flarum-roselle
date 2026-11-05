/*
 * 编辑器各功能共用的部分：管理员的开关，以及在其它扩展之后
 * 扩展编辑器工具栏的方式。
 */
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
