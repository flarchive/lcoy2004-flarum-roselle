/*
 * Discourse 风格的主题页面：标题和徽章位于卡片内，帖子下方带操作栏，
 * 右侧栏为时间线，第一楼之后是主题地图，末尾是主题按钮和建议主题。
 */
import app from 'flarum/forum/app';

import installHero from './hero';
import installLayout from './layout';
import installPosts from './posts';
import installTimeline from './timeline';
import installTopicMap from './topicMap';
import installUserCard from './userCard';
import installAuthorFilter from './authorFilter';
import installEventPosts from './eventPosts';
import installReplyToComposer from './replyToComposer';

let installed = false;

export default function installTopic(): void {
  // avocado 的“回复给”中的 composer（按模块名 extend：
  // composer 的正文以 chunk 形式加载）。
  installReplyToComposer();

  // 全部在 beforeMount 注册，它在所有 initializer 之后运行：
  // 最后注册的 extend 最后运行，主题正是借此看到（并重新排版）
  // tags、likes 和 mentions 放进同一批列表的项目，无论扩展的启动顺序如何。
  // beforeMount 在首次挂载前运行；保持幂等，重复调用也不会叠加处理器。
  app.beforeMount(() => {
    if (installed) return;
    installed = true;

    installHero();
    installLayout();
    installPosts();
    installEventPosts();
    installTimeline();
    installTopicMap();
    installUserCard();
    installAuthorFilter();
  });
}
