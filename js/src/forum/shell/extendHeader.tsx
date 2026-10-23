/*
 * 调整页头右侧的控件，使其与 Discourse 一致：
 * 语言变成圆形旗帜（与本主题一致），“登录”加上图标，当侧栏页脚
 * 已经提供主题选择器时，将其从页头
 * 移除。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';
import LocaleFlags from './LocaleFlags';

export default function extendHeader() {
  // fof/drafts 会在页头放一个羽毛图标（DraftsDropdown，键 `Drafts`）。
  // Discourse 没有这个图标：草稿位于“新主题”按钮的
  // “⌄”中。fof 的 initializer 在主题之后运行，所以移除操作
  // 注册在 `mount` 中，此时所有条目都已添加完毕。
  override(app as any, 'mount', function (this: any, original: (...args: any[]) => unknown, ...args: any[]) {
    extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
      if (items.has('Drafts')) items.remove('Drafts');
    });

    return original(...args);
  });

  extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const sidebarFooter = forumBool('lcoySidebarEnabled', true) && forumBool('lcoySidebarFooter', true);

    if (sidebarFooter && items.has('themeSwitcher')) {
      items.remove('themeSwitcher');
    }

    if (items.has('locale')) {
      // 本主题的选择器：当前语言的旗帜放在圆形按钮中，
      // 展开后，各语言的旗帜显示在带箭头的气泡里。
      items.setContent('locale', LocaleFlags());

      // 对访客，Discourse 把 “PT” 放在注册/登录之后；
      // 已登录时，它位于图标之前。
      if (!app.session.user) items.setPriority('locale', -10);
    }

    // “登录”带上人物图标，如同 Discourse 的 .login-button。
    if (items.has('logIn')) {
      const logIn = items.get('logIn') as Mithril.Vnode<any>;

      if (logIn && logIn.attrs) logIn.attrs.icon = 'far fa-user';
    }
  });
}
