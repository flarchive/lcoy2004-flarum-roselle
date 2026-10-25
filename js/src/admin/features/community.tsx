/*
 * 社区页面卡片：关于、用户和用户组。
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';
import Button from 'flarum/common/components/Button';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminComponent, trans, getBool, getStr, saveSetting } from '../util';
import { AdminNotice, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import type { CardDef } from '../types';
import AboutPagesEditor from './aboutPages';

const KEY = 'lcoy-roselle.admin.settings.community';

const SAVE_DELAY_MS = 600;

/**
 * 自动保存的文本，在用户停止输入一段时间后保存——
 * 每次暂停一个请求，而不是每次按键。值会立即写入
 * `app.data`，这样在 POST 完成前字段不会在重绘时“回滚”。
 */
class AdminTextField extends AdminComponent {
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  onremove(vnode: any) {
    super.onremove(vnode);

    // 在暂停期间离开页面不能丢失已输入的内容。
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flush();
    }
  }

  view() {
    const { settingKey, label, help, multiline, type = 'text', placeholder } = this.attrs;
    const value = getStr(settingKey);
    const id = `LcoyAdmin-${settingKey.replace(/\W+/g, '-')}`;
    const oninput = (event: InputEvent) => this.store((event.target as HTMLInputElement | HTMLTextAreaElement).value);

    return (
      <div className="Form-group">
        <label className="LcoyAdmin-label" for={id}>
          {label}
        </label>
        {multiline ? (
          <textarea id={id} className="FormControl LcoyAdmin-textarea" rows={8} value={value} placeholder={placeholder} oninput={oninput} />
        ) : (
          <input id={id} className="FormControl" type={type} value={value} placeholder={placeholder} oninput={oninput} />
        )}
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  store(value: string): void {
    app.data.settings[this.attrs.settingKey] = value;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  flush(): void {
    this.saveTimer = undefined;
    saveSetting({ [this.attrs.settingKey]: getStr(this.attrs.settingKey) });
  }
}

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`lcoy.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const text = (name: string, label: string, help: string, extra: Record<string, any> = {}) => (
  <AdminTextField settingKey={`lcoy.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} {...extra} />
);

/**
 * 使用 fof/pages 时：哪个页面作为社区守则，以及用当前文本创建
 * “社区守则”页面的按钮。选定页面后，下方的文本
 * 不再生效，内容改为在 fof/pages 中编辑。
 */
class GuidelinesPagePicker extends AdminComponent {
  pages: { id: string; title: string }[] | null = null;
  creating = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.load();
  }

  load() {
    app
      .request<any>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/pages`, params: { 'page[limit]': 50 } })
      .then((res) => {
        this.pages = (res?.data || []).map((p: any) => ({ id: String(p.id), title: String(p.attributes?.title || p.id) }));
        m.redraw();
      })
      .catch(() => {
        this.pages = [];
        m.redraw();
      });
  }

  create() {
    this.creating = true;
    app
      .request<{ pageId: number }>({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/lcoy-guidelines/page` })
      .then((res) => {
        app.data.settings['lcoy.guidelines_page'] = String(res.pageId);
        this.load();
      })
      .finally(() => {
        this.creating = false;
        m.redraw();
      });
  }

  view() {
    const current = getStr('lcoy.guidelines_page');
    const page = this.pages?.find((p) => p.id === current);

    return (
      <div className="Form-group LcoyAdmin-guidelinesPage">
        <label>{trans(`${KEY}.guidelines_page_label`, 'fof/pages 页面')}</label>
        <select
          className="FormControl"
          value={current}
          disabled={this.pages === null}
          onchange={(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            app.data.settings['lcoy.guidelines_page'] = value;
            saveSetting({ 'lcoy.guidelines_page': value });
          }}
        >
          <option value="">{trans(`${KEY}.guidelines_page_none`, '无：使用下方文本')}</option>
          {(this.pages || []).map((p) => (
            <option value={p.id}>{p.title}</option>
          ))}
        </select>
        <p className="helpText">
          {trans(
            `${KEY}.guidelines_page_help`,
            '选定页面后，/guidelines 会显示该页面的内容（遵循 fof/pages 自身的可见性设置），下方文本不再生效。之后在 fof/pages 中编辑该内容。'
          )}
        </p>
        {!page && (
          <Button className="Button" loading={this.creating} disabled={this.pages === null} onclick={() => this.create()}>
            {trans(`${KEY}.guidelines_page_create`, '用当前文本创建「社区守则」页面')}
          </Button>
        )}
      </div>
    );
  }
}

/** 指向论坛中页面的链接，用于检查效果。 */
const viewLink = (path: string) => (
  <p className="LcoyAdmin-viewLink">
    <Link href={app.forum.attribute<string>('baseUrl') + path} external={true} target="_blank">
      {trans(`${KEY}.view_page`, '在论坛中查看该页面')} <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
    </Link>
  </p>
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const COMMUNITY_CARDS: CardDef[] = [
  {
    id: 'about',
    group: 'community',
    icon: 'fas fa-circle-info',
    title: () => trans(`${KEY}.section_about`, '关于页面'),
    description: help(
      'about_enabled',
      '类似 Discourse 的页面，包含论坛简介、自定义文本、联系方式、管理团队和站点数据。会在侧栏的「更多」菜单中添加一个链接。'
    ),
    keywords: '关于 about 团队 staff 管理员 admins 版主 moderators 统计 stats 联系 contact 邮件 email 文本 text',
    master: 'lcoy.about_enabled',
    body: () => (
      <>
        {text(
          'about_text',
          '关于文本',
          '显示在标题下方。支持 Markdown 和 BBCode（以论坛已启用的为准）；如果文本包含 HTML 标签，则按 HTML 原样使用，不做格式化。',
          { multiline: true }
        )}
        <SubDivider />
        {text('about_contact_email', '联系邮箱', '显示在「联系我们」框中。此邮箱是公开的：请使用管理团队的邮箱。', {
          type: 'email',
          placeholder: 'contact@example.com',
        })}
        {text('about_contact_url', '联系页面', '联系表单或联系页面的完整地址（https://…）。', {
          type: 'url',
          placeholder: 'https://',
        })}
        <SubDivider />
        {toggle('about_show_staff', '显示管理团队', '「我们的管理员」和「我们的版主」列表。隐藏的用户组对看不到它们的人不予显示。')}
        {toggle('about_show_stats', '显示站点统计', '最近 24 小时、7 天、30 天以及全部时间内的讨论、帖子、注册、活跃用户和赞。')}
        {getBool('lcoy.about_show_stats') && (
          <AdminNotice>{trans(`${KEY}.stats_notice`, '这些数字只统计公开内容，每 30 分钟重新计算一次。')}</AdminNotice>
        )}
        {viewLink('/about')}
      </>
    ),
  },
  {
    id: 'guidelines',
    group: 'community',
    icon: 'fas fa-scale-balanced',
    title: () => trans(`${KEY}.guidelines_enabled_label`, '社区守则页面（/guidelines）'),
    description: help(
      'guidelines_enabled',
      '论坛的社区规则，显示在「关于」旁的标签页和侧栏的「更多」菜单中。/faq 同样指向该页面，与 Discourse 一致。'
    ),
    keywords: '社区守则 guidelines faq 规则 rules 行为准则',
    master: 'lcoy.guidelines_enabled',
    body: () => (
      <>
        {isExtensionEnabled('fof-pages') && <GuidelinesPagePicker />}
        {text(
          'guidelines_text',
          '社区守则文本',
          '留空则使用主题的默认文本，灵感来自 Discourse 的社区守则。支持 Markdown 和 BBCode；包含 HTML 标签时按 HTML 处理。',
          { multiline: true }
        )}
        {viewLink('/guidelines')}
      </>
    ),
  },
  {
    id: 'about_pages',
    group: 'community',
    icon: 'fas fa-folder-plus',
    title: () => trans(`${KEY}.section_about_pages`, '关于区域页面'),
    description: help(
      'about_pages',
      '可任意添加 fof/pages 页面，作为「关于」和「社区守则」旁的标签页，每个页面都采用规则页布局：标题、章节索引和卡片。'
    ),
    keywords: '页面 pages fof 标签页 tabs 关于 about 社区守则 guidelines 附加 extras 自定义 custom 顺序 order 图标 icon 标签 label',
    extensions: ['fof-pages'],
    body: () => <AboutPagesEditor />,
  },
  {
    id: 'legal',
    group: 'community',
    icon: 'fas fa-file-contract',
    title: () => trans(`${KEY}.section_legal_links`, '条款与隐私'),
    keywords: '条款 terms tos 服务 service 隐私 privacy 政策 policy fof terms',
    body: () => (
      <>
        {text('tos_url', '服务条款地址', '「服务条款」标签页和 /tos 都指向这里。名称中包含「terms」的 FoF Terms 政策优先。', {
          type: 'url',
          placeholder: 'https://',
        })}
        {text('privacy_url', '隐私政策地址', '「隐私政策」标签页和 /privacy 都指向这里。名称中包含「privacy」的 FoF Terms 政策优先。', {
          type: 'url',
          placeholder: 'https://',
        })}
        <AdminNotice>
          {trans(`${KEY}.legal_notice`, '如果未设置地址（此处或 FoF Terms 中），该标签页不会显示。其他 FoF Terms 政策会以自己的名称成为标签页。')}
        </AdminNotice>
      </>
    ),
  },
  {
    id: 'groups',
    group: 'community',
    icon: 'fas fa-user-group',
    title: () => trans(`${KEY}.section_groups`, '用户组'),
    description: help(
      'groups_enabled',
      '每个用户组一张卡片，显示其图标、颜色和成员数，并为每个组提供展示成员的页面。隐藏的用户组只对能看到它们的人显示。'
    ),
    keywords: '用户组 groups 成员 members 活动 activity 个人主页 profile 徽章 badges /g',
    master: 'lcoy.groups_enabled',
    body: () => (
      <>
        {toggle('groups_activity', '活动标签页', '成员在用户组页面上的近期帖子。')}
        {toggle('groups_profile_links', '个人主页上的用户组链接到用户组页面', '个人主页卡片上的用户组胶囊按钮会变成指向 /g/group-name 的链接。')}
        {toggle(
          'directory_guests',
          '游客也能查看成员',
          '默认情况下，只有拥有「查看用户列表」权限（在权限中设置）的人才能看到用户组成员。开启后，游客也能看到，但私密论坛除外。'
        )}
        {viewLink('/g')}
      </>
    ),
  },
];

export default COMMUNITY_CARDS;
