/*
 * Discourse 风格的帖子。
 *
 * - 头部：粗体姓名、灰色的用户名和分组、“回复给”带头像、已编辑的铅笔
 *   以及短日期（链接到该帖）。
 * - 下方右对齐的操作栏，只有图标：点赞数（打开点赞者头像）+ 爱心、链接
 *  （带帖子地址的 popover）、就地展开帖子控制项的“…”，以及带文字的“回复”。
 *   左侧是“N 条回复”，在帖子下方展开内嵌回复。
 *
 * 各扩展的条目（likes、mentions、flags、approval…）保持不变：主题只更换
 * 外观并复用它们的 onclick。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Avatar from 'flarum/common/components/Avatar';
import Separator from 'flarum/common/components/Separator';
import Tooltip from 'flarum/common/components/Tooltip';
import CommentPost from 'flarum/forum/components/CommentPost';
import PostMeta from 'flarum/forum/components/PostMeta';
import PostUser from 'flarum/forum/components/PostUser';
import PostEdited from 'flarum/forum/components/PostEdited';
import PostControls from 'flarum/forum/utils/PostControls';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import PostModel from 'flarum/common/models/Post';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/utils/humanTime';
import extractText from 'flarum/common/utils/extractText';
import classList from 'flarum/common/utils/classList';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import listItems from 'flarum/common/helpers/listItems';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import EmbeddedPost, { embeddedLoading, loadMissingContent } from './components/EmbeddedPost';
import { absoluteUrl, postUi, togglePostUi, topicSettings, type PostUi } from './ui';
import { fullDate, shortAge } from '../utils/dates';
import { isExtensionEnabled, t } from '../utils/settings';
import { copyText } from '../utils/clipboard';
import { decorateQuotes } from './quotes';
import { userIcons } from '../utils/userIcons';
import { heartIcon, openWhoReacted, type ReactorEntry } from './components/WhoReactedPopover';

/** 已向服务器请求过的被回复帖子（避免每次重绘都重新请求）。 */
const requestedParents = new Set<string>();

export default function installPosts(): void {
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    const ui = postUi(this);

    this.subtree.check(() => ui.version);
  });

  extend(CommentPost.prototype, 'onremove', function (this: any) {
    window.clearTimeout(postUi(this).copiedTimer);
  });

  // 头像放在独立的块中，角落带分组的“flair”：
  // 这样两者随阅读一起下移（Discourse 的头像是 sticky 的）。
  extend(CommentPost.prototype, 'sideItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!items.has('avatar')) return;

    const user = this.attrs.post.user();
    const badges = user ? user.badges().toArray() : [];
    // 在线状态与 meta.discourse.org 一致（who's online 插件，"ring" 模式）：
    // 头像外一圈绿色圆环，不带圆点。
    const online = !!user && user.isOnline();

    items.setContent(
      'avatar',
      <div className={online ? 'LcoyPostAvatar LcoyPostAvatar--online' : 'LcoyPostAvatar'}>
        {items.get('avatar')}
        {badges.length ? <ul className="LcoyPostAvatar-flair badges">{listItems(badges)}</ul> : null}
      </div>
    );
  });

  // 名字后的图标（认证徽章、状态 emoji：见 utils/userIcons）
  // 放在作者链接之外、名字所在行：点击它们不会打开卡片，
  // 徽章的 popover 也能正常工作。
  extend(PostUser.prototype, 'userViewItems', function (this: any, items: ItemList<Mithril.Children>, user: User) {
    const icons = userIcons(user, 'post');
    const name = items.has('postUser-name') ? (items.get('postUser-name') as any) : null;

    if (!icons || !name || !Array.isArray(name.children)) return;

    items.setContent('postUser-name', m(name.tag, name.attrs, [...name.children, icons]));
  });

  // 带头部的引用以及被隐藏的“回复给”提及：直接操作已渲染的
  // HTML，因此在每次内容绘制之后运行。
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    const body = this.element?.querySelector?.('.Post-body');

    if (body) {
      // 当“回复给”位于头部（两种样式都算）时，标记回复的
      // 提及从文本中移出。
      const replyInHeader = topicSettings.embeddedReplies() || topicSettings.replyToLine();
      decorateQuotes(body, this.attrs.post, replyInHeader ? replyMarkerId(this.attrs.post) : null);
      markUnavailableMentions(body);
    }
  });

  // 不用核心的 dropdown：主题的“…”在操作栏中就地展开控制项。
  override(CommentPost.prototype, 'controls', function (this: any, original: () => Mithril.Children[]) {
    return topicSettings.postActions() ? [] : original();
  });

  extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (topicSettings.postActions()) buildActions(this, items);
  });

  extend(CommentPost.prototype, 'footerItems', function (this: any, items: ItemList<Mithril.Children>) {
    buildFooter(this, items);
  });

  extend(CommentPost.prototype, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    buildHeader(this, items);
  });

  // 被回复的帖子在整篇帖子上方展开，类似顶部的 “embedded post”。
  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    const ui = postUi(this);

    if (!ui.parent || !topicSettings.embeddedReplies()) return;

    const parentId = parentPostId(this.attrs.post);

    if (parentId) content.unshift(<ParentPost id={parentId} ui={ui} />);
  });

  // Discourse 的短日期（"4 h"、"6月8日"），完整日期放在 title 中，
  // 但点击仍然打开核心的菜单（完整日期 + 帖子链接），按用户要求。
  extend(PostMeta.prototype, 'viewItems', function (this: any, items: ItemList<Mithril.Children>) {
    const post = this.attrs.post;
    const time: Date | undefined = post.createdAt?.();

    if (!time || !items.has('time')) return;

    const label = <time dateTime={time.toISOString()}>{shortAge(time)}</time>;
    const original = items.get('time') as any;

    items.setContent('time', m(original?.tag || 'button', { ...(original?.attrs || {}), title: fullDate(time) }, label));
  });

  // “已编辑”变成 Discourse 的铅笔，并带与编辑者一致的 tooltip。
  override(PostEdited.prototype, 'view', function (this: any, original: () => Mithril.Children) {
    const post = this.attrs.post;

    const info = app.translator.trans('core.forum.post.edited_tooltip', { user: post.editedUser(), ago: humanTime(post.editedAt()) });

    return (
      <Tooltip text={extractText(info)}>
        <span className="PostEdited LcoyPostEdited" aria-label={extractText(info)}>
          <Icon name="fas fa-pencil-alt" />
        </span>
      </Tooltip>
    );
  });
}

// ---------------------------------------------------------------------------
// 头部
// ---------------------------------------------------------------------------

function buildHeader(post: any, items: ItemList<Mithril.Children>) {
  const model: PostModel = post.attrs.post;
  const user = model.user();

  // Discourse 的顺序：粗体姓名，然后是用户名（不同名时）。
  // 分组不出现在文字中：
  // 它已经作为 flair 显示在头像上。
  if (user && user.username() !== user.displayName()) {
    items.add(
      'lcoyNames',
      <span className="LcoyPostNames">
        <span className="LcoyPostNames-username">{user.username()}</span>
      </span>,
      95
    );
  }

  // 核心中用于显示已删除帖子内容的“…”与紧邻下方操作栏的“…”
  // 重复：改为带标签的眼睛图标。
  if (items.has('toggle')) {
    const original = items.get('toggle') as any;
    const open = !!post.revealContent;
    const label = t(open ? 'topic.post.hide_hidden' : 'topic.post.show_hidden');

    items.setContent(
      'toggle',
      <Button
        {...(original?.attrs || {})}
        className="Button Button--icon Button--flat Button--more LcoyPostReveal"
        icon={open ? 'far fa-eye-slash' : 'far fa-eye'}
        aria-label={label}
        aria-pressed={open ? 'true' : 'false'}
        title={label}
      />
    );
  }

  // avocado 的“回复给”：名字下方一行（“↳ 回复给 [头像] 某某”），
  // 取代头部右侧的“↩ 某某”。
  const line = topicSettings.replyToLine();
  const embedded = topicSettings.embeddedReplies();

  if (!embedded && !line) return;

  const parentId = parentPostId(model);

  // 在 avocado 的样式中，被回复帖子就是上一楼时也会显示；
  // Discourse 的样式只在不是上一楼时显示（就在上面，显而易见）。
  if (parentId && (line || !isPreviousPost(model, parentId))) {
    const ui = postUi(post);
    const parent = app.store.getById<PostModel>('posts', parentId);
    const mentioned = mentionInfo(model).text;
    // 被回复的帖子可能尚未加载（不在 stream 当前页中）：
    // 作者按提及名从 store 中取；如果连作者也没有，
    // 则请求一次帖子以显示头像。
    const parentUser =
      (parent ? parent.user() : null) ||
      (typeof mentioned === 'string' ? app.store.getBy<any>('users', 'username', mentioned.replace(/^@/, '')) || null : null);

    if (!parent && !parentUser && !requestedParents.has(parentId)) {
      requestedParents.add(parentId);
      app.store.find('posts', parentId).then(
        () => m.redraw(),
        () => {}
      );
    }

    const name = parentUser ? username(parentUser) : mentioned;

    // 启用内嵌回复时，点击在上方打开被回复的帖子；
    // 未启用时（仅 avocado 样式），跳转到它。
    const onclick = () => {
      if (embedded) {
        togglePostUi(ui, 'parent');
      } else if (parent) {
        m.route.set(app.route.post(parent));
      }
    };

    items.add(
      'lcoyReplyTo',
      <button
        type="button"
        className={classList('LcoyReplyTo', { 'LcoyReplyTo--open': embedded && ui.parent, 'LcoyReplyTo--line': line })}
        aria-expanded={embedded ? (ui.parent ? 'true' : 'false') : undefined}
        title={t('topic.post.in_reply_to')}
        onclick={onclick}
      >
        <Icon name={line ? 'fas fa-reply' : 'fas fa-share'} className="LcoyReplyTo-icon" />
        {line ? <span className="LcoyReplyTo-label">{t('topic.post.reply_to_label')}</span> : null}
        {parentUser ? <Avatar user={parentUser} /> : null}
        <span className="LcoyReplyTo-name">{name}</span>
        {userIcons(parentUser || null, 'replyTo')}
      </button>,
      5
    );
  }
}

/**
 * Discourse 只在被回复的帖子不是紧邻的上一楼时才显示“回复给”
 * ——就在上面的话显而易见。
 */
function isPreviousPost(post: PostModel, parentId: string): boolean {
  const parent = app.store.getById<PostModel>('posts', parentId);

  return !!parent && parent.discussion() === post.discussion() && parent.number() === post.number() - 1;
}

interface MentionInfo {
  /** 本楼所回复的帖子，如果该提及是帖子提及。 */
  id: string | null;
  /** 提及的名字（“某某”），用于被回复帖子尚未加载时。 */
  text: string | null;
  /** 该提及位于第一段开头：这是“回复给”的标记。 */
  marker: boolean;
}

/**
 * 内容中的帖子提及（`@某某#123`），每个 HTML 版本只解析一次：
 * 帖子头部在每次绘制时都会重建，而长主题中每次绘制都新建一个
 * DOMParser 开销很大。
 *
 * 本楼所回复的帖子是第一个帖子提及；Flarum 不像 Discourse 那样
 * 保存“回复给”，但 mentions 生成的回复总是以该提及开头。
 */
function mentionInfo(post: PostModel): MentionInfo {
  const html = post.contentHtml() || '';
  const cache = (post as any).lcoyMention as { html: string; info: MentionInfo } | undefined;

  if (cache && cache.html === html) return cache.info;

  const info: MentionInfo = { id: null, text: null, marker: false };

  if (html.indexOf('PostMention') !== -1) {
    const body = parseHtml(html);
    const link = body.querySelector('a.PostMention:not(.PostMention--deleted)[data-id]');
    const id = link?.getAttribute('data-id') || null;

    if (id) {
      const mention = body.querySelector(`a.PostMention[data-id="${id}"]`);

      info.id = id;
      info.text = (mention?.textContent || '').replace(/^@/, '').trim() || null;
      // “回复给”的标记是位于第一段开头的提及
      // （引用中的提及会变成引用头部）。
      info.marker = /^\s*<p>\s*<a [^>]*class="PostMention"/.test(html);
    }
  }

  (post as any).lcoyMention = { html, info };

  return info;
}

function parentPostId(post: PostModel): string | null {
  return mentionInfo(post).id;
}

/**
 * 标记回复的提及：位于第一段开头的那个（而不是引用中的那个，
 * 主题会把它变成头部）。
 */
function replyMarkerId(post: PostModel): string | null {
  const info = mentionInfo(post);

  return info.marker ? info.id : null;
}

// 用 DOMParser，而不是 innerHTML 到 <div>：惰性文档不会下载帖子中的图片。
function parseHtml(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, 'text/html').body;
}

interface ParentPostAttrs {
  id: string;
  ui: PostUi;
}

/**
 * 拉取被回复的帖子（如有必要），并将其嵌入显示在顶部。已删除或不可见的
 * 帖子就直接不显示：核心的错误提示对于一次“查看更多”点击来说
 * 过于吵闹。
 */
class ParentPost {
  loading = false;
  failed = false;

  oninit(vnode: Mithril.Vnode<ParentPostAttrs, this>) {
    const post = app.store.getById<PostModel>('posts', vnode.attrs.id);

    if (post && post.contentHtml()) return;

    this.loading = true;

    app.store
      .find<PostModel>('posts', vnode.attrs.id, {}, { errorHandler: () => {} })
      .catch(() => (this.failed = true))
      .finally(() => {
        this.loading = false;
        vnode.attrs.ui.version++;
        m.redraw();
      });
  }

  view(vnode: Mithril.Vnode<ParentPostAttrs, this>) {
    const post = app.store.getById<PostModel>('posts', vnode.attrs.id);

    return (
      <div className="LcoyEmbedded LcoyEmbedded--top">
        {this.loading ? embeddedLoading() : post && !this.failed ? <EmbeddedPost post={post} direction="up" /> : null}
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// 操作栏
// ---------------------------------------------------------------------------

function buildActions(component: any, items: ItemList<Mithril.Children>) {
  const post: PostModel = component.attrs.post;
  const ui = postUi(component);

  // 隐藏帖保持 Flarum 的做法：只有管理控制项
  //（恢复、彻底删除）——点赞、反应和回复对它都不适用。
  if (post.isHidden()) {
    ['like', 'react', 'reply', 'lcoyReactions', 'lcoyLikeCount'].forEach((key) => items.has(key) && items.remove(key));
    addMore(component, post, ui, items);
    return;
  }

  addRepliesToggle(post, ui, items);
  restyleLike(post, ui, items);
  items.add('lcoyShare', <ShareAction post={post} ui={ui} />, -10);
  addMore(component, post, ui, items);
  restyleReply(post, items);
}

/** 左侧的“N 条回复 ▾”，用于展开内嵌回复。 */
function addRepliesToggle(post: PostModel, ui: PostUi, items: ItemList<Mithril.Children>) {
  if (!topicSettings.embeddedReplies()) return;

  const count = Number(post.attribute('mentionedByCount')) || 0;

  if (!count) return;

  items.add(
    'lcoyReplies',
    <Button
      className={classList('Button Button--flat LcoyPostAction LcoyPostAction--replies', { active: ui.replies })}
      aria-expanded={ui.replies ? 'true' : 'false'}
      onclick={() => togglePostUi(ui, 'replies')}
    >
      {t('topic.post.replies', { count })}
      <Icon name={ui.replies ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="LcoyPostAction-chevron" />
    </Button>,
    1000
  );
}

/**
 * 与 Meta 一致的点赞：左侧是实心爱心加计数（打开点赞者头像）；
 * 右侧只有点赞爱心。访客看到爱心，点击后出现登录窗口——
 * Discourse 则直接跳转登录。
 */
function restyleLike(post: PostModel, ui: PostUi, items: ItemList<Mithril.Children>) {
  if (!isExtensionEnabled('flarum-likes') || post.isHidden()) return;

  const likes: User[] = ((post as any).likes?.() || []).filter(Boolean);
  const count = Number(post.attribute('likesCount')) || likes.length;
  const original = items.has('like') ? (items.get('like') as any) : null;
  const guest = !app.session.user;

  if (count > 0) {
    items.add(
      'lcoyLikeCount',
      <Button
        className="Button Button--flat LcoyPostAction LcoyLikeCount"
        icon="fas fa-heart"
        aria-haspopup="dialog"
        aria-label={t('topic.post.who_liked')}
        title={t('topic.post.who_liked')}
        onclick={(event: MouseEvent) => openWhoReacted(event.currentTarget as HTMLElement, () => likers(post))}
      >
        <span className="LcoyLikeCount-number">{abbreviateNumber(count)}</span>
      </Button>,
      1100
    );
  }

  if (!original && !guest) return;

  const liked = !guest && likes.indexOf(app.session.user!) !== -1;
  const label = guest ? t('topic.post.like_guest') : t(liked ? 'topic.post.unlike' : 'topic.post.like');

  const onclick = (event: MouseEvent) => {
    if (guest) {
      app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/LogInModal'));
      return;
    }

    // 点赞时 Discourse 的心跳动画（heartBump）。
    if (!liked) ui.likeBump = Date.now();

    return original?.attrs?.onclick?.(event);
  };

  const content = (
    <Button
      className={classList('Button Button--icon Button--flat LcoyPostAction LcoyLike-toggle', {
        'LcoyLike--liked': liked,
        'LcoyLike--bump': liked && ui.likeBump && Date.now() - ui.likeBump < 1000,
      })}
      icon={liked ? 'fas fa-heart' : 'far fa-heart'}
      aria-label={label}
      aria-pressed={liked ? 'true' : 'false'}
      title={label}
      onclick={onclick}
    />
  );

  if (original) items.setContent('like', content);
  else items.add('like', content, 20);
}

/**
 * mentions 的“回复”（没有它时用主题自带的），带图标和文字。
 * 访客看不到：在 Discourse 中他通过主题末尾的按钮回复。
 */
function restyleReply(post: PostModel, items: ItemList<Mithril.Children>) {
  const className = 'Button Button--flat LcoyPostAction LcoyPostAction--reply';

  if (!app.session.user) {
    if (items.has('reply')) items.remove('reply');
    return;
  }

  if (items.has('reply')) {
    const original = items.get('reply') as any;

    items.setContent(
      'reply',
      <Button {...(original?.attrs || {})} className={className} icon="fas fa-reply">
        {original?.children}
      </Button>
    );

    return;
  }

  const discussion = post.discussion();

  if (post.isHidden() || !discussion.canReply()) return;

  items.add(
    'reply',
    <Button className={className} icon="fas fa-reply" onclick={() => DiscussionControls.replyAction.call(discussion, true, false).catch(() => {})}>
      {t('topic.post.reply')}
    </Button>,
    -100
  );
}

/** Discourse 的“…”：消失并让位给控制项，作为操作栏中的图标。 */
function addMore(component: any, post: PostModel, ui: PostUi, items: ItemList<Mithril.Children>) {
  const list = PostControls.controls(post, component).toArray();

  // 有些扩展把条目作为 vnode 列表返回（fof/split 的
  // “从此处拆分”）：展平只是为了判断是否有内容可显示。
  if (!flattenControls(list).length) return;

  // “…”打开一个带控制项（图标 + 文字）的菜单，而不是把图标
  // 铺在操作栏上：有管理操作、扩展和隐藏帖时，一行里会有太多
  // 按钮（用户要求）。
  items.add(
    'lcoyMore',
    // “…”的提示在菜单打开时隐藏（否则会盖在条目上）。
    <Tooltip text={t('topic.post.more_short')} tooltipVisible={ui.more ? false : undefined}>
      <Dropdown
        className="LcoyPostMore"
        buttonClassName="Button Button--icon Button--flat LcoyPostAction LcoyPostAction--more"
        menuClassName="Dropdown-menu--right"
        icon="fas fa-ellipsis-h"
        caretIcon=""
        label=""
        accessibleToggleLabel={t('topic.post.show_more')}
        // 帖子只在 `ui.version` 变化时重绘（SubtreeRetainer）：
        // 没有这一手，菜单第二次打不开。
        onshow={() => {
          togglePostUi(ui, 'more', true);
          m.redraw();
        }}
        onhide={() => {
          togglePostUi(ui, 'more', false);
          m.redraw();
        }}
      >
        {list}
      </Dropdown>
    </Tooltip>,
    -50
  );
}

/** 展平控制项条目（vnode、vnode 列表或空条目）并去掉分隔符。 */
function flattenControls(list: any[]): any[] {
  const out: any[] = [];

  list.forEach((item: any) => {
    if (!item || item.tag === Separator) return;

    if (Array.isArray(item)) {
      const inner = flattenControls(item);
      const name = (item as any).itemName as string | undefined;

      // 条目名（itemName）保留在列表上；内部的按钮继承它。
      inner.forEach((child, i) => {
        if (child && typeof child === 'object' && !child.itemName) child.itemName = inner.length > 1 ? `${name || 'item'}-${i}` : name;
      });
      out.push(...inner);
      return;
    }

    out.push(item);
  });

  return out;
}

interface ShareActionAttrs {
  post: PostModel;
  ui: PostUi;
}

/** 图标保持“已复制”状态的时间。 */
const COPIED_MS = 2000;

/**
 * Discourse 的链接：点击立即复制帖子地址（不弹窗口），
 * 图标短暂变成一个“对勾”。
 */
class ShareAction {
  view(vnode: Mithril.Vnode<ShareActionAttrs, this>) {
    const { post, ui } = vnode.attrs;

    const copy = () => {
      const url = absoluteUrl(app.route.post(post));
      const done = () => {
        window.clearTimeout(ui.copiedTimer);
        togglePostUi(ui, 'share', true);
        m.redraw();
        ui.copiedTimer = window.setTimeout(() => {
          togglePostUi(ui, 'share', false);
          m.redraw();
        }, COPIED_MS);
      };

      copyText(url).then((ok) => ok && done());
    };

    // 刚复制完时，“链接已复制！”的反馈（motion/feedback）
    // 占据按钮上方提示的位置。
    return (
      <Tooltip text={t('topic.post.share_short')} tooltipVisible={ui.share ? false : undefined}>
        <Button
          className={classList('Button Button--icon Button--flat LcoyPostAction LcoyPostAction--share', { 'LcoyPostAction--copied': ui.share })}
          icon="fas fa-link"
          aria-label={t('topic.post.share')}
          onclick={copy}
        />
      </Tooltip>
    );
  }
}

// ---------------------------------------------------------------------------
// 页脚：点赞者和内嵌回复
// ---------------------------------------------------------------------------

function buildFooter(component: any, items: ItemList<Mithril.Children>) {
  const post: PostModel = component.attrs.post;
  const ui = postUi(component);

  if (topicSettings.postActions() && isExtensionEnabled('flarum-likes')) {
    // “某某赞了这篇”这句话变成点赞者 popover，由操作栏左侧的
    // 计数打开。
    items.remove('liked');
  }

  if (topicSettings.embeddedReplies()) {
    items.remove('replies');

    if (ui.replies) items.add('lcoyEmbeddedReplies', <EmbeddedReplies post={post} ui={ui} />, 90);
  }
}

/**
 * 点赞者，供 popover 使用：随帖子返回的用户；如果计数显示还有更多，
 * 则通过 API 取完整列表（flarum/likes 的 `liked` 过滤器）。
 */
export function likers(post: PostModel): Promise<ReactorEntry[]> {
  const loaded: User[] = ((post as any).likes?.() || []).filter(Boolean);
  const count = Number(post.attribute('likesCount')) || loaded.length;
  const entries = (users: User[]) => users.map((user) => ({ user, icon: heartIcon() }));

  if (loaded.length >= count) return Promise.resolve(entries(loaded));

  return app.store
    .find<User[]>('users', { filter: { liked: post.id()! }, page: { limit: 50 } } as any, undefined, { errorHandler: () => {} })
    .then((users) => entries(Array.from(users)))
    .catch(() => entries(loaded));
}

interface EmbeddedRepliesAttrs {
  post: PostModel;
  ui: PostUi;
}

class EmbeddedReplies {
  loading = false;

  replies(post: PostModel): PostModel[] {
    return (((post as any).mentionedBy?.() || []) as PostModel[])
      .filter((reply) => reply && !reply.isHidden())
      .sort((a, b) => a.number() - b.number());
  }

  oninit(vnode: Mithril.Vnode<EmbeddedRepliesAttrs, this>) {
    const replies = this.replies(vnode.attrs.post);

    if (replies.every((reply) => reply.contentHtml())) return;

    this.loading = true;

    loadMissingContent(replies)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        vnode.attrs.ui.version++;
        m.redraw();
      });
  }

  view(vnode: Mithril.Vnode<EmbeddedRepliesAttrs, this>) {
    const post = vnode.attrs.post;
    const replies = this.replies(post);
    const total = Number(post.attribute('mentionedByCount')) || replies.length;
    const MentionedByModal = (flarum as any).reg.checkModule('flarum-mentions', 'forum/components/MentionedByModal');

    return (
      <div className="LcoyEmbedded LcoyEmbedded--bottom">
        {this.loading ? embeddedLoading() : replies.map((reply) => <EmbeddedPost post={reply} direction="down" />)}
        {!this.loading && total > replies.length && MentionedByModal && (
          <Button className="Button Button--flat LcoyEmbedded-more" onclick={() => app.modal.show(MentionedByModal, { post })}>
            {t('topic.post.more_replies', { count: total - replies.length })}
          </Button>
        )}
      </div>
    );
  }
}

/**
 * 提及了一篇读者看不到的帖子（隐藏、已删除或位于受限主题）：
 * mentions 会在回复胶囊中写“[未知]”。改为不带胶囊和链接的普通文字，
 * 因为对读者来说它哪里也去不了。
 */
function markUnavailableMentions(body: HTMLElement): void {
  const unknown = extractText(app.translator.trans('flarum-mentions.forum.post_mention.deleted_text'));

  body.querySelectorAll<HTMLElement>('.PostMention').forEach((link) => {
    if (link.classList.contains('PostMention--deleted') || (unknown && link.textContent?.trim() === unknown)) {
      const span = document.createElement('span');
      span.className = 'LcoyMention-unavailable';
      span.textContent = t('topic.post.mention_unavailable');
      link.replaceWith(span);
    }
  });
}
