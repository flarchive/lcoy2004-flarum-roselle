/*
 * 设置某个标签页的内容（chunk：随核心 SettingsPage 一起加载）。
 * 分区来自 `settingsItems`——核心、主题和扩展的——按当前打开的
 * 标签页过滤（见 tabs.ts）。
 *
 * 有两个分区被重新绘制，但保存方式不变：
 * - “账户”变成 Discourse 的字段：用户名、头像（核心的 AvatarEditor）
 *   以及带状态的邮箱；按钮来自核心的 `accountItems`。
 *   “修改密码”移到安全标签页。
 * - flarum/subscriptions 的关注主题选项从“通知”移到“跟踪”，
 *   即 Discourse 放置它们的位置。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import AvatarEditor from 'flarum/forum/components/AvatarEditor';
import Button from 'flarum/common/components/Button';
import FieldSet from 'flarum/common/components/FieldSet';
import ItemList from 'flarum/common/utils/ItemList';
import listItems from 'flarum/common/helpers/listItems';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { isTagsEnabled } from '../../utils/tags';
import { getSidebarPicks, type SidebarSectionName } from '../../utils/sidebarPrefs';
import { currentTab, rememberOther, sectionTab, TRACKING_ITEMS, visibleTabs, type PrefTab } from './tabs';

/** 账户标签页已经在正确位置绘制的核心按钮。 */
const ACCOUNT_OWN_ITEMS = ['changeEmail', 'changePassword'];

interface AccountAttrs extends ComponentAttrs {
  user: User;
  /** SettingsPage 的 `accountItems()`，含核心和扩展的按钮。 */
  items: ItemList<Mithril.Children>;
}

/** 账户标签页的字段，采用 Discourse 的 `control-group` 格式。 */
class AccountSection extends Component<AccountAttrs> {
  editor: any = null;
  resending = false;
  resent = false;

  view() {
    const { user, items } = this.attrs;
    const extra = new ItemList<Mithril.Children>();

    Object.entries(items.toObject()).forEach(([key, item]) => {
      if (!ACCOUNT_OWN_ITEMS.includes(key)) extra.add(key, item.content as Mithril.Children, item.priority);
    });

    return (
      <div className="LcoyPrefs-account">
        <div className="LcoyPrefs-group LcoyPrefs-username">
          <span className="LcoyPrefs-label">{t('user.preferences.username')}</span>
          <div className="LcoyPrefs-controls">
            <span className="LcoyPrefs-static">{user.username()}</span>
          </div>
          <p className="LcoyPrefs-help">{t('user.preferences.username_help', { username: user.username() })}</p>
        </div>

        <div className="LcoyPrefs-group LcoyPrefs-avatar">
          <span className="LcoyPrefs-label">{t('user.preferences.avatar')}</span>
          <div className="LcoyPrefs-controls">
            {/* vnode 保存实例：按钮使用编辑器自身的提交。 */}
            <AvatarEditor user={user} className="LcoyPrefs-avatarEditor" oncreate={(vnode: any) => (this.editor = vnode.state)} />
            <Button className="Button" icon="fas fa-camera" onclick={() => this.editor?.openPicker()}>
              {t('user.preferences.avatar_change')}
            </Button>
            {user.hasUploadedAvatar() && (
              <Button className="Button Button--link LcoyPrefs-remove" onclick={() => this.editor?.remove()}>
                {app.translator.trans('core.forum.user.avatar_remove_button')}
              </Button>
            )}
          </div>
          <p className="LcoyPrefs-help">{t('user.preferences.avatar_help')}</p>
        </div>

        <div className="LcoyPrefs-group LcoyPrefs-email">
          <span className="LcoyPrefs-label">{t('user.preferences.email')}</span>
          <div className="LcoyPrefs-emailRow">
            <span className="LcoyPrefs-emailAddress">{user.email()}</span>
            <span className="LcoyPrefs-pill LcoyPrefs-pill--primary">{t('user.preferences.email_primary')}</span>
            {user.isEmailConfirmed() ? (
              <span className="LcoyPrefs-pill LcoyPrefs-pill--ok">{t('user.preferences.email_confirmed')}</span>
            ) : (
              [
                <span className="LcoyPrefs-pill LcoyPrefs-pill--warn">{t('user.preferences.email_unconfirmed')}</span>,
                <Button
                  className="Button Button--link LcoyPrefs-resend"
                  loading={this.resending}
                  disabled={this.resent}
                  onclick={() => this.resend()}
                >
                  {t(this.resent ? 'user.preferences.email_resent' : 'user.preferences.email_resend')}
                </Button>,
              ]
            )}
          </div>
          <div className="LcoyPrefs-controls">{items.has('changeEmail') && items.get('changeEmail')}</div>
          <p className="LcoyPrefs-help">{t('user.preferences.email_help')}</p>
        </div>

        {!extra.isEmpty() && <div className="LcoyPrefs-group LcoyPrefs-extra">{listItems(extra.toArray())}</div>}
      </div>
    );
  }

  /** 与核心“确认你的邮箱”提示相同的请求。 */
  resend() {
    this.resending = true;

    app
      .request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/users/${this.attrs.user.id()}/send-confirmation` })
      .then(() => (this.resent = true))
      .finally(() => {
        this.resending = false;
        m.redraw();
      });
  }
}

/** “导航菜单”：侧栏显示的内容，与 Discourse 一致。 */
function navMenuSection(): Mithril.Children {
  const row = (section: SidebarSectionName) => {
    const picks = getSidebarPicks(section);

    return (
      <div className="LcoyPrefs-group">
        <span className="LcoyPrefs-label">{t(section === 'categories' ? 'sidebar.categories' : 'sidebar.tags')}</span>
        <div className="LcoyPrefs-controls">
          <span className="LcoyPrefs-static">
            {picks ? t('user.preferences.nav_menu_picked', { count: picks.length }) : t('user.preferences.nav_menu_default')}
          </span>
          <Button
            className="Button"
            icon="fas fa-pencil"
            onclick={() => app.modal.show(() => import('../../components/SidebarCustomizeModal'), { section })}
          >
            {t('user.preferences.nav_menu_edit')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <FieldSet className="Settings-lcoyNavMenu FieldSet--col" label={t('user.preferences.nav_menu_heading')}>
      <p className="LcoyPrefs-help">{t('user.preferences.nav_menu_help')}</p>
      {row('categories')}
      {row('tags')}
    </FieldSet>
  );
}

/** 所有分区，其中账户、通知和跟踪已重做。 */
function sections(page: any): ItemList<Mithril.Children> {
  const items: ItemList<Mithril.Children> = page.settingsItems();
  const user: User = page.user;

  if (items.has('account')) {
    items.setContent(
      'account',
      <FieldSet className="Settings-account FieldSet--col" label={app.translator.trans('core.forum.settings.account_heading')}>
        <AccountSection user={user} items={page.accountItems()} />
      </FieldSet>
    );
  }

  if (items.has('notifications')) {
    const notifications: ItemList<Mithril.Children> = page.notificationsItems();
    const tracking = new ItemList<Mithril.Children>();

    TRACKING_ITEMS.forEach((key) => {
      if (!notifications.has(key)) return;
      tracking.add(key, notifications.get(key), notifications.getPriority(key));
      notifications.remove(key);
    });

    items.setContent(
      'notifications',
      <FieldSet className="Settings-notifications FieldSet--min" label={app.translator.trans('core.forum.settings.notifications_heading')}>
        {notifications.toArray()}
      </FieldSet>
    );

    if (!tracking.isEmpty()) {
      items.add(
        'lcoyAutoTrack',
        <FieldSet className="Settings-lcoyAutoTrack FieldSet--col" label={t('user.preferences.auto_track_heading')}>
          {tracking.toArray()}
        </FieldSet>,
        50
      );
    }
  }

  if (isTagsEnabled()) items.add('lcoyNavMenu', navMenuSection(), 10);

  return items;
}

export default function renderTab(page: any): Mithril.Children {
  const user: User = page.user;
  const all = sections(page);
  const keys = Object.keys(all.toObject());
  const hasOther = keys.some((key) => sectionTab(key) === 'other');

  // “其他”标签页仅在存在无处安放的分区时出现；导航已经
  // 绘制，因此如有变化就通知。
  if (visibleTabs(user).includes('other') !== hasOther) {
    rememberOther(hasOther);
    setTimeout(m.redraw);
  }

  let tab = currentTab() as PrefTab;
  if (!visibleTabs(user).includes(tab) && !(tab === 'other' && hasOther)) tab = 'account';

  const shown = new ItemList<Mithril.Children>();
  Object.entries(all.toObject()).forEach(([key, item]) => {
    if (sectionTab(key) === tab) shown.add(key, item.content as Mithril.Children, item.priority);
  });

  return (
    <div className={`SettingsPage LcoyPrefs LcoyPrefs--${tab}`}>
      {shown.isEmpty() ? <p className="LcoyPrefs-empty">{t('user.preferences.empty')}</p> : <ul>{listItems(shown.toArray())}</ul>}
    </div>
  );
}
