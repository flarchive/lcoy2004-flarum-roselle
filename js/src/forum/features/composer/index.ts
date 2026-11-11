/*
 * Flarum 中的 Discourse 编辑器（composer）：相似主题、
 * #分类/#标签、草稿（配合 fof/drafts）、以关联主题回复，以及
 * 并排预览。每一项均可在管理后台的“编辑器”卡片中关闭
 * （`lcoy.composer_*`）。
 *
 * 表情选择器不在此处：由 pianotell/flamoji 提供。
 */
import installSimilarTopics from './installSimilarTopics';
import installHashtags from './installHashtags';
import installDrafts from './drafts/installDrafts';
import installLinkedTopic from './installLinkedTopic';
import installPreview from './installPreview';

export default function installComposer() {
  installSimilarTopics();
  installHashtags();
  installDrafts();
  installLinkedTopic();
  installPreview();
}
