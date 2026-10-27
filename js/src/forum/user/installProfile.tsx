/*
 * 基于核心 UserPage 的 Discourse 资料页。
 *
 * 核心把资料绘制成占满宽度的彩色 hero 和左侧导航栏。Discourse 把所有内容
 * 放进卡片：顶部封面、大头像、名字、一行统计以及下方的标签页。
 * 外壳的代理已经把 hero 移进卡片（PageStructure）；
 * 这里为 UserCard 补上缺少的部件，并把导航变成标签页。
 *
 * 与 Discourse 一致，完整头部（封面、简介、统计）只在摘要页显示；
 * 其他标签页中它收缩为小头像和名字（`.collapsed-info`），
 * 列表占据整个屏幕。
 *
 * 所有这些只对资料卡片（`.UserHero`）生效：同一个 UserCard 也会作为
 * 帖子中的 popover 出现，那里保持原样。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import UserCard from 'flarum/forum/components/UserCard';
import UserControls from 'flarum/forum/utils/UserControls';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import LinkButton from 'flarum/common/components/LinkButton';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

import PostListItem from 'flarum/forum/components/PostListItem';
import type Discussion from 'flarum/common/models/Discussion';

import UserStats from './UserStats';
import streamItem from './streamItem';
import ScrollNav from './activity/ScrollNav';
import { ACTIVITY_ORDER } from './activity/install';
import { forumBool, t } from '../utils/settings';
import { currentTab, tabUrl, TAB_ICONS, visibleTabs } from './preferences/tabs';
import { isTagsEnabled } from '../utils/tags';
import PostListState from 'flarum/forum/states/PostListState';
import { userIcons } from '../utils/userIcons';
import { userCoverUrl } from '../thirdparty/profileCover';

/** 改由统计行显示的 UserCard 条目。 */
const INFO_MOVED_TO_STATS = ['lastSeen', 'joined'];

/**
 * `ul.UserCard-info` 会收到各种内容：位置和网站
 *（来自 fof/socialprofile）、简介（来自 fof/user-bio）、最佳答案、
 * 关注者、积分和徽章（来自扩展）。在单行 flex 中，这会变成
 * 两排错位的内容，简介被挤在数字旁边。资料页把它分成三条：资料事实、
 * 数字/徽章胶囊以及简介。
 */
const INFO_FACTS = ['lastSeen', 'joined'];
const INFO_BIO = ['bio'];

/**
 * Discourse 的一级标签页（摘要、活动、通知、消息、徽章、设置）。
 * 其余一切——帖子、主题、点赞、提及以及扩展添加的内容——进入
 * 第二行，位于“活动”之内。
 */
const PRIMARY_NAV_KEYS = ['summary', 'badges', 'settings', 'security', 'notifications', 'messages'];

/** 对用户本人而言属于设置标签页的资料页面。 */
const PREFERENCE_PAGES = ['security', 'ignored-users'];

/** “活动”标签页，使用 Discourse 的名称和图标。 */
const ACTIVITY_LABELS: Record<string, { icon: string; label?: string }> = {
  posts: { icon: 'fas fa-bars', label: 'user.nav.posts' },
  discussions: { icon: 'fas fa-list-ul', label: 'user.nav.discussions' },
  likes: { icon: 'far fa-heart' },
  mentions: { icon: 'fas fa-at' },
};

function isProfileHero(card: any): boolean {
  return /\bUserHero\b/.test(card.attrs?.className || '');
}

function statsEnabled(): boolean {
  return forumBool('lcoyUserStats', true);
}

function summaryEnabled(): boolean {
  return forumBool('lcoyUserSummary', true);
}

/** 摘要页之外头部会收缩，类似 Discourse 的 `.collapsed-info`。 */
export function profileCollapsed(): boolean {
  return summaryEnabled() && app.current.get('routeName') !== 'user.summary';
}

/** 图标成为头像“flair”的分组：第一个带图标的分组。 */
function flairGroup(user: User): Group | null {
  const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);

  return groups.find((group) => !!group.icon()) || null;
}

export default function installProfile() {
  extendUserPage();
  extendProfileHero();
  extendUserStream();
}

/**
 * 资料的帖子标签页（帖子、点赞、提及）采用 Discourse 的
 * `user-stream-item`：48px 头像、作为链接的主题标题、
 * 下方的分类和日期以及正文开头——不是带按钮的整篇帖子，
 * 而那正是核心 PostListItem 绘制的内容。
 */
function extendUserStream() {
  // 条目的分类（“Bug • 5 天前”）来自主题的标签，
  // 而核心的帖子列表不包含它们。
  extend(PostListState.prototype, 'requestParams' as any, function (this: PostListState, params: any) {
    if (!isTagsEnabled() || !params) return;

    const include = typeof params.include === 'string' ? params.include.split(',') : Array.isArray(params.include) ? params.include : [];

    if (!include.includes('discussion.tags')) params.include = [...include, 'discussion.tags'];
  });

  override(PostListItem.prototype, 'view', function (this: PostListItem, original: () => Mithril.Children) {
    const post = this.attrs.post;
    const discussion = post.discussion() as Discussion | false;

    if (!/^user(\.|$)/.test(app.current.get('routeName') || '') || !discussion) return original();

    return streamItem(post);
  });
}

function extendUserPage() {
  // 独立的类启用列布局（卡片、标签页、内容），
  // 不依赖核心为 IndexPage 设计的 `Page--vertical`。
  extend(UserPage.prototype, 'view', function (this: UserPage, vnode: Mithril.Vnode<any, any>) {
    if (!vnode || !vnode.attrs) return;

    vnode.attrs.className = classList(vnode.attrs.className, 'LcoyUserPage', {
      'LcoyUserPage--collapsed': profileCollapsed(),
    });
  });

  // 不用 AffixedSidebar 和 SelectDropdown：在卡片下方、文档流中放两行
  // 标签页，类似 Discourse 的 `user-navigation`。
  override(UserPage.prototype, 'sidebar', function (this: UserPage) {
    const nav = this.navItems();
    const primary = new ItemList<Mithril.Children>();
    const activity = new ItemList<Mithril.Children>();

    const self = !!this.user && this.user === app.session.user;
    const prefTab = self ? currentTab() : null;

    Object.entries(nav.toObject()).forEach(([key, item]) => {
      if (/separator/i.test(key)) return;
      // 安全与忽略成为设置标签页，与 Discourse 一致。
      if (self && PREFERENCE_PAGES.includes(key)) return;

      const content = item.content as any;

      // “设置”是设置页的入口：在“账户”标签页打开，
      // 并在所有标签页中保持激活。
      if (key === 'settings' && self && content?.attrs) {
        content.attrs.href = tabUrl(this.user!, 'account');
        content.attrs.active = !!prefTab;
        content.children = [t('user.preferences.nav')];
      }
      const relabel = ACTIVITY_LABELS[key];

      // 用 Discourse 的 `user-navigation-secondary` 中的名称和图标
      //（“帖子”、“主题”、点赞的爱心）取代核心的。
      if (relabel && content?.attrs) {
        content.attrs.icon = relabel.icon;
        if (relabel.label) content.children = [t(relabel.label)];
      }

      if (PRIMARY_NAV_KEYS.includes(key)) {
        primary.add(key, content as Mithril.Children, item.priority);
        return;
      }

      // Discourse 的顺序（主题、回复、已读、草稿、点赞、
      // 收藏、反应、投票、已解决…）；其他扩展的标签页
      // 随后按它们自己的顺序排列。
      const order = ACTIVITY_ORDER.indexOf(key);
      activity.add(key, content as Mithril.Children, order === -1 ? item.priority : 1000 - order);
    });

    const isActive = (content: any) => !!content?.attrs?.href && LinkButton.isActive(content.attrs);
    const activityActive = activity.toArray().some(isActive);

    if (!activity.isEmpty() && this.user) {
      primary.add(
        'activity',
        <LinkButton href={app.route('user.activity', { username: this.user.slug() })} icon="fas fa-bars" active={activityActive}>
          {t('user.nav.activity')}
        </LinkButton>,
        105
      );
    }

    return (
      <nav className="UserPage-nav LcoyUserNav">
        <ul className="LcoyUserNav-primary">{listItems(primary.toArray())}</ul>
        {activityActive && <ScrollNav className="LcoyUserNav-secondary">{listItems(activity.toArray())}</ScrollNav>}
        {prefTab && (
          <ul className="LcoyUserNav-secondary LcoyUserNav-prefs">
            {visibleTabs().map((tab) => (
              <li className={`item-${tab}`}>
                <LinkButton href={tabUrl(this.user!, tab)} icon={TAB_ICONS[tab]} active={tab === prefTab}>
                  {t(`user.preferences.tabs.${tab}`)}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </nav>
    );
  });
}

function extendProfileHero() {
  extend(UserCard.prototype, 'view', function (this: any, vnode: Mithril.Vnode<any, any>) {
    if (!isProfileHero(this) || !vnode?.attrs) return;

    const user: User = this.attrs.user;
    const collapsed = profileCollapsed();
    // 未上传封面图时不显示该条带：资料页保持干净的顶部，
    // 而不是使用通用渐变（用户要求）。
    const cover = forumBool('lcoyUserCover', true) && !collapsed && !!userCoverUrl(user);

    vnode.attrs.className = classList(vnode.attrs.className, 'LcoyUserHero', {
      'LcoyUserHero--cover': cover,
      'LcoyUserHero--collapsed': collapsed,
    });

    const children = (Array.isArray(vnode.children) ? vnode.children : [vnode.children]) as Mithril.Children[];

    if (cover) children.unshift(<div className="LcoyUserHero-cover" aria-hidden="true" />);

    if (statsEnabled() && !collapsed) children.push(<UserStats user={user} />);

    vnode.children = children as any;
  });

  // Discourse 的“flair”：分组图标放在其颜色的圆圈中，
  // 位于头像角落。
  extend(UserCard.prototype, 'profileItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this) || !items.has('avatar')) return;

    const group = flairGroup(this.attrs.user);

    items.setContent(
      'avatar',
      <div className="LcoyUserHero-avatar">
        {items.get('avatar')}
        {group && (
          <span
            className={classList('LcoyAvatarFlair', { 'LcoyAvatarFlair--colored': !!group.color() })}
            style={group.color() ? { '--group-color': group.color() } : undefined}
            title={group.nameSingular()}
          >
            <Icon name={group.icon()!} />
          </span>
        )}
      </div>
    );
  });

  extend(UserCard.prototype, 'infoItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this) || !statsEnabled()) return;

    INFO_MOVED_TO_STATS.forEach((key) => items.has(key) && items.remove(key));
  });

  extend(UserCard.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this)) return;

    const user: User = this.attrs.user;
    const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);

    // 分组进入统计行（“分组 Admin, …”），第一个带图标的成为
    // 头像的 flair；剩下那些圆形徽章（例如“已暂停”）放在名字
    // 旁边，而不是散落在资料页中间。
    const badges = user.badges();
    groups.forEach((group) => badges.has(`group${group.id()}`) && badges.remove(`group${group.id()}`));
    const badgeList = badges.isEmpty() ? null : <ul className="UserCard-badges badges LcoyUserHero-badges">{listItems(badges.toArray())}</ul>;

    if (items.has('identity')) {
      items.setContent('identity', identity(user, badgeList));
    }

    if (items.has('badges')) items.remove('badges');

    // 核心的 `ul.UserCard-info` 是一条自由的 flex 行：位置/网站/简介、
    // 最佳答案、关注者、积分、徽章和简介（块级）全在同一行中，
    // 会错位。这里把它变成三条：事实、
    // 数字/徽章胶囊以及简介（见 less/forum/User.less 中的 LcoyProfileInfo）。
    if (items.has('info')) {
      const info = this.infoItems();

      if (info.isEmpty()) {
        items.remove('info');
      } else {
        const facts = new ItemList<Mithril.Children>();
        const chips = new ItemList<Mithril.Children>();
        let bio: Mithril.Children = null;

        info.toArray().forEach((content: any) => {
          // `toArray()` 返回内容本身，并附带 `itemName`。
          const key = content?.itemName as string;
          const priority = key ? info.getPriority(key) : 0;

          if (INFO_FACTS.includes(key)) {
            facts.add(key, content, priority);
          } else if (INFO_BIO.includes(key)) {
            bio = content;
          } else {
            chips.add(key, content, priority);
          }
        });

        items.setContent(
          'info',
          <div className="LcoyProfileInfo">
            {!facts.isEmpty() && <ul className="LcoyProfileInfo-facts">{listItems(facts.toArray())}</ul>}
            {!chips.isEmpty() && <ul className="LcoyProfileInfo-chips">{listItems(chips.toArray())}</ul>}
            {bio && <div className="LcoyProfileInfo-bio">{bio}</div>}
          </div>
        );
      }
    }
  });

  extend(UserCard.prototype, 'controlsItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!isProfileHero(this)) return;

    const user: User = this.attrs.user;
    const controls: ItemList<Mithril.Children> = UserControls.controls(user, this);

    // “发消息”（flarum/messages）从菜单移出，变成右侧的主按钮，
    // 与 Discourse 一致。
    if (controls.has('sendMessage')) {
      const message = controls.get('sendMessage') as any;
      controls.remove('sendMessage');

      items.add(
        'lcoyMessage',
        <Button {...(message?.attrs || {})} className="Button Button--primary LcoyUserHero-message">
          {message?.children}
        </Button>,
        110
      );
    }

    const remaining = controls.toArray().filter((item: any) => !/Separator$/.test(item.itemName || ''));

    if (!remaining.length) {
      items.has('controls') && items.remove('controls');
      return;
    }

    // 控制菜单变成一个圆形的图标按钮（⋮）。
    const dropdown = (
      <Dropdown
        className="App-primaryControl LcoyUserHero-controls"
        menuClassName="Dropdown-menu--right"
        buttonClassName="Button Button--icon"
        label={app.translator.trans('core.forum.user_controls.button')}
        accessibleToggleLabel={app.translator.trans('core.forum.user_controls.toggle_dropdown_accessible_label')}
        icon="fas fa-ellipsis-h"
      >
        {controls.toArray()}
      </Dropdown>
    );

    if (items.has('controls')) items.setContent('controls', dropdown);
    else items.add('controls', dropdown, 100);
  });
}

/**
 * 以粗体显示的超大显示名（flarum/nicknames 的昵称，与帖子中一致），
 * 同一行放图标（认证徽章、utils/userIcons）和徽章；
 * 如果不同，下方是 username。
 */
function identity(user: User, badges: Mithril.Children = null): Mithril.Children {
  const username = user.username();
  const displayName = user.displayName() || username;

  return (
    <div className="LcoyUserHero-names">
      <h1 className="UserCard-identity LcoyUserHero-username">
        <span className="username">{displayName}</span>
        {userIcons(user, 'profile')}
        {badges}
      </h1>
      {displayName !== username && <h2 className="LcoyUserHero-displayName">{username}</h2>}
    </div>
  );
}
