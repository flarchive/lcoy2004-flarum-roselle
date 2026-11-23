import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import formatNumber from 'flarum/common/utils/formatNumber';
import type Mithril from 'mithril';

import UserTile from './UserTile';
import type DirectoryState from './DirectoryState';
import type { LoadedRow } from './DirectoryState';
import { t } from '../../utils/settings';
import { shortAge } from '../../utils/dates';

/** 每一列的图标，与 Discourse 目录表头的一致。 */
const COLUMN_ICONS: Record<string, string> = {
  likesReceived: 'fas fa-heart',
  likesGiven: 'fas fa-heart',
};

/** 行数据中自带的数值列（其他列取自用户模型）。 */
const NUMERIC = ['likesReceived', 'likesGiven', 'topicCount', 'postCount', 'daysVisited', 'postsRead'];

export interface DirectoryTableAttrs extends ComponentAttrs {
  state: DirectoryState;
  /** 无人时的文本（未进行搜索）。 */
  emptyText: string;
}

/**
 * Discourse 的目录表格：左侧为用户名，每个数值占一列，表头可点击
 * 排序，末尾有“加载更多”。
 *
 * “最后访问”始终显示（当用户公开该信息时），但仅对有核心权限的
 * 用户可排序——服务端会告知哪些列可排序。
 */
export default class DirectoryTable extends Component<DirectoryTableAttrs> {
  view(): Mithril.Children {
    const { state, emptyText } = this.attrs;
    const columns = this.displayColumns();

    if (state.failed && !state.rows.length) {
      return <p className="LcoyCommunity-empty">{t('community.load_error')}</p>;
    }

    if (!state.loading && !state.rows.length && state.total !== null) {
      return <p className="LcoyCommunity-empty">{state.params.q ? t('community.users.no_results') : emptyText}</p>;
    }

    return (
      <div className="LcoyDirectory">
        <div className="LcoyCommunity-tableWrap">
          <table className="LcoyCommunity-table LcoyDirectory-table">
            <thead>
              <tr>
                {this.header('username', t('community.users.column.username'), 'LcoyDirectory-userCol')}
                {columns.map((column) => this.header(column, t(`community.users.column.${column}`), 'LcoyCommunity-num'))}
              </tr>
            </thead>
            <tbody>{state.rows.map((row) => this.row(row, columns))}</tbody>
          </table>
        </div>

        {state.loading && <LoadingIndicator display="block" />}

        {!state.loading && state.hasMore && (
          <div className="LcoyCommunity-more">
            <Button className="Button" onclick={() => state.loadMore()}>
              {t('community.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  /** 服务端返回的列，外加“最后访问”（若服务端未按此列排序）。 */
  displayColumns(): string[] {
    const columns = [...this.attrs.state.columns];

    if (!columns.includes('lastSeenAt')) columns.push('lastSeenAt');

    return columns;
  }

  header(column: string, label: string, className: string): Mithril.Children {
    const { state } = this.attrs;
    const sortable = column === 'username' || state.columns.includes(column);
    const active = state.currentOrder() === column;
    const icon = COLUMN_ICONS[column];
    const content = (
      <>
        {icon && <Icon name={icon} className="LcoyDirectory-columnIcon" />}
        <span>{label}</span>
        {active && <Icon name={state.params.dir === 'asc' ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="LcoyDirectory-sortIcon" />}
      </>
    );

    return (
      <th
        className={classList(className, `LcoyDirectory-col--${column}`, { 'is-sorted': active })}
        aria-sort={active ? (state.params.dir === 'asc' ? 'ascending' : 'descending') : undefined}
        scope="col"
      >
        {sortable ? (
          <button type="button" className="LcoyDirectory-sort" onclick={() => state.sortBy(column)}>
            {content}
          </button>
        ) : (
          <span className="LcoyDirectory-sort is-static">{content}</span>
        )}
      </th>
    );
  }

  row(row: LoadedRow, columns: string[]): Mithril.Children {
    const user = row.model;
    const isMe = app.session.user === user;

    return (
      <tr key={row.user} className={classList({ 'is-me': isMe })}>
        <td className="LcoyDirectory-userCol">
          <UserTile user={user} size="small" />
        </td>
        {columns.map((column) => (
          <td className={`LcoyCommunity-num LcoyDirectory-value LcoyDirectory-col--${column}`} data-label={t(`community.users.column.${column}`)}>
            {this.value(row, column)}
          </td>
        ))}
      </tr>
    );
  }

  value(row: LoadedRow, column: string): Mithril.Children {
    if (NUMERIC.includes(column)) {
      const value = (row as any)[column];

      return typeof value === 'number' ? formatNumber(value) : '-';
    }

    if (column === 'lastSeenAt') {
      const seen = row.model.lastSeenAt();

      return seen ? (
        <time datetime={seen.toISOString()} title={seen.toLocaleString()}>
          {shortAge(seen)}
        </time>
      ) : (
        '-'
      );
    }

    return null;
  }
}
