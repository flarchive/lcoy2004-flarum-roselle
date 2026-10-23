/*
 * Discourse 编辑器的第一行（`.reply-to`）：加粗的操作
 * 及其图标（"发起讨论"、"主题 ▾"、"正在编辑帖子"），当目标
 * 主题不在屏幕上时，还有指向它的 "🔗 标题" 链接。
 *
 * 回复时，"主题 ▾" 会打开操作菜单（`composer-actions`）：回复
 * 主题，或作为关联主题回复。最小化时，这一行会变成
 * 草稿栏：图标和主题标题（或草稿提示）。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import Stream from 'flarum/common/utils/Stream';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { canReplyAsLinkedTopic, replyAsLinkedTopic } from '../features/composer/installLinkedTopic';
import { t } from '../utils/settings';

export type ComposerKind = 'new_topic' | 'reply' | 'edit' | (string & {});

/** 页眉菜单中的一个操作：图标、加粗标签和描述。 */
export interface ComposerAction {
  icon: string;
  label: string;
  description: string;
  onclick: () => void;
}

export interface ComposerActionTitleAttrs extends ComponentAttrs {
  kind: ComposerKind;
  discussion?: Discussion;
  post?: Post;
  /** 自定义标签和图标（其他编辑器，例如私信编辑器）。 */
  label?: string;
  icon?: string;
  /** 在新主题中输入标题（用于最小化后的栏）。 */
  title?: () => string;
}

/** Discourse 操作所用的图标（`far-pen-to-square`、`share` —— 在其 sprite 中是带箭头的框 ——、`pencil`）。 */
const ICONS: Record<string, string> = {
  new_topic: 'far fa-pen-to-square',
  reply: 'fas fa-arrow-up-from-bracket',
  edit: 'fas fa-pencil',
};

/** 在全屏编辑器中，点击链接会先最小化，与核心一致。 */
function minimizeIfFullScreen(e: MouseEvent): void {
  if (app.composer.position === 'fullScreen') {
    app.composer.minimize();
    e.stopPropagation();
  }
}

/**
 * 切换编辑器类型，并带上已写好的文本（Discourse 菜单中的 "回复
 * 主题" / "发起讨论" 操作）。"是否丢弃？" 的提问
 * 没有意义：文本会一起带走。
 */
async function switchTo(kind: 'reply' | 'new_topic', discussion: Discussion | null): Promise<void> {
  const content = app.composer.fields?.content() || '';
  const title = (app.composer.fields as any)?.title?.() || '';
  const module = kind === 'reply' ? 'flarum/forum/components/ReplyComposer' : 'flarum/forum/components/DiscussionComposer';

  (app.composer as any).onExit = null;

  await app.composer.load(() => flarum.reg.asyncModuleImport(module), {
    user: app.session.user,
    ...(discussion ? { discussion } : {}),
    originalContent: content,
  });
  if (title && kind === 'new_topic') (app.composer.fields as any).title = Stream(title);

  await app.composer.show();
}

export { switchTo as switchComposer };

export default class ComposerActionTitle extends Component<ComposerActionTitleAttrs> {
  view(): Mithril.Children {
    if (app.composer.position === 'minimized') return this.draftView();

    return (
      <div className="LcoyComposerAction" role="heading" aria-level={1}>
        {this.trigger()}
        {this.targetLink()}
      </div>
    );
  }

  /** 最小化编辑器后的栏（`#reply-control.draft .draft-text`）。 */
  draftView(): Mithril.Children {
    const { kind, discussion, post, title } = this.attrs;
    const topic = kind === 'reply' ? discussion : kind === 'edit' ? post?.discussion() : null;
    const text = topic ? topic.title() : title?.() || t('composer.shell.saved_draft');

    return (
      <div className="LcoyComposerAction LcoyComposerAction--draft">
        {topic ? <Icon name={ICONS.reply} /> : null}
        <span className="LcoyComposerAction-draftText">{text}</span>
      </div>
    );
  }

  label(): string {
    const labels: Record<string, string> = {
      new_topic: t('composer.shell.action_new_topic'),
      reply: t('composer.shell.action_reply'),
      edit: t('composer.shell.action_edit'),
    };

    return this.attrs.label || labels[this.attrs.kind] || '';
  }

  icon(): string {
    return this.attrs.icon || ICONS[this.attrs.kind] || ICONS.new_topic;
  }

  trigger(): Mithril.Children {
    const label = this.label();
    const actions = this.actionItems().toArray();

    // 没有其他操作时，Discourse 会静态显示标签，不带箭头。
    if (!actions.length) {
      return (
        <span className="LcoyComposerAction-trigger LcoyComposerAction-trigger--static">
          <Icon name={this.icon()} />
          <span className="LcoyComposerAction-label">{label}</span>
        </span>
      );
    }

    return (
      <Dropdown
        className="LcoyComposerAction-menu"
        buttonClassName="Button LcoyComposerAction-trigger"
        menuClassName="LcoyComposerAction-dropdown"
        icon={this.icon()}
        caretIcon="fas fa-angle-down"
        label={<span className="LcoyComposerAction-label">{label}</span>}
        accessibleToggleLabel={t('composer.linked_topic.menu_label')}
      >
        {actions.map((action) => this.actionButton(action.icon, action.label, action.description, action.onclick))}
      </Dropdown>
    );
  }

  /**
   * 菜单中的其他操作（`composer-actions`）：当前操作不会出现。切换
   * 类型会带上标题和文本。这是菜单的扩展点：其他
   * 功能（私信）扩展这个方法，加入 "创建
   * 私信" / "作为私信回复"：
   *
   *   extend(ComposerActionTitle.prototype, 'actionItems', function (items) {
   *     items.add('message', { icon, label, description, onclick }, 50);
   *   });
   *
   * `this.attrs.kind` 表示当前打开的是哪种编辑器（'new_topic' | 'reply' |
   * 'edit'，或其他编辑器传入的值）。
   */
  actionItems(): ItemList<ComposerAction> {
    const { kind, discussion } = this.attrs;
    const items = new ItemList<ComposerAction>();
    const viewing = (app.current.get('discussion') as Discussion | undefined) || null;
    const canStart = !!app.forum.attribute<boolean>('canStartDiscussion');

    if (kind === 'new_topic' && viewing && (viewing as any).canReply?.()) {
      items.add(
        'reply',
        {
          icon: ICONS.reply,
          label: t('composer.linked_topic.reply'),
          description: t('composer.shell.reply_to_topic_desc'),
          onclick: () => switchTo('reply', viewing),
        },
        100
      );
    }

    if (kind === 'reply' && discussion) {
      if (canReplyAsLinkedTopic()) {
        items.add(
          'linkedTopic',
          {
            icon: 'fas fa-plus',
            label: t('composer.linked_topic.new_topic'),
            description: t('composer.shell.reply_as_new_topic_desc'),
            onclick: () => replyAsLinkedTopic(discussion),
          },
          100
        );
      }

      if (canStart) {
        items.add(
          'newTopic',
          {
            icon: ICONS.new_topic,
            label: t('composer.shell.action_create_topic'),
            description: t('composer.shell.create_topic_desc'),
            onclick: () => switchTo('new_topic', null),
          },
          90
        );
      }
    }

    // 其他编辑器（私信编辑器）若复用这个页眉，可以
    // 切回主题。
    if (kind !== 'new_topic' && kind !== 'reply' && kind !== 'edit' && canStart) {
      items.add(
        'newTopic',
        {
          icon: ICONS.new_topic,
          label: t('composer.shell.action_create_topic'),
          description: t('composer.shell.create_topic_desc'),
          onclick: () => switchTo('new_topic', null),
        },
        90
      );
    }

    return items;
  }

  /** 操作菜单中的一项：图标、加粗标签和描述。 */
  actionButton(icon: string, label: string, description: string, onclick: (() => void) | null, current = false): Mithril.Children {
    // 当前操作不再进入菜单（与 Discourse 相同）；`current` 保留
    // 给扩展者使用。
    return (
      <Button className="Button LcoyComposerAction-btn" onclick={onclick || undefined} disabled={current}>
        <span className="LcoyComposerAction-btnIcon">
          <Icon name={icon} />
        </span>
        <span className="LcoyComposerAction-btnTexts">
          <span className="LcoyComposerAction-btnLabel">{label}</span>
          <span className="LcoyComposerAction-btnDescription">{description}</span>
        </span>
      </Button>
    );
  }

  /**
   * "🔗 标题"：回复或编辑的目标。回复时，仅当主题
   * 不在编辑器后面打开 —— 与 Discourse 相同，在那里从
   * 主题内回复时它会消失。
   */
  targetLink(): Mithril.Children {
    const { kind, discussion, post } = this.attrs;

    if (kind === 'reply' && discussion && !app.viewingDiscussion(discussion)) {
      return (
        <Link className="LcoyComposerAction-target" href={app.route.discussion(discussion)} onclick={minimizeIfFullScreen} title={discussion.title()}>
          <Icon name="fas fa-link" />
          <span className="LcoyComposerAction-targetLabel">{discussion.title()}</span>
        </Link>
      );
    }

    if (kind === 'edit' && post) {
      const target = post.discussion();
      const text = app.translator.trans('core.forum.composer_edit.post_link', { number: post.number(), discussion: target.title() }, true) as string;

      return (
        <Link className="LcoyComposerAction-target" href={app.route.discussion(target, post.number())} onclick={minimizeIfFullScreen} title={text}>
          <Icon name="fas fa-link" />
          <span className="LcoyComposerAction-targetLabel">{text}</span>
        </Link>
      );
    }

    return null;
  }
}
