/*
 * 在主题头部直接编辑标题，与 Discourse 一致：标题旁的铅笔
 *（有重命名权限的人可见）把标题换成输入框，旁边是分类/标签按钮，
 * 以及保存或放弃的“✓”/“✕”。Enter 保存，Esc 放弃。
 *
 * 核心只能通过窗口重命名（RenameDiscussionModal），并通过另一个窗口修改
 * 标签；这里的输入框属于主题，标签仍通过 flarum/tags 的窗口修改，
 * 由主题菜单所用的同一个条目打开。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

interface EditState {
  id: string;
  title: string;
  saving: boolean;
}

let editing: EditState | null = null;

/** flarum/tags 放在管理控制项中的“编辑标签”条目。 */
function tagsControl(discussion: Discussion): any {
  const controls = DiscussionControls.moderationControls(discussion);

  return controls.has('tags') ? controls.get('tags') : null;
}

function start(discussion: Discussion): void {
  // 模型的原始标题：title() 可能来自语言扩展的自动翻译。
  editing = { id: String(discussion.id()), title: discussion.attribute<string>('title'), saving: false };
  m.redraw();
}

function cancel(): void {
  editing = null;
  m.redraw();
}

function save(discussion: Discussion): void {
  if (!editing || editing.saving) return;

  const title = editing.title.trim();

  // 标题为空或未变：无需保存，直接关闭。
  if (!title || title === discussion.attribute<string>('title')) {
    cancel();
    return;
  }

  editing.saving = true;

  discussion
    .save({ title })
    .then(() => {
      editing = null;

      // “重命名了主题”的事件帖子进入 stream，与核心的弹窗一致。
      const stream = app.current.get('stream');
      if (stream && typeof stream.update === 'function') stream.update();
    })
    .catch(() => {
      if (editing) editing.saving = false;
    })
    .finally(() => m.redraw());
}

function editorView(discussion: Discussion): Mithril.Children {
  const state = editing!;
  const tags = tagsControl(discussion);

  return (
    <form
      className="LcoyTitleEditor"
      onsubmit={(event: SubmitEvent) => {
        event.preventDefault();
        save(discussion);
      }}
    >
      <input
        className="FormControl LcoyTitleEditor-input"
        value={state.title}
        disabled={state.saving}
        aria-label={t('gaps.title_editor.label')}
        oninput={(event: InputEvent) => (state.title = (event.target as HTMLInputElement).value)}
        onkeydown={(event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        oncreate={(vnode: Mithril.VnodeDOM) => {
          const input = vnode.dom as HTMLInputElement;
          input.focus();
          input.select();
        }}
      />
      <div className="LcoyTitleEditor-actions">
        {tags && (
          <Button
            className="Button LcoyTitleEditor-tags"
            icon="fas fa-tag"
            type="button"
            disabled={state.saving}
            onclick={() => tags.attrs?.onclick?.()}
          >
            {t('gaps.title_editor.tags')}
          </Button>
        )}
        <Button
          className="Button Button--primary Button--icon LcoyTitleEditor-save"
          icon="fas fa-check"
          type="submit"
          loading={state.saving}
          aria-label={t('gaps.title_editor.save')}
          title={t('gaps.title_editor.save')}
        />
        <Button
          className="Button Button--icon LcoyTitleEditor-cancel"
          icon="fas fa-xmark"
          type="button"
          disabled={state.saving}
          aria-label={t('gaps.title_editor.cancel')}
          title={t('gaps.title_editor.cancel')}
          onclick={cancel}
        />
      </div>
    </form>
  );
}

export default function installTitleEditor(): void {
  extend(DiscussionHero.prototype, 'items', function (this: DiscussionHero, items: ItemList<Mithril.Children>) {
    const discussion = this.attrs.discussion;

    if (!gaps.titleEditor() || !discussion || !items.has('title')) return;

    // 编辑期间打开了另一个主题：旧的编辑在这里无效。
    if (editing && editing.id !== String(discussion.id())) editing = null;

    if (editing) {
      items.setContent('title', editorView(discussion));

      // 编辑时，分类和标签那一行让位给它们的按钮，
      // 与 Discourse 一致。
      if (items.has('lcoyBadges')) items.remove('lcoyBadges');

      return;
    }

    if (!discussion.canRename()) return;

    const title = items.get('title') as any;

    items.setContent(
      'title',
      <div className="LcoyTitleEditor-display">
        {title}
        <Button
          className="Button Button--icon Button--link LcoyTitleEditor-edit"
          icon="fas fa-pencil"
          aria-label={t('gaps.title_editor.edit')}
          title={t('gaps.title_editor.edit')}
          onclick={() => start(discussion)}
        />
      </div>
    );
  });
}
