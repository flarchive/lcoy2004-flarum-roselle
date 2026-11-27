/*
 * fof/best-answer，按照 discourse-solved 的方式呈现。
 *
 * - 帖子栏中，被采纳的帖子显示绿色 "✓ 已解决"；其他帖子中，
 *   有权限的人会看到勾选方块（Discourse 的 `far-square-check`）。
 *   "…" 中的扩展项和帖子页眉中的标签会被移除：
 *   否则同一个控件会出现两次。
 * - 被采纳的答案上移到首帖内容正下方，位于 Discourse 的
 *   折叠面板中（绿色标题 "解决方案"、作者以及截断为
 *   六行的文本，带展开箭头和跳转到该帖的箭头）。
 * - 列表中，徽章图标变成绿色带勾的方块（CSS）。
 *
 * 保存方式与扩展相同：讨论的 `bestAnswerPost` 关系。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import UserCard from 'flarum/forum/components/UserCard';
import PostControls from 'flarum/forum/utils/PostControls';
import username from 'flarum/common/helpers/username';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import humanTime from 'flarum/common/utils/humanTime';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { extModule, thirdParty } from './settings';

/** 讨论中被采纳的答案，或 null（空关系返回 `false`）。 */
function acceptedPost(discussion: Discussion | null | undefined): Post | null {
  const d = discussion as any;

  if (!d || !d.hasBestAnswer?.()) return null;

  return d.bestAnswerPost?.() || null;
}

function isAccepted(post: Post): boolean {
  const accepted = acceptedPost(post.discussion());

  return !!accepted && accepted.id() === post.id();
}

/** 与扩展相同的规则：绝不是首帖，也不含隐藏帖和访客。 */
function canToggle(post: Post): boolean {
  return (
    !!app.session.user &&
    !post.isHidden() &&
    post.number() !== 1 &&
    post.contentType() === 'comment' &&
    !!(post as any).canSelectAsBestAnswer?.() &&
    !!app.current.matches(DiscussionPage)
  );
}

function save(discussion: Discussion, post: Post, accept: boolean): Promise<void> {
  return discussion
    .save({ relationships: { bestAnswerPost: accept ? post : ({ data: null } as any) } } as any, { params: { include: 'tags' } } as any)
    .then(() => {
      // 否则旧关系会留在模型中，帖子仍显示为 "已采纳"。
      if (!accept && discussion.data.relationships) {
        delete (discussion.data.relationships as any).bestAnswerPost;
        delete (discussion.data.relationships as any).bestAnswerUser;
      }

      if (app.current.matches(DiscussionPage)) app.current.get('stream')?.update();

      m.redraw();
    });
}

/** "由某人在 2 天前标记为解决方案"，用于绿色徽章的 title。 */
function acceptedBy(discussion: Discussion): string {
  const d = discussion as any;
  const user = d.bestAnswerUser?.();
  const at: Date | undefined = d.bestAnswerSetAt?.();

  if (!user) return t('thirdparty.solved.accepted_title');

  return t('thirdparty.solved.accepted_by', { username: extractText(username(user)), ago: at ? humanTime(at) : '' });
}

let installed = false;

export default function installBestAnswer(): void {
  // 个人资料顶部的 "0 个最佳答案"：Discourse 不显示为零的计数。
  // 在 beforeMount 中，以便在 fof 自身的项之后运行。
  app.beforeMount(() => {
    if (installed) return;
    installed = true;

    extend(UserCard.prototype, 'infoItems', function (this: any, items: any) {
      const count = Number(this.attrs.user?.attribute?.('bestAnswerCount')) || 0;

      if (!count && items.has('best-answer-count')) items.remove('best-answer-count');
    });
  });

  extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    const post: Post = this.attrs.post;

    // 扩展替代界面的 "主" 按钮：主题已经有自己的。
    items.remove('bestAnswer');

    if (post.isHidden() || post.number() === 1) return;

    const discussion = post.discussion();
    const accepted = isAccepted(post);
    const toggle = canToggle(post);

    if (accepted) {
      const label = t('thirdparty.solved.accepted');
      const title = acceptedBy(discussion);

      items.add(
        'lcoySolved',
        toggle ? (
          <Button
            className="Button Button--flat LcoyPostAction LcoySolved LcoySolved--accepted"
            icon="fas fa-square-check"
            title={`${title}: ${t('thirdparty.solved.unmark')}`}
            aria-pressed="true"
            onclick={() => save(discussion, post, false)}
          >
            {label}
          </Button>
        ) : (
          <span className="LcoySolved LcoySolved--accepted LcoySolved--static" title={title}>
            <Icon name="fas fa-square-check" />
            <span className="LcoySolved-label">{label}</span>
          </span>
        ),
        25
      );

      return;
    }

    if (!toggle) return;

    items.add(
      'lcoySolved',
      <Button
        className="Button Button--icon Button--flat LcoyPostAction LcoySolved"
        icon="far fa-square-check"
        title={t('thirdparty.solved.mark')}
        aria-label={t('thirdparty.solved.mark')}
        aria-pressed="false"
        onclick={() => save(discussion, post, true)}
      />,
      25
    );
  });

  // "…" 中的同一个控件会重复。
  extend(PostControls, 'moderationControls', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    items.remove('bestAnswer');
  });

  // Discourse 不标记被采纳帖子的页眉；栏中的绿色徽章已足够。
  extend(CommentPost.prototype, 'headerItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    items.remove('isBestAnswer');
  });

  // 扩展在页脚的预览让位给内容中的折叠面板，
  // 位于操作栏上方，即 Discourse 放置它的位置。
  extend(CommentPost.prototype, 'footerItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    items.remove('bestAnswerPost');
  });

  // 帖子会保留树结构（SubtreeRetainer）：只有首帖知道
  // 自己的状态发生变化时，展开折叠面板才会重新绘制。
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    if (!thirdParty.solved()) return;

    if (this.attrs.post.number() !== 1) return;

    this.subtree.check(() => {
      const accepted = acceptedPost(this.attrs.post.discussion());

      return accepted ? solutionState(accepted).version : 0;
    });
  });

  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    if (!thirdParty.solved()) return;

    const post: Post = this.attrs.post;

    if (post.number() !== 1 || post.isHidden()) return;

    const accepted = acceptedPost(post.discussion());

    if (accepted && !accepted.isHidden()) content.push(<SolutionAccordion post={accepted} />);
  });

  // 被选中的答案进入正文流：一张带绿色边框的卡片，
  // 顶部有 "解决方案" 条 —— 与举报帖相同的外观，只是绿色。
  extend(CommentPost.prototype, 'elementAttrs', function (this: any, attrs: Record<string, any>) {
    if (!thirdParty.solved() || !isAccepted(this.attrs.post)) return;

    attrs.className = classList(attrs.className, 'LcoyPost--solution');
  });

  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    if (!thirdParty.solved() || !isAccepted(this.attrs.post)) return;

    content.unshift(
      <div className="LcoyPost-solutionBar">
        <Icon name="fas fa-square-check" />
        <span>{t('thirdparty.solved.accepted_bar')}</span>
      </div>
    );
  });

  // 列表中的徽章：Discourse 的带勾方块（`square-check`）。
  const Badge = extModule<any>('fof-best-answer', 'forum/components/BestAnswerBadge');

  if (Badge) {
    override(Badge, 'initAttrs', function (original: (attrs: any) => void, attrs: any) {
      original(attrs);
      if (thirdParty.solved()) attrs.icon = 'fas fa-square-check';
    });
  }
}

interface SolutionAccordionAttrs {
  post: Post;
}

/** 展开前的可见行数（Discourse 的 `--max-lines-displayed`）。 */
const MAX_LINES = 6;

interface SolutionState {
  expanded: boolean;
  overflowing: boolean;
  version: number;
}

/** 折叠面板的状态存放在被采纳的帖子上，首帖可以观察到它。 */
function solutionState(post: Post): SolutionState {
  const p = post as any;

  return (p.lcoySolution ??= { expanded: false, overflowing: false, version: 0 });
}

function setSolutionState(post: Post, changes: Partial<SolutionState>) {
  Object.assign(solutionState(post), changes);
  solutionState(post).version++;
  m.redraw();
}

class SolutionAccordion {
  get expanded(): boolean {
    return solutionState(this.post).expanded;
  }

  get overflowing(): boolean {
    return solutionState(this.post).overflowing;
  }

  post!: Post;

  oninit(vnode: Mithril.Vnode<SolutionAccordionAttrs, this>) {
    this.post = vnode.attrs.post;
  }

  onbeforeupdate(vnode: Mithril.Vnode<SolutionAccordionAttrs, this>) {
    this.post = vnode.attrs.post;
  }

  oncreate(vnode: Mithril.VnodeDOM<SolutionAccordionAttrs, this>) {
    this.measure(vnode.dom as HTMLElement);
  }

  onupdate(vnode: Mithril.VnodeDOM<SolutionAccordionAttrs, this>) {
    this.measure(vnode.dom as HTMLElement);
  }

  /** 只有在文本超过六行时才显示渐变和箭头。 */
  measure(dom: HTMLElement) {
    const content = dom.querySelector<HTMLElement>('.LcoySolution-content');

    if (!content || this.expanded) return;

    const overflowing = content.scrollHeight > content.clientHeight + 1;

    if (overflowing !== this.overflowing) setSolutionState(this.post, { overflowing });
  }

  view(vnode: Mithril.Vnode<SolutionAccordionAttrs, this>) {
    const post = vnode.attrs.post;
    const user = post.user();
    const html = post.contentHtml();

    return (
      <div className="LcoySolution" style={{ '--lcoy-solution-lines': MAX_LINES }}>
        <div className="LcoySolution-header">
          <Icon name="fas fa-square-check" />
          <span className="LcoySolution-title">{t('thirdparty.solved.title')}</span>
        </div>
        <div
          className={classList('LcoySolution-item', {
            'LcoySolution-item--expanded': this.expanded,
            'LcoySolution-item--overflowing': this.overflowing,
          })}
        >
          <div className="LcoySolution-itemHeader">
            <span className="LcoySolution-meta">
              {user ? (
                <Link href={app.route.user(user)} className="LcoySolution-user">
                  <Avatar user={user} />
                  <span className="LcoySolution-username">{username(user)}</span>
                </Link>
              ) : (
                <span className="LcoySolution-user">{username(user)}</span>
              )}
            </span>
            <span className="LcoySolution-controls">
              <Link
                href={app.route.post(post)}
                className="Button Button--icon Button--flat LcoySolution-jump"
                title={t('thirdparty.solved.jump')}
                aria-label={t('thirdparty.solved.jump')}
              >
                <Icon name="fas fa-arrow-down" />
              </Link>
              {(this.overflowing || this.expanded) && (
                <Button
                  className="Button Button--icon Button--flat LcoySolution-toggle"
                  icon={this.expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}
                  aria-expanded={this.expanded ? 'true' : 'false'}
                  aria-label={t(this.expanded ? 'thirdparty.solved.collapse' : 'thirdparty.solved.expand')}
                  title={t(this.expanded ? 'thirdparty.solved.collapse' : 'thirdparty.solved.expand')}
                  onclick={() => setSolutionState(post, { expanded: !this.expanded })}
                />
              )}
            </span>
          </div>
          {html ? <div className="LcoySolution-content Post-body">{m.trust(html)}</div> : null}
        </div>
      </div>
    );
  }
}
