/*
 * 批量选择的状态：模式是否开启以及已勾选的 id。
 *
 * 整个论坛共用一个对象（而非页面状态），因为复选框由每个
 * DiscussionListItem 绘制，工具栏由 IndexPage 绘制，两者必须看到
 * 同一份选择。切换列表页面（其他标签、其他排序）会清空全部内容
 * ——见 `reset`。
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';

import { forumBool } from '../../../utils/settings';

class BulkSelection {
  active = false;
  /** 每次变更时递增：列表项（SubtreeRetainer）据此观察变化。 */
  version = 0;
  private ids = new Set<string>();
  /** 最后点击的项，用于 shift+点击选择区间。 */
  private anchor: string | null = null;

  has(discussion: Discussion): boolean {
    return this.ids.has(String(discussion.id()));
  }

  count(): number {
    return this.ids.size;
  }

  setActive(active: boolean): void {
    this.active = active;
    this.clear();
  }

  toggle(discussion: Discussion, range = false): void {
    const id = String(discussion.id());

    if (range && this.anchor && this.anchor !== id) {
      const visible = loadedDiscussions().map((item) => String(item.id()));
      const from = visible.indexOf(this.anchor);
      const to = visible.indexOf(id);

      if (from !== -1 && to !== -1) {
        // 区间跟随锚点项的状态，与文件管理器一致。
        const select = this.ids.has(this.anchor);

        visible.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((itemId) => (select ? this.ids.add(itemId) : this.ids.delete(itemId)));
        this.anchor = id;
        this.version++;
        return;
      }
    }

    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);

    this.anchor = id;
    this.version++;
  }

  selectAll(): void {
    loadedDiscussions().forEach((discussion) => this.ids.add(String(discussion.id())));
    this.version++;
  }

  clear(): void {
    this.ids.clear();
    this.anchor = null;
    this.version++;
  }

  /** 仍存在于 store 中的已选主题（已删除的会从这里消失）。 */
  selected(): Discussion[] {
    return [...this.ids].map((id) => app.store.getById<Discussion>('discussions', id)).filter((discussion): discussion is Discussion => !!discussion);
  }

  forget(discussion: Discussion): void {
    this.ids.delete(String(discussion.id()));
    this.version++;
  }
}

export const selection = new BulkSelection();

/** 列表中已加载的主题，按出现顺序排列。 */
export function loadedDiscussions(): Discussion[] {
  return app.discussions.getPages().flatMap((page) => page.items);
}

/** 能管理此列表中某些内容的人——即 Discourse 的“staff”。 */
export function canModerate(discussion: Discussion): boolean {
  const model = discussion as Discussion & Record<string, any>;

  return !!(model.canSticky?.() || model.canLock?.() || discussion.canDelete() || (discussion.canHide() && discussion.user() !== app.session.user));
}

export function bulkAvailable(): boolean {
  if (!app.session.user || !forumBool('lcoyBulkSelectEnabled', true)) return false;

  return !!app.session.user.isAdmin?.() || loadedDiscussions().some(canModerate);
}
