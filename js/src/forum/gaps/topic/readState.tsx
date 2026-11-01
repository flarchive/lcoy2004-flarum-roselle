/*
 * Discourse 在主题内显示的阅读状态：
 *
 * - 帖子头部角落的“帖子未读”蓝色小圆点（.read-state），
 *   帖子被读取后慢慢消失；
 * - 读者上次访问时最后读过的帖子之后的“最后访问”红线
 *  （.topic-post-visited）。
 *
 * 两者都取决于读者打开主题时停在哪里；核心会在阅读过程中推进
 * lastReadPostNumber，因此进入时的值会按主题单独保存，
 * 在页面显示它的时刻记录。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

/** 打开主题时最后已读的帖子，按主题 id 索引。 */
const visitedAtOpen = new Map<string, number>();

export function visitedNumber(discussion: Discussion | null | undefined): number | null {
  if (!discussion || !app.session.user) return null;

  const value = visitedAtOpen.get(String(discussion.id()));

  return value === undefined ? null : value;
}

function readState(post: Post): 'unread' | 'read' | null {
  const discussion = post.discussion();
  const visited = visitedNumber(discussion || null);

  if (visited === null || !discussion || post.number() <= visited) return null;

  return (discussion.lastReadPostNumber() || 0) >= post.number() ? 'read' : 'unread';
}

/** 把 vnode 的子节点当列表处理，以便再追加一个。 */
function childrenOf(vnode: any): any[] {
  if (Array.isArray(vnode.children)) return vnode.children;

  vnode.children = vnode.children == null ? [] : [vnode.children];

  return vnode.children;
}

export default function installReadState(): void {
  extend(DiscussionPage.prototype, 'show', function (this: any, _result: unknown, discussion: Discussion) {
    if (!discussion || this.lcoyVisitedFor === discussion.id()) return;

    this.lcoyVisitedFor = discussion.id();

    // 从未打开过的主题算作“已读到 0”：其中一切都是新的，但这样
    // “最后访问”线就没有意义（没有发生过访问）。
    visitedAtOpen.set(String(discussion.id()), discussion.lastReadPostNumber() || 0);
  });

  // 圆点会在帖子未变的情况下变化：帖子的 retainer 需要知道。
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    this.subtree?.check(() => (gaps.readState() ? readState(this.attrs.post) : null));
  });

  extend(CommentPost.prototype, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!gaps.readState()) return;

    const state = readState(this.attrs.post);

    if (!state) return;

    items.add(
      'lcoyReadState',
      <span
        className={classList('LcoyReadState', { 'LcoyReadState--read': state === 'read' })}
        title={t('gaps.read_state.unread')}
        aria-hidden="true"
      >
        <Icon name="fas fa-circle" />
      </span>,
      -100
    );
  });

  // “最后访问”线放进最后已读帖子的项内部：stream 的项都有 key，
  // 在它们中间新增兄弟节点也必须带 key——在项内部，子节点没有 key。
  extend('flarum/forum/components/PostStream', 'view', function (this: any, vdom: any) {
    if (!gaps.readState() || !vdom || !Array.isArray(vdom.children)) return;

    const discussion: Discussion | undefined = this.discussion;
    const visited = visitedNumber(discussion);
    const last = discussion?.lastPostNumber() || 0;

    if (!visited || visited >= last) return;

    const items: any[] = vdom.children;
    // 第一楼与主题地图一起出现在一个片段中。
    const itemOf = (child: any) => (child && child.tag === '[' && Array.isArray(child.children) ? child.children[0] : child);

    // 一次遍历找出最后绘制的项：按项调用 slice() 在屏幕上有
    // 数百篇帖子时是二次复杂度。
    let lastShown = -1;

    items.forEach((child: any, index: number) => {
      const item = itemOf(child);

      if (item && item.attrs && item.attrs['data-number']) lastShown = index;
    });

    items.forEach((child: any, index: number) => {
      const item = itemOf(child);

      if (!item || !item.attrs || Number(item.attrs['data-number']) !== visited) return;

      // 在最后绘制的帖子处这条线说明不了什么（后面没有内容了）。
      if (index === lastShown) return;

      childrenOf(item).push(
        <div className="LcoyVisitedLine" role="separator">
          <span className="LcoyVisitedLine-message" role="heading" aria-level="2">
            {t('gaps.read_state.last_visit')}
          </span>
        </div>
      );
    });
  });
}
