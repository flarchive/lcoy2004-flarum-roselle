/*
 * 首次加载的预加载（服务器上的 `preload` 功能）。
 *
 * 核心已经在 HTML 中提供路由的 `apiDocument`；主题在
 * `payload.lcoyPreload` 中添加页面在启动后立即会发出的请求的响应
 * （个人主页摘要、通知列表、关于、标签的计数）。
 * 每个响应以 API 路径和展平、排序后的参数为键——与
 * `src/Preload/PreloadKey.php` 使用相同的计算方式。
 *
 * 主题没有修改每个页面，而是让 `app.store.find` 和 `app.request`（GET）
 * 在访问网络前查看这里：如果键匹配，就使用准备好的响应
 * 一次。除此之外（应用内导航、其他参数、
 * MAX_AGE_MS 之后），请求照常进行。
 */
import app from 'flarum/forum/app';
import Store from 'flarum/common/Store';
import { override } from 'flarum/common/extend';

/** 超过这个时间后，预加载的数据可能已过时：页面会重新请求。 */
const MAX_AGE_MS = 30_000;

let entries: Record<string, unknown> | null = null;
let bootedAt = 0;

function flatten(value: unknown, prefix: string, pairs: string[]): void {
  if (value === undefined || value === null) return;

  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      flatten(item, prefix ? `${prefix}[${key}]` : key, pairs);
    }

    return;
  }

  // Mithril 也会忽略空值（没有数字的 `page[limit]`）。
  if (value === '') return;

  pairs.push(`${prefix}=${String(value)}`);
}

/** `路径?a=1&b[c]=2`，不编码并按字母顺序排列。 */
export function preloadKey(path: string, params: Record<string, unknown> = {}, extraPairs: string[] = []): string {
  const pairs = [...extraPairs];
  flatten(params, '', pairs);
  pairs.sort();

  return `${path.replace(/^\/+|\/+$/g, '')}?${pairs.join('&')}`;
}

/** 该请求的预加载响应，仅一次；没有时为 null。 */
export function takePreloaded<T = any>(path: string, params: Record<string, unknown> = {}, extraPairs: string[] = []): T | null {
  if (!entries) return null;

  if (Date.now() - bootedAt > MAX_AGE_MS) {
    entries = null;
    return null;
  }

  const key = preloadKey(path, params, extraPairs);

  if (!Object.prototype.hasOwnProperty.call(entries, key)) return null;

  const data = entries[key] as T;
  delete entries[key];

  return data;
}

/** 相对于 API 的路径（`lcoy-about`）和查询参数对，或当 URL 不属于 API 时为 null。 */
function apiPath(url: string): { path: string; pairs: string[] } | null {
  try {
    const target = new URL(url, window.location.href);
    const base = new URL(String(app.forum.attribute('apiUrl') || '/api'), window.location.href);
    const basePath = base.pathname.replace(/\/+$/, '');

    if (target.origin !== base.origin || !target.pathname.startsWith(basePath + '/')) return null;

    const pairs: string[] = [];
    target.searchParams.forEach((value, key) => {
      if (value !== '') pairs.push(`${key}=${value}`);
    });

    return { path: target.pathname.slice(basePath.length + 1), pairs };
  } catch {
    return null;
  }
}

export default function installPreload(): void {
  const data = (app.data as any)?.lcoyPreload;

  // 没有任何预加载内容（大多数路由）：无需拦截。
  if (!data || typeof data !== 'object') return;

  entries = data;
  bootedAt = Date.now();

  override(
    Store.prototype,
    'find',
    function (this: Store, original: (...args: any[]) => any, type: string, idOrParams?: any, query: any = {}, options: any = {}) {
      // id 列表会在内部变成 `filter[id]`：服务器不会预加载这种格式。
      if (entries && !Array.isArray(idOrParams)) {
        const single = typeof idOrParams === 'string' || typeof idOrParams === 'number';
        const preloaded = takePreloaded(single ? `${type}/${idOrParams}` : type, single ? query : idOrParams || {});

        if (preloaded) return Promise.resolve(this.pushPayload(preloaded as any));
      }

      return original(type, idOrParams, query, options);
    }
  );

  override(app, 'request', function (original: (...args: any[]) => any, options: any, ...rest: any[]) {
    if (entries && options && typeof options.url === 'string' && String(options.method || 'GET').toUpperCase() === 'GET') {
      const target = apiPath(options.url);
      const preloaded = target && takePreloaded(target.path, options.params || {}, target.pairs);

      if (preloaded) return Promise.resolve(preloaded);
    }

    return original(options, ...rest);
  });
}
