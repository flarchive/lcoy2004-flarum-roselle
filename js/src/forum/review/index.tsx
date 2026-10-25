/*
 * "审核"：flarum/flags 的 /flags 页面变成 Discourse 的审核队列
 * （/review），位于主题的卡片内。
 *
 * 通过模块名处理，与举报弹窗相同：主题不导入 flarum/flags
 * 的任何内容，它可能被关闭。原始的 `oninit` 也会被
 * 替换：它会加载 `app.flags`（只含帖子和作者），而队列会
 * 自己发起请求，获取完整帖子。
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

import { lazyComponent } from '../utils/lazy';
import { isExtensionEnabled, t } from '../utils/settings';

// 队列放在独立的 chunk 中：只有版主会打开 /flags。
const ReviewQueue = lazyComponent(
  () => import('./ReviewQueue').then((module) => module.default),
  () => <LoadingIndicator />
);

const FLAGS_PAGE = 'ext:flarum/flags/forum/components/FlagsPage';

export default function installReview(): void {
  if (!isExtensionEnabled('flarum-flags')) return;

  override(FLAGS_PAGE as any, 'oninit', function (this: any, _original: unknown, vnode: any) {
    Page.prototype.oninit.call(this, vnode);

    const title = t('review.title');

    app.history.push('flags', title);
    app.setTitle(title);
    app.setTitleCount(0);

    this.bodyClass = 'App--flags App--lcoyReview';
  });

  override(FLAGS_PAGE as any, 'view', function () {
    return (
      <PageStructure className="FlagsPage LcoyReviewPage">
        <ReviewQueue />
      </PageStructure>
    );
  });
}
