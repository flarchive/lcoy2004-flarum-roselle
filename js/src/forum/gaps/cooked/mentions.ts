/*
 * 点击 @某某 提及会打开用户卡片，与 Discourse 一致——
 * 即帖子头像所用的同一个卡片。Ctrl/Cmd+点击仍然在新标签页
 * 打开个人资料。
 *
 * 提及链接只带个人资料地址（/u/slug）：用户已加载时从 store 取，
 * 否则按 slug 从 API 取。
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import { openUserCard } from '../../topic/components/UserCardPopover';
import { gaps } from '../settings';

const MENTION = '.Post-body a.UserMention, .LcoyEmbeddedPost-body a.UserMention';

export function slugFrom(link: HTMLAnchorElement): string | null {
  try {
    const path = new URL(link.href, window.location.href).pathname;
    const match = path.match(/\/u\/([^/]+)\/?$/);

    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function findUser(slug: string): Promise<User | null> {
  const lower = slug.toLowerCase();
  const cached = app.store
    .all<User>('users')
    .find((user) => String(user.slug()).toLowerCase() === lower || String(user.username()).toLowerCase() === lower);

  if (cached) return Promise.resolve(cached);

  return app.store
    .find<User>('users', slug, { bySlug: true } as any, { errorHandler: () => {} } as any)
    .then((user: any) => user || null)
    .catch(() => null);
}

function onClick(event: MouseEvent): void {
  if (!gaps.mentionCards()) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = (event.target as HTMLElement | null)?.closest?.(MENTION) as HTMLAnchorElement | null;

  if (!link) return;

  const slug = slugFrom(link);

  if (!slug) return;

  event.preventDefault();
  event.stopPropagation();

  findUser(slug).then((user) => {
    // 没有用户（已删除、无权限）时，链接退化为普通链接。
    if (user) openUserCard(user, link);
    else window.location.href = link.href;
  });
}

export default function installMentionCards(): void {
  // 在捕获阶段：包裹帖子的 Mithril Link 会先导航。
  document.addEventListener('click', onClick, true);
}
