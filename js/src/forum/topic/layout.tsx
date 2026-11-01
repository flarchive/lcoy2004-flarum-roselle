/*
 * 主题页面的整体：连接两栏布局（stream | 时间线）的类、主题末尾（按钮 + 推荐）、
 * 新回复横条、通知控件、时间线栏中的“↓ N 条未读”，以及目标帖子的黄色高亮。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import NewRepliesBar from './components/NewRepliesBar';
import TopicEnd from './components/TopicEnd';
import TopicNotifications from './components/TopicNotifications';
import { canSubscribe, topicSettings } from './ui';
import { t } from '../utils/settings';

/** 目标帖子高亮持续的时间（与 LESS 中动画的时长一致）。 */
const HIGHLIGHT_MS = 2500;

export default function installLayout(): void {
  extend(DiscussionPage.prototype, 'view', function (this: any, vnode: any) {
    if (!vnode || !vnode.attrs) return;

    vnode.attrs.className = classList(vnode.attrs.className, 'LcoyTopic', {
      'LcoyTopic--timeline': topicSettings.timeline(),
      'LcoyTopic--footer': topicSettings.footer(),
      'LcoyTopic--guest': !app.session.user,
    });

    if (!this.discussion || !this.stream) return;

    // 主题末尾放在 PostStream 之后，而不是它的 endItems 里：放在那里会
    // 位于“回复…”框之前，而核心把它放在最后——它必须保持最后，
    // 因为回复时 stream 会滚动到它。
    const children: any[] = Array.isArray(vnode.children) ? vnode.children : [];
    const streamWrapper = children.find((child) => child && child.attrs && child.attrs.className === 'DiscussionPage-stream');

    if (!streamWrapper || !Array.isArray(streamWrapper.children)) return;

    streamWrapper.children.push(m(TopicEnd, { discussion: this.discussion, stream: this.stream, page: this }));

    if (topicSettings.newRepliesBar()) {
      streamWrapper.children.push(m(NewRepliesBar, { discussion: this.discussion, stream: this.stream, page: this }));
    }
  });

  extend(DiscussionPage.prototype, 'sidebarItems', function (this: any, items: ItemList<Mithril.Children>) {
    const discussion = this.discussion;

    if (!discussion || !topicSettings.timeline()) return;

    // 用 Discourse 的铃铛取代 subscriptions 的分离式按钮。
    if (canSubscribe()) {
      if (items.has('subscription')) items.remove('subscription');

      items.add('lcoyNotifications', <TopicNotifications discussion={discussion} compact />, 80);
    }

    const lastRead = discussion.lastReadPostNumber() || 0;
    const unread = discussion.unreadCount();

    if (app.session.user && lastRead > 0 && unread > 0) {
      items.add(
        'lcoyUnread',
        <Button className="Button Button--flat LcoyTimeline-unread" icon="fas fa-arrow-down" onclick={() => this.stream?.goToNumber(lastRead + 1)}>
          {t('topic.timeline.unread', { count: unread })}
        </Button>,
        -110
      );
    }
  });

  // Discourse 的高亮：只在地址指向某篇帖子时（/d/x/N），
  // 而不是核心每次打开主题时的“脉冲”。
  override('flarum/forum/components/PostStream', 'flashItem', function (this: any, original: ($item: any) => void, $item: any) {
    const near = m.route.param('near');

    if (near === 'reply') return original($item);
    if (!near || !$item || !$item.length) return;

    const element: HTMLElement = $item[0];

    element.classList.remove('fadeIn', 'LcoyHighlight');
    // 强制 reflow，使在同一帖子上的第二次点击时动画重新开始。
    void element.offsetWidth;
    element.classList.add('LcoyHighlight');

    window.setTimeout(() => element.classList.remove('LcoyHighlight'), HIGHLIGHT_MS);
  });
}
