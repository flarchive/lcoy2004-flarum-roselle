/*
 * 社区页面中的用户组：显示哪些组、每组的地址（/g/:name），
 * 以及从名称回到组的查找路径。
 */
import app from 'flarum/forum/app';
import Group from 'flarum/common/models/Group';
import { slug } from 'flarum/common/utils/string';

import { forumBool } from '../../utils/settings';

/**
 * 论坛已在 payload 中收到的用户组——核心只发送当前用户可见的组
 * （隐藏组对无权查看者不可见）。访客组和成员组被排除：没有人会被
 * 加入这些组，因此没有成员可列出。
 */
export function communityGroups(): Group[] {
  return app.store
    .all<Group>('groups')
    .filter((group) => group.id() !== Group.GUEST_ID && group.id() !== Group.MEMBER_ID)
    .sort((a, b) => {
      // 管理员和版主优先，与 Discourse 列表一致；
      // 其次是管理员的排序（位置），最后按名称。
      const rank = (group: Group) => (group.id() === Group.ADMINISTRATOR_ID ? 0 : group.id() === '4' ? 1 : 2);
      const position = (group: Group) => group.attribute<number | null>('position') ?? Number.MAX_SAFE_INTEGER;

      return rank(a) - rank(b) || position(a) - position(b) || (a.namePlural() || '').localeCompare(b.namePlural() || '');
    });
}

/** “版主” → “moderators”：去除重音后的名称，与 Discourse 在地址中的用法一致。 */
function nameSlug(name: string | undefined): string {
  return slug((name || '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

/**
 * 地址使用名称的复数形式；当名称无法生成有效地址（为空、
 * 仅含符号）时使用 id。由于核心用户组的名称会被翻译，
 * `findGroup` 也接受 id（永不改变）和单数形式。
 */
export function groupSlug(group: Group): string {
  return nameSlug(group.namePlural()) || group.id()!;
}

export function groupUrl(group: Group): string {
  return app.route('lcoy.group', { name: groupSlug(group) });
}

export function findGroup(name: string): Group | null {
  const wanted = decodeURIComponent(name || '').toLowerCase();
  const groups = communityGroups();

  return (
    groups.find((group) => groupSlug(group) === wanted) ||
    groups.find((group) => group.id() === wanted) ||
    groups.find((group) => nameSlug(group.nameSingular()) === wanted) ||
    null
  );
}

export function memberCount(group: Group): number | null {
  const count = group.attribute<number | undefined>('lcoyMemberCount');

  return typeof count === 'number' ? count : null;
}

export function groupsEnabled(): boolean {
  return forumBool('lcoyGroupsEnabled', true);
}
