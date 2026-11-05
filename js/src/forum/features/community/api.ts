/*
 * 社区页面各端点的访问（/api/lcoy-about、
 * /api/lcoy-directory、/api/lcoy-groups/:id/activity）。
 *
 * 它们不是 JSON:API 资源——“关于”页面把数据、文本和
 * 团队合并为一个响应——但用户以资源格式（`type: users`）
 * 返回并进入 store。这样 Avatar、`username()` 以及核心的
 * 个人资料路由对它们就如同对任何其他用户一样有效。
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

export type PeriodKey = 'all' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily';

export const PERIODS: PeriodKey[] = ['all', 'yearly', 'quarterly', 'monthly', 'weekly', 'daily'];

export type StatPeriod = 'day' | 'week' | 'month' | 'all';

export interface AboutPayload {
  aboutHtml: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  members: number;
  createdAt: string | null;
  adminCount: number | null;
  moderatorCount: number | null;
  admins: string[] | null;
  moderators: string[] | null;
  stats: Record<string, Record<StatPeriod, number | null>> | null;
  cachedAt: string;
  included: any[];
}

export interface DirectoryRow {
  user: string;
  topicCount?: number;
  postCount?: number;
  likesReceived?: number;
  likesGiven?: number;
  daysVisited?: number;
  postsRead?: number;
}

export interface DirectoryPayload {
  data: DirectoryRow[];
  included: any[];
  meta: {
    columns: string[];
    period: PeriodKey;
    order: string;
    dir: 'asc' | 'desc';
    page: number;
    perPage: number;
    total: number;
    hasMore: boolean;
  };
}

export interface DirectoryParams {
  period?: PeriodKey;
  order?: string;
  dir?: 'asc' | 'desc';
  q?: string;
  page?: number;
  group?: string;
}

function apiUrl(path: string): string {
  return `${(app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '')}${path}`;
}

/** 将随附返回的用户放入 store，并按 id 返回模型。 */
export function pushUsers(resources: any[]): Record<string, User> {
  const users: Record<string, User> = {};

  resources.forEach((resource) => {
    const user = app.store.pushObject<User>(resource);
    if (user) users[resource.id] = user;
  });

  return users;
}

export function fetchAbout(): Promise<AboutPayload> {
  return app.request<AboutPayload>({ method: 'GET', url: apiUrl('/lcoy-about') });
}

export function fetchDirectory(params: DirectoryParams): Promise<DirectoryPayload> {
  // 空参数不参与拼接：API URL 与由已保存链接生成的 URL 一致，
  // 由服务端应用默认值。
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null));

  return app.request<DirectoryPayload>({ method: 'GET', url: apiUrl('/lcoy-directory'), params: query });
}

export function fetchGroupActivity(groupId: string, page: number): Promise<{ data: string[]; meta: { page: number; hasMore: boolean } }> {
  return app.request({ method: 'GET', url: apiUrl(`/lcoy-groups/${groupId}/activity`), params: { page } });
}
