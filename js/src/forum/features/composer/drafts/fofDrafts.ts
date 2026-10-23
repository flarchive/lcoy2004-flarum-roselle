/*
 * 主题与 fof/drafts 之间的桥接：草稿存放在该扩展的 `drafts` 模型中
 * （API `/api/drafts`，列表在 `app.drafts`，计数在
 * `user.draftCount`）。主题只负责按 Discourse 风格绘制——“发起主题”
 * 按钮的“⌄”、个人资料页标签、自动保存以及关闭时的“丢弃”。
 *
 * 未启用 fof-drafts 时，`draftsOn()` 为假，以上内容均不显示。
 */
import app from 'flarum/forum/app';
import { truncate } from 'flarum/common/utils/string';
import type Discussion from 'flarum/common/models/Discussion';

import { composerOn } from '../common';
import { t } from '../../../utils/settings';

/** fof/drafts 的 `Draft` 模型（仅主题用到的部分）。 */
export interface FofDraft {
  id(): string | undefined;
  exists: boolean;
  title(): string | null;
  content(): string;
  updatedAt(): Date | null | undefined;
  type(): 'reply' | 'privateDiscussion' | 'discussion';
  icon(): string;
  relationships(): Record<string, any> | null;
  loadRelationships(force?: boolean): Record<string, any>;
  save(data: Record<string, unknown>): Promise<FofDraft>;
  delete(body?: unknown, options?: unknown): Promise<void>;
}

interface FofDraftsState {
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  load(): void;
  loadMore(): void;
  deleteDraft(draft: FofDraft): void;
  showComposer(draft: FofDraft): Promise<unknown> | undefined;
}

export function fofDraftsInstalled(): boolean {
  return 'fof-drafts' in flarum.extensions;
}

/** 草稿当前可用：扩展已启用、用户已登录且有权限、主题管理后台中该功能已开启。 */
export function draftsOn(): boolean {
  return fofDraftsInstalled() && !!app.session.user && !!app.forum.attribute('canSaveDrafts') && composerOn('Drafts');
}

export function fofState(): FofDraftsState | null {
  return ((app as any).drafts as FofDraftsState | undefined) ?? null;
}

/** fof/drafts 只保存新主题和回复；编辑与 flarum/messages 的私信不保存。 */
export function draftableBody(): boolean {
  const composer = app.composer;

  return (
    !!composer.body?.componentClass &&
    (composer.bodyMatches('flarum/forum/components/DiscussionComposer') || composer.bodyMatches('flarum/forum/components/ReplyComposer'))
  );
}

export function draftsLoaded(): boolean {
  return !!(app.cache as any).draftsLoaded;
}

export function allDrafts(): FofDraft[] {
  return app.store
    .all<any>('drafts')
    .filter((draft: FofDraft) => draft.exists)
    .sort((a: FofDraft, b: FofDraft) => (b.updatedAt()?.getTime?.() ?? 0) - (a.updatedAt()?.getTime?.() ?? 0));
}

/** 用户拥有的草稿数：服务端已返回的数量，或此前用户对象上的计数。 */
export function draftCount(): number {
  if (draftsLoaded()) return allDrafts().length;

  const count = (app.session.user as any)?.attribute?.('draftCount');

  return typeof count === 'number' && count > 0 ? count : 0;
}

function adjustCount(delta: number): void {
  const attributes = (app.session.user as any)?.data?.attributes;

  if (attributes) attributes.draftCount = Math.max(0, (Number(attributes.draftCount) || 0) + delta);
}

/** 向 fof 请求第一页（每个会话一次），完成后返回。 */
export function loadDrafts(): Promise<void> {
  const state = fofState();

  if (!state || !draftsOn()) return Promise.resolve();
  if (draftsLoaded()) return Promise.resolve();

  state.load();

  // fof 的 `load()` 不返回 promise：等待 `loading` 变为 false。
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if ((!state.loading && draftsLoaded()) || Date.now() - started > 15000) {
        clearInterval(timer);
        resolve();
      }
    }, 150);
  });
}

// ---------------------------------------------------------------------
// 打开的 composer
// ---------------------------------------------------------------------

function relationshipRef(model: any): { type: string; id: string } | null {
  const id = typeof model?.id === 'function' ? model.id() : model?.id;
  const type = typeof model?.data?.type === 'function' ? model.data.type() : model?.data?.type || model?.type?.();

  return id && type ? { type: String(type), id: String(id) } : null;
}

/** 主体的 `data()`，采用 fof 的 API 格式（关系表示为 JSON:API 格式）。 */
function payload(raw: Record<string, any>): Record<string, unknown> {
  const data: Record<string, any> = { ...raw };

  delete data.scheduledValidationError;
  delete data.updatedAt;

  if (raw.relationships) {
    data.relationships = {};

    Object.keys(raw.relationships).forEach((name) => {
      const rel = raw.relationships[name];

      if (Array.isArray(rel)) data.relationships[name] = { data: rel.map(relationshipRef).filter(Boolean) };
      else if (rel && typeof rel === 'object') data.relationships[name] = { data: relationshipRef(rel) };
    });
  }

  return data;
}

/** 是否有内容可保存：fof 只会保存含文本的草稿。 */
export function hasContent(): boolean {
  return draftableBody() && !!(app.composer.fields?.content?.() || '').trim();
}

/** 自上次保存以来文本已改变（fof 放在 ComposerState 上的 `changed()`）。 */
export function draftChanged(): boolean {
  return draftableBody() && !!(app.composer as any).changed?.();
}

/**
 * 将打开的 composer 保存到 fof。与 fof 的 `saveDraft()` 不同，它会
 * 返回 promise，并且仅当 composer 仍是同一个时才把新建的草稿挂到
 * composer 上：保存后立即关闭不会让旧草稿留在下一个 composer 中
 * （否则后续保存会覆盖它）。
 */
export function saveCurrentDraft(): Promise<void> {
  const composer: any = app.composer;

  if (!draftsOn() || !draftChanged() || typeof composer.data !== 'function') return Promise.resolve();

  const body = composer.body;
  const data = payload(composer.data());
  const existing: FofDraft | null = composer.draft || null;

  // 保存前已被删除（在列表或另一个标签页中）：不要恢复它。
  if (existing && existing.id() && !existing.exists) return Promise.resolve();

  composer.saving = true;
  composer.lcoyDraftError = false;
  m.redraw();

  const request = existing ? existing.save(data) : (app.store.createRecord('drafts') as unknown as FofDraft).save(data);

  return request
    .then((saved: FofDraft) => {
      saved.loadRelationships(true);

      if (!existing) {
        adjustCount(1);
        if (composer.body === body) composer.draft = saved;
      }

      if (composer.body === body) composer.lcoyDraftSavedAt = Date.now();
    })
    .catch(() => {
      if (composer.body === body) composer.lcoyDraftError = true;
    })
    .finally(() => {
      composer.saving = false;
      m.redraw();
    });
}

/** 删除打开的 composer 对应的草稿（若存在）。 */
export function discardCurrentDraft(): Promise<void> {
  const composer: any = app.composer;
  const draft: FofDraft | null = composer.draft || null;

  composer.draft = null;

  if (!draft || !draft.exists) return Promise.resolve();

  return draft
    .delete()
    .then(() => {
      adjustCount(-1);
      m.redraw();
    })
    .catch(() => {});
}

/** 页脚的轻量状态：保存中、刚保存（3 秒内）或无。 */
export function draftStatus(): 'saving' | 'saved' | 'error' | null {
  const composer: any = app.composer;

  if (composer.lcoyDraftError) return 'error';
  if (composer.saving) return 'saving';
  if (composer.lcoyDraftSavedAt && Date.now() - composer.lcoyDraftSavedAt < 3000) return 'saved';

  return null;
}

// ---------------------------------------------------------------------
// 列表
// ---------------------------------------------------------------------

export function draftDiscussion(draft: FofDraft): Discussion | null {
  return (draft.loadRelationships().discussion as Discussion | null | undefined) || null;
}

export function replyDraftDiscussionId(draft: FofDraft): string | null {
  const ref = draft.relationships()?.discussion?.data;

  return ref?.id ? String(ref.id) : null;
}

const requested = new Set<string>();

/**
 * fof 不会在回复草稿中附带主题，而其标题正是列表所显示的内容
 * （“RE: …”）。逐个请求缺失的主题。
 */
export function ensureDiscussions(drafts: FofDraft[]): void {
  drafts.forEach((draft) => {
    const id = draft.type() === 'reply' ? replyDraftDiscussionId(draft) : null;

    if (!id || requested.has(id) || app.store.getById('discussions', id)) return;

    requested.add(id);
    app.store
      .find<Discussion>('discussions', id, {}, { errorHandler: () => {} } as any)
      .then(() => {
        draft.loadRelationships(true);
        m.redraw();
      })
      .catch(() => {});
  });
}

/** Discourse 各类型对应的图标：↩ 回复、✉ 私信、✎ 主题。 */
export function draftIcon(draft: FofDraft): string {
  switch (draft.type()) {
    case 'reply':
      return 'fas fa-reply';
    case 'privateDiscussion':
      return 'fas fa-envelope';
    default:
      return 'fas fa-pen';
  }
}

/** 行标题：回复为“RE: <主题>”，新主题为标题（或文本开头）。 */
export function draftTitle(draft: FofDraft): string {
  const excerpt = truncate((draft.content() || '').replace(/\s+/g, ' ').trim(), 100);

  if (draft.type() === 'reply') {
    const discussion = draftDiscussion(draft);

    return discussion ? t('composer.drafts.reply_title', { title: discussion.title() }) : excerpt || t('composer.drafts.unavailable');
  }

  return draft.title() || excerpt || t('composer.drafts.untitled');
}

/** 携带草稿重新打开 composer；若为回复，先进入主题，与 Discourse 一致。 */
export function openDraft(draft: FofDraft): void {
  const state = fofState();

  if (!state) return;

  const discussion = draft.type() === 'reply' ? draftDiscussion(draft) : null;

  if (discussion && app.current.get('discussion') !== discussion) {
    m.route.set(app.route.discussion(discussion));
  }

  state.showComposer(draft);
}

export function deleteDraft(draft: FofDraft): void {
  // fof 会先询问，再调整计数，并在删除的是当前草稿时关闭 composer。
  fofState()?.deleteDraft(draft);
}
