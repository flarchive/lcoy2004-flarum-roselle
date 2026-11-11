import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

export interface SidebarSectionAttrs extends ComponentAttrs {
  /** 区域键，用于记住读者是否将其折叠。 */
  name: string;
  /** 没有标题时区域不可折叠——这是顶部的社区区域。 */
  title?: Mithril.Children;
  /** “自定义区域”的铅笔图标，在鼠标悬停于标题栏时显示。 */
  onEdit?: () => void;
  editLabel?: string;
  /** 标题栏按钮的图标；默认是铅笔（聊天私信的“+”是另一个）。 */
  editIcon?: string;
}

const STORAGE_PREFIX = 'lcoy.sidebarSection.';

function readCollapsed(name: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + name) === '1';
  } catch {
    return false;
  }
}

/**
 * 侧栏区域，标题栏使用小型大写字母，并有折叠箭头——
 * 即 Discourse 的“分类”和“标签”。
 */
export default class SidebarSection extends Component<SidebarSectionAttrs> {
  collapsed = false;

  oninit(vnode: Mithril.Vnode<SidebarSectionAttrs, this>) {
    super.oninit(vnode);

    this.collapsed = !!this.attrs.title && readCollapsed(this.attrs.name);
  }

  view(vnode: Mithril.Vnode<SidebarSectionAttrs, this>) {
    const { name, title, onEdit, editLabel, editIcon } = this.attrs;
    const contentId = `lcoy-sidebar-section-${name}`;

    return (
      <section className={classList('LcoySidebar-section', `LcoySidebar-section--${name}`, { collapsed: this.collapsed })}>
        {title && (
          <div className="LcoySidebar-sectionHead">
            <button
              type="button"
              className="LcoySidebar-sectionHeader"
              aria-expanded={this.collapsed ? 'false' : 'true'}
              aria-controls={contentId}
              onclick={() => this.toggle()}
            >
              <Icon name="fas fa-angle-down" className="LcoySidebar-sectionCaret" />
              <span className="LcoySidebar-sectionTitle">{title}</span>
            </button>
            {onEdit && (
              <button type="button" className="LcoySidebar-sectionEdit" aria-label={editLabel} title={editLabel} onclick={onEdit}>
                <Icon name={editIcon || 'fas fa-pencil'} />
              </button>
            )}
          </div>
        )}
        {/* 区域折叠时内容仍保持挂载：扩展的小部件只在
            `oncreate` 中获取数据，卸载它们会让区域在重新打开时
            为空。由 CSS 隐藏。 */}
        <ul className="LcoySidebar-sectionContent" id={contentId}>
          {vnode.children}
        </ul>
      </section>
    );
  }

  toggle() {
    this.collapsed = !this.collapsed;

    try {
      localStorage.setItem(STORAGE_PREFIX + this.attrs.name, this.collapsed ? '1' : '0');
    } catch {
      // 没有存储时，该选择仅在页面重新加载前有效。
    }
  }
}
