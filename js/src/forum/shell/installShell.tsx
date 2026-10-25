/*
 * Discourse 外壳：全宽页头，带汉堡菜单、徽标和
 * 居中搜索；左侧全局侧栏；内容位于淡色背景之上的卡片中。
 *
 * 核心布局（forum.blade.php）没有位置放全局侧栏，
 * 所以它在 #app 内拥有自己的 <aside>，在核心挂载其余部分后
 * 立即挂载。在手机上，同一个 <aside> 会变成汉堡菜单的
 * 面板（Discourse 的 .menu-panel），覆盖在所有内容之上。
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import PageStructure from 'flarum/forum/components/PageStructure';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import LcoySidebar from '../components/LcoySidebar';
import HeaderToggle from '../components/HeaderToggle';
import HeaderCenter, { watchHeaderTopic } from './HeaderCenter';
import { watchColoredAccents } from './coloredAccents';
import installShortcuts from './shortcuts';
import extendHeader from './extendHeader';
import installThemePreview from './themePreview';
import installModalLayout from './modalLayout';
import { forumBool, t } from '../utils/settings';
import { SHELL_CLASS, applySidebarState, closeOverlaySidebar, watchSidebarNavigation, watchViewport } from '../utils/sidebarState';
import { installColorMode } from './colorMode';
import installMobileViewport from './mobileViewport';

/** 在这些页面中，hero 会进入卡片内部，如同 Discourse。 */
const INLINE_HERO_PAGES = /\b(DiscussionPage|UserPage)\b/;

export default function installShell() {
  installMobileViewport();

  // 扩展实例，而不是原型：核心 2.0 不会在模块注册表中
  // 导出 ForumApplication 类。initializer 在 mount 之前运行。
  extend(app as any, 'mount', function () {
    const appElement = document.getElementById('app');

    if (!appElement) return;

    const sidebarEnabled = forumBool('lcoySidebarEnabled', true);

    appElement.classList.add(
      ...classList(SHELL_CLASS, {
        'Lcoy--pillButtons': forumBool('lcoyPillButtons', true),
        'Lcoy--tinted': forumBool('lcoyTintedBackground', true),
        'Lcoy--card': forumBool('lcoyContentCard', true),
        'Lcoy--noSidebar': !sidebarEnabled,
        'Lcoy--headerSearch': forumBool('lcoyHeaderSearch', true),
        'Lcoy--noEventPosts': !forumBool('lcoyTopicEventPosts', true),
        'Lcoy--stickyAvatar': forumBool('lcoyTopicStickyAvatar', false),
        // 连接头像的时间线（less/forum/PostDirect.less）。
        'Lcoy--postDirect': app.forum.attribute('lcoyPostStyle') === 'direct',
      }).split(' ')
    );

    mountHeader(sidebarEnabled);
    watchColoredAccents();
    installColorMode();

    if (sidebarEnabled) {
      mountSidebar(appElement);
      applySidebarState();
      watchViewport();
      watchSidebarNavigation();
    }

    mountBackdrop(appElement);

    if (forumBool('lcoyKeyboardShortcuts', true)) installShortcuts();
  });

  extendHeader();
  installThemePreview();
  installModalLayout();
  installInlineHero();
  removeDiscussionPane();
}

function mountSidebar(appElement: HTMLElement) {
  const aside = document.createElement('aside');
  aside.id = 'lcoy-sidebar';
  aside.className = 'LcoySidebar';
  aside.setAttribute('aria-label', t('sidebar.label'));

  // 放在“跳转到内容”链接之后，它必须获得第一个焦点。
  appElement.insertBefore(aside, document.getElementById('app-navigation'));

  m.mount(aside, { view: () => <LcoySidebar /> });

  // 在覆盖面板（平板）中，选择目标后会关闭面板。
  aside.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) closeOverlaySidebar();
  });

  // Esc 关闭手机面板，如同 Discourse 的菜单。
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOverlaySidebar();
  });

  const backdrop = document.createElement('div');
  backdrop.className = 'LcoySidebar-backdrop';
  backdrop.addEventListener('click', () => closeOverlaySidebar());
  appElement.insertBefore(backdrop, aside.nextSibling);
}

/** meta.discourse.org 背景中的彩色模糊元素（.meta-bg-icons）。 */
const BACKDROP_TILES: [string, string][] = [
  ['plane', 'fas fa-paper-plane'],
  ['chat', 'fas fa-comment-dots'],
  ['quote', 'fas fa-quote-left'],
  ['bell', 'fas fa-bell'],
  ['sparkles', 'fas fa-wand-magic-sparkles'],
  ['reactions', 'fas fa-face-smile'],
];

function mountBackdrop(appElement: HTMLElement) {
  const backdrop = document.createElement('div');
  backdrop.className = 'LcoyBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  appElement.insertAdjacentElement('afterend', backdrop);

  m.render(
    backdrop,
    BACKDROP_TILES.map(([name, icon]) => (
      <div className={`LcoyBackdrop-tile LcoyBackdrop-tile--${name}`}>
        <Icon name={icon} />
      </div>
    ))
  );
}

function mountHeader(sidebarEnabled: boolean) {
  const container = document.querySelector<HTMLElement>('#header > .container');
  const title = container?.querySelector('.Header-title');

  if (!container || !title) return;

  // 插槽可能已经存在：<head> 中的脚本（`preload` 功能）会在
  // 首次绘制前创建它们，以免启动时徽标跳动位置。
  if (sidebarEnabled) {
    let toggleSlot = container.querySelector<HTMLElement>(':scope > .LcoyHeader-toggleSlot');

    if (!toggleSlot) {
      toggleSlot = document.createElement('div');
      toggleSlot.className = 'LcoyHeader-toggleSlot';
      container.insertBefore(toggleSlot, title);
    }

    if (!(toggleSlot as any).lcoyMounted) {
      (toggleSlot as any).lcoyMounted = true;
      m.mount(toggleSlot, HeaderToggle);
    }
  }

  // 即使没有搜索，页头中部也存在：滚动时主题标题
  // 会在这里显示。
  let centerSlot = container.querySelector<HTMLElement>(':scope > .LcoyHeader-center');

  if (!centerSlot) {
    centerSlot = document.createElement('div');
    centerSlot.className = 'LcoyHeader-search LcoyHeader-center';
    container.insertBefore(centerSlot, document.getElementById('header-secondary'));
  }

  if (!(centerSlot as any).lcoyMounted) {
    (centerSlot as any).lcoyMounted = true;
    m.mount(centerSlot, HeaderCenter);
  }

  watchHeaderTopic();

  if (!forumBool('lcoyShowTitleWithLogo', false)) {
    container.classList.add('LcoyHeader--logoOnly');
  }
}

/**
 * 在 Discourse 中，主题标题和个人主页封面位于卡片内部，
 * 而不是像 Flarum 的 hero 那样放在背景之上。这里不重写页面，
 * 而是在所有页面共用的 PageStructure 中移动 hero 的位置。
 */
/**
 * Discourse 没有 Flarum 在主题页中打开的那个带讨论列表的侧边
 * 面板（“pane”）：将它从 PageStructure 中移除，
 * 使其即便在鼠标移到边缘时也不会出现。
 */
function removeDiscussionPane() {
  override(PageStructure.prototype, 'rootItems', function (this: PageStructure, original: () => ItemList<Mithril.Children>) {
    const items = original();

    items.remove('pane');

    return items;
  });

  extend(DiscussionPage.prototype, 'oninit', function () {
    app.pane?.disable();
  });
}

function installInlineHero() {
  const isInline = (structure: PageStructure) => INLINE_HERO_PAGES.test(structure.attrs.className || '');

  override(PageStructure.prototype, 'mainItems', function (this: PageStructure, original: () => ItemList<Mithril.Children>) {
    const items = original();

    if (isInline(this)) items.remove('hero');

    return items;
  });

  override(PageStructure.prototype, 'containerItems', function (this: PageStructure, original: () => ItemList<Mithril.Children>) {
    const items = original();

    if (isInline(this)) {
      items.add('hero', <div className="Page-hero Page-hero--inline">{(this.attrs.hero && this.attrs.hero()) || null}</div>, 200);
    }

    return items;
  });
}
