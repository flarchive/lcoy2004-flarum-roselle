/*
 * avocado 的“回复给”中的 composer（lcoy.topic_reply_to_style =
 * avocado）：位于文本开头的被回复帖子提及（`@"某某"#p7`）从输入区移出，
 * 变成 composer 头部的“↳ 回复给 [头像] 某某 ×”指示器。发送时它回到内容的
 * 开头：flarum/mentions 需要它来建立回复关联，保存下来的帖子与平时完全一样。
 *
 * 在回复时生效（提及通过 mentions 的“回复”、引用或草稿到来）以及编辑时
 * （提及已经在帖子开头）。只有开头的提及会变成指示器；文本中间的提及保持
 * 原样。
 *
 * 草稿（fof/drafts）：fof 保存 composer 正文的 `data()`，其中已经把提及
 * 放回；打开草稿时它又会变成指示器。
 *
 * 移植自 avocado-v2/js/src/forum/utils/replyTo.ts。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import type PostModel from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { topicSettings } from './ui';

/** 源文本开头的帖子提及：`@"某某"#p7` 加一个空格。 */
const LEADING_MENTION = /^@"((?:[^"\\]|\\.)+)"#p(\d+)[ \t]?/;

interface ComposerReply {
  /** 被回复帖子的 id。 */
  id: string;
  /** 提及显示的名字。 */
  name: string;
  /** 提及在文本中的原样形式，发送时原样放回。 */
  raw: string;
}

const BODIES = ['flarum/forum/components/ReplyComposer', 'flarum/forum/components/EditPostComposer'];

function composerReply(composer: any): ComposerReply | null {
  return composer?.fields?.lcoyReplyTo || null;
}

/**
 * 从文本开头取出提及并保存到 composer 中。文本每次变化时运行
 * （编辑器在首次绘制后才存在，因此需要等待）。
 */
function absorbLeadingMention(composer: any, attrs: any): void {
  const editor = composer?.editor;

  if (!topicSettings.replyToLine() || !composer?.fields?.content || !editor) return;

  const content = String(composer.fields.content() || '');
  const match = content.match(LEADING_MENTION);

  if (!match) return;

  const raw = match[0];
  composer.fields.lcoyReplyTo = { id: match[2], name: match[1].replace(/\\(.)/g, '$1'), raw } as ComposerReply;

  // “原始”文本是关闭时用来比较、询问是否丢弃的基准：
  // mentions 在打开空回复时把提及写进去，编辑时则写入整篇帖子。
  // 如果不从这里也去掉，什么都没写就关闭时会询问是否丢弃。
  for (const target of [composer.body?.attrs, attrs]) {
    const original = target?.originalContent;

    if (typeof original === 'string' && original.startsWith(raw)) target.originalContent = original.slice(raw.length);
  }

  editor.insertBetween(0, raw.length, '', false);

  // 用空文本调 `insertBetween` 取决于浏览器（execCommand）：如果提及
  // 还在，就直接调整 textarea。
  const el: HTMLTextAreaElement | undefined = editor.el;

  if (String(composer.fields.content() || '').startsWith(raw) && el && typeof el.value === 'string') {
    el.value = el.value.slice(raw.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  m.redraw();
}

/** 被回复帖子的作者，如果已加载（或名字与提及一致的用户）。 */
function replyUser(reply: ComposerReply): User | null {
  const post = app.store.getById<PostModel>('posts', reply.id);
  const user = post?.user();

  if (user) return user;

  return (app.store.all('users') as User[]).find((item) => item.displayName() === reply.name || item.username() === reply.name) || null;
}

function ReplyIndicator(composer: any, reply: ComposerReply): Mithril.Children {
  const user = replyUser(reply);

  return (
    <span className="LcoyComposerReplyTo">
      <Icon name="fas fa-reply" className="LcoyComposerReplyTo-icon" />
      <span className="LcoyComposerReplyTo-label">{t('topic.post.reply_to_label')}</span>
      {user ? <Avatar user={user} /> : null}
      <span className="LcoyComposerReplyTo-name">{reply.name}</span>
      <button
        type="button"
        className="LcoyComposerReplyTo-remove"
        aria-label={t('topic.post.remove_reply')}
        title={t('topic.post.remove_reply')}
        // 撤销回复：文本中已经没有提及，只是发送时不再把它放回去。
        onclick={() => {
          composer.fields.lcoyReplyTo = null;
          composer.editor?.focus?.();
        }}
      >
        <Icon name="fas fa-times" />
      </button>
    </span>
  );
}

export default function installReplyToComposer(): void {
  BODIES.forEach((module) => {
    extend(module as any, 'oninit', function (this: any) {
      const composer = this.attrs.composer;

      composer.fields.content.map(() => {
        if (!topicSettings.replyToLine()) return;

        Promise.resolve(composer.editorReady?.())
          .then(() => absorbLeadingMention(composer, this.attrs))
          .catch(() => {});
      });
    });

    // 放在 composer 标题之后（主题中的优先级为 1000）。
    extend(module as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      const reply = topicSettings.replyToLine() ? composerReply(this.attrs.composer) : null;

      if (reply) items.add('lcoyReplyTo', ReplyIndicator(this.attrs.composer, reply), 900);
    });

    // 发送时（以及保存 fof/drafts 草稿时），提及回到开头。
    extend(module as any, 'data', function (this: any, data: any) {
      const reply = composerReply(this.attrs.composer);

      if (reply && data && typeof data.content === 'string' && !data.content.startsWith(reply.raw)) {
        data.content = reply.raw + data.content;
      }
    });
  });
}
