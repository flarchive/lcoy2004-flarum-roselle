/*
 * Discourse 的批量选择（面向有管理权限者）：列表栏中的按钮为每个
 * 主题启用复选框，并在列表上方显示操作栏——标记为已读、置顶、
 * 锁定、更改标签、隐藏、删除。
 *
 * 全部通过核心的 ItemLists 实现：按钮位于 `IndexPage.actionItems`
 * （主题的导航栏绘制在右侧），工具栏位于 `contentItems`，复选框位于
 * `DiscussionListItem.contentItems`。
 */
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { bulkActions } from './actions';
import { bulkAvailable, loadedDiscussions, selection } from './selection';

/** MinimalDiscussionListItem（弹窗结果）继承自列表项；在那里没有选择功能。 */
function isMinimal(item: DiscussionListItem): boolean {
  return String(item.elementAttrs().className || '').includes('MinimalDiscussionListItem');
}

function toggleButton(): Mithril.Children {
  const label = selection.active ? t('extras.bulk.toggle_off') : t('extras.bulk.toggle_on');

  return (
    <Tooltip text={label}>
      <Button
        className={classList('Button Button--icon LcoyBulk-toggle', { active: selection.active })}
        icon="fas fa-list-check"
        aria-label={label}
        aria-pressed={selection.active ? 'true' : 'false'}
        onclick={() => selection.setActive(!selection.active)}
      />
    </Tooltip>
  );
}

function bar(): Mithril.Children {
  const selected = selection.selected();
  const count = selected.length;
  const total = loadedDiscussions().length;
  const actions = bulkActions().filter((action) => selected.some((discussion) => action.applies(discussion as any)));

  return (
    <div className="LcoyBulkBar" role="toolbar" aria-label={t('extras.bulk.bar_label')}>
      <div className="LcoyBulkBar-status">
        <span className="LcoyBulkBar-count">{t('extras.bulk.selected', { count })}</span>
        {count < total ? (
          <Button className="Button Button--link LcoyBulkBar-link" onclick={() => selection.selectAll()}>
            {t('extras.bulk.select_all', { count: total })}
          </Button>
        ) : null}
        {count > 0 && (
          <Button className="Button Button--link LcoyBulkBar-link" onclick={() => selection.clear()}>
            {t('extras.bulk.clear')}
          </Button>
        )}
      </div>
      <div className="LcoyBulkBar-actions">
        {count === 0 && <span className="LcoyBulkBar-hint">{t('extras.bulk.hint')}</span>}
        {actions.map((action) => (
          <Button
            className={classList('Button LcoyBulkBar-action', { 'LcoyBulkBar-action--danger': action.danger })}
            icon={action.icon}
            onclick={() => action.run(selection.selected() as any)}
          >
            {action.label}
          </Button>
        ))}
        <Button
          className="Button Button--icon Button--link LcoyBulkBar-close"
          icon="fas fa-times"
          aria-label={t('extras.bulk.toggle_off')}
          onclick={() => selection.setActive(false)}
        />
      </div>
    </div>
  );
}

export default function installBulkSelect(): void {
  extend(IndexPage.prototype, 'oninit', function () {
    // 另一个列表，另一份选择：在某个标签中勾选主题后切换标签，
    // 不能让操作仍然作用于已从屏幕上消失的内容。
    selection.setActive(false);
  });

  extend(IndexPage.prototype, 'actionItems', function (items: ItemList<Mithril.Children>) {
    if (!bulkAvailable()) return;

    items.add('lcoyBulk', toggleButton(), 5);
  });

  extend(IndexPage.prototype, 'contentItems', function (items: ItemList<Mithril.Children>) {
    if (!selection.active || !bulkAvailable()) return;

    // 位于导航栏（100）与列表（90）之间。
    items.add('lcoyBulkBar', bar(), 95);
  });

  extend(DiscussionListItem.prototype, 'oninit', function (this: DiscussionListItem) {
    // 仅当 SubtreeRetainer 检测到变化时该项才会重绘；选择状态
    // 必须纳入该判断，否则复选框不会响应点击。
    this.subtree.check(
      () => selection.active,
      () => selection.active && selection.has(this.attrs.discussion)
    );
  });

  extend(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (!selection.active || isMinimal(this)) return;

    const discussion = this.attrs.discussion;
    const checked = selection.has(discussion);

    items.add(
      'lcoyBulkCheck',
      <label className="LcoyBulkCheck" onclick={(event: MouseEvent) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={t('extras.bulk.select_one', { title: discussion.title() })}
          onclick={(event: MouseEvent) => {
            selection.toggle(discussion, event.shiftKey);

            // shift+点击时最终状态来自区间而非本次点击：
            // 在此校正被点击的复选框，因为若其自身状态未变，
            // 该项甚至可能不会重绘（SubtreeRetainer）。
            (event.currentTarget as HTMLInputElement).checked = selection.has(discussion);
          }}
        />
      </label>,
      // 排在最前，包括手机端的头像（100）之前。
      110
    );
  });

  extend(DiscussionListItem.prototype, 'elementAttrs', function (this: DiscussionListItem, attrs: Record<string, any>) {
    if (selection.active && selection.has(this.attrs.discussion)) {
      attrs.className = classList(attrs.className, 'LcoyBulk-selected');
    }
  });
}
