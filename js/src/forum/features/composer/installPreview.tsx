/*
 * 编辑器旁的预览，与 Discourse 一致：在桌面端，输入时右侧会显示
 * 格式化后的文本。composer 角落的 « 按钮（与全屏、最小化并列，
 * 类似 Discourse 的 `toggle-preview`）可隐藏或显示预览，选择会
 * 保存在浏览器中。
 *
 * 预览使用核心的 ComposerPostPreview（与服务端相同的格式化器，
 * 以 JS 实现），因此提及、emoji 和 markdown 的显示与发布后的
 * 帖子一致。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import type ComposerBody from 'flarum/forum/components/ComposerBody';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { composerOn } from './common';
import { t } from '../../utils/settings';
import { richMode } from '../../composer/installToolbar';

const STORAGE_KEY = 'lcoy.composerPreview';

let memoryPreference = true;

export function preferred(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    // Markdown 模式下预览默认展开，与 Discourse 一致。
    return value === null ? true : value === '1';
  } catch {
    return memoryPreference;
  }
}

export function setPreferred(value: boolean): void {
  memoryPreference = value;

  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // 仅在离开页面前有效。
  }
}

/**
 * composer 现在需要容纳两列：桌面端、展开或全屏。`app.screen()` 从
 * 1200px 起返回 "desktop-hd"——只与 "desktop" 比较会让宽屏恰好缺少
 * 预览。高度不计入判断：Discourse 在较矮的 composer（255px）中也会
 * 分栏。
 */
export function splitPossible(): boolean {
  const composer = app.composer;
  const screen = app.screen();

  // 仅限 Markdown 模式：在“A”（富文本）模式下 Discourse 没有预览列。
  if (!composerOn('Preview') || richMode() || (screen !== 'desktop' && screen !== 'desktop-hd') || !composer.isVisible()) return false;

  return composer.position === 'normal' || composer.position === 'fullScreen';
}

export function splitPreviewVisible(): boolean {
  return splitPossible() && preferred();
}

/** 在 vdom 中按类名深度查找节点。 */
function findByClass(vnode: any, className: string): any {
  if (!vnode || typeof vnode !== 'object') return null;
  if (Array.isArray(vnode)) {
    for (const child of vnode) {
      const found = findByClass(child, className);
      if (found) return found;
    }
    return null;
  }

  const classes = String(vnode.attrs?.className || vnode.attrs?.class || '').split(/\s+/);

  if (classes.includes(className)) return vnode;

  return findByClass(vnode.children, className);
}

/**
 * 核心的 ComposerPostPreview，在渲染时动态获取：它位于 composer 的
 * 同一 chunk 中，按需加载，在文件顶部 import 会在启动时解析为
 * `undefined`。
 */
function previewComponent(): any {
  return flarum.reg.get('core', 'forum/components/ComposerPostPreview');
}

export default function installPreview() {
  // 编辑器位于 `.ComposerBody-editor` 内；预览插入其旁边，
  // 位于同一个盒子中。修改已生成的 vdom 可避免重写 ComposerBody 的
  // view（以及其他扩展向其添加的内容）。
  // 按模块名扩展：ComposerBody 位于按需加载的 chunk 中。
  extend('flarum/forum/components/ComposerBody' as any, 'view', function (this: ComposerBody, vdom: Mithril.Children) {
    if (!splitPreviewVisible()) return;

    const editor = findByClass(vdom, 'ComposerBody-editor');

    if (!editor || !Array.isArray(editor.children)) return;

    editor.attrs.className = `${editor.attrs.className} LcoyComposer-split`;

    // 无 `key`：其同级 TextEditor 也没有，而 Mithril 不接受混合有 key
    // 和无 key 节点的列表（此前打开预览会使 composer 出错）。始终最后
    // 插入，因此编辑器的位置不变。
    editor.children.push(
      <div className="LcoyComposerPreview" aria-label={t('composer.preview.label')}>
        <div className="LcoyComposerPreview-scroll">
          {m(previewComponent(), { className: 'Post-body LcoyComposerPreview-body', composer: app.composer })}
        </div>
      </div>
    );
  });
}

/**
 * Discourse 的 « 按钮（`toggle-preview`）：位于 composer 角落，
 * 在全屏和最小化之前。预览隐藏时箭头会（由 CSS）旋转，与
 * Discourse 一致。
 */
export function previewToggle(): Mithril.Children {
  const visible = preferred();
  const label = visible ? t('composer.preview.hide') : t('composer.preview.show');

  return (
    <Button
      className={`Button Button--icon Button--link LcoyComposerPreview-toggle${visible ? '' : ' active'}`}
      icon="fas fa-angles-left"
      title={label}
      aria-label={label}
      aria-pressed={visible ? 'true' : 'false'}
      onclick={() => setPreferred(!visible)}
    />
  );
}
