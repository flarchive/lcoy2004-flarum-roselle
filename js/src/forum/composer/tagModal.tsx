/*
 * flarum/tags 的标签弹窗（`TagSelectionModal` 以及继承它的 `TagDiscussionModal`：
 * "编辑标签"、讨论的控件、批量选择）按照主题编辑器中的标签选择器来绘制：
 * 搜索框是一个 `.FormControl`，已选标签以胶囊形式显示（符号、名称、×）；
 * 列表中有带标签颜色的符号、使用文字颜色的名称、下方的描述，
 * 以及右侧的勾选标记，并分为 "主标签" 和 "二级标签"；
 * 底部左侧是 "忽略要求"（开关），右侧是按钮。
 *
 * 只有外观改变：过滤、限制、权限、`requireParentTag`、
 * 键盘操作（↑ ↓ Enter、Ctrl+Enter、Backspace）和提交仍由
 * flarum/tags 的方法完成，从这里调用。两个模块都放在按需
 * 加载的 chunk 中：按名称扩展。
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Switch from 'flarum/common/components/Switch';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import highlight from 'flarum/common/helpers/highlight';
import type Mithril from 'mithril';

import { categorySymbol, type LcoyTag } from '../utils/tags';
import { isExtensionEnabled, t } from '../utils/settings';

const SELECTION = 'ext:flarum/tags/common/components/TagSelectionModal';
const DISCUSSION = 'ext:flarum/tags/forum/components/TagDiscussionModal';

/** 与 flarum/tags 相同的规则：一个 CJK 字符占 2ch。 */
function textWidth(modal: any, text: string): number {
  return typeof modal.lengthWithCJK === 'function' ? modal.lengthWithCJK(text) : text.length;
}

/** 已选标签的胶囊；点击会移除该标签（与 flarum/tags 相同）。 */
function chip(modal: any, tag: LcoyTag): Mithril.Children {
  return (
    <button
      type="button"
      className="LcoySelectKit-chip LcoyTagModal-chip"
      title={t('composer.shell.remove_tag')}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        modal.removeTag(tag);
        modal.onready();
      }}
    >
      {categorySymbol(tag)}
      <span className="LcoyTagModal-chipName">{tag.name()}</span>
      <Icon name="fas fa-xmark" />
    </button>
  );
}

/** 列表中的一行：符号、名称、描述以及已选项的勾选标记。 */
function row(modal: any, tag: LcoyTag, filter: string): Mithril.Children {
  const selected = modal.selected.includes(tag);
  const description = tag.description();

  return (
    <li
      data-index={tag.id()}
      role="option"
      aria-selected={selected ? 'true' : 'false'}
      className={classList('SelectTagListItem LcoyTagList-item', {
        pinned: tag.position() !== null,
        child: !!tag.parent(),
        colored: !!tag.color(),
        selected,
        active: modal.indexTag === tag,
      })}
      onmouseover={() => (modal.indexTag = tag)}
      onclick={() => modal.toggleTag(tag)}
    >
      <span className="LcoyTagList-symbol">{categorySymbol(tag)}</span>
      <span className="LcoyTagList-text">
        <span className="LcoyTagList-name">{highlight(tag.name(), filter)}</span>
        {description ? <span className="LcoyTagList-desc">{description}</span> : null}
      </span>
      <Icon name="fas fa-check" className="LcoyTagList-check" />
    </li>
  );
}

/**
 * 带分区标题的列表。置顶的（`position`）是主标签及其子标签，
 * `sortTags` 已将它们排在二级标签之前；只有两种类型都存在时才
 * 显示标题。标题没有 `data-index`，下面的
 * `selectableItems` 会把它们排除在键盘导航之外。
 */
function list(modal: any, tags: LcoyTag[], filter: string): Mithril.Children[] {
  const pinned = tags.filter((tag) => tag.position() !== null);
  const others = tags.filter((tag) => tag.position() === null);
  const sections = pinned.length > 0 && others.length > 0;
  const items: Mithril.Children[] = [];

  tags.forEach((tag, i) => {
    if (sections && (i === 0 || (tag.position() === null && tags[i - 1].position() !== null))) {
      items.push(
        <li className="LcoyTagList-heading" role="presentation">
          {t(tag.position() !== null ? 'tag_modal.primary_heading' : 'tag_modal.secondary_heading')}
        </li>
      );
    }

    items.push(row(modal, tag, filter));
  });

  return items;
}

function content(modal: any): Mithril.Children {
  if (modal.loading || !modal.tags) {
    return <LoadingIndicator />;
  }

  const filter = modal.filter().toLowerCase();
  const primaryCount = modal.primaryCount();
  const secondaryCount = modal.secondaryCount();
  const tags: LcoyTag[] = modal.getFilteredTags();
  const instruction = extractText(modal.getInstruction(primaryCount, secondaryCount));
  const placeholder = instruction || t('composer.shell.search_placeholder');
  const inputWidth = Math.max(textWidth(modal, placeholder), textWidth(modal, modal.filter()));

  return [
    <div className="Modal-body LcoyTagModal-body">
      <div
        className={classList('TagsInput FormControl LcoyTagModal-input', { focus: modal.focused })}
        onclick={() => modal.$('.TagsInput input').focus()}
      >
        {modal.selected.map((tag: LcoyTag) => chip(modal, tag))}
        <input
          className="LcoyTagModal-search"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder={placeholder}
          bidi={modal.filter}
          style={{ flexBasis: inputWidth + 2 + 'ch' }}
          // 标签在弹窗的 `onready` 之后才到达，而那时还找不到该字段：
          // 标签出现时把焦点交给搜索框（移动端不这样做，
          // 以免键盘在列表上方弹出）。
          oncreate={(vnode: Mithril.VnodeDOM) => {
            if (app.screen() !== 'phone') (vnode.dom as HTMLInputElement).focus();
          }}
          onkeydown={modal.navigator.navigate.bind(modal.navigator)}
          onfocus={() => (modal.focused = true)}
          onblur={() => (modal.focused = false)}
        />
      </div>

      {tags.length ? (
        <ul className="TagSelectionModal-list LcoyTagList" role="listbox" aria-multiselectable="true">
          {list(modal, tags, filter)}
        </ul>
      ) : (
        <div className="LcoyTagList-empty">{t('composer.shell.no_results')}</div>
      )}
    </div>,

    <div className="Modal-footer LcoyTagModal-footer">
      {modal.attrs.limits?.allowBypassing ? (
        <Switch className="LcoyTagModal-bypass" state={modal.bypassReqs} onchange={(value: boolean) => (modal.bypassReqs = value)}>
          {app.translator.trans('flarum-tags.lib.tag_selection_modal.bypass_requirements')}
        </Switch>
      ) : null}
      <Button type="submit" className="Button Button--primary LcoyTagModal-submit" disabled={!modal.meetsRequirements(primaryCount, secondaryCount)}>
        {app.translator.trans('flarum-tags.lib.tag_selection_modal.submit_button')}
      </Button>
    </div>,
  ];
}

export default function installTagModal(): void {
  if (!isExtensionEnabled('flarum-tags')) return;

  // `className` 返回文本：只有 override 才能追加类名。
  override(SELECTION as any, 'className', function (this: any, original: () => string) {
    return classList(original(), 'LcoyTagModal');
  });

  // 整个外观；这里若出错，就回退到 flarum/tags 的版本。
  override(SELECTION as any, 'content', function (this: any, original: () => Mithril.Children) {
    try {
      return content(this);
    } catch (e) {
      console.error(e);
      return original();
    }
  });

  // 分区标题不参与 ↑ ↓ 导航。
  override(SELECTION as any, 'selectableItems', function (this: any) {
    return this.$('.TagSelectionModal-list > li[data-index]');
  });

  // "编辑标签" 占一行，讨论标题在其下方，更小且为灰色，
  // 而不是把 "编辑标签：<标题>" 放在两行大字中。
  override(DISCUSSION as any, 'title', function (this: any, original: () => Mithril.Children) {
    const discussion = this.attrs?.discussion;

    if (!discussion) return original();

    return [
      <span className="LcoyTagModal-title">{t('tag_modal.edit_title')}</span>,
      <span className="LcoyTagModal-subtitle" title={discussion.title()}>
        {discussion.title()}
      </span>,
    ];
  });
}
