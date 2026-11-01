/*
 * Flarum 编辑器，采用 Discourse 编辑器（meta.discourse.org 使用的
 * 改版，`uc-enable-composer-redesign`）的形态：
 *
 *   拖柄 · "发起讨论" / "主题 ▾" ............ «  ⤢  —  ✕
 *   分类 ▾                      | 🏷 可选标签 ▾
 *   标题
 *   文本                        | 预览
 *   B I H 🔗 " </> … 😀 ............ 丢弃  [创建主题]
 *
 * 行为仍由核心负责（打开、调整大小、最小化、
 * 全屏、提交）; 这里只更换 ItemList 中的项和类名
 * —— 布局由 CSS 负责（`less/forum/Composer.less`）。
 *
 * Composer、DiscussionComposer、ReplyComposer 和 EditPostComposer 位于按需
 * 加载的 chunk 中：按模块名扩展。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import ComposerState from 'flarum/forum/states/ComposerState';
import TextEditor from 'flarum/common/components/TextEditor';
import Button from 'flarum/common/components/Button';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ComposerActionTitle from './ComposerActionTitle';
import ComposerFields from './ComposerFields';
import { missingTagsMessage, normalizeTags, selectableTags, type RuleTag } from './tagRules';
import installModals from './installModals';
import installTagModal from './tagModal';
import installAlignComposer from './alignComposer';
import installToolbar, { addMoreAction, richMode, setPlaceholderProvider } from './installToolbar';
import { editorComposer } from '../features/composer/common';
import { draftableBody, draftsOn, saveCurrentDraft } from '../features/composer/drafts/fofDrafts';
import { previewToggle, splitPossible, splitPreviewVisible } from '../features/composer/installPreview';
import { isExtensionEnabled, t } from '../utils/settings';

const REPLY = 'flarum/forum/components/ReplyComposer';
const EDIT = 'flarum/forum/components/EditPostComposer';
const DISCUSSION = 'flarum/forum/components/DiscussionComposer';

/** Discourse 的初始高度：回复 255px，其余 400px。 */
function defaultHeight(): number {
  return app.composer.bodyMatches(REPLY) ? 255 : 400;
}

/** 用户已经拖动过拖柄：其高度对所有编辑器生效。 */
function hasStoredHeight(): boolean {
  try {
    return !!localStorage.getItem('composerHeight');
  } catch {
    return false;
  }
}

function kindClass(): string {
  if (app.composer.bodyMatches(REPLY)) return 'LcoyComposer--reply';
  if (app.composer.bodyMatches(EDIT)) return 'LcoyComposer--edit';
  if (app.composer.bodyMatches(DISCUSSION)) return 'LcoyComposer--newTopic';

  return 'LcoyComposer--other';
}

/** 把内容放入某个键（替换已有内容），使用给定优先级。 */
function put(items: ItemList<Mithril.Children>, key: string, content: Mithril.Children, priority: number): void {
  if (items.has(key)) items.setContent(key, content).setPriority(key, priority);
  else items.add(key, content, priority);
}

function controlButton(icon: string, label: string, onclick: () => void, className = ''): Mithril.Children {
  return (
    <Button
      className={`Button Button--icon Button--link LcoyComposer-control ${className}`}
      icon={icon}
      title={label}
      aria-label={label}
      onclick={onclick}
    />
  );
}

/**
 * Discourse 的 ✕ 是 "保存并关闭"：有草稿时保存文本并直接关闭，
 * 不再询问。没有草稿时，与核心一样关闭（有文本时会询问）。
 */
function saveAndClose(): void {
  if (draftsOn() && draftableBody()) {
    saveCurrentDraft();
    app.composer.hide();
  } else {
    app.composer.close();
  }
}

/**
 * Discourse 的占位文本，随模式变化："A" 模式下为 "在此输入。使用
 * 工具栏或 Markdown 进行格式化。"；Markdown 模式下为 "在此输入。
 * 使用 Markdown、BBCode 或 HTML 进行格式化。" —— 这里只列出
 * 本论坛已启用的格式。"拖放或粘贴图片。" 仅在装有
 * fof/upload 时出现，由它接收拖放和粘贴。
 */
function bodyPlaceholder(rich: boolean = richMode()): string {
  const formats = [isExtensionEnabled('flarum-markdown') && 'Markdown', isExtensionEnabled('flarum-bbcode') && 'BBCode'].filter(Boolean) as string[];
  const upload = isExtensionEnabled('fof-upload') && !!app.forum.attribute('fof-upload.canUpload');
  const or = ` ${t('composer.shell.or')} `;

  let text: string;

  if (rich && formats.includes('Markdown')) text = t('composer.shell.body_placeholder_markdown');
  else if (formats.length) text = t('composer.shell.body_placeholder_formats', { formats: formats.join(or) });
  else text = t('composer.shell.body_placeholder');

  return upload ? `${text} ${t('composer.shell.drag_images')}` : text;
}

/**
 * Discourse 的标签（"发起讨论"、"回复"、"保存编辑"）和
 * 占位文本，仅在打开编辑器的人未传入自己的值时才使用。
 */
function installLabels(): void {
  const labels: Array<[string, string]> = [
    ['forum/components/DiscussionComposer', 'composer.shell.submit_new_topic'],
    ['forum/components/ReplyComposer', 'composer.shell.submit_reply'],
    ['forum/components/EditPostComposer', 'composer.shell.submit_edit'],
  ];

  labels.forEach(([id, submitKey]) => {
    flarum.reg.onLoad('core', id, (module: any) => {
      override(module, 'initAttrs', function (this: any, original: (attrs: any) => void, attrs: any) {
        attrs.submitLabel = attrs.submitLabel || t(submitKey);
        attrs.placeholder = attrs.placeholder || bodyPlaceholder();
        if (id.endsWith('DiscussionComposer')) attrs.titlePlaceholder = attrs.titlePlaceholder || t('composer.shell.title_placeholder');

        return original(attrs);
      });
    });
  });
}

function installHeights(): void {
  override(ComposerState.prototype, 'minimumHeight', () => 255);

  // Composer 在挂载时只读取一次默认高度；之后打开的编辑器
  // 会继承前一个的高度。Discourse 每次打开都重新决定。
  override(ComposerState.prototype, 'load', async function (this: ComposerState, original: (...args: any[]) => Promise<any>, ...args: any[]) {
    const result = await original(...args);

    if (!hasStoredHeight() && this.body?.componentClass) this.height = defaultHeight();

    return result;
  });

  override('flarum/forum/components/Composer' as any, 'defaultHeight', () => defaultHeight());
}

function installRoot(): void {
  // CSS 所需的类名：编辑器类型，以及预览是否
  // 位于侧边（`show-preview` / `hide-preview`，会改变宽度）。
  extend('flarum/forum/components/Composer' as any, 'view', function (vdom: any) {
    if (!vdom?.attrs) return;

    const rich = richMode();

    vdom.attrs.className = `${vdom.attrs.className} LcoyComposer ${kindClass()} ${splitPreviewVisible() && !rich ? 'show-preview' : 'hide-preview'}${rich ? ' is-rich' : ' is-markdown'}`;
  });

  // «、全屏、最小化和 ✕ —— Discourse 的顺序和图标。最小化后
  // 只有 ✕，位于彩色栏之上。
  extend('flarum/forum/components/Composer' as any, 'controlItems', function (items: ItemList<Mithril.Children>) {
    const state = app.composer;
    const phone = app.screen() === 'phone';
    const closeLabel =
      draftsOn() && draftableBody()
        ? t('composer.shell.save_and_close')
        : (app.translator.trans('core.forum.composer.close_tooltip', {}, true) as string);

    if (state.position === 'minimized') {
      put(items, 'close', controlButton('fas fa-xmark', closeLabel, saveAndClose), 10);
      return;
    }

    // Discourse 角落的图标：全屏、最小化和关闭 —— 在
    // Markdown 模式下，还有它们之前的预览 «。其他扩展在此放置的
    // 内容会被移除。
    Object.keys(items.toObject()).forEach((key) => {
      if (!['fullScreen', 'minimize', 'close'].includes(key)) items.remove(key);
    });

    if (splitPossible()) put(items, 'lcoyPreview', previewToggle(), 40);

    if (!phone) {
      put(
        items,
        'fullScreen',
        state.position === 'fullScreen'
          ? controlButton('fas fa-compress', app.translator.trans('core.forum.composer.exit_full_screen_tooltip', {}, true) as string, () =>
              state.exitFullScreen()
            )
          : controlButton('fas fa-expand', app.translator.trans('core.forum.composer.full_screen_tooltip', {}, true) as string, () =>
              state.fullScreen()
            ),
        30
      );
    }

    // 没有核心的 `App-backControl`，它在移动端会变成页眉的
    // "返回"：Discourse 的移动端编辑器在同一行显示 — 和 ✕。
    put(
      items,
      'minimize',
      controlButton('fas fa-minus', app.translator.trans('core.forum.composer.minimize_tooltip', {}, true) as string, () => state.minimize()),
      20
    );

    put(items, 'close', controlButton('fas fa-xmark', closeLabel, saveAndClose), 10);
  });
}

/**
 * 页眉。进入第一个编辑器主体，位于所有扩展之后：
 * 这样它们放入的项（标签、fof/polls 的投票）在被替换时
 * 已经存在于列表中。
 */
function installHeader(): void {
  // fof/polls 的投票：页眉的 "添加投票" 按钮变成工具栏 ⊕ 菜单中的
  // 一项，与 Discourse 的 "创建投票" 相同。
  addMoreAction(() => {
    const poll = (app.composer as any).lcoyPoll;

    if (!poll || !app.composer.isVisible()) return null;

    return {
      key: 'poll',
      icon: 'fas fa-square-poll-horizontal',
      label: poll.hasPoll ? t('composer.shell.edit_poll') : t('composer.shell.add_poll'),
      active: poll.hasPoll,
      onclick: poll.onclick,
    };
  });

  const takePoll = (body: any, items: ItemList<Mithril.Children>) => {
    const poll: any = items.has('polls') ? items.get('polls') : null;

    (app.composer as any).lcoyPoll = poll?.attrs?.onclick ? { onclick: poll.attrs.onclick, hasPoll: !!body.composer?.fields?.poll } : null;
    if (poll) items.remove('polls');
  };

  let applied = false;

  extend('flarum/forum/components/ComposerBody' as any, 'oninit', function () {
    if (applied) return;
    applied = true;

    extend(DISCUSSION as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      put(items, 'title', <ComposerActionTitle kind="new_topic" title={this.title} />, 1000);

      // flarum/tags 的按钮变成 "分类 | 标签" 这一行。
      if (items.has('tags')) {
        const original: any = items.get('tags');
        const disabled = String(original?.attrs?.className || '').includes('disabled') || !!this.attrs.disabled;

        // 从外部传入的标签（标签页、草稿、关联主题）
        // 要经过 flarum/tags 的规则：不含孤立子标签，
        // 也不含操作者无权发起讨论的标签。
        const current: RuleTag[] = this.composer.fields.tags || [];
        const allowed = normalizeTags(current.filter((tag) => tag?.canStartDiscussion?.() !== false));
        if (allowed.length !== current.length) this.composer.fields.tags = allowed;

        put(
          items,
          'tags',
          <ComposerFields
            tags={allowed}
            disabled={disabled}
            onchange={(tags: any[]) => {
              this.composer.fields.tags = tags;
            }}
          />,
          500
        );
      }

      takePoll(this, items);
    });

    extend(REPLY as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      put(items, 'title', <ComposerActionTitle kind="reply" discussion={this.attrs.discussion} />, 1000);
      takePoll(this, items);
    });

    extend(EDIT as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      put(items, 'title', <ComposerActionTitle kind="edit" post={this.attrs.post} />, 1000);
      takePoll(this, items);
    });
  });
}

/**
 * 发布时校验 flarum/tags 的标签下限（`minPrimaryTags`、`minSecondaryTags`），
 * 使用 flarum/tags 自己的提示信息，并打开尚未填写的
 * 选择器。没有这段逻辑，flarum/tags 会打开它自己的弹窗，
 * 而主题已用编辑器中的一行取代了该弹窗。它在 flarum/tags 的 override
 * 之外（后者先初始化）：传给它的只会是有效的选择。
 */
function installTagRequirements(): void {
  override(DISCUSSION as any, 'onsubmit', function (this: any, original: (...args: unknown[]) => unknown, ...args: unknown[]) {
    if (!isExtensionEnabled('flarum-tags')) return original(...args);

    const tags = normalizeTags((this.composer.fields.tags || []) as RuleTag[]);
    this.composer.fields.tags = tags;

    const missing = selectableTags().length ? missingTagsMessage(tags) : null;
    if (!missing) return original(...args);

    app.alerts.show({ type: 'error' }, missing.message);

    const cell = missing.kind === 'primary' ? 'category' : 'tags';
    const chooser = document.querySelector(`.LcoyComposerFields-${cell}:not(.is-expanded) .LcoySelectKit-header`) as HTMLElement | null;
    chooser?.click();

    return undefined;
  });
}

function installFooter(): void {
  // Discourse 的页脚：左侧是格式工具栏，右侧是
  // "丢弃" 和没有图标的主按钮。
  extend(TextEditor.prototype, 'controlItems', function (this: TextEditor, items: ItemList<Mithril.Children>) {
    if (!editorComposer(this) || editorComposer(this) !== app.composer) return;

    const attrs = this.attrs as any;

    // 核心的预览 "眼睛"：主题已经在侧边显示预览。
    if (items.has('preview')) items.remove('preview');

    if (items.has('submit')) {
      items.setContent(
        'submit',
        // 没有核心的 `App-primaryControl`：在移动端，这个类会把
        // 按钮移到页眉并隐藏标签；在 Discourse 中它留在
        // 页脚，以文字形式显示。
        <Button className="Button Button--primary LcoyComposer-submit" onclick={() => (this as any).onsubmit()}>
          {attrs.submitLabel}
        </Button>
      );
    }

    const editing = app.composer.bodyMatches(EDIT);

    items.add(
      'lcoyCancel',
      <Button className="Button Button--link LcoyComposer-cancel" onclick={() => app.composer.close()}>
        {editing ? t('composer.shell.cancel_edit') : t('composer.shell.discard')}
      </Button>,
      -200
    );

    // 在能侧边显示预览的地方（即使被 « 隐藏），核心的 "眼睛"
    // —— 指向主题内预览 —— 就是多余的：Discourse 没有它。
    if (splitPossible() && items.has('preview')) items.remove('preview');
  });
}

export default function installComposerShell() {
  setPlaceholderProvider(bodyPlaceholder);
  installLabels();
  installHeights();
  installRoot();
  installHeader();
  installTagRequirements();
  installFooter();
  installToolbar();
  // 登录/注册弹窗（UI 外壳与编辑器外壳放在一起）。
  installModals();
  // 按编辑器标签选择器的外观绘制 flarum/tags 的标签弹窗。
  installTagModal();
  installAlignComposer();
}
