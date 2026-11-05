/*
 * 已登录时 Discourse 侧栏顶部的区域：“⌂ 首页”、“主题 •”、“我的帖子”、
 * “我的消息 (N)”和“更多”。
 *
 * - “首页”跳到管理后台选定的主页（列表、分类或某个地址）。当首页与“主题”
 *   指向同一处时，“主题”改为显式的“最新”列表（/?sort=latest），
 *   以免两者同时处于激活状态。
 * - “我的消息”（flarum/messages）获得未读会话计数，并在会话内也保持激活；
 *   flarum/messages 放在导航中的“消息”链接会从这里移除，因为内容重复。
 * - 有新主题或未读主题的每个分类旁的新内容圆点（“主题”的圆点来自统计功能）。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import LinkButton from 'flarum/common/components/LinkButton';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import LcoySidebar from '../components/LcoySidebar';
import { forumString } from './settings';
import { forumBool, isExtensionEnabled, t } from '../utils/settings';
import { categoriesRouteName, categoriesUrl, currentTag, isTagsEnabled } from '../utils/tags';
import { draftCount, draftsOn } from '../features/composer/drafts/fofDrafts';

type HomeTarget = 'index' | 'categories' | 'url';

function homeTarget(): HomeTarget {
  const value = forumString('lcoySidebarHome');

  if (value === 'categories' && isTagsEnabled()) return 'categories';
  if (value === 'url' && forumString('lcoySidebarHomeUrl')) return 'url';

  return 'index';
}

function onIndexWithoutFilter(): boolean {
  return app.current.matches(IndexPage) && app.current.get('routeName') === 'index' && !currentTag();
}

function homeLink(): Mithril.Children {
  const target = homeTarget();
  const sort = app.search.state.params().sort;

  if (target === 'url') {
    const href = forumString('lcoySidebarHomeUrl');

    return (
      <LinkButton href={href} icon="fas fa-house" external={true}>
        {t('gaps.sidebar.home')}
      </LinkButton>
    );
  }

  const href = target === 'categories' ? categoriesUrl() : app.route('index');
  const active = target === 'categories' ? app.current.get('routeName') === categoriesRouteName() : onIndexWithoutFilter() && !sort;

  return (
    <LinkButton href={href} icon="fas fa-house" active={active}>
      {t('gaps.sidebar.home')}
    </LinkButton>
  );
}

/** 把 vnode 的子节点当列表处理，以便再追加一个。 */
function withChild(vnode: any, child: Mithril.Children): any {
  const children = Array.isArray(vnode.children) ? vnode.children : vnode.children == null ? [] : [vnode.children];

  return m(vnode.tag, { ...vnode.attrs }, [...children, child]);
}

/**
 * 读者已加载的主题中，拥有新主题或未读主题的标签。Flarum 不提供按标签的
 * 计数；功能后端开启时（gaps.php），主题的服务器会下发
 * `lcoyHasUnread`。
 */
function tagsWithNews(): Set<string> {
  const ids = new Set<string>();

  if (!app.session.user) return ids;

  app.store.all<Discussion>('discussions').forEach((discussion) => {
    if (!discussion.isUnread()) return;

    const tags = ((discussion as any).tags?.() || []) as any[];

    tags.forEach((tag) => {
      if (!tag) return;

      ids.add(String(tag.id()));

      const parent = tag.parent?.();
      if (parent) ids.add(String(parent.id()));
    });
  });

  app.store.all<any>('tags').forEach((tag) => {
    if (tag.attribute('lcoyHasUnread')) ids.add(String(tag.id()));
  });

  return ids;
}

export default function installSidebarHome(): void {
  extend(LcoySidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (forumBool('lcoySidebarHomeLink', true)) {
      items.add('lcoyHome', homeLink(), 110);

      // 首页与“所有讨论”会指向同一列表：只保留首页。
      if (homeTarget() === 'index' && items.has('topics')) items.remove('topics');
    }

    if (items.has('myMessages')) {
      if (items.has('messages')) items.remove('messages');

      const vnode = items.get('myMessages') as any;
      const unread = Number(app.session.user?.attribute<number>('unreadDialogCount') || 0);
      const routeName = app.current.get('routeName');

      if (vnode && vnode.attrs) {
        const children = Array.isArray(vnode.children) ? vnode.children : vnode.children == null ? [] : [vnode.children];
        const attrs = { ...vnode.attrs, active: ['messages', 'dialog', 'dialog.message'].includes(routeName) };

        items.setContent(
          'myMessages',
          m(vnode.tag, attrs, unread > 0 ? [...children, <span className="LcoySidebar-suffix LcoySidebar-count">{unread}</span>] : children)
        );
      }
    } else if (isExtensionEnabled('flarum-messages') && items.has('messages')) {
      // 没有主题的条目时，flarum/messages 的条目沿用 Discourse 的名称。
      const vnode = items.get('messages') as any;

      if (vnode && vnode.attrs) items.setContent('messages', m(vnode.tag, vnode.attrs, t('gaps.sidebar.my_messages')));
    }
  });

  // 侧栏中的“我的草稿”，与 Discourse 一致，紧跟在主题（100）之后：
  // 安装 fof/drafts 后始终可用，有草稿时显示计数。
  extend(LcoySidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;
    const count = draftCount();

    if (!user || !draftsOn()) return;

    items.add(
      'lcoyDrafts',
      <LinkButton
        icon="fas fa-pen-ruler"
        href={app.route('user.drafts', { username: user.slug() })}
        active={app.current.get('routeName') === 'user.drafts'}
      >
        {t('composer.drafts.sidebar')}
        {count > 0 && <span className="LcoySidebar-suffix LcoySidebar-count">{count}</span>}
      </LinkButton>,
      99
    );
  });

  extend(LcoySidebar.prototype, 'categoryItems', function (items: ItemList<Mithril.Children>) {
    if (!app.session.user || !forumBool('lcoySidebarCategoryDots', true)) return;

    const fresh = tagsWithNews();

    if (!fresh.size) return;

    Object.keys(items.toObject()).forEach((key) => {
      const match = key.match(/^category(\d+)$/);

      if (!match || !fresh.has(match[1])) return;

      const vnode = items.get(key) as any;

      if (!vnode || typeof vnode !== 'object' || !vnode.tag) return;

      items.setContent(
        key,
        withChild(vnode, <span className="LcoyStatsDot LcoySidebar-newDot" title={t('gaps.sidebar.new_in_category')} aria-hidden="true" />)
      );
    });
  });
}
