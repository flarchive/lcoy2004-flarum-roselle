/*
 * Discourse 列表中的“最后访问”分隔线（.topic-list-item-separator）：
 * 在“最新”列表中，一条红线把自上次访问以来有新动态的主题与原本就是
 * 这样的主题分开。
 *
 * Flarum 不保存上次访问（last_seen_at 每次请求都会更新），因此主题按用户
 * 在设备上保存：本次访问和上次访问。超过一小时未使用后开始一次新的
 * “访问”，与 Discourse 的 previous_visit_at 一致。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

const VISIT_GAP_MS = 60 * 60 * 1000;
const KEY = 'lcoy.visits.';

interface Visits {
  /** 读者最后一次使用论坛的时间（使用时持续更新）。 */
  last: number;
  /** 上次访问结束的时间：分隔线的分界。 */
  previous: number;
}

function storageKey(): string | null {
  const user = app.session.user;

  return user ? KEY + user.id() : null;
}

function read(): Visits | null {
  const key = storageKey();

  if (!key) return null;

  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');

    return data && typeof data.last === 'number' && typeof data.previous === 'number' ? data : null;
  } catch {
    return null;
  }
}

function write(visits: Visits): void {
  const key = storageKey();

  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(visits));
  } catch {
    // 没有 localStorage（隐私窗口）：这条线直接不出现。
  }
}

/** 记录当前使用时间；如果读者离开超过一小时，则开始新的访问。 */
export function touchVisit(): void {
  if (!app.session.user) return;

  const now = Date.now();
  const visits = read();

  if (!visits) {
    write({ last: now, previous: now });
    return;
  }

  write({ last: now, previous: now - visits.last > VISIT_GAP_MS ? visits.last : visits.previous });
}

export function previousVisit(): Date | null {
  const visits = read();

  return visits && visits.previous < visits.last ? new Date(visits.previous) : null;
}

/** 仅在首页（或某个标签）的“最新”列表中，且不在搜索中。 */
function appliesTo(state: any): boolean {
  if (!gaps.lastVisit() || !app.session.user || state !== app.discussions || !app.current.matches(IndexPage)) return false;

  const params = state.getParams?.() || {};
  const sort = params.sort;

  return !params.q && (!sort || sort === 'latest');
}

function isPinned(discussion: Discussion): boolean {
  return !!discussion.attribute<boolean>('isSticky');
}

export default function installLastVisit(): void {
  extend(app as any, 'mount', () => {
    touchVisit();

    // 整夜开着的标签页：重新切回它算作一次新访问。
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') touchVisit();
    });
  });

  extend(IndexPage.prototype, 'oninit', () => touchVisit());

  extend(DiscussionList.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    const state = this.attrs.state;

    if (!vdom || !appliesTo(state)) return;

    const since = previousVisit();

    if (!since) return;

    const list = (Array.isArray(vdom.children) ? vdom.children : []).find(
      (child: any) => child && child.attrs && String(child.attrs.className || '').includes('DiscussionList-discussions')
    ) as any;

    if (!list || !Array.isArray(list.children)) return;

    let seenNewer = false;

    // 列表的每一页是一个片段（'['），其中是带 key 的 <li>。
    for (const page of list.children) {
      const rows: any[] = page && page.tag === '[' && Array.isArray(page.children) ? page.children : [];

      for (let index = 0; index < rows.length; index++) {
        const id = rows[index]?.attrs?.['data-id'];
        const discussion = id ? app.store.getById<Discussion>('discussions', String(id)) : null;

        if (!discussion || isPinned(discussion)) continue;

        const bumped = discussion.lastPostedAt() || discussion.createdAt();

        if (bumped && bumped > since) {
          seenNewer = true;
          continue;
        }

        // 如果连第一个主题都不新，顶部的这条线说明不了什么。
        if (!seenNewer) return;

        rows.splice(
          index,
          0,
          <li key="lcoy-last-visit" className="LcoyLastVisit" role="separator">
            <span className="LcoyLastVisit-label">{t('gaps.last_visit')}</span>
          </li>
        );

        return;
      }
    }
  });
}
