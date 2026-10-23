import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

/**
 * “关于”“用户”和“用户组”页面的基类：PageStructure 卡片（不含
 * 侧栏——导航位于全局栏）、标签页标题与历史记录。
 *
 * 管理员关闭该功能后，服务端已对通过地址访问者返回 404；此处
 * 的检查用于覆盖在选项变更时仍打开着论坛的用户。
 */
export default abstract class CommunityPage<Attrs extends IPageAttrs = IPageAttrs> extends Page<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--lcoyCommunity';

    const title = this.title();

    app.history.push(this.attrs.routeName, title);
    app.setTitle(title);
    app.setTitleCount(0);
  }

  view(): Mithril.Children {
    return (
      <PageStructure className={classList('LcoyCommunityPage', this.className())}>
        {this.enabled() ? this.content() : <p className="LcoyCommunity-empty">{this.unavailableText()}</p>}
      </PageStructure>
    );
  }

  /** 页面无法打开的原因（默认：功能已关闭）。 */
  unavailableText(): string {
    return t('community.unavailable');
  }

  abstract title(): string;

  abstract className(): string;

  abstract enabled(): boolean;

  abstract content(): Mithril.Children;
}
