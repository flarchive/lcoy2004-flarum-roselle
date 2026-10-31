/*
 * “有 N 条新回复”——读者停在主题中间时，realtime 送来新帖子后出现的
 * Discourse 横条。在主题末尾，flarum/realtime 会直接把帖子追加进 stream，
 * 横条不出现；在中间，它只更新计数，这时横条才提醒。
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import type Discussion from 'flarum/common/models/Discussion';

import { t } from '../../utils/settings';

export interface NewRepliesBarAttrs extends ComponentAttrs {
  discussion: Discussion;
  stream: any;
  /** 页面保存上次所见评论数的地方。 */
  page: any;
}

export default class NewRepliesBar extends Component<NewRepliesBarAttrs> {
  view() {
    const { discussion, stream, page } = this.attrs;
    const count = discussion.commentCount() || 0;

    if (page.lcoySeenCount === undefined || stream.viewingEnd()) page.lcoySeenCount = count;

    const fresh = count - page.lcoySeenCount;

    if (fresh <= 0) return null;

    return (
      <div className="LcoyNewReplies" role="status">
        <button
          type="button"
          className="LcoyNewReplies-button"
          onclick={() => {
            page.lcoySeenCount = count;
            stream.goToLast();
          }}
        >
          <Icon name="fas fa-arrow-down" />
          {t('topic.new_replies', { count: fresh })}
        </button>
      </div>
    );
  }
}
