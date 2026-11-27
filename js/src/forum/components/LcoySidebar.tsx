import app from 'flarum/forum/app';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Link from 'flarum/common/components/Link';
import Dropdown from 'flarum/common/components/Dropdown';
import Separator from 'flarum/common/components/Separator';
import ItemList from 'flarum/common/utils/ItemList';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import SidebarSection from './SidebarSection';
import DraftsMenu, { showDraftsMenu } from '../features/composer/drafts/DraftsMenu';
import { FooterColorMode, FooterPaletteSelector } from '../shell/colorMode';
import { getCommunityMore, getSidebarPicks, type SidebarSectionName } from '../utils/sidebarPrefs';
import { forumBool, forumInt, t } from '../utils/settings';
import {
  allTags,
  categoriesUrl,
  categorySymbol,
  currentTag,
  isTagsEnabled,
  primaryTags,
  secondaryTags,
  sortTags,
  tagSymbol,
  tagUrl,
  type LcoyTag,
} from '../utils/tags';

/** flarum/tags 放在 IndexSidebar 导航中的条目：这里它们有自己的区域。 */
const TAG_NAV_KEYS = /^(tags|separator|moreTags|tag\d+)$/;

/**
 * Discourse 的侧栏：“发起讨论”按钮、社区区域
 * （主题、我的帖子、更多……）、分类和标签，以及一个
 * 包含浅色/深色主题和键盘快捷键的页脚。
 *
 * 继承 IndexSidebar，以便免费获得扩展添加到首页
 * 导航中的内容——例如“关注”——并使用 LinkButton
 * 已经计算好的 `active`。
 */
export default class LcoySidebar extends IndexSidebar {
  view(): Mithril.Children {
    return (
      <div className="LcoySidebar-inner">
        <div className="LcoySidebar-sections">{this.sectionItems().toArray()}</div>
        {forumBool('lcoySidebarFooter', true) && <div className="LcoySidebar-footer">{this.footerItems().toArray()}</div>}
      </div>
    );
  }

  sectionItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    // 与 Discourse 一样，按钮只对已登录用户显示（访客
    // 有页头的“登录”）。管理员可以将其完全隐藏。
    if (app.session.user && forumBool('lcoySidebarNewTopic', true)) items.add('newTopic', this.newTopicButton(), 100);

    items.add('community', <SidebarSection name="community">{listItems(this.communitySection().toArray())}</SidebarSection>, 90);

    if (isTagsEnabled() && forumBool('lcoySidebarCategories', true)) {
      const categories = this.categoryItems();

      if (!categories.isEmpty()) {
        items.add(
          'categories',
          <SidebarSection name="categories" title={t('sidebar.categories')} {...this.editAttrs('categories')}>
            {listItems(categories.toArray())}
          </SidebarSection>,
          80
        );
      }
    }

    if (isTagsEnabled() && forumBool('lcoySidebarTags', true)) {
      const tags = this.tagItems();

      if (!tags.isEmpty()) {
        items.add(
          'tags',
          <SidebarSection name="tags" title={t('sidebar.tags')} {...this.editAttrs('tags')}>
            {listItems(tags.toArray())}
          </SidebarSection>,
          70
        );
      }
    }

    return items;
  }

  /** 自定义区域的铅笔图标，如同 Discourse。 */
  editAttrs(section: SidebarSectionName) {
    return {
      editLabel: t(section === 'categories' ? 'sidebar.customize_categories' : 'sidebar.customize_tags'),
      onEdit: () => app.modal.show(() => import('./SidebarCustomizeModal'), { section }),
    };
  }

  /** 读者为该区域选择的标签，按论坛顺序排列。 */
  pickedTags(section: SidebarSectionName): LcoyTag[] | null {
    const picks = getSidebarPicks(section);

    if (!picks) return null;

    const ids = new Set(picks);

    return sortTags(allTags().filter((tag) => ids.has(tag.id()!)));
  }

  newTopicButton(): Mithril.Children {
    const tag = currentTag() as (LcoyTag & { canStartDiscussion?: () => boolean }) | null;
    const canStart = !app.session.user || (tag?.canStartDiscussion ? tag.canStartDiscussion() : !!app.forum.attribute('canStartDiscussion'));

    // 有草稿（fof/drafts）时，按钮会变成 Discourse 的分裂按钮：
    // “✎ 新主题”以及带草稿列表的“⌄”。
    const split = showDraftsMenu();

    return (
      <div className={classList('LcoySidebar-newTopic', split && 'LcoySidebar-newTopic--split')}>
        <Button
          className="Button Button--primary LcoySidebar-newTopicButton"
          icon="fas fa-pen-to-square"
          disabled={!canStart}
          onclick={() => this.newDiscussionAction().catch(() => {})}
        >
          {t('sidebar.new_topic')}
        </Button>
        {split && <DraftsMenu />}
      </div>
    );
  }

  communityItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = app.session.user;
    const params = app.search.state.stickyParams();

    items.add(
      'topics',
      <LinkButton href={app.route('index', params)} icon="fas fa-layer-group" active={this.isIndexActive()}>
        {t('sidebar.topics')}
      </LinkButton>,
      100
    );

    // 其他扩展放在导航中的内容（例如“关注”），
    // 但不包括标签列表，它在这里有自己的区域。
    const extensionItems = this.navItems();

    extensionItems.remove('allDiscussions');

    Object.entries(extensionItems.toObject()).forEach(([key, item]) => {
      if (!TAG_NAV_KEYS.test(key)) items.add(key, item.content as Mithril.Children, item.priority);
    });

    if (user) {
      items.add(
        'myPosts',
        <LinkButton href={app.route('user.posts', { username: user.slug() })} icon="far fa-user">
          {t('sidebar.my_posts')}
        </LinkButton>,
        60
      );

      // “私信”和“管理”不在这里：两者都已位于头像菜单中
      // （核心的菜单带“管理”，以及主题的消息标签页），
      // 在侧栏重复入口只会占用高度。
    }

    items.add('more', this.moreDropdown(), -100);

    return items;
  }

  /**
   * 所有扩展都添加完条目后的主区域：
   * 读者选择隐藏的条目会进入“更多”，而“更多”
   * 会获得“自定义”以及所有条目的列表。
   */
  communitySection(): ItemList<Mithril.Children> {
    const items = this.communityItems();
    const hidden = new Set(getCommunityMore());
    const entries: { key: string; label: string; icon?: string }[] = [];
    const moved: { key: string; node: Mithril.Children }[] = [];

    Object.keys(items.toObject()).forEach((key) => {
      if (key === 'more') return;

      const vnode = items.get(key) as any;

      entries.push({ key, label: vnodeText(vnode) || key, icon: vnode?.attrs?.icon });

      // 活动中的条目永远不会消失：位于该页面的人能看到自己在哪。
      if (hidden.has(key) && vnode?.attrs?.active !== true && vnode?.attrs?.active !== 'true') {
        moved.push({ key, node: vnode });
        items.remove(key);
      }
    });

    if (items.has('more')) items.setContent('more', this.moreDropdown(moved, entries));

    return items;
  }

  /** “主题”在首页且无标签或“关注”筛选时处于活动状态。 */
  isIndexActive(): boolean {
    const routeName = app.current.get('routeName');

    return routeName === 'index' && !currentTag();
  }

  moreItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    if (isTagsEnabled()) {
      items.add(
        'categories',
        <LinkButton href={categoriesUrl()} icon="fas fa-table-cells-large">
          {t('sidebar.all_categories')}
        </LinkButton>,
        100
      );
    }

    if (app.session.user) {
      items.add(
        'notifications',
        <LinkButton href={app.route('notifications')} icon="far fa-bell">
          {t('sidebar.notifications')}
        </LinkButton>,
        90
      );
      items.add(
        'settings',
        <LinkButton href={app.route('settings')} icon="fas fa-gear">
          {t('sidebar.settings')}
        </LinkButton>,
        80
      );
    }

    items.add(
      'shortcuts',
      <Button icon="far fa-keyboard" onclick={() => app.modal.show(() => import('./KeyboardShortcutsModal'))}>
        {t('sidebar.keyboard_shortcuts')}
      </Button>,
      10
    );

    return items;
  }

  moreDropdown(
    moved: { key: string; node: Mithril.Children }[] = [],
    entries: { key: string; label: string; icon?: string }[] = []
  ): Mithril.Children {
    const more = this.moreItems();

    if (entries.length) {
      more.add(
        'customizeCommunity',
        <Button icon="fas fa-pencil" onclick={() => app.modal.show(() => import('./CommunityCustomizeModal'), { entries, onsave: () => m.redraw() })}>
          {t('sidebar.customize_community')}
        </Button>,
        5
      );
    }

    // 移动的条目进入与其余条目相同的 ItemList：`toArray()` 会为所有条目
    // 设置 `itemName`，Dropdown 将该名称作为 key。将散落的 vnode
    // 与分隔符混在一起会让 Mithril 拒绝整个列表
    // （"vnodes must either all have keys or none have keys"）。
    const menu = new ItemList<Mithril.Children>();

    // 仅在与会话“更多”的固定键（categories、notifications、settings、
    // shortcuts……）冲突时添加前缀：这样移动的条目
    // 保留主题/扩展其他部分所知的 `item-<键>` 类。
    moved.forEach(({ key, node }, index) => menu.add(more.has(key) ? `moved-${key}` : key, node, 200 - index));
    if (moved.length) menu.add('lcoyMovedSeparator', <Separator />, 150);
    menu.merge(more);

    return (
      <Dropdown
        className="LcoySidebar-more"
        buttonClassName="LcoySidebar-moreButton"
        icon="fas fa-ellipsis-vertical"
        label={t('sidebar.more')}
        caretIcon={null}
        accessibleToggleLabel={t('sidebar.more')}
        onshow={() => placeMoreMenu()}
      >
        {menu.toArray()}
      </Dropdown>
    );
  }

  categoryItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const active = currentTag();
    const activeRoot = active && active.isChild() ? (active.parent() as LcoyTag) : active;

    (this.pickedTags('categories') ?? primaryTags()).forEach((tag, index) => {
      items.add(`category${tag.id()}`, this.tagLink(tag, categorySymbol(tag, 'LcoySidebar-linkIcon'), activeRoot === tag), 100 - index);
    });

    items.add(
      'allCategories',
      <LinkButton className="LcoySidebar-link--all" href={categoriesUrl()} icon="fas fa-list">
        {t('sidebar.all_categories')}
      </LinkButton>,
      -100
    );

    return items;
  }

  tagItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const active = currentTag();
    const limit = forumInt('lcoySidebarTagsLimit', 6);
    const picked = this.pickedTags('tags');
    const tags = picked ?? secondaryTags().slice(0, limit);

    tags.forEach((tag, index) => {
      items.add(`tag${tag.id()}`, this.tagLink(tag, tagSymbol(tag, 'LcoySidebar-linkIcon', 'fas fa-tag'), active === tag), 100 - index);
    });

    if (tags.length) {
      items.add(
        'allTags',
        <LinkButton className="LcoySidebar-link--all" href={app.route('tags')} icon="fas fa-list">
          {t('sidebar.all_tags')}
        </LinkButton>,
        -100
      );
    }

    return items;
  }

  tagLink(tag: LcoyTag, icon: Mithril.Children, active: boolean): Mithril.Children {
    return (
      <Link
        className={classList('LinkButton LcoySidebar-tagLink', { active })}
        href={tagUrl(tag)}
        active={String(active)}
        title={tag.description() || undefined}
      >
        {icon}
        <span className="Button-label">{tag.name()}</span>
      </Link>
    );
  }

  footerItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    // 左侧的调色板与颜色模式，如同 Discourse 的页脚。
    if (app.allowUserColorScheme) {
      items.add('palette', <FooterPaletteSelector />, 110);
      items.add('theme', <FooterColorMode />, 100);
    }

    // 页脚的“+”，如同 Discourse，仅对已登录用户显示。
    if (app.session.user)
      items.add(
        'newTopic',
        <Button
          className="Button Button--icon Button--flat"
          icon="fas fa-plus"
          aria-label={t('sidebar.new_topic')}
          title={t('sidebar.new_topic')}
          onclick={() => this.newDiscussionAction().catch(() => {})}
        />,
        90
      );

    items.add(
      'shortcuts',
      <Button
        className="Button Button--icon Button--flat LcoySidebar-footerShortcuts"
        icon="far fa-keyboard"
        aria-label={t('sidebar.keyboard_shortcuts')}
        title={t('sidebar.keyboard_shortcuts')}
        onclick={() => app.modal.show(() => import('./KeyboardShortcutsModal'))}
      />,
      80
    );

    return items;
  }
}

/** 侧栏条目的文本（LinkButton 的标签），用于“自定义”列表。 */
function vnodeText(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(vnodeText).join('');
  // 标签旁的数量（草稿、未读）不计入。
  if (typeof node.attrs?.className === 'string' && /count|suffix/i.test(node.attrs.className)) return '';

  return vnodeText(node.children ?? node.text);
}

/**
 * “更多”菜单向侧栏之外打开：侧栏会滚动（overflow），
 * 会裁掉菜单。使用 position: fixed 让它脱离侧栏，紧贴按钮，
 * 并用一个小箭头指向“更多”（如同子菜单）；空间不足时
 * 会向上移动，直到屏幕底部。
 */
function placeMoreMenu(): void {
  requestAnimationFrame(() => {
    const toggle = document.querySelector<HTMLElement>('.LcoySidebar-more.open .LcoySidebar-moreButton');
    const menu = document.querySelector<HTMLElement>('.LcoySidebar-more.open .Dropdown-menu');

    if (!toggle || !menu) return;

    const rect = toggle.getBoundingClientRect();
    const phone = window.innerWidth < 768;

    menu.classList.toggle('LcoySidebar-moreMenu--side', !phone);
    menu.style.position = 'fixed';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.top = '0px';
    menu.style.left = `${phone ? rect.left : rect.right + 10}px`;

    const height = menu.offsetHeight;
    const wanted = phone ? rect.bottom + 4 : rect.top + rect.height / 2 - 22;
    const top = Math.max(8, Math.min(wanted, window.innerHeight - height - 8));

    menu.style.top = `${top}px`;
    // 小箭头保持在按钮中部的高度，即使菜单已经上移。
    menu.style.setProperty('--lcoy-more-arrow', `${rect.top + rect.height / 2 - top}px`);
  });
}
