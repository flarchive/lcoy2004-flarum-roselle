/*
 * Discourse 侧栏中缺失的内容：
 *
 * - 社区区域中面向管理者的“审核”，带待处理举报数（flarum/flags 的队列）；
 * - 管理后台填写地址后，“更多”菜单中的“FAQ”、“服务条款”和“隐私政策”；
 * - 由管理后台填写的自定义链接区域（Discourse 的 custom sections），
 *   每行一个链接：“标签 | 地址 | 图标”。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import listItems from 'flarum/common/helpers/listItems';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import LcoySidebar from '../components/LcoySidebar';
import SidebarSection from '../components/SidebarSection';
import { forumString } from './settings';
import { isExtensionEnabled, t } from '../utils/settings';

interface CustomLink {
  label: string;
  href: string;
  icon: string;
}

/** 其他站点的地址：在新标签页打开。论坛自身的地址则在当前页打开。 */
function isForeign(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;

  try {
    return new URL(href).host !== window.location.host;
  } catch {
    return true;
  }
}

/** 读取自定义链接配置；格式错误的行会被丢弃。 */
export function customLinks(): CustomLink[] {
  return forumString('lcoySidebarCustomLinks')
    .split(/\r?\n/)
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([label, href]) => !!label && !!href && /^(https?:\/\/|\/)/i.test(href))
    .map(([label, href, icon]) => ({
      label,
      href,
      icon: icon && /^fa[a-z-]*\s+fa-[a-z0-9-]+$/i.test(icon) ? icon : 'fas fa-link',
    }));
}

/**
 * 管理后台的链接是任意地址，不是应用路由：按普通链接导航（external），
 * 其他站点的地址在新标签页打开。
 */
function link(href: string, icon: string, label: string): Mithril.Children {
  const foreign = isForeign(href);

  return (
    <LinkButton href={href} icon={icon} external={true} target={foreign ? '_blank' : undefined} rel={foreign ? 'noopener noreferrer' : undefined}>
      {label}
    </LinkButton>
  );
}

export default function installSidebarGaps(): void {
  extend(LcoySidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    // 谁能看到帖子举报：数字是尚未查看的举报数。
    if (!user || !isExtensionEnabled('flarum-flags') || !app.forum.attribute<boolean>('canViewFlags')) return;

    const pending = Number(user.attribute<number>('newFlagCount') || 0);

    items.add(
      'lcoyReview',
      <LinkButton href={app.route('flags')} icon="fas fa-flag">
        {t('gaps.sidebar.review')}
        {pending > 0 && <span className="LcoySidebar-suffix LcoySidebar-count">{pending}</span>}
      </LinkButton>,
      52
    );
  });

  extend(LcoySidebar.prototype, 'moreItems', function (items: ItemList<Mithril.Children>) {
    const faq = forumString('lcoySidebarFaqUrl');
    const tos = forumString('lcoySidebarTosUrl');
    const privacy = forumString('lcoySidebarPrivacyUrl');

    // 紧跟在“关于”之后（75），与 Discourse 的菜单一致。
    if (faq) items.add('lcoyFaq', link(faq, 'fas fa-circle-question', t('gaps.sidebar.faq')), 74.5);
    if (tos) items.add('lcoyTos', link(tos, 'fas fa-file-contract', t('gaps.sidebar.tos')), 20);
    if (privacy) items.add('lcoyPrivacy', link(privacy, 'fas fa-user-shield', t('gaps.sidebar.privacy')), 19);
  });

  extend(LcoySidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    const links = customLinks();

    if (!links.length) return;

    const list = new ItemList<Mithril.Children>();

    links.forEach((entry, index) => list.add(`custom${index}`, link(entry.href, entry.icon, entry.label), 100 - index));

    // 位于社区（90）与分类（80）之间，与 Discourse 的区域一致。
    items.add(
      'lcoyCustom',
      <SidebarSection name="custom" title={forumString('lcoySidebarCustomTitle') || t('gaps.sidebar.custom_title')}>
        {listItems(list.toArray())}
      </SidebarSection>,
      85
    );
  });
}
