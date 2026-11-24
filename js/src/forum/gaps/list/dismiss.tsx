/*
 * Discourse 的“未读”和“新”列表中的“忽略”
 *（topic-dismiss-buttons）：顶部右侧一个，列表末尾再来一个。
 * 把列表中的主题标为已读——在总的未读列表中则标记全部，
 * 通过核心的“全部标为已读”，只发一次请求。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';
import { refreshCounts } from '../../features/stats/counts';

let busy = false;

function currentSort(): string {
  return String(app.search.state.params().sort || '');
}

function loaded(): Discussion[] {
  return app.discussions.getPages().flatMap((page: any) => page.items as Discussion[]);
}

function unreadLoaded(): Discussion[] {
  return loaded().filter((discussion) => discussion.isUnread());
}

/** 按钮出现在哪些列表：未读列表始终出现；新列表在有可忽略的条目时出现。 */
function shouldShow(): boolean {
  if (!gaps.dismiss() || !app.session.user || app.discussions.isEmpty() || app.discussions.isInitialLoading()) return false;

  const sort = currentSort();

  if (sort === 'unread') return true;

  return sort === 'newest' && unreadLoaded().length > 0;
}

async function dismiss(): Promise<void> {
  if (busy) return;

  const sort = currentSort();
  const params = app.search.state.params() as Record<string, any>;
  const filtered = !!params.tags || !!params.q;

  if (!window.confirm(sort === 'unread' ? t('gaps.dismiss.confirm_unread') : t('gaps.dismiss.confirm_new'))) return;

  busy = true;
  m.redraw();

  try {
    if (sort === 'unread' && !filtered) {
      // 总的未读列表就是“全部”：与核心的按钮相同。
      await app.session.user!.save({ markedAllAsReadAt: new Date() });
    } else {
      // 在分类中（或“新”列表中）只处理列表里的主题，与 Discourse 一致。
      await Promise.all(unreadLoaded().map((discussion) => discussion.save({ lastReadPostNumber: discussion.lastPostNumber() }).catch(() => null)));
    }

    app.discussions.refresh();
    refreshCounts(true).catch(() => {});
  } finally {
    busy = false;
    m.redraw();
  }
}

function dismissButton(position: 'top' | 'bottom'): Mithril.Children {
  const label = currentSort() === 'unread' ? t('gaps.dismiss.unread') : t('gaps.dismiss.new');

  return (
    <div className={`LcoyDismiss LcoyDismiss--${position}`}>
      <Button className="Button LcoyDismiss-button" icon="fas fa-check" loading={busy} onclick={() => dismiss()}>
        {label}
      </Button>
    </div>
  );
}

export default function installDismiss(): void {
  extend(IndexPage.prototype, 'contentItems', function (items: ItemList<Mithril.Children>) {
    if (!shouldShow()) return;

    // 位于工具栏（100）和列表（90）之间；以及列表之后。
    items.add('lcoyDismissTop', dismissButton('top'), 95);

    if (!app.discussions.hasNext()) items.add('lcoyDismissBottom', dismissButton('bottom'), 80);
  });
}
