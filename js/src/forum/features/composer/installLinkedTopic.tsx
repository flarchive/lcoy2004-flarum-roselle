/*
 * “作为关联主题回复”——Discourse 回复 composer 中“主题 ▾”菜单
 * 的一项操作。将回复替换为一个新主题，携带已写好的文本、一个指回
 * 原主题的链接（“续自 [标题](链接)”）以及源主题的相同标签。
 */
import app from 'flarum/forum/app';
import Stream from 'flarum/common/utils/Stream';
import type Discussion from 'flarum/common/models/Discussion';

import { composerOn } from './common';
import { discardCurrentDraft } from './drafts/fofDrafts';
import { isTagsEnabled } from '../../utils/tags';
import { normalizeTags, selectableTags } from '../../composer/tagRules';
import { t } from '../../utils/settings';

function absoluteDiscussionUrl(discussion: Discussion): string {
  const path = app.route.discussion(discussion);
  const origin = app.forum.attribute<string>('baseOrigin') || window.location.origin;

  return /^https?:\/\//.test(path) ? path : origin + path;
}

/** 转义标题中的方括号，避免它提前闭合 Markdown 链接。 */
function markdownText(text: string): string {
  return text.replace(/([[\]\\])/g, '\\$1');
}

export async function replyAsLinkedTopic(discussion: Discussion): Promise<void> {
  const content = app.composer.fields?.content() || '';
  const intro = t('composer.linked_topic.continuation', {
    link: `[${markdownText(discussion.title())}](${absoluteDiscussionUrl(discussion)})`,
  });
  const tags = isTagsEnabled() ? ((discussion as any).tags?.() || []).filter(Boolean) : [];

  // 文本会随新主题一同带走，因此询问“要丢弃回复吗？”
  // 没有意义：先解除 composer 的退出拦截。
  (app.composer as any).onExit = null;

  // 回复的草稿也一样：文本现在属于新主题，新主题会有自己的
  // 草稿。
  await discardCurrentDraft();

  // 文本以 `originalContent` 传入：主体在编辑器挂载之前就把它放进
  // 字段，已有新主题草稿不会覆盖它（仅在空 composer 中才会恢复）。
  await app.composer.load(() => import('flarum/forum/components/DiscussionComposer'), {
    user: app.session.user,
    originalContent: `${intro}\n\n${content}`.trimEnd() + '\n',
  });

  // `load` 会清空字段；flarum/tags 从 `fields.tags` 读取标签。
  // 仅保留当前用户可在新主题中使用的标签（flarum/tags 的规则）。
  const allowed = normalizeTags(tags, selectableTags());
  if (allowed.length) (app.composer.fields as any).tags = allowed;
  (app.composer.fields as any).title = Stream('');

  await app.composer.show();
  await app.composer.editorReady();

  (document.querySelector('.DiscussionComposer-title') as HTMLInputElement | null)?.focus();
}

/**
 * 回复 composer 的“主题 ▾”菜单是否提供“作为关联主题回复”。
 * 菜单本身由 composer 页头（`composer/ComposerActionTitle`）绘制，
 * 与 Discourse 的 `composer-actions` 一致。
 */
export function canReplyAsLinkedTopic(): boolean {
  return composerOn('LinkedTopic') && !!app.forum.attribute<boolean>('canStartDiscussion');
}

export default function installLinkedTopic() {
  // 无需注册任何内容：该功能是页头菜单中的一项操作。
}
