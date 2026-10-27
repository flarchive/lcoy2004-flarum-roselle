/*
 * fof/links 放在侧边栏，就像 Discourse 的自定义区块。
 *
 * Horizon 的页眉中没有链接：管理员添加的一切都放在
 * 侧边栏。因此：
 * - 独立链接（及其子链接）进入主题已有的链接区块
 *   （`lcoyCustom`，即管理员的 "标签 | 地址 | 图标"）—— 只有
 *   一个区块，而不是两个相同作用的区块；
 * - 扩展中带子项的每个标签变成独立区块，标签
 *   作为标题；
 * - 页眉移除该扩展的项。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';
import listItems from 'flarum/common/helpers/listItems';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import LcoySidebar from '../components/LcoySidebar';
import SidebarSection from '../components/SidebarSection';
import { customLinks } from '../gaps/sidebar';
import { forumString } from '../gaps/settings';
import { t } from '../utils/settings';
import { extModule, thirdParty } from './settings';

type LinkModel = any;

function allLinks(): LinkModel[] {
  return app.store.all<LinkModel>('links');
}

function sorted(links: LinkModel[]): LinkModel[] {
  return links.slice(0).sort((a, b) => (a.position() ?? 0) - (b.position() ?? 0));
}

function childrenOf(parent: LinkModel): LinkModel[] {
  return sorted(allLinks().filter((link) => link.parent?.() === parent));
}

function isLabel(link: LinkModel): boolean {
  return !link.url();
}

/** 扩展自己的项（激活、新标签页、rel=me）；没有它时，使用简单的 LinkButton。 */
function entry(link: LinkModel, child = false): Mithril.Children {
  const LinkItem = extModule<any>('fof-links', 'forum/components/LinkItem');
  const className = child ? 'LcoySidebar-childLink' : undefined;

  if (LinkItem) return m(LinkItem, { link, inDropdown: true, className });

  return (
    <LinkButton
      className={className}
      href={link.url()}
      icon={link.icon() || 'fas fa-link'}
      external={true}
      target={link.isNewtab() ? '_blank' : undefined}
    >
      {link.title()}
    </LinkButton>
  );
}

/** 主题管理员设置的链接（文本配置），使用与 gaps 区块相同的格式。 */
function themeLink(href: string, icon: string, label: string): Mithril.Children {
  let foreign = false;

  try {
    foreign = /^https?:\/\//i.test(href) && new URL(href).host !== window.location.host;
  } catch {
    foreign = true;
  }

  return (
    <LinkButton href={href} icon={icon} external={true} target={foreign ? '_blank' : undefined} rel={foreign ? 'noopener noreferrer' : undefined}>
      {label}
    </LinkButton>
  );
}

export default function installLinks(): void {
  extend(HeaderPrimary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.linksSidebar()) return;

    Object.keys(items.toObject())
      .filter((key) => /^link\d+$/.test(key))
      .forEach((key) => items.remove(key));
  });

  extend(LcoySidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.linksSidebar()) return;

    const roots = sorted(allLinks().filter((link) => !link.isChild?.()));

    if (!roots.length) return;

    const loose = new ItemList<Mithril.Children>();
    let priority = 100;

    // 先是主题管理员设置的，按他的顺序；然后是扩展的。
    customLinks().forEach((link, index) => loose.add(`custom${index}`, themeLink(link.href, link.icon, link.label), priority--));

    roots.forEach((root, index) => {
      const children = childrenOf(root);

      if (isLabel(root)) {
        if (!children.length) return;

        const list = new ItemList<Mithril.Children>();
        children.forEach((child, i) => list.add(`fofLink${child.id()}`, entry(child), 100 - i));

        // 紧接主题的链接区块（85）之后，按管理员的顺序。
        items.add(
          `fofLinks${root.id()}`,
          <SidebarSection name={`fofLinks${root.id()}`} title={root.title()}>
            {listItems(list.toArray())}
          </SidebarSection>,
          84.9 - index / 100
        );

        return;
      }

      loose.add(`fofLink${root.id()}`, entry(root), priority--);
      children.forEach((child) => loose.add(`fofLink${child.id()}`, entry(child, true), priority--));
    });

    if (loose.isEmpty()) return;

    // gaps 的区块会用双方的链接重新构建。
    if (items.has('lcoyCustom')) items.remove('lcoyCustom');

    items.add(
      'lcoyCustom',
      <SidebarSection name="custom" title={forumString('lcoySidebarCustomTitle') || t('gaps.sidebar.custom_title')}>
        {listItems(loose.toArray())}
      </SidebarSection>,
      85
    );
  });
}
