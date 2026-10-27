/*
 * 登录与注册使用独立页面（/login、/signup），与 Discourse 一致。
 * 关闭该选项时（或未加载在服务端提供路由的 extend/auth.php 时），
 * 页头中的“登录”和“注册”仍会打开核心的弹窗。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import AuthPage, { type AuthMode, goToAuth, rememberReturn } from './AuthPage';
import ResetPasswordPage from './ResetPasswordPage';
import { forumBool } from '../../utils/settings';

export function authPagesActive(): boolean {
  return forumBool('lcoyAuthPages', true) && forumBool('lcoyAuthRoutes', false);
}

export default function installAuth(): void {
  // 页面从路由名中取得模式（DefaultResolver 不传递 attrs）。
  app.routes['lcoy.login'] = { path: '/login', component: AuthPage };
  app.routes['lcoy.signup'] = { path: '/signup', component: AuthPage };
  app.routes['lcoy.forgot'] = { path: '/forgot-password', component: AuthPage };
  // 重置邮件中的链接（页面由服务端提供：extend/auth.php）。
  app.routes['resetPassword'] = { path: '/reset/:token', component: ResetPasswordPage };

  extend(HeaderSecondary.prototype, 'items', (items: ItemList<Mithril.Children>) => {
    if (app.session.user || !authPagesActive()) return;

    const link = (key: string, mode: AuthMode) => {
      const button = items.has(key) ? (items.get(key) as Mithril.Vnode<any>) : null;

      if (!button?.attrs) return;

      button.attrs.onclick = (event: MouseEvent) => {
        event.preventDefault();
        rememberReturn();
        goToAuth(mode);
      };
    };

    link('logIn', 'login');
    link('signUp', 'signup');
  });
}
