/*
 * 用户表格（/u 目录或用户组成员）的状态：筛选条件、
 * 已加载的页面以及“加载更多”。
 */
import type User from 'flarum/common/models/User';

import { fetchDirectory, pushUsers, type DirectoryParams, type DirectoryRow, type PeriodKey } from './api';

export interface LoadedRow extends DirectoryRow {
  model: User;
}

export default class DirectoryState {
  params: DirectoryParams;
  rows: LoadedRow[] = [];
  columns: string[] = [];
  total: number | null = null;
  hasMore = false;
  loading = false;
  failed = false;

  /** 乱序到达的响应（快速输入搜索）会被丢弃。 */
  private requestId = 0;

  constructor(params: DirectoryParams) {
    this.params = { ...params };
  }

  /** 切换筛选条件并从第一页重新开始。 */
  refresh(changes: Partial<DirectoryParams> = {}): Promise<void> {
    this.params = { ...this.params, ...changes, page: 1 };
    this.rows = [];
    this.hasMore = false;

    return this.load();
  }

  loadMore(): Promise<void> {
    if (this.loading || !this.hasMore) return Promise.resolve();

    this.params = { ...this.params, page: (this.params.page || 1) + 1 };

    return this.load();
  }

  /** 点击已排序的列会反转方向；点击新列时从最大值开始。 */
  sortBy(column: string): Promise<void> {
    const same = this.currentOrder() === column;
    const dir: 'asc' | 'desc' = same ? (this.params.dir === 'asc' ? 'desc' : 'asc') : column === 'username' ? 'asc' : 'desc';

    return this.refresh({ order: column, dir });
  }

  setPeriod(period: PeriodKey): Promise<void> {
    return this.refresh({ period });
  }

  currentOrder(): string | undefined {
    return this.params.order;
  }

  private load(): Promise<void> {
    const id = ++this.requestId;

    this.loading = true;
    this.failed = false;
    m.redraw();

    return fetchDirectory(this.params)
      .then((payload) => {
        if (id !== this.requestId) return;

        const users = pushUsers(payload.included || []);
        const rows = payload.data.map((row) => ({ ...row, model: users[row.user] })).filter((row): row is LoadedRow => !!row.model);

        this.rows = payload.meta.page > 1 ? [...this.rows, ...rows] : rows;
        this.columns = payload.meta.columns;
        this.total = payload.meta.total;
        this.hasMore = payload.meta.hasMore;

        // 服务端返回实际生效的排序（无效参数会回落到
        // 默认值）：表头据此标记正确的列。
        this.params = { ...this.params, order: payload.meta.order, dir: payload.meta.dir, period: payload.meta.period };
      })
      .catch(() => {
        if (id === this.requestId) this.failed = true;
      })
      .finally(() => {
        if (id !== this.requestId) return;

        this.loading = false;
        m.redraw();
      });
  }
}
