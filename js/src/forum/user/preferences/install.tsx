/*
 * 标签页式设置，与 Discourse 一致：`/u/:username/preferences/:tab`，
 * 导航以胶囊形式位于资料头部下方（见 installProfile.tsx 中的 `sidebar`），
 * 每个标签页包含自己的分区。
 *
 * 核心的 SettingsPage 仍是页面本体（保存也由它完成：
 * `savePreferences`、`user.save`）；主题只替换 `content()`，
 * 显示当前标签页的分区。核心的 `/settings` 变成“账户”标签页。
 *
 * SettingsPage 和 UserSecurityPage 位于核心的 chunk 中：extend 使用
 * 模块名，标签页的绘制（主题 chunk）随 SettingsPage 一起加载。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import FieldSet from 'flarum/common/components/FieldSet';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import DefaultResolver from 'flarum/common/resolvers/DefaultResolver';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { beforeChunk, once } from '../../utils/chunkGate';
import { BASE_ROUTE, TAB_ROUTE } from './tabs';

type RenderTab = (page: any) => Mithril.Children;

const loadTabs = once(() => import('./SettingsTabs').then((mod) => mod.default as RenderTab));
let renderTab: RenderTab | null = null;

/**
 * 所有标签页使用同一个页面：切换标签页不会重建页面（也不会重建资料
 * 头部），只重建内容，内容从地址中读取标签页。
 */
class PreferencesResolver extends UserPageResolver {
  makeKey() {
    return BASE_ROUTE + (this.canonicalizeUserSlug(m.route.param('username')) || '');
  }

  // 不做 UserPageResolver 的 slug 校正：它构建的地址不带标签页。
  // SettingsPage 已经把用其他名字访问的人带到自己的设置页。
  render(vnode: Mithril.Vnode<any, any>) {
    return DefaultResolver.prototype.render.call(this, vnode);
  }
}

/** 访客（服务器只保护带标签页的地址）返回首页。 */
const GuestRedirect = {
  oninit() {
    m.route.set(app.route('index'), undefined, { replace: true });
  },
  view: () => null,
};

export default function installPreferences() {
  const settings = app.routes.settings as any;
  // 核心的 SettingsPage（chunk）仅对已登录者可用：没有用户时，
  // 它的 `show()` 和扩展的 extends 会出错。
  const component = () => (app.session.user ? settings.component() : Promise.resolve({ default: GuestRedirect }));

  app.routes[BASE_ROUTE] = { path: '/u/:username/preferences', component, resolverClass: PreferencesResolver } as any;
  app.routes[TAB_ROUTE] = { path: '/u/:username/preferences/:tab', component, resolverClass: PreferencesResolver } as any;

  beforeChunk(
    (namespace, url) => namespace === 'core' && /\/forum\/components\/SettingsPage\.js/.test(url),
    () => loadTabs().then((render) => (renderTab = render))
  );

  override('flarum/forum/components/SettingsPage' as any, 'oninit', function (this: any, original: (vnode: unknown) => void, vnode: unknown) {
    original(vnode);

    const user = app.session.user!;

    // 核心的 `/settings` 和其他名字的设置页都指向自己的设置页。
    const route = app.current.get('routeName');
    const username = m.route.param('username');

    if (route === 'settings' || (username && username.split('-')[0] !== user.slug().split('-')[0])) {
      const tab = route === TAB_ROUTE ? m.route.param('tab') : 'account';

      m.route.set(app.route(TAB_ROUTE, { username: user.slug(), tab }), undefined, { replace: true });
    }
  });

  override('flarum/forum/components/SettingsPage' as any, 'content', function (this: any) {
    if (!renderTab) {
      loadTabs().then((render) => {
        renderTab = render;
        m.redraw();
      });

      return <LoadingIndicator />;
    }

    return renderTab(this);
  });

  // “密码”放在安全标签页，与 Discourse 一致（按钮来自核心）。
  extend('flarum/forum/components/UserSecurityPage' as any, 'settingsItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!this.user || this.user !== app.session.user) return;

    items.add(
      'lcoyPassword',
      <FieldSet className="UserSecurityPage-lcoyPassword FieldSet--col" label={t('user.preferences.password_heading')}>
        <Button
          className="Button"
          icon="fas fa-key"
          onclick={() => app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/ChangePasswordModal'))}
        >
          {app.translator.trans('core.forum.settings.change_password_button')}
        </Button>
        <p className="helpText">{t('user.preferences.password_help')}</p>
      </FieldSet>,
      200
    );
  });
}
