/*
 * 最后一篇帖子之后的内容：主题按钮和建议主题。仅在 stream 到达末尾时出现
 * ——在长主题中间，后面的帖子还没加载，页脚会卡在中间。
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';

import SuggestedTopics from './SuggestedTopics';
import TopicFooter from './TopicFooter';
import TopicMap, { hasBottomTopicMap } from './TopicMap';
import { topicSettings } from '../ui';

export interface TopicEndAttrs extends ComponentAttrs {
  discussion: Discussion;
  stream: any;
  page: any;
}

export default class TopicEnd extends Component<TopicEndAttrs> {
  view() {
    const { discussion, stream, page } = this.attrs;

    if (!stream || !stream.viewingEnd()) return null;

    const footer = topicSettings.footer();
    const suggested = topicSettings.suggested();

    if (!footer && !suggested) return null;

    return (
      <div className="LcoyTopicEnd">
        {/* 长主题末尾会重复出现主题地图（topic-map.--bottom）。 */}
        {topicSettings.map() && hasBottomTopicMap(discussion) && <TopicMap discussion={discussion} position="bottom" />}
        {footer && <TopicFooter discussion={discussion} page={page} />}
        {/* key 会在从一个主题直接跳到另一个主题时重新发起搜索；放在单独的
            数组里，因为 Mithril 不接受有 key 和无 key 的兄弟节点混排。 */}
        {suggested && [<SuggestedTopics key={discussion.id()} discussion={discussion} />]}
      </div>
    );
  }
}
