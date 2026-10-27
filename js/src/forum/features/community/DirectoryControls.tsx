import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Select from 'flarum/common/components/Select';
import type Mithril from 'mithril';

import type DirectoryState from './DirectoryState';
import { PERIODS, type PeriodKey } from './api';
import { t } from '../../utils/settings';

const SEARCH_DELAY_MS = 350;

export interface DirectoryControlsAttrs extends ComponentAttrs {
  state: DirectoryState;
}

/** 时间段、按名称搜索与总数：目录表格上方的工具栏。 */
export default class DirectoryControls extends Component<DirectoryControlsAttrs> {
  searchTimer: ReturnType<typeof setTimeout> | undefined;
  draft: string | null = null;

  onremove(vnode: Mithril.VnodeDOM<DirectoryControlsAttrs, this>) {
    super.onremove(vnode);
    clearTimeout(this.searchTimer);
  }

  view(): Mithril.Children {
    const { state } = this.attrs;
    const options = Object.fromEntries(PERIODS.map((period) => [period, t(`community.users.period.${period}`)]));

    return (
      <div className="LcoyDirectory-controls">
        <div className="LcoyDirectory-filters">
          <Select
            className="LcoyDirectory-period"
            options={options}
            value={state.params.period || 'all'}
            onchange={(value: PeriodKey) => state.setPeriod(value)}
            aria-label={t('community.users.period_label')}
          />
          <label className="LcoyDirectory-search">
            <Icon name="fas fa-magnifying-glass" />
            <input
              className="FormControl"
              type="search"
              placeholder={t('community.users.search_placeholder')}
              aria-label={t('community.users.search_placeholder')}
              value={this.draft ?? state.params.q ?? ''}
              oninput={(event: InputEvent) => this.search((event.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        {state.total !== null && <span className="LcoyDirectory-total">{t('community.users.total', { count: state.total })}</span>}
      </div>
    );
  }

  /** 搜索会等待用户停止输入：每个名称只发一次请求，而非每次按键。 */
  search(value: string): void {
    this.draft = value;
    clearTimeout(this.searchTimer);

    this.searchTimer = setTimeout(() => {
      this.draft = null;
      this.attrs.state.refresh({ q: value.trim() });
    }, SEARCH_DELAY_MS);
  }
}
