/*
 * 手机端底部导航（Discourse / 现代社区 App 的形态）：
 * 讨论 · 标签 · 发帖 · 通知 · 我的。
 *
 * 由 PageStructure 的 rootItems 渲染，和页面平级、固定在最底部；
 * 编辑器打开（body.Lcoy--composing）或话题页向下滚动
 * （#app.Lcoy--navHidden）时整体收起。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled, t } from '../utils/settings';

interface NavItem {
  key: string;
  icon: string;
  label: string;
  href?: string;
  compose?: boolean;
  active?: boolean;
}

export default class MobileNav extends Component {
  items(): NavItem[] {
    const user = app.session.user;
    const path = m.route.get() || '/';
    const tags = isExtensionEnabled('flarum-tags');
    const login = app.route('lcoy.login');

    return [
      {
        key: 'index',
        icon: 'fas fa-comments',
        label: t('mobile_nav.discussions'),
        href: app.route('index'),
        active: path === '/' || path.startsWith('/?'),
      },
      tags
        ? {
            key: 'tags',
            icon: 'fas fa-tag',
            label: t('mobile_nav.tags'),
            href: app.route('tags'),
            active: path.startsWith('/tags'),
          }
        : {
            key: 'categories',
            icon: 'fas fa-layer-group',
            label: t('mobile_nav.categories'),
            href: app.route('categories'),
            active: path.startsWith('/categories'),
          },
      {
        key: 'compose',
        icon: 'fas fa-pen',
        label: t('mobile_nav.compose'),
        compose: true,
      },
      {
        key: 'notifications',
        icon: 'fas fa-bell',
        label: t('mobile_nav.notifications'),
        href: user ? app.route('notifications') : login,
        active: path.startsWith('/notifications'),
      },
      {
        key: 'user',
        icon: 'fas fa-user',
        label: user ? t('mobile_nav.profile') : t('mobile_nav.login'),
        href: user ? app.route('user', { username: user.slug() }) : login,
        active: path.startsWith('/u/') || path.startsWith('/settings'),
      },
    ];
  }

  /** 与侧栏、列表导航同一个入口：访客会看到登录弹窗。 */
  compose(event: MouseEvent): void {
    event.preventDefault();
    IndexSidebar.prototype.newDiscussionAction.call(IndexSidebar.prototype).catch(() => {});
  }

  view(): Mithril.Children {
    if (!forumBool('lcoyMobileNav', true)) return null;

    return (
      <nav className="LcoyMobileNav" aria-label={t('mobile_nav.label')}>
        {this.items().map((item) =>
          item.compose ? (
            <button
              type="button"
              key={item.key}
              className="LcoyMobileNav-item LcoyMobileNav-compose"
              aria-label={item.label}
              onclick={(event: MouseEvent) => this.compose(event)}
            >
              <span className="LcoyMobileNav-fab">
                <Icon name={item.icon} />
              </span>
              <span className="LcoyMobileNav-label">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.key}
              href={item.href as string}
              className={classList('LcoyMobileNav-item', { 'is-active': item.active })}
              aria-current={item.active ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span className="LcoyMobileNav-label">{item.label}</span>
            </Link>
          )
        )}
      </nav>
    );
  }
}
