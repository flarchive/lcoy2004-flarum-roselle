/*
 * 页头中部。与 Discourse 一样，在主题中向下滚动超过
 * 标题后，搜索会变成主题标题，下方带分类和
 * 标签（Discourse 的 `.header-title.topic`）；点击标题
 * 会回到顶部。除此之外显示搜索。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import HeaderSearch from './HeaderSearch';
import { forumBool } from '../utils/settings';
import { discussionBadges } from '../utils/tags';

let showingTopic = false;
let frame = 0;
let lastCheck = 0;
let trailing: number | undefined;

/**
 * 页头只需要知道主题标题是否已经滚出屏幕；每帧测量
 * 会迫使滚动过程中进行布局计算。每 80ms 检查一次
 * 足以完成切换，而 timeout 保证滚动停止后
 * 再做最后一次检查（位置只在移动过程中变化）。
 */
const CHECK_EVERY_MS = 80;

function currentDiscussion(): Discussion | null {
  return app.current.matches(DiscussionPage) ? (app.current.get('discussion') as Discussion | null) : null;
}

/** 主题标题是否已从页头下方滚出屏幕？ */
function titleScrolledAway(): boolean {
  const title = document.querySelector('.DiscussionHero-title');
  const header = document.getElementById('header');

  if (!title || !header) return false;

  return title.getBoundingClientRect().bottom < header.getBoundingClientRect().bottom;
}

function update() {
  frame = 0;
  lastCheck = performance.now();

  const next = !!currentDiscussion() && titleScrolledAway();

  if (next !== showingTopic) {
    showingTopic = next;
    m.redraw();
  }
}

function schedule() {
  if (frame) return;

  const wait = lastCheck + CHECK_EVERY_MS - performance.now();

  if (wait > 0) {
    window.clearTimeout(trailing);
    trailing = window.setTimeout(schedule, wait);

    return;
  }

  frame = requestAnimationFrame(update);
}

let watching = false;

export function watchHeaderTopic() {
  // 监听器只挂一次：安装器被重复调用时也不会累积。
  if (watching) return;
  watching = true;

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

export default class HeaderCenter extends Component {
  view(): Mithril.Children {
    const discussion = currentDiscussion();

    // 切换页面时，状态在绘制前重置。
    if (!discussion && showingTopic) showingTopic = false;

    if (discussion && showingTopic) return this.topic(discussion);

    return forumBool('lcoyHeaderSearch', true) ? <HeaderSearch state={app.search.state} /> : null;
  }

  onupdate() {
    schedule();
  }

  topic(discussion: Discussion): Mithril.Children {
    const badges = discussion.badges().toArray();

    return (
      <div className="LcoyHeaderTopic">
        <a
          className="LcoyHeaderTopic-title"
          href={app.route.discussion(discussion)}
          onclick={(event: MouseEvent) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;

            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {badges.length > 0 && <span className="LcoyHeaderTopic-status">{badges}</span>}
          <span className="LcoyHeaderTopic-text">{discussion.title()}</span>
        </a>
        <div className="LcoyHeaderTopic-badges">{discussionBadges(discussion)}</div>
      </div>
    );
  }
}
