/*
 * 统计专用的两个路由，通过 `fetch` 而非 `app.request` 调用。
 *
 * 每次调用 `app.request` 都会关闭当前屏幕上的错误提示；这些请求在
 * 后台自行运行，不能清除用户仍在阅读的提示。`fetch` 还支持
 * `keepalive`，使最后一次阅读时长上报在标签页关闭时仍能发出。
 */
import app from 'flarum/forum/app';

import { takePreloaded } from '../../utils/preload';

function apiUrl(path: string): string {
  const base = (app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '');

  return `${base}/${path}`;
}

export interface TopicCountsResponse {
  new: number;
  unread: number;
  limit: number;
}

/** 无 `tag` 时统计整个论坛；有 `tag` 时仅统计该标签及其子标签。 */
export async function fetchTopicCounts(tag?: string): Promise<TopicCountsResponse | null> {
  // 首次加载某个标签时，计数已随 HTML 下发。
  const preloaded = takePreloaded<TopicCountsResponse>('lcoy-counts', tag ? { tag } : {});
  if (preloaded) return preloaded;

  try {
    const response = await fetch(apiUrl('lcoy-counts' + (tag ? `?tag=${encodeURIComponent(tag)}` : '')), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    return response.ok ? ((await response.json()) as TopicCountsResponse) : null;
  } catch {
    return null;
  }
}

export interface ReadTimePayload {
  discussionId: string;
  seconds: number;
  postIds: string[];
}

export function sendReadTime(payload: ReadTimePayload): void {
  fetch(apiUrl('lcoy-read-time'), {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': app.session.csrfToken || '',
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // 无网络时该时间段的时长会丢失——不值得为此提示。
  });
}
