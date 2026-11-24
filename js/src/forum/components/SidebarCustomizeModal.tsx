import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { categorySymbol, tagSymbol, primaryTags, secondaryTags, sortTags, allTags, type LcoyTag } from '../utils/tags';
import { getSidebarPicks, setSidebarPicks, type SidebarSectionName } from '../utils/sidebarPrefs';

export interface SidebarCustomizeModalAttrs extends IInternalModalAttrs {
  section: SidebarSectionName;
}

/**
 * Discourse 的“编辑区域”：带搜索的列表和复选框，用于选择
 * 侧栏中显示的分类（或标签）。
 */
export default class SidebarCustomizeModal extends Modal<SidebarCustomizeModalAttrs> {
  selected = new Set<string>();
  filter = '';

  oninit(vnode: Mithril.Vnode<SidebarCustomizeModalAttrs, this>) {
    super.oninit(vnode);

    const picks = getSidebarPicks(this.attrs.section);
    const initial = picks ?? this.defaultTags().map((tag) => tag.id()!);

    this.selected = new Set(initial);
  }

  className() {
    return 'LcoySidebarCustomize Modal--small';
  }

  title() {
    return t(this.attrs.section === 'categories' ? 'sidebar.customize_categories' : 'sidebar.customize_tags');
  }

  /** 未选择时区域显示的内容：主标签，或最常用的标签。 */
  defaultTags(): LcoyTag[] {
    return this.attrs.section === 'categories' ? primaryTags() : secondaryTags();
  }

  candidates(): LcoyTag[] {
    const tags = this.attrs.section === 'categories' ? sortTags(allTags().filter((tag) => tag.position() !== null)) : secondaryTags();
    const query = this.filter.trim().toLowerCase();

    return query ? tags.filter((tag) => tag.name().toLowerCase().includes(query)) : tags;
  }

  content(): Mithril.Children {
    const candidates = this.candidates();

    return (
      <div className="Modal-body">
        <div className="Form-group">
          <input
            className="FormControl"
            type="search"
            placeholder={t('sidebar.customize_filter')}
            value={this.filter}
            oninput={(event: InputEvent) => (this.filter = (event.target as HTMLInputElement).value)}
          />
        </div>

        <ul className="LcoySidebarCustomize-list">
          {candidates.map((tag) => {
            const id = tag.id()!;
            const checked = this.selected.has(id);

            return (
              <li className={classList({ 'LcoySidebarCustomize-item--child': tag.isChild() })}>
                <label className="checkbox">
                  <input type="checkbox" checked={checked} onchange={() => this.toggle(id)} />
                  {this.attrs.section === 'categories' ? categorySymbol(tag) : tagSymbol(tag, '', 'fas fa-tag')}
                  <span>{tag.name()}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="LcoySidebarCustomize-actions">
          <Button className="Button Button--primary" onclick={() => this.save()}>
            {t('sidebar.customize_save')}
          </Button>
          <Button className="Button Button--link" onclick={() => this.reset()}>
            {t('sidebar.customize_reset')}
          </Button>
        </div>
      </div>
    );
  }

  toggle(id: string) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  save() {
    setSidebarPicks(this.attrs.section, Array.from(this.selected));
    this.hide();
  }

  reset() {
    setSidebarPicks(this.attrs.section, null);
    this.hide();
  }
}
