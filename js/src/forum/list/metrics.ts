/*
 * 列表行中的数字：浏览量（当某个扩展负责计数时）、
 * 计数的 "热度" 区间，以及活动的 "冷度"，对应 Discourse 的 heatmap
 * 和 coldmap。
 */
import type Discussion from 'flarum/common/models/Discussion';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';

import { isExtensionEnabled } from '../utils/settings';

/**
 * fof/discussion-views 自行统计浏览量，并在 `views` 属性中发布该
 * 数字。启用后，主题仍绘制自己的列，
 * 但读取该数字并丢弃扩展放在行中的 "👁" —— 这样
 * 列表只有一列，使用扩展提供的实时数据。
 */
export function pluginProvidesViews(): boolean {
  return isExtensionEnabled('fof-discussion-views');
}

/**
 * 核心不统计浏览量。计数由 fof/discussion-views 负责，它
 * 在 `views` 属性中发布数字；`view_count` 是列名，用于
 * 某些序列化在没有映射的情况下暴露该字段的情况。
 */
const VIEW_ATTRIBUTES = ['views', 'view_count'];

export function discussionViews(discussion: Discussion): number | null {
  for (const name of VIEW_ATTRIBUTES) {
    const value = discussion.attribute<unknown>(name);

    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }

  return null;
}

/** 只有当列表中至少一个讨论带有该数字时，整列才会显示。 */
export function listHasViews(state: DiscussionListState): boolean {
  return state.getPages().some((page) => (page.items as Discussion[]).some((discussion) => discussionViews(discussion) !== null));
}

type Heat = 'low' | 'med' | 'high' | null;

function band(value: number, low: number, med: number, high: number): Heat {
  if (value >= high) return 'high';
  if (value >= med) return 'med';
  if (value >= low) return 'low';

  return null;
}

/**
 * 回复数的区间。Discourse 依据点赞/帖子比率衡量热度，
 * Flarum 没有这个比率，除非安装扩展；回复量是所有论坛都具备的、
 * 最接近 "热烈讨论" 的信号。
 */
export function repliesHeat(count: number): Heat {
  return band(count, 10, 25, 50);
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Discourse 的 coldmap：从创建到最后回复的时间越长，
 * 主题越 "冷" —— 被重新翻出的旧对话会以
 * 与刚刚开始的对话不同的色调显示。
 */
export function activityCold(discussion: Discussion): Heat {
  const created = discussion.createdAt()?.getTime();
  const last = discussion.lastPostedAt()?.getTime();

  if (!created || !last) return null;

  return band((last - created) / DAY, 14, 30, 60);
}
