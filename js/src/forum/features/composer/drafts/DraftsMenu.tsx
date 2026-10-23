/*
 * “发起主题”按钮右侧的“⌄”（Discourse 的 `topic-drafts-menu`）：
 * 打开 fof/drafts 的草稿，每行一个，带类型图标和截断的标题
 * （回复为“RE: …”）。点击即可携带草稿重新打开 composer。与
 * Discourse 一样最多显示四个，点击“查看全部”进入个人资料页的
 * 草稿标签。
 *
 * 与 Discourse 一致，菜单在按钮右侧打开，位于侧边栏之外并覆盖
 * 内容（顶部与按钮对齐，“⌄”之后 8px，最大宽度 540px）。侧边栏
 * 会裁剪溢出内容，因此位置为固定定位，依据按钮计算。在手机上，
 * 菜单在下方打开，宽度与侧边栏相同。点击外部或按 Esc 关闭由核心
 * 的 Dropdown 处理。
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import Tooltip from 'flarum/common/components/Tooltip';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { allDrafts, draftCount, draftIcon, draftsLoaded, draftsOn, draftTitle, ensureDiscussions, loadDrafts, openDraft } from './fofDrafts';
import { t } from '../../../utils/settings';

const LIMIT = 4;
const GAP = 8;
const MAX_WIDTH = 540;

/** ⌄ 仅在存在草稿时出现（且 fof-drafts 已启用）。 */
export function showDraftsMenu(): boolean {
  return draftsOn() && draftCount() > 0;
}

/**
 * “⌄”的 tooltip 向侧边栏外（右侧）展开，并附着到
 * <body>：放在会滚动的侧边栏内时它会被裁剪并换行。
 */
class DraftsDropdown extends Dropdown {
  getButton(children: Mithril.ChildArray): Mithril.Vnode<any, any> {
    const vnode = super.getButton(children) as Mithril.Vnode<any, any>;

    if (vnode && vnode.tag === Tooltip) {
      vnode.attrs = { ...vnode.attrs, position: 'right', container: 'body' };
    }

    return vnode;
  }
}

export default class DraftsMenu extends Component {
  private frame = 0;

  /** 滚动/缩放时每帧最多重算一次位置，避免逐事件读写布局。 */
  private readonly schedulePlace = () => {
    if (this.frame) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.place();
    });
  };

  private readonly place = () => {
    const root = this.element as HTMLElement | undefined;
    const menu = root?.querySelector<HTMLElement>('.LcoyDraftsMenu-menu');
    const anchor = root?.closest<HTMLElement>('.LcoySidebar-newTopic') || root;

    if (!root || !menu || !anchor || !root.classList.contains('open')) return;

    const rect = anchor.getBoundingClientRect();
    const phone = window.innerWidth < 768;
    const left = phone ? rect.left : rect.right + GAP;
    const width = phone ? rect.width : Math.max(240, Math.min(MAX_WIDTH, window.innerWidth - left - 16));

    // `important`：核心的 Dropdown 会在打开时切换 --top/--right 类。
    const set = (prop: string, value: string) => menu.style.setProperty(prop, value, 'important');

    set('position', 'fixed');
    set('top', `${phone ? rect.bottom + 4 : rect.top}px`);
    set('left', `${left}px`);
    set('right', 'auto');
    set('bottom', 'auto');
    set('width', `${width}px`);
    set('max-width', 'none');
    set('margin', '0');
    // 在手机上，核心会把菜单绘制为底部抽屉（底部留有间距）。
    set('padding', '4px 0');
    set('max-height', `${Math.max(160, window.innerHeight - (phone ? rect.bottom + 4 : rect.top) - 16)}px`);
    set('overflow-y', 'auto');
  };

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);

    // 提前加载列表：菜单打开时标题已就绪。
    if (!draftsLoaded()) loadDrafts().then(() => m.redraw());
  }

  oncreate(vnode: Mithril.VnodeDOM) {
    super.oncreate(vnode);

    window.addEventListener('resize', this.schedulePlace);
    window.addEventListener('scroll', this.schedulePlace, true);
  }

  onupdate(vnode: Mithril.VnodeDOM) {
    super.onupdate(vnode);

    this.place();
  }

  onremove(vnode: Mithril.VnodeDOM) {
    super.onremove(vnode);

    window.removeEventListener('resize', this.schedulePlace);
    window.removeEventListener('scroll', this.schedulePlace, true);
    cancelAnimationFrame(this.frame);
  }

  view() {
    const label = t('composer.drafts.menu_label');

    return (
      <DraftsDropdown
        className="LcoyDraftsMenu"
        buttonClassName="Button Button--primary LcoyDraftsMenu-toggle"
        menuClassName="LcoyDraftsMenu-menu"
        icon="fas fa-chevron-down"
        caretIcon=""
        label=""
        accessibleToggleLabel={label}
        tooltip={label}
        lazyDraw
        onshow={() => {
          // “打开草稿”的 tooltip 位于 <body>（侧边栏之外）：菜单打开时
          // 将其隐藏，否则会覆盖在菜单上方。
          $(this.element).find('.LcoyDraftsMenu-toggle').tooltip('hide');
          this.place();
          // 核心会在 onshow 之后立即重新定位菜单：再确认一次。
          requestAnimationFrame(this.place);
        }}
      >
        {this.items()}
      </DraftsDropdown>
    );
  }

  items(): Mithril.Children[] {
    if (!draftsLoaded()) return [<LoadingIndicator size="small" display="block" />];

    const drafts = allDrafts();

    ensureDiscussions(drafts.slice(0, LIMIT));

    const items: Mithril.Children[] = drafts.slice(0, LIMIT).map((draft) => {
      const title = draftTitle(draft);

      return (
        <Button className="LcoyDraftsMenu-item" icon={draftIcon(draft)} title={title} onclick={() => openDraft(draft)}>
          <span className="LcoyDraftsMenu-title">{title}</span>
        </Button>
      );
    });

    const user = app.session.user;

    if (user && draftCount() > LIMIT) {
      items.push(
        <LinkButton className="LcoyDraftsMenu-all" href={app.route('user.drafts', { username: user.slug() })}>
          {t('composer.drafts.view_all', { count: draftCount() })}
        </LinkButton>
      );
    }

    return items;
  }
}
