/*
 * 按时间段的“最佳”，与 Discourse 一致：在“最佳”标签中，一个选择器
 * （全部时间 / 年 / 季度 / 月 / 周 / 今天）将列表限制为在该区间内
 * 创建的主题。
 *
 * 时间段放在 URL 中（`?sort=top&period=monthly`），进入搜索的
 * “粘性”参数，并传到 DiscussionListState，由其转换为核心的
 * `created` 筛选（`YYYY-MM-DD..YYYY-MM-DD`）。因此刷新、后退和
 * 分享链接都会保留该时间段。
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import SelectDropdown from 'flarum/common/components/SelectDropdown';
import LinkButton from 'flarum/common/components/LinkButton';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';
import { lastDaysRange } from '../../utils/dates';

const TOP_SORT = 'top';

/** 时间段 => 往回的天数。`all` 不筛选。 */
export const TOP_PERIODS: Record<string, number> = {
  all: 0,
  yearly: 365,
  quarterly: 90,
  monthly: 30,
  weekly: 7,
  daily: 1,
};

function enabled(): boolean {
  return forumBool('lcoyTopPeriodsEnabled', true);
}

function validPeriod(value: unknown): string | null {
  return typeof value === 'string' && value in TOP_PERIODS && value !== 'all' ? value : null;
}

/** 页面当前使用的排序：来自 URL，若没有则为默认值。 */
function currentSort(): string {
  return app.search.state.params().sort || app.search.state.defaultSort();
}

export default function installTopPeriods(): void {
  extend(GlobalSearchState.prototype, 'stickyParams', function (params: Record<string, any>) {
    if (!enabled()) return;

    const period = validPeriod(m.route.param('period'));

    // 仅当该列表就是“最佳”时才跟随：切换标签时不能把隐藏的日期
    // 筛选带到“最新”。
    if (period && (m.route.param('sort') || app.search.state.defaultSort()) === TOP_SORT) params.period = period;
  });

  extend(DiscussionListState.prototype, 'requestParams', function (this: DiscussionListState, params: Record<string, any>) {
    if (!enabled()) return;

    const own = this.getParams() as Record<string, any>;
    const period = validPeriod(own.period);
    const sort = own.sort || Object.keys(this.sortMap())[0];

    if (!period || sort !== TOP_SORT) return;

    params.filter = { ...params.filter, created: lastDaysRange(TOP_PERIODS[period]) };
  });

  extend(IndexPage.prototype, 'viewItems', function (items: ItemList<Mithril.Children>) {
    if (!enabled() || currentSort() !== TOP_SORT || !(TOP_SORT in app.discussions.sortMap())) return;

    const active = validPeriod(m.route.param('period')) || 'all';
    const routeName = app.current.get('routeName') || 'index';
    const base: Record<string, any> = { ...app.search.state.params() };

    // 空参数只会弄脏 URL（"?q=&filter="）。
    Object.keys(base).forEach((key) => {
      const value = base[key];
      if (value === undefined || value === '' || (typeof value === 'object' && value && !Object.keys(value).length)) delete base[key];
    });

    items.add(
      'lcoyTopPeriod',
      <SelectDropdown
        className="LcoyTopPeriod"
        buttonClassName="Button LcoyTopPeriod-button"
        caretIcon="fas fa-chevron-down"
        accessibleToggleLabel={t('extras.top_periods.label')}
      >
        {Object.keys(TOP_PERIODS).map((period) => {
          const params = { ...base };

          if (period === 'all') delete params.period;
          else params.period = period;

          return (
            <LinkButton href={app.route(routeName, params)} active={period === active} icon={period === active ? 'fas fa-check' : true}>
              {t(`extras.top_periods.${period}`)}
            </LinkButton>
          );
        })}
      </SelectDropdown>,
      // 紧接在核心的排序（100）之后，主题会隐藏它。
      90
    );
  });
}
