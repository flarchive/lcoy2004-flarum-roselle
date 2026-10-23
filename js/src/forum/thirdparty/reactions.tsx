/*
 * fof/reactions，按照 discourse-reactions 的方式呈现。
 *
 * 在主题的操作栏和 flarum/likes 启用时，点赞与回应
 * 合并为一个按钮，与 Discourse 相同：
 *
 * - 栏中的心形：点击点赞（或取消）；悬停（或在移动端长按）
 *   会在上方打开选择器，显示 fof/reactions 已启用的回应，
 *   按其顺序排列。fof 的 "heart" 回应，无论位于列表何处，
 *   都是 flarum/likes 的点赞；其他则是 fof 的回应。每个人
 *   对每个帖子只能有一个回应：在已点赞时选择某个 emoji
 *   会取消点赞，在已有 emoji 时选择心形会移除该回应。
 *   回应后，按钮显示所选的 emoji；点击它会取消。
 * - 左侧只有一个计数：最多三个 emoji（最常用的在前，
 *   包含点赞的心形）叠加显示，再加上总数。点击会打开
 *   回应者列表，每人显示自己的 emoji。
 *
 * 没有主题的操作栏或没有 flarum/likes 时，fof 的回应按钮
 * 仍然保留（使用相同的网格选择器），摘要显示在点赞旁边。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import CommentPost from 'flarum/forum/components/CommentPost';
import PostControls from 'flarum/forum/utils/PostControls';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import haptic from 'flarum/common/utils/haptic';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { isExtensionEnabled, t } from '../utils/settings';
import { extModule, thirdParty } from './settings';
import { postUi, topicSettings, type PostUi } from '../topic/ui';
import { likers } from '../topic/posts';
import { heartIcon, openWhoReacted, type ReactorEntry } from '../topic/components/WhoReactedPopover';

/** 摘要显示多少个 emoji（Discourse 中 `nth-of-type(1n + 4)` 会隐藏）。 */
const SUMMARY_EMOJIS = 3;

/** fof 中代表 flarum/likes 点赞的回应。 */
const HEART = 'heart';

/** discourse-reactions 的延迟：悬停打开、离开关闭、长按。 */
const OPEN_DELAY = 250;
const CLOSE_DELAY = 300;
const LONG_PRESS = 400;

/** 选择器与窗口边缘的最小距离。 */
const EDGE = 8;

function reactionComponent(): any {
  return extModule<any>('fof-reactions', 'common/components/ReactionComponent');
}

function reactToPostFn(): ((post: Post, reaction: any, loading: Record<string, boolean>) => unknown) | null {
  const mod = extModule<any>('fof-reactions', 'forum/utils/reactToPost');

  return mod ? mod.default || mod : null;
}

/**
 * fof/reactions 已启用的回应，按其顺序（由 fof 的
 * 管理员管理）：帖子选择器和私信选择器都使用这个列表。
 */
export function enabledReactions(): any[] {
  const fromForum = (app.forum as any)?.reactions?.();
  const list: any[] = Array.isArray(fromForum) && fromForum.length ? fromForum : (app.store.all('reactions') as any[]);

  return list.filter((reaction) => reaction && reaction.enabled?.() !== false);
}

function heartReaction(): any {
  return (app.store.all('reactions') as any[]).find((reaction) => reaction.identifier?.() === HEART) || null;
}

/** 点赞的 ❤️：使用 fof 的 emoji，以便与其他保持一致；没有它时用图标。 */
function heartEmoji(): Mithril.Children {
  const ReactionComponent = reactionComponent();
  const heart = heartReaction();

  return ReactionComponent && heart ? m(ReactionComponent, { reaction: heart }) : heartIcon();
}

function reactionEmoji(reaction: any): Mithril.Children {
  const ReactionComponent = reactionComponent();

  return ReactionComponent && reaction ? m(ReactionComponent, { reaction }) : null;
}

function reactionLabel(reaction: any): string {
  return String(reaction?.display?.() || reaction?.identifier?.() || '');
}

function counts(post: Post): Array<[string, number]> {
  const raw: Record<string, number> = (post as any).reactionCounts?.() || {};

  return Object.keys(raw)
    .map((id) => [id, Number(raw[id]) || 0] as [string, number])
    .filter(([id, count]) => count > 0 && !!app.store.getById('reactions', id))
    .sort((a, b) => b[1] - a[1]);
}

/** 在主题的操作栏和两个扩展都具备时才进行合并。 */
function unified(): boolean {
  return thirdParty.reactions() && topicSettings.postActions() && isExtensionEnabled('flarum-likes');
}

function isLiked(post: Post): boolean {
  const user = app.session.user;

  return !!user && ((post as any).likes?.() || []).some((liker: any) => liker === user);
}

/** 读者在该帖子上的 fof 回应（"heart" 计为点赞）。 */
function myReaction(post: Post): any {
  const id = (post as any).userReaction?.();
  const counted = id && Number(((post as any).reactionCounts?.() || {})[id]) > 0;

  return counted ? app.store.getById('reactions', String(id)) || null : null;
}

/**
 * 按 flarum/likes 的方式点赞/取消点赞，但返回 promise（以便
 * 随后把点赞换成 emoji），并立即更新计数。
 */
function setLiked(post: Post, value: boolean): Promise<unknown> {
  const user = app.session.user!;
  const data: any = post.data;
  const relationships = (data.relationships ??= {});
  const likes = (relationships.likes ??= { data: [] }).data as Array<{ type: string; id: string }>;
  const index = likes.findIndex((like) => like.id === user.id());
  const count = Number(post.attribute('likesCount')) || 0;

  if (index !== -1) likes.splice(index, 1);
  if (value) likes.unshift({ type: 'users', id: user.id()! });
  if (value) haptic('success');

  // 改变帖子的 "新鲜度"：SubtreeRetainer 会立即重绘。
  post.pushAttributes({ likesCount: Math.max(0, count + (value ? 1 : -1)) } as any);
  m.redraw();

  return post.save({ isLiked: value } as any).catch(() => {});
}

// ---------------------------------------------------------------------------
// 回应者
// ---------------------------------------------------------------------------

/** fof PostReaction 的关系（或属性）id。 */
function relatedId(item: any, relation: string, attribute: string): string | null {
  const id = item?.data?.relationships?.[relation]?.data?.id ?? item?.attribute?.(attribute);

  return id === null || id === undefined ? null : String(id);
}

/**
 * 使用 emoji 回应的人。fof 2.x 的 PostReaction 模型不会解析
 * 关系（`user()` 返回 getter，`reaction()` 读取一个不
 * 存在的属性）：用户和回应通过响应中已包含的 id 获取。
 */
function reactors(post: Post): Promise<ReactorEntry[]> {
  return app.store
    .find<any[]>('post_reactions', { filter: { post: post.id()! }, include: 'user,reaction', page: { limit: 50 } } as any, undefined, {
      errorHandler: () => {},
    })
    .then((list) =>
      Array.from(list || [])
        .map((item: any) => {
          const userId = relatedId(item, 'user', 'userId');
          const reactionId = relatedId(item, 'reaction', 'reactionId');

          return {
            user: userId ? app.store.getById<any>('users', userId) : null,
            reaction: reactionId ? app.store.getById('reactions', reactionId) : null,
          };
        })
        .filter((entry) => entry.user && entry.reaction)
        .map((entry) => ({ user: entry.user, icon: reactionEmoji(entry.reaction) }))
    );
}

/** 点赞者（带 ❤️）和使用 emoji 回应的人，合并在一个弹出层中。 */
function everyone(post: Post, canSeeReactions: boolean): Promise<ReactorEntry[]> {
  const likes = likers(post)
    .then((entries) => entries.map((entry) => ({ ...entry, icon: heartEmoji() })))
    .catch(() => [] as ReactorEntry[]);
  const others = canSeeReactions ? reactors(post).catch(() => [] as ReactorEntry[]) : Promise.resolve([] as ReactorEntry[]);

  return Promise.all([likes, others]).then(([a, b]) => a.concat(b));
}

// ---------------------------------------------------------------------------
// 左侧的摘要
// ---------------------------------------------------------------------------

interface SummaryEntry {
  key: string;
  count: number;
  icon: Mithril.Children;
}

function summaryButton(entries: SummaryEntry[], onclick: ((event: MouseEvent) => void) | null): Mithril.Children {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const label = t('thirdparty.reactions.summary', { count: total });

  const body = [
    <span className="LcoyReactions-list">
      {entries.slice(0, SUMMARY_EMOJIS).map((entry) => (
        <span className="LcoyReactions-emoji">{entry.icon}</span>
      ))}
    </span>,
    <span className="LcoyReactions-count">{abbreviateNumber(total)}</span>,
  ];

  return onclick ? (
    <Button className="Button Button--flat LcoyPostAction LcoyReactions" aria-haspopup="dialog" aria-label={label} title={label} onclick={onclick}>
      {body}
    </Button>
  ) : (
    <span className="LcoyReactions LcoyReactions--static" aria-label={label} title={label}>
      {body}
    </span>
  );
}

function unifiedSummary(post: Post): Mithril.Children {
  const heart = heartReaction();
  const heartId = heart ? String(heart.id()) : null;
  const likeCount = Number(post.attribute('likesCount')) || ((post as any).likes?.() || []).length;
  let hearts = likeCount;
  const entries: SummaryEntry[] = [];

  counts(post).forEach(([id, count]) => {
    if (id === heartId) hearts += count;
    else entries.push({ key: id, count, icon: reactionEmoji(app.store.getById('reactions', id)) });
  });

  if (hearts > 0) entries.push({ key: HEART, count: hearts, icon: heartEmoji() });

  if (!entries.length) return null;

  // 最常用的在前；相同时，心形优先。
  entries.sort((a, b) => b.count - a.count || (a.key === HEART ? -1 : b.key === HEART ? 1 : 0));

  const canSee = !!(post.discussion() as any)?.canSeeReactions?.();

  // 没有查看回应者的权限且没有点赞（点赞是公开的）时，
  // 列表会是空的：摘要只作为计数，不打开任何内容。
  if (!canSee && likeCount === 0) return summaryButton(entries, null);

  return summaryButton(entries, (event) => openWhoReacted(event.currentTarget as HTMLElement, () => everyone(post, canSee)));
}

// ---------------------------------------------------------------------------
// 带选择器的心形按钮
// ---------------------------------------------------------------------------

interface Choice {
  key: string;
  label: string;
  icon: Mithril.Children;
  used: boolean;
  reaction: any;
}

function choices(post: Post): Choice[] {
  if (!app.session.user) return [];

  const canLike = !!(post as any).canLike?.();
  const canReact = !!(post as any).canReact?.();
  const mine = myReaction(post);
  const liked = isLiked(post);
  const list: Choice[] = [];
  let heartAdded = false;

  const addHeart = () => {
    if (heartAdded || !canLike) return;

    heartAdded = true;
    list.push({
      key: HEART,
      label: t('thirdparty.reactions.like_reaction'),
      icon: heartEmoji(),
      used: liked && (!mine || mine.identifier?.() === HEART),
      reaction: null,
    });
  };

  enabledReactions().forEach((reaction) => {
    if (reaction.identifier?.() === HEART) return addHeart();
    if (!canReact) return;

    list.push({
      key: String(reaction.id()),
      label: reactionLabel(reaction),
      icon: reactionEmoji(reaction),
      used: !!mine && mine === reaction,
      reaction,
    });
  });

  // 没有在 fof 中启用 "heart" 时，点赞排在最前，与 Discourse 相同。
  if (!heartAdded && canLike) {
    addHeart();
    list.unshift(list.pop()!);
  }

  return list;
}

interface ReactButtonAttrs {
  post: Post;
  ui: PostUi;
}

class LcoyReactButton {
  open = false;
  element: HTMLElement | null = null;
  hoverTimer = 0;
  pressTimer = 0;
  suppressClick = false;
  loading: Record<string, boolean> = {};
  attrs!: ReactButtonAttrs;

  onDocument = (event: Event) => {
    if (!this.open || !this.element) return;

    if (event instanceof KeyboardEvent) {
      if (event.key === 'Escape') {
        this.setOpen(false);
        (this.element.querySelector('.LcoyReact-button') as HTMLElement | null)?.focus();
      }

      return;
    }

    if (!this.element.contains(event.target as Node)) this.setOpen(false);
  };

  view(vnode: Mithril.Vnode<ReactButtonAttrs, this>) {
    this.attrs = vnode.attrs;

    const { post, ui } = vnode.attrs;
    const guest = !app.session.user;
    const mine = myReaction(post);
    const emojiMine = mine && mine.identifier?.() !== HEART ? mine : null;
    const liked = isLiked(post) || (!!mine && !emojiMine);
    // 只有心形（例如在自己的帖子上没有回应权限）：按钮
    // 本身就会点赞，因此没有选择器 —— 与 Discourse 相同。
    const all = choices(post);
    const list = all.length === 1 && all[0].key === HEART ? [] : all;
    const label = guest
      ? t('topic.post.like_guest')
      : emojiMine
        ? t('thirdparty.reactions.remove')
        : t(liked ? 'topic.post.unlike' : 'topic.post.like');

    return (
      <div
        className={classList('LcoyReact', { 'is-open': this.open, 'has-reacted': liked || !!emojiMine, 'has-picker': list.length > 0 })}
        onpointerenter={(event: PointerEvent) => this.hover(event, true)}
        onpointerleave={(event: PointerEvent) => this.hover(event, false)}
        onfocusout={(event: FocusEvent) => {
          if (this.element && !this.element.contains(event.relatedTarget as Node)) this.setOpen(false);
        }}
      >
        <Button
          className={classList('Button Button--flat LcoyPostAction LcoyReact-button', {
            'Button--icon LcoyLike-toggle': !emojiMine,
            'LcoyLike--liked': !emojiMine && liked,
            'LcoyLike--bump': !emojiMine && liked && ui.likeBump && Date.now() - ui.likeBump < 1000,
            'LcoyReact-button--emoji': !!emojiMine,
          })}
          icon={emojiMine ? undefined : liked ? 'fas fa-heart' : 'far fa-heart'}
          aria-label={label}
          aria-pressed={liked || emojiMine ? 'true' : 'false'}
          aria-haspopup={list.length ? 'menu' : undefined}
          aria-expanded={list.length ? (this.open ? 'true' : 'false') : undefined}
          title={label}
          loading={!!this.loading[null as any]}
          onpointerdown={(event: PointerEvent) => this.press(event)}
          onpointerup={() => window.clearTimeout(this.pressTimer)}
          onpointercancel={() => window.clearTimeout(this.pressTimer)}
          oncontextmenu={(event: Event) => {
            if (this.open) event.preventDefault();
          }}
          onkeydown={(event: KeyboardEvent) => {
            if (event.key !== 'ArrowUp' || !list.length) return;

            event.preventDefault();
            this.setOpen(true);
            (this.element?.querySelector('.LcoyReactPicker-item') as HTMLElement | null)?.focus();
          }}
          onclick={() => this.main()}
        >
          {emojiMine ? reactionEmoji(emojiMine) : null}
        </Button>
        {list.length ? (
          <div className="LcoyReactPicker" role="menu" aria-label={t('thirdparty.reactions.picker')}>
            <div className="LcoyReactPicker-container" style={`--lcoy-react-cols: ${Math.min(7, list.length)}`}>
              {list.map((choice) => (
                <button
                  type="button"
                  role="menuitem"
                  className={classList('LcoyReactPicker-item', { 'is-used': choice.used })}
                  title={choice.label}
                  aria-label={t('thirdparty.reactions.react_with', { reaction: choice.label })}
                  onclick={(event: MouseEvent) => {
                    event.stopPropagation();
                    this.pick(choice);
                  }}
                >
                  {choice.icon}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<ReactButtonAttrs, this>) {
    this.element = vnode.dom as HTMLElement;
  }

  onupdate(vnode: Mithril.VnodeDOM<ReactButtonAttrs, this>) {
    this.element = vnode.dom as HTMLElement;
  }

  onremove() {
    window.clearTimeout(this.hoverTimer);
    window.clearTimeout(this.pressTimer);
    this.unlisten();
  }

  hasPicker(): boolean {
    return !!this.element?.querySelector('.LcoyReactPicker');
  }

  /** 选择器以 Discourse 的延迟打开（或关闭），仅限鼠标。 */
  hover(event: PointerEvent, inside: boolean) {
    if (event.pointerType !== 'mouse' || !this.hasPicker()) return;

    window.clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => this.setOpen(inside), inside ? OPEN_DELAY : CLOSE_DELAY);
  }

  /** 触摸时，按住心形会打开选择器（随后的点击不会点赞）。 */
  press(event: PointerEvent) {
    this.suppressClick = false;

    if (event.pointerType === 'mouse' || !this.hasPicker()) return;

    window.clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      this.suppressClick = true;
      haptic('selection' as any);
      this.setOpen(true);
    }, LONG_PRESS);
  }

  /**
   * 直接操作类名来打开/关闭：帖子由
   * SubtreeRetainer 保留，不会因为这一部分的局部状态而重绘。
   */
  setOpen(open: boolean) {
    window.clearTimeout(this.hoverTimer);

    if (this.open === open) return;

    this.open = open;

    const el = this.element;

    if (!el) return;

    el.classList.toggle('is-open', open);
    el.querySelector('.LcoyReact-button')?.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      this.place();
      document.addEventListener('pointerdown', this.onDocument, true);
      document.addEventListener('keydown', this.onDocument, true);
    } else {
      this.unlisten();
    }
  }

  unlisten() {
    document.removeEventListener('pointerdown', this.onDocument, true);
    document.removeEventListener('keydown', this.onDocument, true);
  }

  /** 与按钮左对齐（与 Meta 相同），且不超出窗口。 */
  place() {
    const picker = this.element?.querySelector('.LcoyReactPicker') as HTMLElement | null;

    if (!picker) return;

    picker.style.setProperty('--lcoy-react-shift', '0px');

    const rect = picker.getBoundingClientRect();
    const overflowRight = rect.right - (document.documentElement.clientWidth - EDGE);
    let shift = 0;

    if (overflowRight > 0) shift = -overflowRight;
    if (rect.left + shift < EDGE) shift = EDGE - rect.left;

    picker.style.setProperty('--lcoy-react-shift', `${Math.round(shift)}px`);
  }

  main() {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }

    const { post, ui } = this.attrs;

    if (!app.session.user) {
      app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/LogInModal'));
      return;
    }

    this.setOpen(false);

    const mine = myReaction(post);

    if (mine) {
      this.react(null);
      return;
    }

    if ((post as any).canLike?.()) {
      const liked = isLiked(post);

      if (!liked) ui.likeBump = Date.now();

      setLiked(post, !liked);
      return;
    }

    // 无法点赞（例如自己的帖子）时，点击会打开选择器。
    if (this.hasPicker()) this.setOpen(true);
  }

  react(reaction: any): Promise<unknown> {
    const fn = reactToPostFn();

    if (!fn) return Promise.resolve();

    return Promise.resolve(fn(this.attrs.post, reaction, this.loading)).then(() => m.redraw());
  }

  async pick(choice: Choice) {
    const { post, ui } = this.attrs;
    const mine = myReaction(post);
    const liked = isLiked(post);

    this.setOpen(false);

    if (choice.key === HEART) {
      if (choice.used) {
        if (mine) await this.react(null);
        if (liked) await setLiked(post, false);
        return;
      }

      if (mine) await this.react(null);

      ui.likeBump = Date.now();
      await setLiked(post, true);
      return;
    }

    if (choice.used) {
      await this.react(null);
      return;
    }

    if (liked) await setLiked(post, false);

    await this.react(choice.reaction);
  }
}

// ---------------------------------------------------------------------------

function unifiedActions(component: any, post: Post, items: ItemList<Mithril.Children>) {
  items.remove('react');
  items.remove('lcoyLikeCount');

  const summary = unifiedSummary(post);

  if (summary) items.add('lcoyReactions', summary, 1050);

  const guest = !app.session.user;

  if (!guest && !(post as any).canLike?.() && !(post as any).canReact?.()) {
    items.remove('like');
    return;
  }

  const button = m(LcoyReactButton, { post, ui: postUi(component) });

  if (items.has('like')) items.setContent('like', button);
  else items.add('like', button, 20);
}

function legacySummary(post: Post, items: ItemList<Mithril.Children>) {
  const list = counts(post);

  if (!list.length) return;

  const canSee = !!(post.discussion() as any)?.canSeeReactions?.();
  const entries = list.map(([id, count]) => ({ key: id, count, icon: reactionEmoji(app.store.getById('reactions', id)) }));

  items.add(
    'lcoyReactions',
    summaryButton(entries, canSee ? (event) => openWhoReacted(event.currentTarget as HTMLElement, () => reactors(post)) : null),
    1050
  );
}

export default function installReactions(): void {
  extend(CommentPost.prototype, 'footerItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.reactions()) return;

    items.remove('reactionCounts');
  });

  // 在 beforeMount 中，与主题的操作栏（topic/index.ts）相同：在它之后
  // 注册，就在它之后运行，并能看到它已重新处理的点赞按钮。
  app.beforeMount(() => {
    extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
      if (!thirdParty.reactions()) return;

      const post: Post = this.attrs.post;

      if (post.isHidden()) return;

      if (unified()) unifiedActions(this, post, items);
      else legacySummary(post, items);
    });
  });

  // fof 放在帖子控件中的 "查看回应"（心形）会与操作栏左侧的
  // 摘要重复，而摘要本身就能打开回应者：在 Discourse 中
  // 心形只出现一次。
  app.beforeMount(() => {
    extend(PostControls, 'moderationControls', function (items: ItemList<Mithril.Children>) {
      if (thirdParty.reactions() && topicSettings.postActions() && items.has('viewReactions')) items.remove('viewReactions');
    });
  });

  // 合并时 fof 的按钮消失，即使它在主题之后加入。
  override('ext:fof/reactions/forum/components/PostReactAction', 'view', function (this: any, original: () => Mithril.Children) {
    return unified() ? null : original();
  });

  // 不合并时：使用 fof 的选择器，显示已启用的回应，按其顺序。
  override('ext:fof/reactions/forum/components/PostReactAction', 'unreactButton', function (this: any, original: () => Mithril.Children) {
    if (!thirdParty.reactions()) return original();

    const post: Post = this.post;
    const mine = app.store.getById('reactions', (post as any).userReaction?.());
    const reactToPost = reactToPostFn();

    if (!mine || !reactionComponent() || !reactToPost) return original();

    const label = app.translator.trans('fof-reactions.forum.unreact_button_label', {}, true) as string;

    return (
      <Button
        className="Button Button--link Reactions--ShowReactions LcoyReactions-mine"
        title={label}
        aria-label={label}
        loading={this.loading?.[null as any]}
        onclick={() => reactToPost(post, null, this.loading)}
      >
        {reactionEmoji(mine)}
      </Button>
    );
  });
}
