/*
 * 批量选择工具栏的操作。每项仅对用户确实有权限的已选主题生效
 * （`canSticky`、`canLock`…）：无权限的主题会被跳过并计入“已忽略”
 * 数量，而不会导致整个操作失败。
 *
 * 请求逐个发出。数量不多（一个列表页），排队发送可避免服务端收到
 * 突发请求，错误提示的顺序也更合理。
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type Model from 'flarum/common/Model';

import { t } from '../../../utils/settings';
import { selection } from './selection';

type Moderatable = Discussion & Record<string, any>;

export interface BulkAction {
  key: string;
  icon: string;
  label: string;
  /** 该主题是否可执行此操作？（权限与当前状态） */
  applies: (discussion: Moderatable) => boolean;
  run: (discussions: Moderatable[]) => Promise<void> | void;
  danger?: boolean;
}

async function eachSequential(discussions: Moderatable[], work: (discussion: Moderatable) => Promise<unknown>): Promise<number> {
  let failed = 0;

  for (const discussion of discussions) {
    try {
      await work(discussion);
    } catch {
      failed++;
    }
  }

  return failed;
}

function report(done: number, failed: number, skipped: number): void {
  const parts = [t('extras.bulk.done', { count: done })];

  if (skipped) parts.push(t('extras.bulk.skipped', { count: skipped }));
  if (failed) parts.push(t('extras.bulk.failed', { count: failed }));

  app.alerts.show({ type: failed ? 'error' : 'success' }, parts.join(' '));
}

/**
 * 对适用的已选主题执行 `work`，提示结果，并在操作会改变顺序或
 * 列表内容时刷新列表。
 */
async function apply(action: BulkAction, work: (discussion: Moderatable) => Promise<unknown>, refreshList: boolean): Promise<void> {
  const all = selection.selected() as Moderatable[];
  const targets = all.filter(action.applies);

  if (!targets.length) return;

  const failed = await eachSequential(targets, work);

  report(targets.length - failed, failed, all.length - targets.length);

  if (refreshList) {
    selection.clear();
    app.discussions.refresh();
  }

  m.redraw();
}

function has(discussion: Moderatable, method: string): boolean {
  return typeof discussion[method] === 'function' && !!discussion[method]();
}

export function bulkActions(): BulkAction[] {
  const actions: BulkAction[] = [];

  actions.push({
    key: 'markRead',
    icon: 'fas fa-check',
    label: t('extras.bulk.mark_read'),
    applies: (discussion) => !!discussion.isUnread(),
    run() {
      return apply(this, (discussion) => discussion.save({ lastReadPostNumber: discussion.lastPostNumber() }), false);
    },
  });

  if ('flarum-sticky' in flarum.extensions) {
    actions.push(
      {
        key: 'sticky',
        icon: 'fas fa-thumbtack',
        label: t('extras.bulk.sticky'),
        applies: (discussion) => has(discussion, 'canSticky') && !has(discussion, 'isSticky'),
        run() {
          return apply(this, (discussion) => discussion.save({ isSticky: true }), true);
        },
      },
      {
        key: 'unsticky',
        icon: 'fas fa-thumbtack',
        label: t('extras.bulk.unsticky'),
        applies: (discussion) => has(discussion, 'canSticky') && has(discussion, 'isSticky'),
        run() {
          return apply(this, (discussion) => discussion.save({ isSticky: false }), true);
        },
      }
    );
  }

  if ('flarum-lock' in flarum.extensions) {
    actions.push(
      {
        key: 'lock',
        icon: 'fas fa-lock',
        label: t('extras.bulk.lock'),
        applies: (discussion) => has(discussion, 'canLock') && !has(discussion, 'isLocked'),
        run() {
          return apply(this, (discussion) => discussion.save({ isLocked: true }), false);
        },
      },
      {
        key: 'unlock',
        icon: 'fas fa-unlock',
        label: t('extras.bulk.unlock'),
        applies: (discussion) => has(discussion, 'canLock') && has(discussion, 'isLocked'),
        run() {
          return apply(this, (discussion) => discussion.save({ isLocked: false }), false);
        },
      }
    );
  }

  if ('flarum-tags' in flarum.extensions) {
    actions.push({
      key: 'tags',
      icon: 'fas fa-tag',
      label: t('extras.bulk.tags'),
      applies: (discussion) => has(discussion, 'canTag'),
      run() {
        return changeTags(this);
      },
    });
  }

  actions.push(
    {
      key: 'hide',
      icon: 'far fa-trash-alt',
      label: t('extras.bulk.hide'),
      applies: (discussion) => !!discussion.canHide() && !discussion.isHidden(),
      run() {
        if (!confirm(t('extras.bulk.hide_confirm', { count: selection.selected().filter(this.applies).length }))) return;

        return apply(
          this,
          (discussion) => {
            discussion.pushData({ attributes: { hiddenAt: new Date() }, relationships: { hiddenUser: app.session.user as Model } });
            return discussion.save({ isHidden: true });
          },
          true
        );
      },
      danger: true,
    },
    {
      key: 'restore',
      icon: 'fas fa-reply',
      label: t('extras.bulk.restore'),
      applies: (discussion) => !!discussion.canHide() && !!discussion.isHidden(),
      run() {
        return apply(this, (discussion) => discussion.save({ isHidden: false }), true);
      },
    },
    {
      key: 'delete',
      icon: 'fas fa-times',
      label: t('extras.bulk.delete'),
      applies: (discussion) => !!discussion.canDelete(),
      run() {
        if (!confirm(t('extras.bulk.delete_confirm', { count: selection.selected().filter(this.applies).length }))) return;

        return apply(
          this,
          (discussion) =>
            discussion.delete().then(() => {
              selection.forget(discussion);
              app.discussions.removeDiscussion(discussion);
            }),
          false
        );
      },
      danger: true,
    }
  );

  return actions;
}

/**
 * “更改标签”：使用 flarum/tags 自带的选择器（受论坛的主标签和次标签
 * 限制），以第一个已选主题的标签为起点。所选集合会替换所有已选
 * 主题的标签。
 */
async function changeTags(action: BulkAction): Promise<void> {
  const targets = selection.selected().filter(action.applies) as Moderatable[];

  if (!targets.length) return;

  const modal = () => flarum.reg.asyncModuleImport('ext:flarum/tags/forum/components/TagDiscussionModal');

  app.modal.show(modal, {
    selectedTags: (targets[0].tags?.() || []).filter(Boolean),
    onsubmit: (tags: Model[]) => {
      apply(action, (discussion) => discussion.save({ relationships: { tags } }), true);
    },
  });
}
