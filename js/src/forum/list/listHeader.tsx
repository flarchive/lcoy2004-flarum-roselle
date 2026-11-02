/*
 * 列表的列标题（"主题 · 回复 · 浏览量 ·
 * 活动"）以及告知列表有哪些列的类名。
 *
 * 它进入 DiscussionList，而不是每一行：各行会保留树结构
 * （SubtreeRetainer），当新页面中出现第一个带浏览量的讨论时
 * 不会重新绘制。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import IndexPage from 'flarum/forum/components/IndexPage';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { listHasViews } from './metrics';
import { activeSort } from './sorts';
import listSkeleton from './listSkeleton';

/**
 * 上一次加载的列表是否带有浏览量列：在下一页加载期间
 * 没有讨论可用于判断，页眉（以及骨架屏）不能丢掉该列
 * 又重新加回来。
 */
let lastShowViews = true;

function sortableColumn(label: string, sort: string, enabled: boolean, className: string): Mithril.Children {
  if (!enabled || !(sort in app.discussions.sortMap())) {
    return <span className={classList('LcoyListHeader-cell', className)}>{label}</span>;
  }

  // 与 Discourse 相同，只有在读者通过列（或 URL）选择了该顺序时
  // 箭头才显示；默认列表不标记任何列。
  const active = !!app.search.state.params().sort && activeSort() === sort;

  return (
    <button
      type="button"
      className={classList('Button--ua-reset LcoyListHeader-cell LcoyListHeader-sort', className, { active })}
      aria-pressed={active ? 'true' : 'false'}
      onclick={() => app.search.state.changeSort(sort)}
    >
      {label}
      {active && <Icon name="fas fa-chevron-down" className="LcoyListHeader-arrow" />}
    </button>
  );
}

function headerView(state: DiscussionListState, showViews: boolean): Mithril.Children {
  // 只有首页（以及标签/关注）的列表通过 URL 重新排序；个人资料的
  // 讨论列表使用另一个状态，那里的列只是标签。
  const sortable = state === app.discussions && app.current.matches(IndexPage) && !state.isSearchResults();

  return (
    <div className="LcoyListHeader" role="presentation">
      <span className="LcoyListHeader-cell LcoyListHeader-cell--topic">{t('list.topic')}</span>
      {forumBool('lcoyListPosters', true) && <span className="LcoyListHeader-cell LcoyCell--posters" />}
      {sortableColumn(t('list.replies'), 'top', sortable, 'LcoyCell--replies')}
      {showViews && <span className="LcoyListHeader-cell LcoyCell--views">{t('list.views')}</span>}
      {sortableColumn(t('list.activity'), 'latest', sortable, 'LcoyCell--activity')}
    </div>
  );
}

export default function installListHeader(): void {
  extend(DiscussionList.prototype, 'view', function (this: DiscussionList, vdom: Mithril.Vnode<any, any>) {
    const state = (this as any).attrs.state as DiscussionListState;

    if (!vdom || !state) return;

    // 第一页加载中（切换过滤器、分类或排序）：用骨架屏
    // 行取代加载动画，位于页眉下方。
    const loadingFirst = state.isInitialLoading() && !state.hasItems();

    if (!loadingFirst) lastShowViews = listHasViews(state);

    const showViews = forumBool('lcoyListViews', true) && lastShowViews;

    vdom.attrs.className = classList(vdom.attrs.className, 'LcoyList', {
      'LcoyList--views': showViews,
    });

    // 空列表只返回 Placeholder：没有行，也没有页眉。
    if (!forumBool('lcoyListHeader', true) || state.isEmpty() || !Array.isArray(vdom.children)) return;

    if (loadingFirst) {
      const children = vdom.children as any[];
      const list = children.find((child) => child?.attrs?.className === 'DiscussionList-discussions');
      const more = children.find((child) => child?.attrs?.className === 'DiscussionList-loadMore');

      if (list) {
        list.children = listSkeleton(showViews);
        if (more) more.children = [];
      }
    }

    // div 的子节点（ul + "加载更多"）没有 key，因此插入一个
    // 无 key 的同级节点到开头对 Mithril 来说是安全的。
    vdom.children.unshift(headerView(state, showViews) as any);
  });
}
