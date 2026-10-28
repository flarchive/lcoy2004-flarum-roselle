/*
 * 主题末尾的按钮，类似 Discourse 的 #topic-footer-buttons：
 * 带边框的胶囊按钮，图标加文字——分享、收藏、举报、标记为未读——以及
 * 高亮的“回复”；“…”里放主题控制项剩下的部分（重命名、删除、打印…）。
 * 下一行是通知控件和级别说明文字（“你将收到通知…”）。访客只有“回复”。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

import TopicNotifications, { notificationReason } from './TopicNotifications';
import { canSubscribe } from '../ui';
import { isExtensionEnabled, t } from '../../utils/settings';
import { openShare } from '../../gaps/topic/share';
import { bookmarksEnabled } from '../../features/bookmarks/actions';
import { toggleTopicBookmark, topicIsBookmarked } from '../../features/bookmarks/index';

export interface TopicFooterAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** 一个 DiscussionPage：主题控制项随上下文变化。 */
  page: any;
}

/** 第一楼帖子，如果已在 store 中（主题末尾几乎总是有它）。 */
function firstPost(discussion: Discussion): Post | null {
  const linkedId = (discussion.data.relationships as any)?.firstPost?.data?.id;

  return (
    (linkedId && app.store.getById<Post>('posts', linkedId)) ||
    app.store.all<Post>('posts').find((post) => post.discussion() === discussion && post.number() === 1) ||
    null
  );
}

export default class TopicFooter extends Component<TopicFooterAttrs> {
  markingUnread = false;

  view() {
    const discussion = this.attrs.discussion;

    // 访客只有右侧的“回复”（会打开登录窗口）。
    if (!app.session.user) {
      return (
        <div className="LcoyTopicFooter LcoyTopicFooter--guest" role="group" aria-label={t('topic.footer.aria_label')}>
          <div className="LcoyTopicFooter-main">{this.replyButton(discussion)}</div>
        </div>
      );
    }

    // 已经有独立按钮的内容不在“…”里重复。
    const controls = DiscussionControls.controls(discussion, this.attrs.page);
    ['reply', 'lcoyBookmark'].forEach((key) => controls.has(key) && controls.remove(key));
    const controlItems = controls.toArray().filter((item: any) => item && item.itemName && !/Separator$/.test(item.itemName));

    return (
      <div className="LcoyTopicFooter" role="group" aria-label={t('topic.footer.aria_label')}>
        <div className="LcoyTopicFooter-main">
          <Button
            className="Button LcoyTopicFooter-button LcoyTopicFooter-share"
            icon="fas fa-arrow-up-from-bracket"
            onclick={() => openShare(discussion)}
          >
            {t('topic.footer.share')}
          </Button>

          {this.bookmarkButton(discussion)}
          {this.flagButton(discussion)}
          {this.unreadButton(discussion)}

          {controlItems.length > 0 && (
            <Dropdown
              className="LcoyTopicFooter-more"
              buttonClassName="Button Button--icon LcoyTopicFooter-button"
              menuClassName="Dropdown-menu--right"
              icon="fas fa-ellipsis-h"
              caretIcon=""
              label=""
              helperText={null}
              accessibleToggleLabel={t('topic.footer.more')}
            >
              {controls.toArray()}
            </Dropdown>
          )}

          {this.replyButton(discussion)}
        </div>

        {canSubscribe() && (
          <div className="LcoyTopicFooter-notifications">
            <TopicNotifications discussion={discussion} />
            <p className="LcoyTopicFooter-reason">{notificationReason(discussion)}</p>
          </div>
        )}
      </div>
    );
  }

  /** 收藏 = 第一楼的收藏（Discourse 的主题“bookmark”）。 */
  bookmarkButton(discussion: Discussion) {
    if (!bookmarksEnabled()) return null;

    const bookmarked = topicIsBookmarked(discussion);

    return (
      <Button
        className={classNames('Button LcoyTopicFooter-button', bookmarked && 'LcoyTopicFooter-button--active')}
        icon={bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark'}
        onclick={() => toggleTopicBookmark(discussion).catch(() => {})}
      >
        {t(bookmarked ? 'topic.footer.bookmarked' : 'topic.footer.bookmark')}
      </Button>
    );
  }

  /** 举报主题 = 举报第一楼，使用 flarum/flags 的弹窗。 */
  flagButton(discussion: Discussion) {
    if (!isExtensionEnabled('flarum-flags')) return null;

    const post = firstPost(discussion);

    if (!post || post.isHidden() || !post.attribute('canFlag')) return null;

    return (
      <Button
        className="Button LcoyTopicFooter-button LcoyTopicFooter-flag"
        icon="far fa-flag"
        onclick={() => app.modal.show(() => flarum.reg.asyncModuleImport('ext:flarum/flags/forum/components/FlagPostModal'), { post })}
      >
        {t('topic.footer.flag')}
      </Button>
    );
  }

  /**
   * “标记为未读”：阅读进度回到上次已读帖子之前，用户回到列表，
   * 与 Discourse 一致。需要主题的字段（extend/topic.php）：
   * 核心只允许阅读进度向前推进。
   */
  unreadButton(discussion: Discussion) {
    const lastRead = discussion.lastReadPostNumber() || 0;

    if (!app.forum.attribute('lcoyMarkUnread') || lastRead < 1) return null;

    return (
      <Button
        className="Button LcoyTopicFooter-button LcoyTopicFooter-unread"
        icon="fas fa-circle"
        loading={this.markingUnread}
        onclick={() => {
          this.markingUnread = true;

          discussion
            .save({ lcoyMarkUnread: lastRead - 1 } as any)
            .then(() => {
              discussion.pushAttributes({ lastReadPostNumber: lastRead - 1 });
              m.route.set(app.route('index'));
            })
            .catch(() => {})
            .finally(() => {
              this.markingUnread = false;
              m.redraw();
            });
        }}
      >
        {t('topic.footer.mark_unread')}
      </Button>
    );
  }

  replyButton(discussion: Discussion) {
    if (app.session.user && !discussion.canReply()) {
      return (
        <Button className="Button LcoyTopicFooter-reply disabled" icon="fas fa-reply" disabled>
          {app.translator.trans('core.forum.discussion_controls.cannot_reply_button')}
        </Button>
      );
    }

    return (
      <Button
        className="Button Button--primary LcoyTopicFooter-reply"
        icon="fas fa-reply"
        onclick={() => DiscussionControls.replyAction.call(discussion, true, false).catch(() => {})}
      >
        {t('topic.footer.reply')}
      </Button>
    );
  }
}

function classNames(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
