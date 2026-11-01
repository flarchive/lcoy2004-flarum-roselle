/*
 * 外壳尚未实现的 Discourse 键盘快捷键
 *（services/keyboard-shortcuts.js）：用 j/k 在主题的帖子间移动，并对
 * 选中的帖子执行操作（l 点赞，b 收藏，s 分享，e 编辑，r 回复，q 引用，
 * d 删除，! 举报，t 关联合并主题），# 跳转到某篇帖子，Home/End，
 * shift+l 到第一条未读，shift+r 回复主题，shift+s 分享主题，shift+p 置顶，
 * shift+a 主题菜单，f 收藏主题，m w/t/r/m 通知级别，
 * shift+j/k 在列表标签页之间切换，x/shift+b 批量选择，
 * shift+d“忽略”，“.”实时新主题，p 用户菜单，shift+c 编辑器，
 * ctrl+alt+f 搜索，ctrl+p 打印，以及 g n/g u/
 * g b/g m/g d/g j/g k/g s。
 *
 * 监听器运行在 document 的捕获阶段，先于外壳的监听器（shell/
 * shortcuts.ts）：如果按键属于这里，它就在此停止事件；如果不属于，
 * 就放行，由外壳处理自己的。这样外壳无需改动。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import IndexPage from 'flarum/forum/components/IndexPage';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import PostControls from 'flarum/forum/utils/PostControls';
import { getPlainContent } from 'flarum/common/utils/string';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

import { SHORTCUT_GROUPS } from '../shell/shortcuts';
import { gaps } from './settings';
import { openShare } from './topic/share';
import { forumBool, isExtensionEnabled } from '../utils/settings';
import { isTypingTarget } from '../utils/keyboard';
import { canReplyAsLinkedTopic, replyAsLinkedTopic } from '../features/composer/installLinkedTopic';
import { printDiscussion } from '../features/extras/print';
import { bookmarksEnabled, createBookmark, deleteBookmark, firstPostOf, postBookmark } from '../features/bookmarks/actions';
import { bulkAvailable, selection } from '../features/extras/bulk/selection';
import { draftsOn } from '../features/composer/drafts/fofDrafts';

const SELECTED = 'LcoyPostSelected';
const LIST_SELECTED = 'LcoySelected';
const SEQUENCE_TIMEOUT_MS = 1000;
/** 两次 j/k 快于此值：不启用平滑滚动。 */
const FAST_MS = 150;

let pending: string | null = null;
let pendingTimer: number | undefined;
let lastMove = 0;

// ---------------------------------------------------------------------------
// 帮助（“?”）：新快捷键加入窗口已绘制的分组。
// ---------------------------------------------------------------------------

function addHelp(): void {
  const group = (name: string) => {
    let found = SHORTCUT_GROUPS.find((item) => item.name === name);

    if (!found) {
      found = { name, shortcuts: [] };
      SHORTCUT_GROUPS.push(found);
    }

    return found;
  };

  group('jump_to').shortcuts.push(
    { keys: ['g n'], action: 'new' },
    { keys: ['g u'], action: 'unread' },
    { keys: ['g b'], action: 'bookmarks' },
    { keys: ['g m'], action: 'messages' },
    { keys: ['g d'], action: 'drafts' },
    { keys: ['g j', 'g k'], action: 'next_prev_topic_jump' },
    { keys: ['g s'], action: 'suggested' }
  );

  group('navigation').shortcuts.push(
    { keys: ['#'], action: 'jump_to_post' },
    { keys: ['Home', 'End'], action: 'first_last_post' },
    { keys: ['shift+l'], action: 'first_unread' },
    { keys: ['shift+j', 'shift+k'], action: 'next_prev_section' },
    { keys: ['.'], action: 'show_incoming' }
  );

  group('application').shortcuts.push(
    { keys: ['p'], action: 'user_menu' },
    { keys: ['shift+c'], action: 'focus_composer' },
    { keys: ['ctrl+alt+f'], action: 'search_global' },
    { keys: ['shift+z shift+z'], action: 'log_out' }
  );

  group('actions').shortcuts.push(
    { keys: ['f'], action: 'bookmark_topic' },
    { keys: ['shift+p'], action: 'pin_topic' },
    { keys: ['shift+s'], action: 'share_topic' },
    { keys: ['shift+r'], action: 'reply_topic' },
    { keys: ['r'], action: 'reply_post' },
    { keys: ['q'], action: 'quote_post' },
    { keys: ['t'], action: 'reply_linked' },
    { keys: ['l'], action: 'like_post' },
    { keys: ['b'], action: 'bookmark_post' },
    { keys: ['s'], action: 'share_post' },
    { keys: ['e'], action: 'edit_post' },
    { keys: ['d'], action: 'delete_post' },
    { keys: ['!'], action: 'flag_post' },
    { keys: ['shift+a'], action: 'topic_menu' },
    { keys: ['ctrl+p'], action: 'print' },
    { keys: ['m w'], action: 'watch_topic' },
    { keys: ['m r'], action: 'regular_topic' },
    { keys: ['m m'], action: 'mute_topic' },
    { keys: ['x'], action: 'bulk_item' },
    { keys: ['shift+b'], action: 'bulk_toggle' },
    { keys: ['shift+d'], action: 'dismiss' }
  );
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function headerOffset(): number {
  const header = document.querySelector<HTMLElement>('.App-header, #header');

  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
}

function currentDiscussion(): Discussion | null {
  return app.current.matches(DiscussionPage) ? app.current.get('discussion') || null : null;
}

function currentStream(): any {
  return app.current.matches(DiscussionPage) ? app.current.get('stream') || null : null;
}

function click(selector: string, scope: ParentNode = document): boolean {
  const element = Array.from(scope.querySelectorAll<HTMLElement>(selector)).find((el) => el.offsetParent !== null || el === document.activeElement);

  if (!element) return false;

  element.click();

  return true;
}

/** 执行 ItemList 条目（Button）的 onclick，而不绘制它。 */
function runItem(item: any): boolean {
  const onclick = item?.attrs?.onclick;

  if (typeof onclick !== 'function') return false;

  onclick();

  return true;
}

// ---------------------------------------------------------------------------
// 帖子选择（主题中的 j/k）
// ---------------------------------------------------------------------------

function articles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.PostStream-item[data-number]')).filter(
    (item) => !!item.querySelector('.CommentPost, .EventPost')
  );
}

function selectedArticle(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.PostStream-item.${SELECTED}`);
}

function selectedPost(): { element: HTMLElement; post: Post } | null {
  const element = selectedArticle();
  const id = element?.dataset.id;
  const post = id ? app.store.getById<Post>('posts', id) : null;

  return element && post ? { element, post } : null;
}

function scrollToTop(element: HTMLElement, fast: boolean): void {
  const top = element.getBoundingClientRect().top + window.scrollY - headerOffset() - 8;

  window.scrollTo({ top: Math.max(0, top), behavior: fast ? 'auto' : 'smooth' });
}

/** Discourse 的 _moveSelection：长帖子先按页滚动，再切换。 */
function movePostSelection(direction: number, scrollWithinPosts: boolean): void {
  const now = Date.now();
  const fast = now - lastMove < FAST_MS;
  lastMove = now;

  const list = articles();

  if (!list.length) return;

  const offset = headerOffset();
  let selected = list.find((item) => item.classList.contains(SELECTED)) || null;

  // 屏幕外的选择会被丢弃：键盘行为与鼠标滚动保持一致。
  if (selected && !fast) {
    const rect = selected.getBoundingClientRect();

    if (rect.bottom < offset || rect.top > window.innerHeight) selected = null;
  }

  if (!selected) {
    selected =
      list.find((item) => (direction > 0 ? item.getBoundingClientRect().top >= offset : item.getBoundingClientRect().bottom >= offset)) ||
      list[list.length - 1];
    direction = 0;
  }

  if (!fast && direction !== 0 && scrollWithinPosts) {
    const rect = selected.getBoundingClientRect();
    const begin = rect.top + window.scrollY;
    const end = begin + rect.height;
    const screenTop = window.scrollY;
    const screenBottom = screenTop + window.innerHeight;

    if (direction < 0 && screenTop > begin - offset + 1) {
      window.scrollTo({ top: Math.max(screenTop - window.innerHeight + 3 * offset, begin - offset), behavior: 'smooth' });
      return;
    }

    if (direction > 0 && screenBottom < end - offset) {
      window.scrollTo({ top: Math.min(screenBottom - 3 * offset, end - window.innerHeight), behavior: 'smooth' });
      return;
    }
  }

  const index = list.indexOf(selected);
  const next = list[Math.min(list.length - 1, Math.max(0, index + direction))];

  list.forEach((item) => item.classList.remove(SELECTED));
  next.classList.add(SELECTED);
  scrollToTop(next, fast);
}

// ---------------------------------------------------------------------------
// 操作
// ---------------------------------------------------------------------------

function mentionsReply(post: Post, quote?: string): boolean {
  const reply = (flarum as any).reg?.get?.('flarum-mentions', 'forum/utils/reply');
  const fn = typeof reply === 'function' ? reply : reply?.default;

  if (typeof fn !== 'function') return false;

  fn(post, quote);

  return true;
}

function replyToTopic(discussion: Discussion): void {
  DiscussionControls.replyAction.call(discussion, true, false).catch(() => {});
}

async function toggleTopicBookmark(discussion: Discussion): Promise<void> {
  const post = await firstPostOf(discussion);

  if (!post) return;

  if (postBookmark(post)) await deleteBookmark(post);
  else await createBookmark(post);

  m.redraw();
}

function setSubscription(discussion: Discussion, value: 'follow' | 'ignore' | null): void {
  if (!isExtensionEnabled('flarum-subscriptions') || !app.session.user) return;

  discussion.save({ subscription: value } as any).then(() => m.redraw());
}

/** g j / g k：上次所看列表中的下一个或上一个主题。 */
function adjacentTopic(step: number): void {
  const discussion = currentDiscussion();
  const list: Discussion[] = app.discussions.getPages().flatMap((page: any) => page.items as Discussion[]);

  if (!list.length) return;

  const index = discussion ? list.indexOf(discussion) : -1;
  const next = list[index === -1 ? 0 : index + step];

  if (next) m.route.set(app.route.discussion(next));
}

function changeSection(step: number): void {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('.LcoyNav-tabs > .LcoyNav-tab:not(.LcoyNav-tab--more)'));
  const active = tabs.findIndex((tab) => tab.classList.contains('active'));
  const target = tabs[active + step];

  (target?.querySelector('a, button') as HTMLElement | null)?.click();
}

function selectedListDiscussion(): Discussion | null {
  const id = document.querySelector<HTMLElement>(`.DiscussionList-discussions > li.${LIST_SELECTED}`)?.dataset.id;

  return id ? app.store.getById<Discussion>('discussions', id) || null : null;
}

function openSearch(): void {
  const field = Array.from(document.querySelectorAll<HTMLElement>('.Search-input, .LcoyHeaderSearch')).find((el) => el.offsetParent !== null);

  field?.click();
}

// ---------------------------------------------------------------------------
// 按键
// ---------------------------------------------------------------------------

/** 外壳不认识的那些“g …”和“m …”序列。返回是否已处理。 */
function runSequence(prefix: string, key: string, shift: boolean): boolean {
  const user = app.session.user;
  const discussion = currentDiscussion();

  if (prefix === 'g') {
    switch (key) {
      case 'n':
        m.route.set(app.route('index', { sort: 'newest' }));
        return true;
      case 'u':
        if (user) m.route.set(app.route('index', { sort: 'unread' }));
        return !!user;
      case 'b':
        if (user && (app.routes as any)['user.bookmarks']) m.route.set(app.route('user.bookmarks', { username: user.slug() }));
        return !!user;
      case 'm':
        if (user && (app.routes as any)['messages']) m.route.set(app.route('messages'));
        return !!user;
      case 'd':
        if (user && draftsOn()) m.route.set(app.route('user.drafts', { username: user.slug() }));
        return !!user;
      case 'j':
        adjacentTopic(1);
        return true;
      case 'k':
        adjacentTopic(-1);
        return true;
      case 's': {
        // 在主题中跳到第一个推荐主题（Discourse）；不在主题中时，外壳会带到设置。
        const link = discussion ? document.querySelector<HTMLAnchorElement>('.LcoySuggested a[href*="/d/"], .SuggestedTopics a[href*="/d/"]') : null;

        if (!link) return false;

        link.click();
        return true;
      }
    }

    return false;
  }

  if (prefix === 'm' && discussion) {
    const levels: Record<string, 'follow' | 'ignore' | null> = { w: 'follow', t: 'follow', r: null, m: 'ignore' };

    if (key in levels) {
      setSubscription(discussion, levels[key]);
      return true;
    }
  }

  if (prefix === 'Z' && key === 'z' && shift && user) {
    app.session.logout();
    return true;
  }

  return false;
}

/** 主题内的快捷键。返回是否已处理该按键。 */
function topicKey(event: KeyboardEvent, discussion: Discussion): boolean {
  const stream = currentStream();
  const key = event.key;
  const selected = selectedPost();

  switch (key) {
    case 'j':
    case 'k':
      movePostSelection(key === 'j' ? 1 : -1, true);
      return true;
    case 'J':
    case 'K':
      movePostSelection(key === 'J' ? 1 : -1, false);
      return true;
    case 'Home':
      stream?.goToFirst();
      return !!stream;
    case 'End':
      stream?.goToLast();
      return !!stream;
    case '#':
      if (stream) app.modal.show(() => import('./topic/JumpToPostModal'), { stream });
      return !!stream;
    case 'L': {
      const lastRead = discussion.lastReadPostNumber() || 0;

      if (!stream || !app.session.user) return false;

      stream.goToNumber(Math.min(lastRead + 1, discussion.lastPostNumber() || lastRead + 1));
      return true;
    }
    case 'R':
      replyToTopic(discussion);
      return true;
    case 'S':
      openShare(discussion);
      return true;
    case 'P':
      return runItem(DiscussionControls.moderationControls(discussion).get('sticky'));
    case 'A':
      return click('.LcoyTopicFooter-more > .Dropdown-toggle, .DiscussionPage-nav .ButtonGroup .Dropdown-toggle');
    case 'f':
      if (!bookmarksEnabled() || !app.session.user) return false;
      toggleTopicBookmark(discussion).catch(() => {});
      return true;
    case 't':
      if (!canReplyAsLinkedTopic()) return false;
      replyAsLinkedTopic(discussion).catch(() => {});
      return true;
  }

  if (!selected) return false;

  const { element, post } = selected;

  switch (key) {
    case 'l':
      return click('.item-like button, .LcoyPostAction--like', element);
    case 'b':
      return click('.LcoyBookmarkButton', element);
    case 's':
      openShare(discussion, post);
      return true;
    case 'e':
      if (!post.canEdit()) return false;
      PostControls.editAction.call(post);
      return true;
    case 'r':
      if (!discussion.canReply()) return false;
      return mentionsReply(post) || (replyToTopic(discussion), true);
    case 'q':
      if (!discussion.canReply()) return false;
      return mentionsReply(post, getPlainContent(post.contentHtml() || '')) || (replyToTopic(discussion), true);
    case 'd': {
      const controls = PostControls.destructiveControls(post, null as any);

      return runItem(controls.has('hide') ? controls.get('hide') : controls.has('delete') ? controls.get('delete') : null);
    }
    case '!': {
      const controls = PostControls.userControls(post, null as any);

      return controls.has('flag') && runItem(controls.get('flag'));
    }
  }

  return false;
}

/** 列表中的快捷键。返回是否已处理该按键。 */
function listKey(event: KeyboardEvent): boolean {
  switch (event.key) {
    case 'J':
    case 'K':
      changeSection(event.key === 'J' ? 1 : -1);
      return true;
    case '.':
      return click('.DiscussionList-update');
    case 'D':
      return click('.LcoyDismiss--top .LcoyDismiss-button');
    case 'B':
      if (!forumBool('lcoyBulkSelectEnabled', true) || !bulkAvailable()) return false;
      selection.setActive(!selection.active);
      m.redraw();
      return true;
    case 'x': {
      const discussion = selectedListDiscussion();

      if (!discussion || !selection.active) return false;

      selection.toggle(discussion);
      m.redraw();
      return true;
    }
    case 'f': {
      const discussion = selectedListDiscussion();

      if (!discussion || !bookmarksEnabled() || !app.session.user) return false;

      toggleTopicBookmark(discussion).catch(() => {});
      return true;
    }
  }

  return false;
}

function onKeydown(event: KeyboardEvent): void {
  if (!gaps.postShortcuts()) return;

  // ctrl+alt+f 在输入时也生效，与 Discourse 一致（它是全局的）。
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    event.stopImmediatePropagation();
    openSearch();
    return;
  }

  // 主题中的 ctrl+p（cmd+p）：使用主题的打印版本，而不是原始页面。
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'p') {
    const discussion = currentDiscussion();

    if (discussion && forumBool('lcoyPrintTopicEnabled', true)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      printDiscussion(discussion).catch(() => {});
    }

    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target) || app.modal.isModalOpen()) return;

  const handled = () => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  if (pending) {
    const prefix = pending;
    pending = null;
    window.clearTimeout(pendingTimer);

    if (runSequence(prefix, prefix === 'Z' ? event.key.toLowerCase() : event.key, event.shiftKey)) handled();

    return;
  }

  const key = event.key;

  // 序列开头：“g”外壳也会监听（并处理 g h、g l…）；“m”和
  // “shift+z”只属于这里。
  if (key === 'g' || (key === 'm' && currentDiscussion()) || key === 'Z') {
    pending = key;
    pendingTimer = window.setTimeout(() => (pending = null), SEQUENCE_TIMEOUT_MS);

    if (key !== 'g') handled();

    return;
  }

  if (key === 'p' && app.session.user) {
    if (
      click(
        '#header-secondary .item-session .Dropdown-toggle, #header-secondary .SessionDropdown .Dropdown-toggle, #header-secondary .item-session button'
      )
    )
      handled();
    return;
  }

  if (key === 'C' && app.composer.isVisible()) {
    const field = document.querySelector<HTMLElement>('.Composer .TextEditor-editor, .Composer textarea');

    if (field) {
      handled();
      field.focus();
    }

    return;
  }

  const discussion = currentDiscussion();

  if (discussion) {
    if (topicKey(event, discussion)) handled();
    return;
  }

  if (app.current.matches(IndexPage) && listKey(event)) handled();
}

let helpAdded = false;

export default function installGapShortcuts(): void {
  // 在 mount 中注册，而不是这里：只有那时论坛配置才已加载，
  // 且“?”窗口不应列出已关闭的快捷键。帮助条目只添加一次。
  extend(app as any, 'mount', () => {
    if (gaps.postShortcuts() && !helpAdded) {
      helpAdded = true;
      addHelp();
    }
  });

  // 在捕获阶段：先于外壳的监听器运行，后者处于冒泡阶段。
  document.addEventListener('keydown', onKeydown, true);
}
