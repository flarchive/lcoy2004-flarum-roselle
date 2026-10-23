/*
 * 读取用户活跃度统计，用于个人资料摘要。
 *
 * 服务端仅在个人资料响应（用户 Show）中、且功能启用时才下发这些
 * 属性；否则缺失，各函数返回 null，使对应统计直接不显示。关闭
 * flarum-likes 时，点赞数同样为 null。
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

export interface UserActivity {
  /** 至少访问过一次的不同天数。 */
  daysVisited: number | null;
  /** 阅读时长，单位为秒。 */
  timeRead: number | null;
  /** 最近 60 天的阅读时长，单位为秒（Discourse 的“最近”）。 */
  recentTimeRead: number | null;
  postsRead: number | null;
  likesGiven: number | null;
  likesReceived: number | null;
}

/** API 中的属性名——在此记录，供个人资料页及其他区域使用。 */
export const ACTIVITY_ATTRIBUTES: Record<keyof UserActivity, string> = {
  daysVisited: 'lcoyDaysVisited',
  timeRead: 'lcoyTimeRead',
  recentTimeRead: 'lcoyRecentTimeRead',
  postsRead: 'lcoyPostsRead',
  likesGiven: 'lcoyLikesGiven',
  likesReceived: 'lcoyLikesReceived',
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/** 当个人资料尚未携带统计数据（或功能已关闭）时返回 null。 */
export function userActivity(user: User): UserActivity | null {
  if (user.attribute<unknown>('lcoyDaysVisited') === undefined) return null;

  const activity = {} as UserActivity;

  (Object.keys(ACTIVITY_ATTRIBUTES) as (keyof UserActivity)[]).forEach((key) => {
    activity[key] = numberOrNull(user.attribute<unknown>(ACTIVITY_ATTRIBUTES[key]));
  });

  return activity;
}

/**
 * 以 Discourse 的写法表示阅读时长："45 s"、"12 min"、"3 h"、"2 d"。
 * 只用一个单位并取整——摘要用于大致了解，而非精确审计。
 */
export function formatReadTime(seconds: number): string {
  const trans = (key: string, count: number) => app.translator.trans(`lcoy-roselle.forum.stats.duration.${key}`, { count }, true) as string;

  if (seconds < 60) return trans('seconds', Math.max(0, Math.round(seconds)));
  if (seconds < 3600) return trans('minutes', Math.round(seconds / 60));
  if (seconds < 86400) return trans('hours', Math.round((seconds / 3600) * 10) / 10);

  return trans('days', Math.round((seconds / 86400) * 10) / 10);
}
