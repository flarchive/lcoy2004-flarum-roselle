/*
 * Discourse 编辑器中的 "主标签 | 二级标签" 一行
 * （`.title-and-category`）：左侧是 `category-chooser`，右侧是
 * `mini-tag-chooser`，两个 select-kit 就在这一行内，取代
 * flarum/tags 的弹窗。
 *
 * 规则与 TagDiscussionModal 相同（见 `tagRules.ts`）：只显示操作者
 * 可用的标签；左侧是一级主标签；右侧是所选主标签（且仅限它）的子标签
 * 以及二级标签，二者合计计入二级标签上限，与
 * 服务端一致。更换主标签会移除原先的子标签。达到上限后不能添加；
 * 下限在发布时校验（`installComposerShell`）。结果写入
 * `composer.fields.tags`，与 flarum/tags 的 addTagComposer 相同。
 *
 * 可复用：有其他编辑器的调用方传入 `tags`/`onchange`（编辑已有讨论的
 * 标签时再传 `discussion`），并选择显示哪几部分。
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import SelectKit, { type SelectKitRow } from './SelectKit';
import { categorySymbol, type LcoyTag } from '../utils/tags';
import { t } from '../utils/settings';
import {
  addTag,
  canAddTag,
  countTags,
  isPrimaryParent,
  normalizeTags,
  parentTag,
  removeTag,
  selectableTags,
  sortSelectable,
  tagLimits,
  type TagLimits,
} from './tagRules';

export interface ComposerFieldsAttrs extends ComponentAttrs {
  tags: LcoyTag[];
  onchange: (tags: LcoyTag[]) => void;
  disabled?: boolean;
  /** 正在编辑某个讨论的标签：适用 `canAddToDiscussion`。 */
  discussion?: Discussion | null;
  /** 显示主标签部分（默认：显示）。 */
  categories?: boolean;
  /** 显示二级标签部分（默认：显示，如果有的话）。 */
  labels?: boolean;
}

function matches(tag: LcoyTag, filter: string): boolean {
  if (!filter) return true;

  const needle = filter.toLowerCase();
  const parent = parentTag(tag);

  return tag.name().toLowerCase().includes(needle) || (!!parent && parent.name().toLowerCase().includes(needle));
}

/** "(符号) 名称"，Discourse 的徽章，不含链接。 */
function badge(tag: LcoyTag): Mithril.Children {
  const symbol: any = categorySymbol(tag);
  const parent = parentTag(tag);

  // 没有图标的子标签：使用双色小方块，父标签的颜色和它自己的颜色
  // （`.badge-category.--has-parent.--style-square`）。
  if (parent && !tag.icon() && symbol?.attrs) {
    symbol.attrs.className = `${symbol.attrs.className || ''} LcoyCategorySymbol--split`;
    symbol.attrs.style = { ...(symbol.attrs.style || {}), '--category-parent-color': parent.color() || 'var(--lcoy-primary-medium)' };
  }

  return (
    <span className="LcoyChooserBadge">
      {symbol}
      <span className="LcoyChooserBadge-name">{tag.name()}</span>
    </span>
  );
}

/** 父 ▪ 子，例如 `支持 ▪ 安装`。 */
function categoryLabel(tag: LcoyTag): Mithril.Children {
  const parent = parentTag(tag);

  return parent ? [badge(parent), badge(tag)] : badge(tag);
}

export default class ComposerFields extends Component<ComposerFieldsAttrs> {
  view(): Mithril.Children {
    const { disabled, categories = true } = this.attrs;
    const limits = tagLimits();
    const selectable = selectableTags(this.attrs.discussion);
    const selected = this.selected();
    const chosenPrimary = selected.filter(isPrimaryParent);
    const chosenOthers = selected.filter((tag) => !isPrimaryParent(tag));
    const { secondary } = countTags(selected);

    // 只有其中存在可选项（或已有选中项）时，该部分才会显示。
    const showCategories = categories && (chosenPrimary.length > 0 || (limits.maxPrimary > 0 && selectable.some(isPrimaryParent)));
    const anyOthers = selectable.some((tag) => !isPrimaryParent(tag) && this.parentChosen(tag, selected));
    const showLabels = (this.attrs.labels ?? true) && (chosenOthers.length > 0 || (limits.maxSecondary > 0 && anyOthers));

    // 设定了二级标签下限时，使用 flarum/tags 的文本（"再选择 1 个标签"）
    // 而不是 "可选标签……"。
    const missing = limits.bypass ? 0 : Math.max(0, limits.minSecondary - secondary);
    const tagsPlaceholder = missing
      ? (app.translator.trans('flarum-tags.lib.tag_selection_modal.choose_secondary_placeholder', { count: missing }, true) as string)
      : t('composer.shell.tags_placeholder');

    return (
      <div className="LcoyComposerFields">
        {showCategories && (
          <SelectKit
            className={`LcoyComposerFields-cell LcoyComposerFields-category${chosenPrimary.length ? ' has-selection' : ''}`}
            label={t('composer.shell.category_placeholder')}
            disabled={disabled}
            filterIcon
            header={
              chosenPrimary.length ? (
                <span className="LcoyComposerFields-value">{chosenPrimary.map((tag, i) => [i > 0 ? ', ' : null, categoryLabel(tag)])}</span>
              ) : (
                <span className="LcoyComposerFields-placeholder">{t('composer.shell.category_placeholder')}</span>
              )
            }
            rows={(filter: string) => this.categoryRows(filter, selected, selectable, limits)}
            onselect={(key: string) => this.chooseCategory(key, selectable, limits)}
            after={() => this.limitNote(chosenPrimary.length, limits.maxPrimary)}
          />
        )}
        {showLabels && (
          <SelectKit
            className={`LcoyComposerFields-cell LcoyComposerFields-tags${chosenOthers.length ? ' has-selection' : ''}`}
            label={t('composer.shell.tags_placeholder')}
            disabled={disabled}
            caret="fas fa-plus"
            caretOpen="fas fa-plus"
            stayOpen
            header={
              <>
                <Icon name="fas fa-tag" className="LcoyComposerFields-tagIcon" />
                <span className="LcoyComposerFields-value">
                  {chosenOthers.length ? (
                    chosenOthers.map((tag) => tag.name()).join(', ')
                  ) : (
                    <span className="LcoyComposerFields-placeholder">{tagsPlaceholder}</span>
                  )}
                </span>
              </>
            }
            before={
              chosenOthers.length ? (
                <div className="LcoySelectKit-selected">
                  {chosenOthers.map((tag) => (
                    <button
                      type="button"
                      className="LcoySelectKit-chip"
                      title={t('composer.shell.remove_tag')}
                      onmousedown={(e: MouseEvent) => e.preventDefault()}
                      onclick={() => this.remove(tag)}
                    >
                      <span>{tag.name()}</span>
                      <Icon name="fas fa-xmark" />
                    </button>
                  ))}
                </div>
              ) : null
            }
            rows={(filter: string) => this.labelRows(filter, selected, selectable, limits)}
            onselect={(key: string) => this.chooseLabel(key, selectable, limits)}
            emptyText={
              secondary >= limits.maxSecondary ? t('composer.shell.max_secondary_tags', { count: limits.maxSecondary }) : t('composer.shell.no_tags')
            }
          />
        )}
      </div>
    );
  }

  /** 当前选择，去重且不含孤立的子标签。 */
  selected(): LcoyTag[] {
    return normalizeTags(this.attrs.tags.filter(Boolean));
  }

  /** 子标签只在其父标签已选时有效（`requireParentTag`）；其他直接通过。 */
  parentChosen(tag: LcoyTag, selected: LcoyTag[]): boolean {
    const parent = parentTag(tag);
    return !parent || selected.includes(parent);
  }

  /** 主标签数量上限的提示（仅在允许多个时显示）。 */
  limitNote(count: number, max: number): Mithril.Children {
    if (max <= 1 || count < max) return null;

    return <div className="LcoySelectKit-note">{t('composer.shell.max_primary_tags', { count: max })}</div>;
  }

  categoryRows(filter: string, selected: LcoyTag[], selectable: LcoyTag[], limits: TagLimits): SelectKitRow[] {
    const chosen = selected.filter(isPrimaryParent);
    let options = sortSelectable(selectable.filter(isPrimaryParent));

    // 允许多个主标签时，最多只保留已选的（便于取消），
    // 与 flarum/tags 的弹窗相同。只允许一个时，选择另一个会替换它。
    if (limits.maxPrimary > 1 && chosen.length >= limits.maxPrimary) {
      options = options.filter((tag) => selected.includes(tag));
    }

    const rows: SelectKitRow[] = options
      .filter((tag) => matches(tag, filter))
      .map((tag) => ({
        key: String(tag.id()),
        selected: selected.includes(tag),
        title: tag.name(),
        content: (
          <div className="LcoyCategoryRow">
            <div className="LcoyCategoryRow-status">
              {categoryLabel(tag)}
              <span className="LcoyCategoryRow-count">× {tag.discussionCount() || 0}</span>
            </div>
            {tag.description() ? <div className="LcoyCategoryRow-desc">{tag.description()}</div> : null}
          </div>
        ),
      }));

    // 没有必选主标签（或可以忽略下限）时，可以回到 "无"。
    if (!filter && (limits.minPrimary === 0 || limits.bypass) && chosen.length) {
      rows.unshift({
        key: 'none',
        content: <div className="LcoyCategoryRow LcoyCategoryRow--none">{t('composer.shell.no_category')}</div>,
      });
    }

    return rows;
  }

  labelRows(filter: string, selected: LcoyTag[], selectable: LcoyTag[], limits: TagLimits): SelectKitRow[] {
    // 达到二级标签上限（含子标签）时，列表为空，
    // 空状态文本会提示该上限。
    if (countTags(selected).secondary >= limits.maxSecondary) return [];

    // flarum/tags 的 `sortTags`：子标签（有 position 的）在前，按
    // 父标签的顺序；然后是二级标签，使用最多的在前。
    const options = selectable.filter(
      (tag) => !isPrimaryParent(tag) && !selected.includes(tag) && this.parentChosen(tag, selected) && matches(tag, filter)
    );

    return sortSelectable(options).map((tag) => {
      const child = !!parentTag(tag);

      return {
        key: String(tag.id()),
        title: tag.name(),
        content: (
          <span className={`LcoyTagRow${child ? ' LcoyTagRow--child' : ''}`}>
            <span className="LcoyTagRow-name">{child ? categoryLabel(tag) : tag.name()}</span>
            <span className="LcoyTagRow-count">x{tag.discussionCount() || 0}</span>
          </span>
        ),
      };
    });
  }

  find(key: string, selectable: LcoyTag[]): LcoyTag | undefined {
    return selectable.find((tag) => String(tag.id()) === key);
  }

  chooseCategory(key: string, selectable: LcoyTag[], limits: TagLimits): void {
    const selected = this.selected();

    // "无"：移除主标签，子标签随之移除。
    if (key === 'none') {
      this.attrs.onchange(normalizeTags(selected.filter((tag) => !isPrimaryParent(tag))));
      return;
    }

    const tag = this.find(key, selectable);
    if (!tag) return;

    if (selected.includes(tag)) {
      // 有多个主标签时，再次选择会移除；只有一个时，什么也不变。
      if (limits.maxPrimary > 1) this.attrs.onchange(removeTag(selected, tag));
      return;
    }

    if (canAddTag(tag, selected, selectable, limits)) {
      this.attrs.onchange(selected.concat(tag));
      return;
    }

    // 达到上限：替换。被移除的主标签的子标签也随之失效。
    const base = normalizeTags(selected.filter((item) => !isPrimaryParent(item)));
    const next = addTag(base, tag, selectable, limits);

    if (next) this.attrs.onchange(next);
  }

  chooseLabel(key: string, selectable: LcoyTag[], limits: TagLimits): void {
    const tag = this.find(key, selectable);
    if (!tag) return;

    const next = addTag(this.selected(), tag, selectable, limits);
    if (next) this.attrs.onchange(next);
  }

  remove(tag: LcoyTag): void {
    this.attrs.onchange(removeTag(this.selected(), tag));
  }
}
