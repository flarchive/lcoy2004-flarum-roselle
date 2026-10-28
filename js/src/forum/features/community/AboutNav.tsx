/*
 * “关于”和“准则”页面顶部的标签，与 Discourse 一致（关于、
 * 准则、服务条款、隐私政策）。每个标签仅在存在内容时出现：
 * 开启功能时的“准则”；有地址时的条款和隐私政策（来自
 * fof/terms 或主题管理员的配置）。fof/terms 的其他政策随后
 * 以自身名称加入。“准则”与“条款”之间是管理员添加到该区域的
 * fof/pages 页面。
 */
import app from 'flarum/forum/app';
import LinkButton from 'flarum/common/components/LinkButton';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';

export interface LegalPage {
  key: string;
  title: string | null;
  url: string;
}

/** 一个额外标签（论坛的 `lcoyAboutPages` 属性，已按可见性过滤）。 */
export interface AboutPageTab {
  id: number;
  label: string;
  slug: string;
  icon: string;
}

export function legalPages(): LegalPage[] {
  const pages = app.forum.attribute<LegalPage[] | undefined>('lcoyLegalPages');

  return Array.isArray(pages) ? pages.filter((page) => page && typeof page.url === 'string' && page.url) : [];
}

export function aboutPages(): AboutPageTab[] {
  const pages = app.forum?.attribute<AboutPageTab[] | undefined>('lcoyAboutPages');

  return Array.isArray(pages) ? pages.filter((page) => page && Number(page.id) > 0) : [];
}

export function findAboutPage(id: number): AboutPageTab | undefined {
  return aboutPages().find((page) => Number(page.id) === id);
}

/** 当前标签页的名称（每个额外页面各有一个）。 */
export function aboutPageTab(id: number): string {
  return `lcoy.about_page:${id}`;
}

export function aboutPageUrl(page: AboutPageTab): string {
  return app.route('lcoy.about_page', { page: page.slug ? `${page.id}-${page.slug}` : String(page.id) });
}

export function guidelinesEnabled(): boolean {
  return forumBool('lcoyGuidelinesEnabled', false);
}

function isActive(routeName: string, active: string): boolean {
  return routeName === active || (active === 'lcoy.guidelines' && routeName === 'lcoy.faq');
}

export default function AboutNav(active: string): Mithril.Children {
  const tabs: Mithril.Children[] = [];

  const internal = (tab: string, href: string, label: string, icon?: string) => (
    <li className={isActive(tab, active) ? 'active' : ''}>
      <LinkButton href={href} active={isActive(tab, active)} icon={icon || undefined}>
        {label}
      </LinkButton>
    </li>
  );

  if (forumBool('lcoyAboutEnabled', true)) tabs.push(internal('lcoy.about', app.route('lcoy.about'), t('community.about.title')));
  if (guidelinesEnabled()) tabs.push(internal('lcoy.guidelines', app.route('lcoy.guidelines'), t('community.guidelines.title')));

  aboutPages().forEach((page) => tabs.push(internal(aboutPageTab(Number(page.id)), aboutPageUrl(page), page.label, page.icon)));

  legalPages().forEach((page) => {
    const label = page.key === 'tos' ? t('community.legal.tos') : page.key === 'privacy' ? t('community.legal.privacy') : page.title || page.url;
    const external = /^https?:\/\//i.test(page.url);

    tabs.push(
      <li className={`LcoyAbout-navLegal LcoyAbout-navLegal--${page.key}`}>
        <a href={page.url} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>
          {label}
        </a>
      </li>
    );
  });

  // 单个标签不构成导航。
  if (tabs.length < 2) return null;

  return (
    <nav className="LcoyAbout-nav">
      <ul>{tabs}</ul>
    </nav>
  );
}
