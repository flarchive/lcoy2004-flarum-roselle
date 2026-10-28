/*
 * Discourse 风格的草稿，由 fof/drafts 保存。
 *
 * - 新主题 composer 和回复 composer 在用户停止输入两秒后自动保存
 *   （fof 的自动保存是可选项且默认关闭；在偏好设置中启用了它的
 *   用户沿用其设置）。
 * - 在有草稿的主题中回复会恢复该草稿。
 * - 含文本时关闭会询问丢弃/保存/继续；切换 composer 则直接保存，
 *   不做询问。
 * - 没有保存按钮（fof 的软盘按钮会从控制项中移除）：编辑器页脚
 *   以低调方式显示“保存中……”/“草稿已保存”，失败时给出提示。
 * - 列表位于“发起主题”按钮的“⌄”、用户菜单以及个人资料页的
 *   “草稿”标签中。
 *
 * 一切都取决于 `draftsOn()`：未启用 fof-drafts 时均不显示。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import ComposerState from 'flarum/forum/states/ComposerState';
import TextEditor from 'flarum/common/components/TextEditor';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import Icon from 'flarum/common/components/Icon';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import DraftsUserPage from './DraftsUserPage';
import {
  allDrafts,
  discardCurrentDraft,
  draftChanged,
  draftCount,
  draftableBody,
  draftStatus,
  draftsLoaded,
  draftsOn,
  hasContent,
  loadDrafts,
  replyDraftDiscussionId,
  saveCurrentDraft,
} from './fofDrafts';
import { editorComposer } from '../common';
import { t } from '../../../utils/settings';

const SAVE_DELAY = 2000;
const TICK = 500;

/** 在偏好设置中启用了 fof 自动保存的用户沿用其设置（避免重复保存）。 */
function fofAutosave(): boolean {
  return !!(app.session.user as any)?.preferences?.()?.draftAutosaveEnable;
}

/**
 * 自动保存：每半秒比较 composer 中的内容；两秒无变化且存在新内容时
 * 写入。正在发送时不写入（fof 在发布时会删除草稿）。
 */
function startAutosave(body: any): () => void {
  let lastContent = '';
  let lastTitle = '';
  let lastTags = '';
  let dueAt = 0;
  let saving = false;
  const composerBody = app.composer.body;

  const timer = setInterval(() => {
    if (app.composer.body !== composerBody || body.loading || !draftsOn() || fofAutosave()) {
      dueAt = 0;
      return;
    }

    const fields: any = app.composer.fields || {};
    const content = fields.content?.() || '';
    const title = fields.title?.() || '';
    const tags = (fields.tags || []).map((tag: any) => tag?.id?.()).join(',');

    if (content !== lastContent || title !== lastTitle || tags !== lastTags) {
      lastContent = content;
      lastTitle = title;
      lastTags = tags;
      dueAt = Date.now() + SAVE_DELAY;
      return;
    }

    if (dueAt && Date.now() >= dueAt && !saving && draftChanged()) {
      dueAt = 0;
      saving = true;
      saveCurrentDraft().finally(() => (saving = false));
    }
  }, TICK);

  return () => clearInterval(timer);
}

/**
 * 打开的回复尚未选择草稿：若用户在该主题中有草稿，composer 会恢复它
 * （Discourse 也是如此）。打开时插入的引用不会被覆盖。
 */
function restoreReplyDraft(body: any): void {
  const discussion = body.attrs?.discussion;
  const composer: any = app.composer;
  const composerBody = composer.body;

  if (!discussion || body.attrs?.draft || !composer.bodyMatches('flarum/forum/components/ReplyComposer')) return;

  const run = (editorBuilt: boolean) => {
    if (composer.body !== composerBody || composer.draft) return;

    const draft = allDrafts().find((item) => item.type() === 'reply' && replyDraftDiscussionId(item) === String(discussion.id()));

    if (!draft || (composer.fields.content() || '').trim()) return;

    const content = draft.content() || '';

    composer.draft = draft;

    if (editorBuilt && composer.editor) composer.editor.insertBetween(0, composer.fields.content().length, content, false);
    else composer.fields.content(content);

    m.redraw();
  };

  if (draftsLoaded()) run(false);
  else if (draftCount() > 0)
    loadDrafts()
      .then(() => composer.editorReady())
      .then(() => run(true));
}

function confirmClose(composer: ComposerState): void {
  app.modal.show(() => import('./DraftCloseModal'), {
    ondiscard: () => {
      discardCurrentDraft();
      composer.hide();
    },
    onsave: () => {
      saveCurrentDraft();
      composer.hide();
    },
  });
}

let draftControlInstalled = false;

export default function installDrafts() {
  // 路由始终存在（initializer 在论坛加载配置之前运行）；没有草稿时，
  // 该页面会跳转到帖子页。
  app.routes['user.drafts'] = {
    path: '/u/:username/drafts',
    component: DraftsUserPage,
    resolverClass: UserPageResolver,
  } as any;

  // 按模块名扩展：ComposerBody 位于按需加载的 chunk 中。
  extend('flarum/forum/components/ComposerBody' as any, 'oninit', function (this: any) {
    if (!draftsOn() || !draftableBody()) return;

    (app.composer as any).lcoyDraftError = false;
    this.lcoyStopAutosave = startAutosave(this);
    restoreReplyDraft(this);
  });

  extend('flarum/forum/components/ComposerBody' as any, 'onremove', function (this: any) {
    this.lcoyStopAutosave?.();
  });

  // 切换 composer（打开另一个回复、新主题）不做任何询问：
  // 文本会作为草稿保存。
  override(ComposerState.prototype, 'preventExit', function (this: ComposerState, original: () => boolean | void) {
    if (this.isVisible() && draftsOn() && hasContent()) {
      saveCurrentDraft();
      return false;
    }

    return original();
  });

  override(ComposerState.prototype, 'close', function (this: ComposerState, original: () => void) {
    if (!draftsOn() || !this.isVisible() || !draftableBody()) return original();

    if (hasContent()) {
      confirmClose(this);
      return;
    }

    // 文本已全部删除：草稿不再存在，与 Discourse 一致。
    discardCurrentDraft();
    this.hide();
  });

  // fof 会在 composer 控制项中放置一个软盘（“保存草稿”）。Discourse
  // 没有该按钮：而是自动保存。fof 的 initializer 在主题之后运行，
  // 因此在 `mount` 中注册移除操作，排在其后。
  override(app as any, 'mount', function (this: any, original: (...args: any[]) => unknown, ...args: any[]) {
    if (!draftControlInstalled) {
      draftControlInstalled = true;

      extend('flarum/forum/components/Composer' as any, 'controlItems', function (items: ItemList<Mithril.Children>) {
        if (items.has('save-draft')) items.remove('save-draft');
      });
    }

    return original(...args);
  });

  // 编辑器页脚：Discourse 的 `#draft-status`，低调显示——“保存中……”，
  // “草稿已保存”持续几秒，或错误信息。
  extend(TextEditor.prototype, 'controlItems', function (this: TextEditor, items: ItemList<Mithril.Children>) {
    const status = draftStatus();

    if (!draftsOn() || editorComposer(this) !== app.composer || !draftableBody() || !status) return;

    const label = t(`composer.drafts.status_${status}`);
    const icon = status === 'error' ? 'fas fa-triangle-exclamation' : status === 'saved' ? 'fas fa-check' : null;

    items.add(
      'lcoyDraft',
      <span className={`LcoyDraftStatus LcoyDraftStatus--${status}`} role={status === 'error' ? 'alert' : 'status'} title={label}>
        {icon && <Icon name={icon} />}
        <span className="LcoyDraftStatus-label">{label}</span>
      </span>,
      -100
    );
  });

  extend(SessionDropdown.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    if (!user || !draftsOn()) return;

    const count = draftCount();

    items.add(
      'lcoyDrafts',
      <LinkButton icon="fas fa-pen-ruler" href={app.route('user.drafts', { username: user.slug() })}>
        {t('composer.drafts.nav')}
        {count > 0 && <span className="LcoyDrafts-count">{count}</span>}
      </LinkButton>,
      // 紧接在“个人资料”（100）之后、“设置”（50）之前。
      90
    );
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!this.user || this.user !== app.session.user || !draftsOn()) return;

    const count = draftCount();

    items.add(
      'lcoyDrafts',
      <LinkButton href={app.route('user.drafts', { username: this.user.slug() })} icon="fas fa-pen-ruler">
        {t('composer.drafts.nav')}
        {/* “草稿 (2)”，与 Discourse 的子标签一致。 */}
        {count > 0 && ` (${count})`}
      </LinkButton>,
      // 位于帖子（100）和主题（90）之后，其他扩展的标签之前。
      70
    );
  });
}
