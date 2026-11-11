/*
 * 统计卡片：浏览列的高亮、新讨论/未读计数（列表）
 * 以及个人主页摘要中的活动。
 */
import { trans } from '../util';
import { AdminNotice, AdminSubGroup } from '../components/AdminCard';
import AdminNumber from '../components/AdminNumber';
import type { CardDef } from '../types';

const KEY = 'lcoy-roselle.admin.settings.stats';

const number = (name: string, range: { min: number; max: number; fallback: number }, label: string, help: string, suffix?: string) => (
  <AdminNumber
    settingKey={`lcoy.${name}`}
    min={range.min}
    max={range.max}
    fallback={range.fallback}
    suffix={suffix}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help, { min: range.min, max: range.max })}
  />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const STATS_CARDS: CardDef[] = [
  {
    id: 'views',
    group: 'list',
    icon: 'far fa-eye',
    title: () => trans(`${KEY}.section_views`, '浏览列高亮'),
    description: help('stats_views_enabled', '列表「浏览」列的高亮颜色（Discourse 的热力图）。浏览数字本身来自 fof/discussion-views。'),
    keywords: '浏览 views 热力 热度 heat heatmap 高亮 highlight topic_views_heat',
    body: () => (
      <AdminSubGroup>
        {number(
          'topic_views_heat_low',
          { min: 1, max: 100000000, fallback: 1000 },
          '轻度高亮起始值',
          '浏览数超过该值后，浏览数字段会略微高亮。Discourse 使用 1000。',
          trans(`${KEY}.views_suffix`, '次浏览')
        )}
        {number(
          'topic_views_heat_medium',
          { min: 1, max: 100000000, fallback: 2000 },
          '中度高亮起始值',
          '浏览数超过该值后，浏览数字段会中度高亮。Discourse 使用 2000。',
          trans(`${KEY}.views_suffix`, '次浏览')
        )}
        {number(
          'topic_views_heat_high',
          { min: 1, max: 100000000, fallback: 3500 },
          '强烈高亮起始值',
          '浏览数超过该值后，浏览数字段会强烈高亮。Discourse 使用 3500。',
          trans(`${KEY}.views_suffix`, '次浏览')
        )}
      </AdminSubGroup>
    ),
  },
  {
    id: 'counts',
    group: 'list',
    icon: 'fas fa-circle-dot',
    title: () => trans(`${KEY}.section_counts`, '新讨论与未读计数'),
    description: help('stats_counts_enabled', '对已登录用户：列表标签页上显示「新 (3)」和「未读 (2)」，侧栏中「全部讨论」旁在有新内容时显示小圆点。'),
    keywords: '新帖 new 未读 unread 计数 count 标签页 tabs 圆点 dot 侧栏 sidebar 主题 topics',
    master: 'lcoy.stats_counts_enabled',
    body: () =>
      number(
        'stats_new_days',
        { min: 0, max: 365, fallback: 2 },
        '讨论保持为新帖的天数',
        '指在该时段内创建、且本人尚未打开过的讨论。设为 0 时，统计自注册或上次「全部标记为已读」以来的全部内容。可选 {min} 到 {max}；Discourse 使用 2。',
        trans(`${KEY}.days_suffix`, '天')
      ),
  },
  {
    id: 'activity',
    group: 'people',
    icon: 'fas fa-chart-simple',
    title: () => trans(`${KEY}.section_activity`, '个人主页活动'),
    description: help(
      'stats_activity_enabled',
      '个人主页摘要中显示访问天数、阅读时长（总计及近 60 天）、已读帖子，以及给出和收到的赞，与 Discourse 一致。'
    ),
    keywords: '活动 activity 摘要 summary 访问天数 days visited 阅读时长 read time 已读帖子 posts read 赞 likes',
    master: 'lcoy.stats_activity_enabled',
    body: () => (
      <AdminNotice>
        {trans(`${KEY}.activity_notice`, '阅读时长只在标签页可见且有人在操作页面时才会计时。各项数据自开启该功能之日起从零开始。')}
      </AdminNotice>
    ),
  },
];

export default STATS_CARDS;
