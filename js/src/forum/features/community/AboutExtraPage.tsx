import app from 'flarum/forum/app';

import { aboutPageTab, findAboutPage } from './AboutNav';
import RulesPage, { type RulesPayload } from './RulesPage';
import { t } from '../../utils/settings';

/**
 * “关于”区域中的一个额外标签（/about/{id-slug}）：在管理后台选定的
 * fof/pages 页面，采用与“准则”相同的布局。参数前部为 id，与核心的
 * /d/{id} 一致；slug 仅用于美化。
 */
export default class AboutExtraPage extends RulesPage {
  pageId(): number {
    const match = /^(\d+)/.exec(String(m.route.param('page') || ''));

    return match ? Number(match[1]) : 0;
  }

  title(): string {
    return findAboutPage(this.pageId())?.label || t('community.about.title');
  }

  className(): string {
    return 'LcoyAboutExtraPage';
  }

  /** 仅限管理员列表中 fof/pages 允许当前用户查看的页面。 */
  enabled(): boolean {
    return !!findAboutPage(this.pageId());
  }

  endpoint(): string {
    return `/lcoy-about-pages/${this.pageId()}`;
  }

  activeTab(): string {
    return aboutPageTab(this.pageId());
  }

  loaded(data: RulesPayload): void {
    if (data?.title) app.setTitle(data.title);
  }
}
