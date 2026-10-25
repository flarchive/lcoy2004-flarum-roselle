/*
 * 打印主题，类似 Discourse 的 `/t/…/print`：主题控制中的一项，
 * 加载所有帖子（主题页面只包含已滚动到屏幕上的帖子），构建一个
 * 干净视图（标题、作者、日期以及每条帖子的文本），然后调用浏览器
 * 打印。
 *
 * 该视图是覆盖在页面上的一个层，主题的 `@media print` 会隐藏其余
 * 内容（外壳、侧边栏、时间线、编辑器）。打印结束后该层消失，页面
 * 恢复原状。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Avatar from 'flarum/common/components/Avatar';
import username from 'flarum/common/helpers/username';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';
import { fullDate } from '../../utils/dates';
import { discussionBadges } from '../../utils/tags';

/** API 每页返回的最大数量。 */
const PAGE_LIMIT = 50;

const PRINTING_CLASS = 'lcoy-printing';

async function loadAllPosts(discussion: Discussion): Promise<Post[]> {
  const posts: Post[] = [];
  let offset = 0;

  for (;;) {
    const page: any = await app.store.find<Post[]>('posts', {
      filter: { discussion: discussion.id(), type: 'comment' },
      sort: 'number',
      include: 'user',
      page: { offset, limit: PAGE_LIMIT },
    });

    posts.push(...page);
    offset += page.length;

    if (!page.length || !page.payload?.links?.next) break;
  }

  return posts;
}

function printView(discussion: Discussion, posts: Post[], close: () => void): Mithril.Children {
  return (
    <div className="LcoyPrint">
      <div className="LcoyPrint-toolbar">
        <Button className="Button Button--primary" icon="fas fa-print" onclick={() => window.print()}>
          {t('extras.print.print_again')}
        </Button>
        <Button className="Button" icon="fas fa-times" onclick={close}>
          {t('extras.print.close')}
        </Button>
      </div>
      <header className="LcoyPrint-header">
        <h1 className="LcoyPrint-title">{discussion.title()}</h1>
        <div className="LcoyPrint-meta">
          {discussionBadges(discussion, false)}
          <span className="LcoyPrint-url">{window.location.origin + app.route.discussion(discussion)}</span>
        </div>
      </header>
      {posts.map((post) => (
        <article className="LcoyPrint-post">
          <div className="LcoyPrint-postHeader">
            <Avatar user={post.user() || null} title="" />
            <strong className="LcoyPrint-author">{username(post.user())}</strong>
            <span className="LcoyPrint-date">{fullDate(post.createdAt())}</span>
            <span className="LcoyPrint-number">#{post.number()}</span>
          </div>
          <div className="LcoyPrint-body Post-body">{m.trust(post.contentHtml() || '')}</div>
        </article>
      ))}
    </div>
  );
}

export async function printDiscussion(discussion: Discussion): Promise<void> {
  const loading = app.alerts.show({ type: 'success' }, t('extras.print.preparing'));
  let posts: Post[];

  try {
    posts = await loadAllPosts(discussion);
  } finally {
    app.alerts.dismiss(loading);
  }

  const root = document.createElement('div');
  root.id = 'lcoy-print';
  document.body.appendChild(root);

  const close = () => {
    window.removeEventListener('afterprint', close);
    document.documentElement.classList.remove(PRINTING_CLASS);
    m.render(root, null);
    root.remove();
  };

  document.documentElement.classList.add(PRINTING_CLASS);
  m.render(root, printView(discussion, posts, close));

  // 帖子中的图片需要加载完成，否则打印出来是空白。等待它们
  // 完成（设有上限，避免某张损坏的图片卡住打印）。
  const images = Array.from(root.querySelectorAll('img')).filter((image) => !image.complete);
  const settled = (image: HTMLImageElement) =>
    new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });

  await Promise.race([Promise.all(images.map(settled)), new Promise((resolve) => setTimeout(resolve, 3000))]);

  window.addEventListener('afterprint', close);
  window.print();
}

export default function installPrint(): void {
  extend(DiscussionControls, 'userControls', function (items: ItemList<Mithril.Children>, discussion: Discussion) {
    if (!forumBool('lcoyPrintTopicEnabled', true)) return;

    items.add(
      'lcoyPrint',
      <Button icon="fas fa-print" onclick={() => printDiscussion(discussion).catch(() => {})}>
        {t('extras.print.button')}
      </Button>,
      -10
    );
  });
}
